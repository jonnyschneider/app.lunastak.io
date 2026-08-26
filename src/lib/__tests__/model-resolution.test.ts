/**
 * Model resolution + sampling-param compatibility.
 *
 * Phase 0 of the model-bump experiment (desk #15, design doc
 * docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md).
 *
 * Two invariants this locks down:
 *
 * 1. The model is resolvable PER CONTEXT via env, so the experiment can run
 *    three arms (and later a mixed per-stage map) without a code change.
 * 2. Sampling params (temperature/top_p/top_k) are stripped for models that
 *    reject them (the Claude 5 family returns 400), and PRESERVED for models
 *    that accept them — so arm A (the control) keeps shipping behaviour
 *    exactly.
 */

import { modelFor, supportsSamplingParams, stripUnsupportedParams, DEFAULT_MODEL } from '@/lib/model-config'

describe('modelFor', () => {
  const saved = { ...process.env }

  afterEach(() => {
    process.env = { ...saved }
  })

  it('defaults to the shipping control model when no override is set', () => {
    delete process.env.LUNASTAK_MODEL
    expect(modelFor('strategy_generation')).toBe(DEFAULT_MODEL)
    expect(DEFAULT_MODEL).toBe('claude-sonnet-4-5-20250929')
  })

  it('applies a global override to every context', () => {
    process.env.LUNASTAK_MODEL = 'claude-opus-5'
    expect(modelFor('strategy_generation')).toBe('claude-opus-5')
    expect(modelFor('conversation_title')).toBe('claude-opus-5')
  })

  it('lets a per-context override beat the global override', () => {
    process.env.LUNASTAK_MODEL = 'claude-sonnet-5'
    process.env.LUNASTAK_MODEL_STRATEGY_GENERATION = 'claude-opus-5'
    expect(modelFor('strategy_generation')).toBe('claude-opus-5')
    expect(modelFor('conversation_title')).toBe('claude-sonnet-5')
  })

  it('falls back to the default for an unknown or missing context', () => {
    delete process.env.LUNASTAK_MODEL
    expect(modelFor('not_a_real_stage')).toBe(DEFAULT_MODEL)
    expect(modelFor(undefined)).toBe(DEFAULT_MODEL)
  })
})

describe('supportsSamplingParams', () => {
  it('is false for the Claude 5 family, which rejects them with a 400', () => {
    expect(supportsSamplingParams('claude-opus-5')).toBe(false)
    expect(supportsSamplingParams('claude-sonnet-5')).toBe(false)
    expect(supportsSamplingParams('claude-fable-5')).toBe(false)
    expect(supportsSamplingParams('claude-opus-4-8')).toBe(false)
    expect(supportsSamplingParams('claude-sonnet-4-6')).toBe(false)
  })

  it('is true for the models that still accept them', () => {
    expect(supportsSamplingParams('claude-sonnet-4-5-20250929')).toBe(true)
    expect(supportsSamplingParams('claude-sonnet-4-20250514')).toBe(true)
    expect(supportsSamplingParams('claude-haiku-4-5')).toBe(true)
  })
})

describe('stripUnsupportedParams', () => {
  it('removes sampling params for a Claude 5 model', () => {
    const out = stripUnsupportedParams({
      model: 'claude-opus-5',
      max_tokens: 100,
      temperature: 0.7,
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(out).not.toHaveProperty('temperature')
    expect(out.model).toBe('claude-opus-5')
    expect(out.max_tokens).toBe(100)
  })

  it('removes top_p and top_k too', () => {
    const out = stripUnsupportedParams({
      model: 'claude-sonnet-5',
      max_tokens: 100,
      temperature: 0.3,
      top_p: 0.9,
      top_k: 40,
      messages: [],
    })

    expect(out).not.toHaveProperty('temperature')
    expect(out).not.toHaveProperty('top_p')
    expect(out).not.toHaveProperty('top_k')
  })

  it('PRESERVES sampling params for the control model — the baseline must not drift', () => {
    const out = stripUnsupportedParams({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      temperature: 0.7,
      messages: [],
    })

    expect(out.temperature).toBe(0.7)
  })

  it('does not mutate the caller’s params object', () => {
    const input = {
      model: 'claude-opus-5',
      max_tokens: 100,
      temperature: 0.7,
      messages: [],
    }

    stripUnsupportedParams(input)
    expect((input as { temperature?: number }).temperature).toBe(0.7)
  })
})
