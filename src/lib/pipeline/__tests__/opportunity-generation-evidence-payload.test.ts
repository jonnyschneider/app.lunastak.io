/**
 * Opportunity generation reads the Evidence table (§18/§20 of the ground-truth preflight design).
 *
 * §2 traced where inventions are born by stage: the fabricated numbers — `8–15 hours`, `30–50%`,
 * `Baseline: 0%`, `Target: 50%` — appear ONLY at `opportunity_generation`. The defect here has a
 * specific shape (invented metrics), and this stage is the last generation path still composed
 * entirely of Lunastak's own paraphrases of the user.
 *
 * Unlike initial generation, this stage reads BOTH fragments and dimensional syntheses, and
 * synthesis already carries evidence (`452afd5`). So the user's words reach this payload twice, in
 * two forms: prose already digested through a summary, and raw spans marked as the user's own
 * words. They are different representations — the summary is an interpretation, the spans are the
 * thing being interpreted — and the marking is exactly what §18 measured as load-bearing. The raw
 * spans are what the metric-writing step needs: a number can only be grounded in the sentence the
 * user actually said it in.
 *
 * The rendering is `renderEvidence` — the same helper synthesis and initial generation use,
 * unchanged. What is pinned here is the PAYLOAD: fragments in this stage carry a `- [contentType]`
 * bullet prefix and are joined by single newlines, so a multi-line evidence block sits INSIDE a
 * bullet list. That is accepted deliberately (the block is self-delimiting: labelled header plus
 * `>` markers) and the literal two-fragment string below exists so a human can judge it.
 *
 * Non-negotiable: a fragment with no usable evidence renders BYTE-IDENTICALLY to the pre-change
 * payload. Nearly every production fragment has zero evidence rows and there is no backfill.
 */
const createMessageMock = vi.fn()

vi.mock('@/lib/claude', () => ({
  createMessage: (...args: unknown[]) => createMessageMock(...args),
  CLAUDE_MODEL: 'claude-sonnet-4-5-20250929',
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    fragment: { findMany: vi.fn() },
    dimensionalSynthesis: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/decision-stack', () => ({
  getStrategyStatements: vi.fn(),
  writeOpportunitiesToStack: vi.fn(),
  captureSnapshot: vi.fn(),
  setGenerationStatus: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({ notifySlackOpportunitiesGenerated: vi.fn() }))

import { prisma } from '@/lib/db'
import { getStrategyStatements } from '@/lib/decision-stack'
import { runOpportunityGeneration } from '@/lib/pipeline/generation'

const mockPrisma = prisma as unknown as {
  fragment: { findMany: any }
  dimensionalSynthesis: { findMany: any }
  user: { findUnique: any }
}

const CLAUDE_RESPONSE = {
  content: [{ type: 'text', text: '<opportunities></opportunities>' }],
  model: 'test-model',
  usage: { input_tokens: 1, output_tokens: 1 },
}

type Span = { text: string; verification: string }

function fragment(content: string, evidence: Span[] = [], contentType = 'insight') {
  return { content, contentType, evidence }
}

beforeEach(() => {
  vi.clearAllMocks()
  createMessageMock.mockResolvedValue(CLAUDE_RESPONSE)
  mockPrisma.dimensionalSynthesis.findMany.mockResolvedValue([])
  mockPrisma.user.findUnique.mockResolvedValue(null)
  ;(getStrategyStatements as any).mockResolvedValue({
    vision: 'V',
    strategy: 'S',
    objectives: [],
  })
})

/** The prompt string handed to createMessage. */
async function promptFor(fragments: ReturnType<typeof fragment>[]): Promise<string> {
  mockPrisma.fragment.findMany.mockResolvedValue(fragments)
  await runOpportunityGeneration('p1', 'u1', 'test-model')
  const [args] = createMessageMock.mock.calls[createMessageMock.mock.calls.length - 1]
  return args.messages[0].content as string
}

/** Just the Knowledge Base section of the prompt. */
async function knowledgeBaseFor(fragments: ReturnType<typeof fragment>[]): Promise<string> {
  const prompt = await promptFor(fragments)
  return prompt.split('## Knowledge Base (Active Fragments)\n')[1]
}

const BLOCK_HEADER = "The user's own words this rests on:"

describe('opportunity generation renders labelled evidence', () => {
  it('appends the marked block after the fragment content', async () => {
    const kb = await knowledgeBaseFor([
      fragment('They buy on trust, not on price.', [
        { text: 'we win on trust', verification: 'verified' },
      ]),
    ])
    expect(kb).toBe(
      `- [insight] They buy on trust, not on price.\n\n${BLOCK_HEADER}\n> we win on trust`
    )
  })

  it('renders multiple spans in the order supplied (ordinal asc)', async () => {
    const kb = await knowledgeBaseFor([
      fragment('Content.', [
        { text: 'first span', verification: 'verified' },
        { text: 'second span', verification: 'unverifiable' },
      ]),
    ])
    expect(kb).toContain(`${BLOCK_HEADER}\n> first span\n> second span`)
  })

  it('never renders a failed span', async () => {
    const kb = await knowledgeBaseFor([
      fragment('Content.', [
        { text: 'genuine span', verification: 'verified' },
        { text: 'near-quote we could not find', verification: 'failed' },
      ]),
    ])
    expect(kb).toContain('> genuine span')
    expect(kb).not.toContain('near-quote we could not find')
  })

  it('omits the block entirely when every span failed', async () => {
    const kb = await knowledgeBaseFor([
      fragment('Content.', [{ text: 'not the user', verification: 'failed' }]),
    ])
    expect(kb).toBe('- [insight] Content.')
  })
})

/**
 * The payload a human has to be able to read. Two fragments, the FIRST carrying two spans, shown
 * with the surrounding prompt context — the strategic direction, the dimensional syntheses that
 * ALSO carry evidence (in prose, via `452afd5`), and the fragment bullets. Written out literally,
 * NOT built by the helper under test.
 */
describe('the two-fragment payload, pinned literally with its prompt context', () => {
  it('reads as this exact string', async () => {
    ;(getStrategyStatements as any).mockResolvedValue({
      vision: 'Every trade quotes in a day.',
      strategy: 'Win the buying cycle, not the product comparison.',
      objectives: [
        {
          id: 'obj-1',
          title: 'Cut time-to-quote',
          explanation: 'Quoting is where deals stall.',
        },
      ],
    })
    mockPrisma.dimensionalSynthesis.findMany.mockResolvedValue([
      {
        dimension: 'GO_TO_MARKET',
        summary:
          'Deals are lost in procurement rather than in evaluation. As the user put it: "we lose deals in procurement, every time".',
      },
    ])

    const prompt = await promptFor([
      fragment(
        'The buying cycle, not the product, is the constraint.',
        [
          { text: 'we lose deals in procurement, every time', verification: 'verified' },
          { text: 'it takes them nine months to sign anything', verification: 'unverifiable' },
        ],
        'insight'
      ),
      fragment('Delivery capability sits with one person.', [], 'observation'),
    ])

    expect(prompt).toBe(
      `## Strategic Direction
Vision: Every trade quotes in a day.
Strategy: Win the buying cycle, not the product comparison.
Objectives:
1. [obj-1] Cut time-to-quote — Quoting is where deals stall.

## Strategic Context (Dimensional Syntheses)
### Go-to-Market
Deals are lost in procurement rather than in evaluation. As the user put it: "we lose deals in procurement, every time".

## Knowledge Base (Active Fragments)
- [insight] The buying cycle, not the product, is the constraint.

The user's own words this rests on:
> we lose deals in procurement, every time
> it takes them nine months to sign anything

- [observation] Delivery capability sits with one person.`
    )
  })
})

/**
 * The pinned pre-change payload. If this changes, evidence rendering has leaked into the common
 * path — nearly every production fragment has zero evidence rows.
 */
describe('no evidence renders exactly as it did before', () => {
  it('is byte-identical whether evidence is absent or empty', async () => {
    const absent = await knowledgeBaseFor([
      { content: 'First theme.', contentType: 'insight' } as any,
      { content: 'Second theme.', contentType: 'insight' } as any,
    ])
    const empty = await knowledgeBaseFor([fragment('First theme.'), fragment('Second theme.')])
    expect(absent).toBe('- [insight] First theme.\n- [insight] Second theme.')
    expect(empty).toBe(absent)
  })

  it('still says "No fragments yet." when there are none', async () => {
    const kb = await knowledgeBaseFor([])
    expect(kb).toBe('No fragments yet.')
  })
})

describe('the opportunity-generation query supplies evidence in ordinal order', () => {
  it('selects evidence ordered by ordinal asc', async () => {
    await promptFor([fragment('Content.')])
    const call = mockPrisma.fragment.findMany.mock.calls[0][0]
    expect(call.select.evidence).toEqual({
      select: { text: true, verification: true },
      orderBy: { ordinal: 'asc' },
    })
    expect(call.take).toBe(100)
  })
})
