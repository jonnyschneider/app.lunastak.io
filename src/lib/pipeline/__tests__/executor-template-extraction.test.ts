/**
 * A `template_submitted` plan schedules post-hoc extraction by calling the pipeline function
 * directly — not by `fetch`ing its own API. The self-fetch carried no cookies, so the route it hit
 * could never be guarded; this pins that the background task reaches the library with the
 * trace the template run just wrote.
 */
import { describe, it, expect, vi } from 'vitest'
import type { PipelinePlan, PipelineTrigger } from '@/lib/pipeline/types'
import type { StrategyStatements } from '@/lib/types'

const extractFromTemplate = vi.fn()
const runBackgroundTasks = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: { create: vi.fn().mockResolvedValue({ id: 'conv-1' }) },
    trace: { create: vi.fn().mockResolvedValue({ id: 'trace-1' }) },
    project: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    fragment: { count: vi.fn().mockResolvedValue(0) },
  },
}))
vi.mock('@/lib/decision-stack', () => ({
  setGenerationStatus: vi.fn(),
  writeStrategyToStack: vi.fn(),
  captureSnapshot: vi.fn(),
}))
vi.mock('@/lib/fragments', () => ({
  createFragmentsFromThemes: vi.fn(),
  createFragmentsFromDocument: vi.fn(),
}))
vi.mock('@/lib/synthesis', () => ({ updateAllSyntheses: vi.fn() }))
vi.mock('@/lib/knowledge-summary', () => ({ generateKnowledgeSummary: vi.fn() }))
vi.mock('@/lib/background-tasks', () => ({ runBackgroundTasks: (...a: unknown[]) => runBackgroundTasks(...a) }))
vi.mock('@/lib/pipeline/generation', () => ({
  runInitialGeneration: vi.fn(),
  runRefreshGeneration: vi.fn(),
  runOpportunityGeneration: vi.fn(),
}))
vi.mock('@/lib/pipeline/extract-from-template', () => ({
  extractFromTemplate: (...a: unknown[]) => extractFromTemplate(...a),
}))

import { executePipeline } from '@/lib/pipeline/executor'

const statements: StrategyStatements = {
  vision: 'v', strategy: 's', objectives: [], opportunities: [], principles: [],
}

const plan: PipelinePlan = {
  trigger: 'template_submitted',
  extraction: null,
  persistFragments: false,
  runSynthesis: false,
  runKnowledgeSummary: false,
  generation: { mode: 'template', source: 'user_input' },
  model: 'claude-sonnet-5',
  backgroundSteps: ['extractFromTemplate'],
}

const trigger: PipelineTrigger = {
  type: 'template_submitted',
  projectId: 'proj-1',
  userId: 'user-1',
  statements,
}

describe('executePipeline on a template plan', () => {
  it('runs extractFromTemplate in the background, directly, with the new trace', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await executePipeline(plan, trigger)

    expect(runBackgroundTasks).toHaveBeenCalledTimes(1)
    const { tasks } = runBackgroundTasks.mock.calls[0][0] as { tasks: { name: string; fn: () => Promise<void> }[] }
    expect(tasks.map(t => t.name)).toEqual(['extractFromTemplate'])

    await tasks[0].fn()

    expect(extractFromTemplate).toHaveBeenCalledWith({ projectId: 'proj-1', traceId: 'trace-1', statements })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
