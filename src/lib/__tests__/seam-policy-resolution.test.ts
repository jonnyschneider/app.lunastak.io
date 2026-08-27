/**
 * The seam resolves stage config from the policy, and refuses a request it
 * cannot size.
 *
 * `import_dimension_tagging` computes `Math.max(4000, batchChunks.length * 150)`
 * at its call site — a per-batch number no static policy can express. It is
 * declared `maxTokens: 'per-call'`, and the seam THROWS if the call site then
 * fails to pass one. The alternative — quietly falling back to a default — would
 * truncate a batch sized for more, and truncation on a tagging stage looks like
 * missing tags rather than an error.
 *
 * Everything else ignores a passed max_tokens entirely: the policy is the
 * authority, and a call site that thinks otherwise is the drift this seam
 * exists to remove.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
  },
}))
vi.mock('@/lib/db', () => ({ prisma: { user: { update: vi.fn() } } }))
vi.mock('@/lib/experiment/capture', () => ({ captureCall: vi.fn() }))

process.env.ANTHROPIC_API_KEY ||= 'test-key'

const load = async () => (await import('@/lib/claude')).createMessage

const okResponse = {
  content: [{ type: 'text', text: 'ok' }],
  usage: { input_tokens: 1, output_tokens: 1 },
  stop_reason: 'end_turn',
  model: 'claude-sonnet-5',
}

describe('per-call max_tokens', () => {
  beforeEach(() => {
    create.mockReset()
    create.mockResolvedValue(okResponse)
  })

  it('throws when a per-call stage passes no max_tokens', async () => {
    const createMessage = await load()
    await expect(
      createMessage({ messages: [{ role: 'user', content: 'x' }] }, 'import_dimension_tagging'),
    ).rejects.toThrow(/per-call/)
    expect(create, 'it must refuse before spending a request').not.toHaveBeenCalled()
  })

  it('honours the passed value for a per-call stage', async () => {
    const createMessage = await load()
    await createMessage(
      { messages: [{ role: 'user', content: 'x' }], max_tokens: 9000 },
      'import_dimension_tagging',
    )
    // maxTokensFor() adds thinking headroom on top of the visible budget.
    expect(create.mock.calls[0][0].max_tokens).toBeGreaterThanOrEqual(9000)
  })

  it('ignores a passed max_tokens on a stage the policy sizes', async () => {
    const createMessage = await load()
    // The type permits max_tokens on any stage — it cannot narrow on the
    // policy's 'per-call' discriminant — so this one is enforced at runtime.
    await createMessage(
      { messages: [{ role: 'user', content: 'x' }], max_tokens: 999999 },
      'conversation_title',
    )
    expect(create.mock.calls[0][0].max_tokens).toBeLessThan(999999)
  })
})

describe('the system block is seam-assembled', () => {
  beforeEach(() => {
    create.mockReset()
    create.mockResolvedValue(okResponse)
  })

  it('sends the governed guidance on a prose stage', async () => {
    const createMessage = await load()
    await createMessage({ messages: [{ role: 'user', content: 'x' }] }, 'full_synthesis')
    expect(create.mock.calls[0][0].system).toContain('Voice Constraint')
  })

  it('omits system entirely on a structured stage, rather than sending an empty string', async () => {
    const createMessage = await load()
    await createMessage({ messages: [{ role: 'user', content: 'x' }] }, 'extraction')
    expect(create.mock.calls[0][0]).not.toHaveProperty('system')
  })
})

/**
 * promptHash — the provenance stamp that replaced the prompt registry.
 *
 * It hashes the RESOLVED request (system block + user content), so it changes
 * when the guidance changes. That is the property that makes it useful: a
 * prompt edit becomes visible in the cost data instead of being invisible.
 */
describe('promptHash provenance', () => {
  let hashes: string[]

  const call = async (context: Parameters<Awaited<ReturnType<typeof load>>>[1], content: string) => {
    const createMessage = await load()
    await createMessage({ messages: [{ role: 'user', content }] }, context)
    const { captureCall } = await import('@/lib/experiment/capture')
    const calls = (captureCall as ReturnType<typeof vi.fn>).mock.calls
    return calls[calls.length - 1][0].promptHash as string
  }

  beforeEach(async () => {
    create.mockReset()
    create.mockResolvedValue(okResponse)
    const { captureCall } = await import('@/lib/experiment/capture')
    ;(captureCall as ReturnType<typeof vi.fn>).mockClear()
    hashes = []
  })

  it('is stable for the same resolved request', async () => {
    hashes.push(await call('full_synthesis', 'same input'))
    hashes.push(await call('full_synthesis', 'same input'))
    expect(hashes[0]).toBe(hashes[1])
    expect(hashes[0]).toMatch(/^[0-9a-f]{16}$/)
  })

  it('differs when the user content differs', async () => {
    hashes.push(await call('full_synthesis', 'input one'))
    hashes.push(await call('full_synthesis', 'input two'))
    expect(hashes[0]).not.toBe(hashes[1])
  })

  it('differs across stages with the same user content — the guidance is in the hash', async () => {
    hashes.push(await call('full_synthesis', 'identical')) // question-gap guidance
    hashes.push(await call('extraction', 'identical'))     // no guidance at all
    expect(hashes[0]).not.toBe(hashes[1])
  })
})
