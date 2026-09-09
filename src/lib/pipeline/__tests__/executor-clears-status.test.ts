/**
 * A plan that generates nothing must still leave the project idle.
 *
 * `setGenerationStatus(projectId, null)` lived in exactly three places, all inside
 * `pipeline/generation.ts` — so the busy flag cleared only when a generation completed. That was
 * invisible while every plan generated. The ground-truth review split makes an initial
 * conversation plan `generation: null`, and without this the project polls 'generating' forever
 * and the UI never leaves its busy state.
 *
 * Same class as the two silent-degradation defects already on this thread: a required step that
 * only ran on the happy path.
 *
 * ⚠ AND it must clear ONLY a flag this run set (`ownsGenerationStatus`). The condition is on the
 * plan but the write is on the project, so an unconditional clear reaches a CONCURRENT run's
 * flag: a document upload or follow-up extraction finishing inside a `generate_from_knowledge`
 * window nulls that run's status, stopping the client polling mid-generation and lifting the
 * `409 already_generating` guard at the same moment — re-opening the double-generation the guard
 * exists to prevent (observed 2026-09-08: v2 then v3). Found by architecture review, same day.
 *
 * The two cases below are the whole contract: clear when it is ours, never when it is not.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const setGenerationStatus = vi.fn()
const projectUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { update: (...a: unknown[]) => projectUpdate(...a), findUniqueOrThrow: vi.fn() },
    message: { findMany: vi.fn().mockResolvedValue([]) },
    fragment: { count: vi.fn().mockResolvedValue(0) },
  },
}))
vi.mock('@/lib/decision-stack', () => ({
  setGenerationStatus: (...a: unknown[]) => setGenerationStatus(...a),
  writeStrategyToStack: vi.fn(),
  captureSnapshot: vi.fn(),
}))
vi.mock('@/lib/fragments', () => ({
  createFragmentsFromThemes: vi.fn().mockResolvedValue([]),
  createFragmentsFromDocument: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/synthesis', () => ({ updateAllSyntheses: vi.fn() }))
vi.mock('@/lib/knowledge-summary', () => ({ generateKnowledgeSummary: vi.fn() }))
vi.mock('@/lib/background-tasks', () => ({ runBackgroundTasks: vi.fn() }))
vi.mock('@/lib/pipeline/generation', () => ({
  runInitialGeneration: vi.fn(),
  runRefreshGeneration: vi.fn(),
  runOpportunityGeneration: vi.fn(),
}))

import { executePipeline } from '@/lib/pipeline/executor'
import type { PipelinePlan, PipelineTrigger } from '@/lib/pipeline/types'

const plan: PipelinePlan = {
  trigger: 'conversation_ended',
  extraction: { approach: 'emergent', source: 'conversation' },
  persistFragments: true,
  runSynthesis: false,
  runKnowledgeSummary: false,
  generation: null,
  model: 'claude-sonnet-5',
  backgroundSteps: [],
}

const trigger: PipelineTrigger = {
  type: 'conversation_ended',
  projectId: 'proj-1',
  conversationId: 'conv-1',
  userId: 'user-1',
  isInitial: true,
  experimentVariant: null,
}

describe('executePipeline and the busy flag on a plan that does not generate', () => {
  beforeEach(() => {
    setGenerationStatus.mockClear()
    projectUpdate.mockClear()
  })

  it('clears generationStatus when generation is null AND this run set the flag', async () => {
    await executePipeline(plan, trigger, { ownsGenerationStatus: true })
    expect(setGenerationStatus).toHaveBeenCalledWith('proj-1', null)
  })

  it('does NOT clear a flag this run did not set — it may belong to a concurrent generation', async () => {
    await executePipeline(plan, trigger)
    expect(setGenerationStatus).not.toHaveBeenCalled()
  })
})
