/**
 * Layer 1 of the executor: reading the transcript to verify evidence spans must never be able to
 * cost us the fragments.
 *
 * The transcript read is SUPPLEMENTARY — it exists only so spans can be checked at ingest. The
 * fragments are the primary artefact of an extraction. A transient failure on the read must
 * therefore degrade the check (`unverifiable` — "could not be checked", which is literally true)
 * and NOT discard the extraction, which is what happens if both live under one try/catch.
 */
import { executePipeline } from '@/lib/pipeline/executor'
import type { PipelinePlan, PipelineTrigger } from '@/lib/pipeline/types'
import { prisma } from '@/lib/db'
import { createFragmentsFromThemes } from '@/lib/fragments'

vi.mock('@/lib/db', () => ({
  prisma: {
    message: { findMany: vi.fn() },
    project: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    fragment: { count: vi.fn() },
  },
}))

vi.mock('@/lib/fragments', () => ({
  createFragmentsFromThemes: vi.fn(),
  createFragmentsFromDocument: vi.fn(),
}))

vi.mock('@/lib/synthesis', () => ({ updateAllSyntheses: vi.fn() }))
vi.mock('@/lib/knowledge-summary', () => ({ generateKnowledgeSummary: vi.fn() }))
vi.mock('@/lib/background-tasks', () => ({ runBackgroundTasks: vi.fn() }))
vi.mock('@/lib/pipeline/generation', () => ({
  runInitialGeneration: vi.fn(),
  runRefreshGeneration: vi.fn(),
  runOpportunityGeneration: vi.fn(),
}))

const mockPrisma = prisma as unknown as {
  message: { findMany: any }
  project: { findUniqueOrThrow: any; update: any }
  fragment: { count: any }
}
const mockCreate = createFragmentsFromThemes as unknown as any

const plan: PipelinePlan = {
  trigger: 'conversation_ended',
  extraction: { approach: 'emergent', source: 'conversation' },
  persistFragments: true,
  runSynthesis: false,
  runKnowledgeSummary: false,
  generation: null,
  model: 'test-model',
  backgroundSteps: [],
}

const trigger: PipelineTrigger = {
  type: 'conversation_ended',
  projectId: 'p1',
  conversationId: 'c1',
  userId: 'u1',
  isInitial: true,
  experimentVariant: null,
  extractionResult: {
    extractedContext: {} as never,
    themes: [{ theme_name: 'T', content: 'c' }] as never,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }])
  mockPrisma.project.findUniqueOrThrow.mockResolvedValue({ knowledgeUpdatedAt: new Date() })
  mockPrisma.fragment.count.mockResolvedValue(0)
})

describe('executePipeline — the transcript read is supplementary', () => {
  it('passes the joined transcript through when the read succeeds', async () => {
    mockPrisma.message.findMany.mockResolvedValue([
      { role: 'user', content: 'we lose deals in procurement' },
      { role: 'assistant', content: 'so the constraint is the buying cycle' },
    ])

    const result = await executePipeline(plan, trigger)

    expect(result.fragmentsCreated).toBe(2)
    expect(mockCreate.mock.calls[0][3]).toEqual({
      user: 'we lose deals in procurement',
      assistant: 'so the constraint is the buying cycle',
    })
  })

  it('still writes the fragments when the transcript read fails, with no source', async () => {
    mockPrisma.message.findMany.mockRejectedValue(new Error('connection reset'))

    const result = await executePipeline(plan, trigger)

    // The primary artefact survives...
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(result.fragmentsCreated).toBe(2)
    // ...and the check degrades honestly: no source, so the spans store as `unverifiable`.
    expect(mockCreate.mock.calls[0][3]).toBeNull()
  })

  it('reports zero when the fragment WRITE itself fails (unchanged behaviour)', async () => {
    mockPrisma.message.findMany.mockResolvedValue([])
    mockCreate.mockRejectedValue(new Error('write failed'))

    const result = await executePipeline(plan, trigger)

    expect(result.fragmentsCreated).toBe(0)
  })
})
