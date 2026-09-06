/**
 * Synthesis reads the Evidence table (§18 of the ground-truth preflight design).
 *
 * The measured winner is arm `C_labelled`: the same characters as flattened prose,
 * but MARKED as the user's own words. Labelling — not volume — nearly doubled how
 * much the summary echoed the user's actual language (4.9% -> 9.4%) and inverted a
 * 4.7x-toward-our-own-claims ratio into 3.6x-toward-the-user.
 *
 * Three invariants are load-bearing:
 *  1. a `failed` span is NEVER rendered — it could not be found in the user's own
 *     words, so quoting it under that heading would be a false attribution (§15);
 *  2. `verified` and `unverifiable` render IDENTICALLY — the distinction is
 *     bookkeeping for the user-facing badge, not a signal for the model;
 *  3. a fragment with no usable evidence renders BYTE-IDENTICALLY to the pre-change
 *     payload — that is the overwhelmingly common path (no backfill exists).
 */
const createMessageMock = vi.fn()

vi.mock('@/lib/claude', () => ({
  createMessage: (...args: unknown[]) => createMessageMock(...args),
  CLAUDE_MODEL: 'claude-sonnet-4-5-20250929',
}))

import type { FragmentForSynthesis } from '@/lib/synthesis/types'
import type { DimensionalSynthesis } from '@prisma/client'

let fullSynthesis: typeof import('@/lib/synthesis/full-synthesis').fullSynthesis
let incrementalSynthesis: typeof import('@/lib/synthesis/incremental-synthesis').incrementalSynthesis

beforeAll(async () => {
  fullSynthesis = (await import('@/lib/synthesis/full-synthesis')).fullSynthesis
  incrementalSynthesis = (await import('@/lib/synthesis/incremental-synthesis')).incrementalSynthesis
})

beforeEach(() => {
  createMessageMock.mockReset()
  createMessageMock.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify({ summary: 's', gaps: [], confidence: 'HIGH' }) }],
  })
})

function fragment(over: Partial<FragmentForSynthesis> = {}): FragmentForSynthesis {
  return {
    id: 'f1',
    content: 'They buy on trust, not on price.',
    contentType: 'insight',
    confidence: 'high',
    capturedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }
}

const existing = {
  summary: 'Prior summary',
  gaps: [],
  confidence: 'MEDIUM',
} as unknown as DimensionalSynthesis

/** The prompt string handed to createMessage by the last call. */
function lastPrompt(): string {
  const [args] = createMessageMock.mock.calls[createMessageMock.mock.calls.length - 1]
  return args.messages[0].content as string
}

async function fullPrompt(fragments: FragmentForSynthesis[]) {
  await fullSynthesis('CUSTOMER_MARKET', fragments)
  return lastPrompt()
}

async function incrementalPrompt(fragments: FragmentForSynthesis[]) {
  await incrementalSynthesis('CUSTOMER_MARKET', existing, fragments)
  return lastPrompt()
}

const BLOCK_HEADER = "The user's own words this rests on:"

describe.each([
  ['full', (f: FragmentForSynthesis[]) => fullPrompt(f)],
  ['incremental', (f: FragmentForSynthesis[]) => incrementalPrompt(f)],
])('%s synthesis renders labelled evidence', (_name, build) => {
  it('appends the marked block after the content', async () => {
    const prompt = await build([
      fragment({ evidence: [{ text: 'we win on trust', verification: 'verified' }] }),
    ])
    expect(prompt).toContain(
      `They buy on trust, not on price.\n\n${BLOCK_HEADER}\n> we win on trust`
    )
  })

  it('renders multiple spans in the order supplied (ordinal asc)', async () => {
    const prompt = await build([
      fragment({
        evidence: [
          { text: 'first span', verification: 'verified' },
          { text: 'second span', verification: 'unverifiable' },
        ],
      }),
    ])
    expect(prompt).toContain(`${BLOCK_HEADER}\n> first span\n> second span`)
  })

  it('never renders a failed span', async () => {
    const prompt = await build([
      fragment({
        evidence: [
          { text: 'genuine span', verification: 'verified' },
          { text: 'near-quote we could not find', verification: 'failed' },
        ],
      }),
    ])
    expect(prompt).toContain('> genuine span')
    expect(prompt).not.toContain('near-quote we could not find')
  })

  it('omits the block entirely when every span failed', async () => {
    const prompt = await build([
      fragment({ evidence: [{ text: 'not the user', verification: 'failed' }] }),
    ])
    expect(prompt).not.toContain(BLOCK_HEADER)
  })

  it('renders verified and unverifiable identically', async () => {
    const verified = await build([
      fragment({ evidence: [{ text: 'same span', verification: 'verified' }] }),
    ])
    const unverifiable = await build([
      fragment({ evidence: [{ text: 'same span', verification: 'unverifiable' }] }),
    ])
    expect(unverifiable).toBe(verified)
  })

  it('is byte-identical to the no-evidence payload when evidence is absent or empty', async () => {
    const absent = await build([fragment()])
    const empty = await build([fragment({ evidence: [] })])
    const allFailed = await build([
      fragment({ evidence: [{ text: 'x', verification: 'failed' }] }),
    ])
    expect(empty).toBe(absent)
    expect(allFailed).toBe(absent)
  })
})

/**
 * The pinned pre-change payloads. If either changes, evidence rendering has leaked
 * into the common path — nearly every production fragment has zero evidence rows.
 */
describe('no evidence renders exactly as it did before', () => {
  it('full synthesis', async () => {
    expect(await fullPrompt([fragment(), fragment({ id: 'f2', content: 'Second.' })])).toBe(
      [
        'Dimension: CUSTOMER MARKET',
        'Fragments: 2',
        '',
        '### Fragment 1\nType: insight\nConfidence: high\n\nThey buy on trust, not on price.',
        '',
        '---',
        '',
        '### Fragment 2\nType: insight\nConfidence: high\n\nSecond.',
      ].join('\n')
    )
  })

  it('incremental synthesis', async () => {
    expect(await incrementalPrompt([fragment()])).toBe(
      [
        'Dimension: CUSTOMER MARKET',
        '',
        '## Existing Synthesis:',
        '',
        'Summary:',
        'Prior summary',
        '',
        'Gaps:',
        'None identified',
        '',
        'Confidence: MEDIUM',
        '',
        '---',
        '',
        '## New Fragments:',
        '',
        '### Fragment 1\nThey buy on trust, not on price.',
      ].join('\n')
    )
  })
})

describe('the synthesis query supplies evidence in ordinal order', () => {
  it('update-synthesis selects evidence ordered by ordinal asc', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.resolve(__dirname, '../update-synthesis.ts'),
      'utf8'
    )
    expect(src).toMatch(/evidence:\s*\{[\s\S]*?orderBy:\s*\{\s*ordinal:\s*'asc'\s*\}/)
    expect(src).toMatch(/select:\s*\{\s*text:\s*true,\s*verification:\s*true\s*\}/)
  })
})
