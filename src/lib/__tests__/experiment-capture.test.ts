/**
 * Stage capture for the model-bump experiment.
 *
 * Phase 1 records each stage's resolved request + response so Phase 2 can
 * replay the identical payload against the other arms. Two hard requirements:
 *
 * 1. OFF unless explicitly enabled — this writes prompts (and therefore user
 *    content) to disk, so it must never be on by accident in production.
 * 2. It must NEVER break the API call. A capture failure during a paid run
 *    that loses the user's generation would be far worse than losing the
 *    measurement.
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { captureCall, isCaptureEnabled } from '@/lib/experiment/capture'

const sampleResponse = {
  model: 'claude-opus-5',
  stop_reason: 'end_turn',
  usage: { input_tokens: 1200, output_tokens: 340 },
  content: [{ type: 'text', text: 'the generated strategy' }],
}

describe('isCaptureEnabled', () => {
  const saved = { ...process.env }
  afterEach(() => { process.env = { ...saved }; vi.unstubAllEnvs() })

  it('is off by default', () => {
    delete process.env.LUNASTAK_CAPTURE_DIR
    expect(isCaptureEnabled()).toBe(false)
  })

  it('is on when a capture dir is set', () => {
    process.env.LUNASTAK_CAPTURE_DIR = '/tmp/whatever'
    expect(isCaptureEnabled()).toBe(true)
  })

  it('REFUSES to enable in production, even when the env var is set', () => {
    // Capture writes prompts — and therefore user content — to disk. In a
    // deployed environment that is both useless (ephemeral filesystem) and a
    // privacy problem. The gate is structural, not documentary: setting the
    // env var in production must do nothing.
    process.env.LUNASTAK_CAPTURE_DIR = '/tmp/whatever'
    vi.stubEnv('NODE_ENV', 'production')
    expect(isCaptureEnabled()).toBe(false)
  })
})

describe('captureCall', () => {
  const saved = { ...process.env }
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-test-'))
    process.env.LUNASTAK_CAPTURE_DIR = dir
  })

  afterEach(() => {
    process.env = { ...saved }
    vi.unstubAllEnvs()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writes nothing when disabled', () => {
    delete process.env.LUNASTAK_CAPTURE_DIR
    captureCall({
      context: 'strategy_generation',
      request: { model: 'claude-opus-5', max_tokens: 4000, messages: [] },
      response: sampleResponse,
      latencyMs: 1234,
    })
    expect(fs.readdirSync(dir)).toHaveLength(0)
  })

  it('records the resolved request so it can be replayed verbatim', () => {
    const request = { model: 'claude-opus-5', max_tokens: 4000, messages: [{ role: 'user', content: 'hi' }] }
    captureCall({ context: 'strategy_generation', request, response: sampleResponse, latencyMs: 1234 })

    const files = fs.readdirSync(dir)
    expect(files).toHaveLength(1)

    const rec = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'))
    expect(rec.context).toBe('strategy_generation')
    expect(rec.request).toEqual(request)
  })

  it('records the metrics the comparison is scored on', () => {
    captureCall({ context: 'extraction', request: { model: 'claude-opus-5', max_tokens: 2000, messages: [] }, response: sampleResponse, latencyMs: 987 })

    const rec = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8'))
    expect(rec.model).toBe('claude-opus-5')
    expect(rec.inputTokens).toBe(1200)
    expect(rec.outputTokens).toBe(340)
    expect(rec.latencyMs).toBe(987)
    expect(rec.stopReason).toBe('end_turn')
    expect(rec.text).toBe('the generated strategy')
  })

  it('flags truncation explicitly — a truncated output must not be scored', () => {
    captureCall({
      context: 'conversation_title',
      request: { model: 'claude-opus-5', max_tokens: 30, messages: [] },
      response: { ...sampleResponse, stop_reason: 'max_tokens' },
      latencyMs: 100,
    })

    const rec = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8'))
    expect(rec.truncated).toBe(true)
  })

  it('does not collide when several calls share a context', () => {
    const req = { model: 'claude-opus-5', max_tokens: 2000, messages: [] }
    captureCall({ context: 'extraction', request: req, response: sampleResponse, latencyMs: 1 })
    captureCall({ context: 'extraction', request: req, response: sampleResponse, latencyMs: 2 })

    expect(fs.readdirSync(dir)).toHaveLength(2)
  })

  it('NEVER throws, even when the capture dir is unwritable', () => {
    process.env.LUNASTAK_CAPTURE_DIR = '/proc/nonexistent-and-unwritable'
    expect(() => captureCall({
      context: 'extraction',
      request: { model: 'claude-opus-5', max_tokens: 2000, messages: [] },
      response: sampleResponse,
      latencyMs: 1,
    })).not.toThrow()
  })

  it('writes nothing in production even with a valid dir configured', () => {
    vi.stubEnv('NODE_ENV', 'production')
    captureCall({
      context: 'strategy_generation',
      request: { model: 'claude-opus-5', max_tokens: 4000, messages: [{ role: 'user', content: 'private user content' }] },
      response: sampleResponse,
      latencyMs: 1,
    })
    expect(fs.readdirSync(dir)).toHaveLength(0)
  })

  it('NEVER throws on an unexpected response shape', () => {
    expect(() => captureCall({
      context: 'extraction',
      request: { model: 'claude-opus-5', max_tokens: 2000, messages: [] },
      response: {} as never,
      latencyMs: 1,
    })).not.toThrow()
  })
})
