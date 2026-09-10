/**
 * Post-hoc template extraction — reverse-extracts fragments from a strategy the user typed in.
 *
 * This used to be a route the executor `fetch`ed server-to-server with no cookies, which meant it
 * could never sit behind the auth guard (and anyone could POST to it). It is now a pipeline
 * library function the executor calls directly; these cases pin the behaviour it carried over.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StrategyStatements } from '@/lib/types'

const createMessage = vi.fn()
const createFragmentsFromThemes = vi.fn()
const conversationFindFirst = vi.fn()
const traceFindUnique = vi.fn()

vi.mock('@/lib/claude', () => ({
  createMessage: (...a: unknown[]) => createMessage(...a),
}))
vi.mock('@/lib/fragments', () => ({
  createFragmentsFromThemes: (...a: unknown[]) => createFragmentsFromThemes(...a),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: { findFirst: (...a: unknown[]) => conversationFindFirst(...a) },
    trace: { findUnique: (...a: unknown[]) => traceFindUnique(...a) },
  },
}))

import { extractFromTemplate } from '@/lib/pipeline/extract-from-template'

const statements: StrategyStatements = {
  vision: 'Every team runs on a strategy it can state',
  strategy: 'Win mid-market ops leaders by coaching, not templates',
  objectives: [],
  opportunities: [],
  principles: [],
}

const themes = [
  { theme_name: 'Mid-market focus', content: 'Ops leaders', dimensions: [{ name: 'customer_market', confidence: 'HIGH' }] },
  { theme_name: 'Coaching', content: 'Not templates', dimensions: [{ name: 'differentiation_advantage', confidence: 'MEDIUM' }] },
]

function replyWith(text: string) {
  createMessage.mockResolvedValue({ content: [{ type: 'text', text }] })
}

describe('extractFromTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createFragmentsFromThemes.mockImplementation(async (_p: string, _c: string, t: unknown[]) => t.map((_, i) => ({ id: `f${i}` })))
  })

  it('writes fragments against the synthetic template conversation when it exists', async () => {
    replyWith(`Here you go:\n${JSON.stringify(themes)}`)
    conversationFindFirst.mockResolvedValue({ id: 'template-trace-1' })

    const result = await extractFromTemplate({ projectId: 'proj-1', traceId: 'trace-1', statements })

    expect(createFragmentsFromThemes).toHaveBeenCalledWith('proj-1', 'template-trace-1', themes)
    expect(traceFindUnique).not.toHaveBeenCalled()
    expect(result).toEqual({ fragmentsCreated: 2 })
  })

  it("falls back to the trace's conversation when there is no synthetic one", async () => {
    replyWith(JSON.stringify(themes))
    conversationFindFirst.mockResolvedValue(null)
    traceFindUnique.mockResolvedValue({ conversationId: 'conv-real' })

    const result = await extractFromTemplate({ projectId: 'proj-1', traceId: 'trace-1', statements })

    expect(createFragmentsFromThemes).toHaveBeenCalledWith('proj-1', 'conv-real', themes)
    expect(result).toEqual({ fragmentsCreated: 2 })
  })

  it('goes through createMessage as template_extraction with no userId — guest quota untouched (D4)', async () => {
    replyWith(JSON.stringify(themes))
    conversationFindFirst.mockResolvedValue({ id: 'template-trace-1' })

    await extractFromTemplate({ projectId: 'proj-1', traceId: 'trace-1', statements })

    expect(createMessage).toHaveBeenCalledTimes(1)
    const args = createMessage.mock.calls[0]
    expect(args[1]).toBe('template_extraction')
    expect(args).toHaveLength(2)
  })

  it('writes nothing when no themes come back', async () => {
    replyWith('[]')

    const result = await extractFromTemplate({ projectId: 'proj-1', traceId: 'trace-1', statements })

    expect(result).toEqual({ fragmentsCreated: 0 })
    expect(createFragmentsFromThemes).not.toHaveBeenCalled()
  })

  it('writes nothing when the reply is not parsable JSON', async () => {
    replyWith('[ not json at all ]')

    const result = await extractFromTemplate({ projectId: 'proj-1', traceId: 'trace-1', statements })

    expect(result).toEqual({ fragmentsCreated: 0 })
    expect(createFragmentsFromThemes).not.toHaveBeenCalled()
  })
})
