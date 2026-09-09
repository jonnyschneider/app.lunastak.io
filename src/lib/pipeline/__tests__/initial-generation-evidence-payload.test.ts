/**
 * Initial generation reads the Evidence table (§18/§19 of the ground-truth preflight design).
 *
 * `runInitialGeneration` produces the FIRST strategy a user ever sees, and it holds zero
 * references to `dimensionalSynthesis` — so the synthesis repoint (`452afd5`) cannot reach it.
 * This is the only route by which the user's own words reach first-run.
 *
 * The rendering is `renderEvidence` — the same helper synthesis uses, unchanged. What is pinned
 * here is the PAYLOAD: this path has no `### Fragment N` headers and no `---` separators, so the
 * evidence block sits between one theme's content and the next separated only by blank lines. The
 * block is self-delimiting (labelled header plus `>` markers) and that is accepted deliberately —
 * the literal three-fragment string below exists so a human can judge whether it reads clearly.
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
    conversation: { create: vi.fn(), update: vi.fn() },
    trace: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/decision-stack', () => ({
  writeStrategyToStack: vi.fn(),
  captureSnapshot: vi.fn(),
  setGenerationStatus: vi.fn(),
}))

vi.mock('@/lib/statsig', () => ({ logStatsigEvent: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifySlackStrategyGenerated: vi.fn() }))

import { prisma } from '@/lib/db'
import { runInitialGeneration } from '@/lib/pipeline/generation'

const mockPrisma = prisma as unknown as {
  fragment: { findMany: any }
  conversation: { create: any; update: any }
  trace: { create: any }
  user: { findUnique: any }
}

const CLAUDE_RESPONSE = {
  content: [
    {
      type: 'text',
      text: '<thoughts>t</thoughts><statements><vision>V</vision><strategy>S</strategy><objectives>O</objectives></statements>',
    },
  ],
  model: 'test-model',
  usage: { input_tokens: 1, output_tokens: 1 },
}

type Span = { text: string; verification: string }

function fragment(content: string, evidence: Span[] = [], id = content.slice(0, 4)) {
  return { id, content, contentType: 'insight', evidence }
}

beforeEach(() => {
  vi.clearAllMocks()
  createMessageMock.mockResolvedValue(CLAUDE_RESPONSE)
  mockPrisma.trace.create.mockResolvedValue({ id: 'trace1' })
  mockPrisma.conversation.create.mockResolvedValue({ id: 'convo1' })
  mockPrisma.user.findUnique.mockResolvedValue(null)
})

/** The prompt string handed to createMessage. */
async function promptFor(fragments: ReturnType<typeof fragment>[]): Promise<string> {
  mockPrisma.fragment.findMany.mockResolvedValue(fragments)
  await runInitialGeneration('p1', 'c1', 'u1', null, 'test-model')
  const [args] = createMessageMock.mock.calls[createMessageMock.mock.calls.length - 1]
  return args.messages[0].content as string
}

const BLOCK_HEADER = "The user's own words this rests on:"

describe('initial generation renders labelled evidence', () => {
  it('appends the marked block after the fragment content', async () => {
    const prompt = await promptFor([
      fragment('They buy on trust, not on price.', [
        { text: 'we win on trust', verification: 'verified' },
      ]),
    ])
    expect(prompt).toBe(
      `EMERGENT THEMES:\nThey buy on trust, not on price.\n\n${BLOCK_HEADER}\n> we win on trust`
    )
  })

  it('renders multiple spans in the order supplied (ordinal asc)', async () => {
    const prompt = await promptFor([
      fragment('Content.', [
        { text: 'first span', verification: 'verified' },
        { text: 'second span', verification: 'unverifiable' },
      ]),
    ])
    expect(prompt).toContain(`${BLOCK_HEADER}\n> first span\n> second span`)
  })

  it('never renders a failed span', async () => {
    const prompt = await promptFor([
      fragment('Content.', [
        { text: 'genuine span', verification: 'verified' },
        { text: 'near-quote we could not find', verification: 'failed' },
      ]),
    ])
    expect(prompt).toContain('> genuine span')
    expect(prompt).not.toContain('near-quote we could not find')
  })

  it('omits the block entirely when every span failed', async () => {
    const prompt = await promptFor([
      fragment('Content.', [{ text: 'not the user', verification: 'failed' }]),
    ])
    expect(prompt).toBe('EMERGENT THEMES:\nContent.')
  })
})

/**
 * The payload a human has to be able to read. Three themes, the MIDDLE one carrying two spans, and
 * no `### Fragment N` headers or `---` rules to lean on — the boundaries are blank lines plus the
 * self-delimiting evidence block. Written out literally, NOT built by the helper under test.
 */
describe('the three-fragment payload, pinned literally', () => {
  it('reads as this exact string', async () => {
    const prompt = await promptFor([
      fragment('Buyers pick us on trust, not on price.'),
      fragment('The buying cycle, not the product, is the constraint.', [
        { text: 'we lose deals in procurement, every time', verification: 'verified' },
        { text: 'it takes them nine months to sign anything', verification: 'unverifiable' },
      ]),
      fragment('Delivery capability sits with one person.'),
    ])
    expect(prompt).toBe(
      `EMERGENT THEMES:
Buyers pick us on trust, not on price.

The buying cycle, not the product, is the constraint.

The user's own words this rests on:
> we lose deals in procurement, every time
> it takes them nine months to sign anything

Delivery capability sits with one person.`
    )
  })
})

/**
 * The pinned pre-change payload. If this changes, evidence rendering has leaked into the common
 * path — nearly every production fragment has zero evidence rows.
 */
describe('no evidence renders exactly as it did before', () => {
  it('is byte-identical whether evidence is absent or empty', async () => {
    const absent = await promptFor([
      { id: 'f1', content: 'First theme.', contentType: 'insight' } as any,
      { id: 'f2', content: 'Second theme.', contentType: 'insight' } as any,
    ])
    const empty = await promptFor([fragment('First theme.'), fragment('Second theme.', [], 'f2')])
    expect(absent).toBe('EMERGENT THEMES:\nFirst theme.\n\nSecond theme.')
    expect(empty).toBe(absent)
  })
})

describe('the initial-generation query supplies evidence in ordinal order', () => {
  it('selects evidence ordered by ordinal asc', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(path.resolve(__dirname, '../generation.ts'), 'utf8')
    expect(src).toMatch(
      /select:\s*\{\s*id:\s*true,\s*content:\s*true,\s*contentType:\s*true,[\s\S]*?evidence:\s*\{[\s\S]*?select:\s*\{\s*text:\s*true,\s*verification:\s*true\s*\},[\s\S]*?orderBy:\s*\{\s*ordinal:\s*'asc'\s*\}/
    )
  })
})
