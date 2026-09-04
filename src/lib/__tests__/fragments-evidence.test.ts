/**
 * Evidence persistence across all three fragment-creation paths.
 *
 * The load-bearing distinction under test: the import path passes NO source (a bundle is produced
 * in a conversation this app never sees), so its spans store as `unverifiable` — "could not be
 * checked" — never `failed`, which means "checked and the span was not there". Downstream logic
 * treats the two differently, and conflating them would penalise a whole ingest path.
 *
 * Back-compat is also load-bearing: a theme with no evidence must still create its fragment.
 */

import {
  createFragment,
  createFragmentsFromThemes,
  createFragmentsFromDocument,
  createFragmentsFromImport,
  type ThemeWithDimensions,
} from '@/lib/fragments'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    fragment: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    fragmentDimensionTag: {
      createMany: vi.fn(),
    },
    evidence: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const mockPrisma = prisma as unknown as {
  fragment: { create: any; createMany: any; findMany: any }
  fragmentDimensionTag: { createMany: any }
  evidence: { createMany: any }
  $transaction: any
}

/** The data passed to the single nested prisma.fragment.create call. */
function createArg(callIndex = 0) {
  return mockPrisma.fragment.create.mock.calls[callIndex][0].data
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.fragment.create.mockImplementation(async () => ({ id: 'frag-1' }))
  mockPrisma.fragment.createMany.mockResolvedValue({ count: 0 })
  mockPrisma.fragmentDimensionTag.createMany.mockResolvedValue({ count: 0 })
  mockPrisma.evidence.createMany.mockResolvedValue({ count: 0 })
  mockPrisma.fragment.findMany.mockResolvedValue([])
  mockPrisma.$transaction.mockImplementation(async (fn: any) =>
    fn({
      fragment: mockPrisma.fragment,
      fragmentDimensionTag: mockPrisma.fragmentDimensionTag,
      evidence: mockPrisma.evidence,
    })
  )
})

describe('createFragment — evidence in the same write', () => {
  it('nests evidence rows in the same fragment.create call as dimensionTags', async () => {
    await createFragment(
      {
        projectId: 'p1',
        content: 'theme content',
        contentType: 'theme',
        interpretationType: 'verbatim',
        evidence: [
          { text: 'first span here', verification: 'verified', sourceRole: 'user' },
          { text: 'second span here', verification: 'failed', sourceRole: 'user' },
        ],
      },
      [{ dimension: 'CUSTOMER_MARKET' }]
    )

    // One write, one transaction — no second round trip
    expect(mockPrisma.fragment.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.evidence.createMany).not.toHaveBeenCalled()

    const data = createArg()
    expect(data.interpretationType).toBe('verbatim')
    expect(data.dimensionTags.create).toHaveLength(1)
    expect(data.evidence.create).toEqual([
      { text: 'first span here', verification: 'verified', sourceRole: 'user', ordinal: 0 },
      { text: 'second span here', verification: 'failed', sourceRole: 'user', ordinal: 1 },
    ])
  })

  it('omits evidence entirely when none is supplied', async () => {
    await createFragment({ projectId: 'p1', content: 'c', contentType: 'theme' })
    expect(createArg().evidence).toBeUndefined()
    expect(mockPrisma.fragment.create).toHaveBeenCalledTimes(1)
  })
})

describe('createFragmentsFromThemes — conversation path', () => {
  const source = 'We keep losing enterprise deals on procurement review, every single quarter.'

  it('verifies spans against the conversation source and preserves ordinal order', async () => {
    const themes: ThemeWithDimensions[] = [
      {
        theme_name: 'Procurement friction',
        content: 'Deals stall in procurement',
        dimensions: [],
        evidence: ['losing enterprise deals on procurement review', 'a span that is simply not there'],
        type: 'verbatim',
      } as ThemeWithDimensions,
    ]

    await createFragmentsFromThemes('p1', 'c1', themes, source)

    const rows = createArg().evidence.create
    expect(rows.map((r: any) => r.ordinal)).toEqual([0, 1])
    expect(rows[0].text).toBe('losing enterprise deals on procurement review')
    expect(rows[0].verification).toBe('verified')
    expect(rows[1].verification).toBe('failed')
    expect(rows.every((r: any) => r.sourceRole === 'user')).toBe(true)
    expect(createArg().interpretationType).toBe('verbatim')
  })

  it('creates the fragment for a theme carrying no evidence (back-compat)', async () => {
    const themes: ThemeWithDimensions[] = [
      { theme_name: 'Legacy theme', content: 'no evidence element', dimensions: [] } as ThemeWithDimensions,
    ]

    const fragments = await createFragmentsFromThemes('p1', 'c1', themes, source)

    expect(fragments).toHaveLength(1)
    expect(mockPrisma.fragment.create).toHaveBeenCalledTimes(1)
    expect(createArg().evidence).toBeUndefined()
  })
})

describe('createFragmentsFromDocument — document path', () => {
  it('verifies against the document text and tags sourceRole document', async () => {
    const documentText = 'Our margin is thinnest in the mid-market segment, where support cost dominates.'
    const themes: ThemeWithDimensions[] = [
      {
        theme_name: 'Margin pressure',
        content: 'Mid-market margin',
        dimensions: [],
        evidence: ['margin is thinnest in the mid-market segment'],
        type: 'interpretation',
      } as ThemeWithDimensions,
    ]

    await createFragmentsFromDocument('p1', 'd1', themes, documentText)

    const data = createArg()
    expect(data.interpretationType).toBe('interpretation')
    expect(data.evidence.create).toEqual([
      {
        text: 'margin is thinnest in the mid-market segment',
        verification: 'verified',
        sourceRole: 'document',
        ordinal: 0,
      },
    ])
  })
})

describe('createFragmentsFromImport — bundle path', () => {
  const themes: ThemeWithDimensions[] = [
    {
      theme_name: 'Imported theme',
      content: 'from a bundle',
      dimensions: [],
      evidence: ['a span from a conversation this app never saw', 'another such span here'],
      type: 'verbatim',
    } as ThemeWithDimensions,
    { theme_name: 'No evidence', content: 'still a fragment', dimensions: [] } as ThemeWithDimensions,
  ]

  it('stores every span as unverifiable — never failed — because there is no source to check', async () => {
    await createFragmentsFromImport('p1', 'batch-1', themes)

    const rows = mockPrisma.evidence.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(2)
    expect(rows.map((r: any) => r.verification)).toEqual(['unverifiable', 'unverifiable'])
    expect(rows.some((r: any) => r.verification === 'failed')).toBe(false)
    expect(rows.map((r: any) => r.ordinal)).toEqual([0, 1])
    expect(rows.every((r: any) => r.sourceRole === 'bundle')).toBe(true)
  })

  it('attaches evidence to the right fragment and still creates evidence-less fragments', async () => {
    await createFragmentsFromImport('p1', 'batch-1', themes)

    const fragmentRows = mockPrisma.fragment.createMany.mock.calls[0][0].data
    expect(fragmentRows).toHaveLength(2)
    expect(fragmentRows[0].interpretationType).toBe('verbatim')

    const evidenceRows = mockPrisma.evidence.createMany.mock.calls[0][0].data
    expect(evidenceRows.every((r: any) => r.fragmentId === fragmentRows[0].id)).toBe(true)
  })

  it('writes evidence inside the same transaction as the fragments', async () => {
    await createFragmentsFromImport('p1', 'batch-1', themes)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('skips the evidence insert when no theme carries spans', async () => {
    await createFragmentsFromImport('p1', 'batch-1', [
      { theme_name: 'Bare', content: 'no spans', dimensions: [] } as ThemeWithDimensions,
    ])
    expect(mockPrisma.evidence.createMany).not.toHaveBeenCalled()
    expect(mockPrisma.fragment.createMany).toHaveBeenCalledTimes(1)
  })
})
