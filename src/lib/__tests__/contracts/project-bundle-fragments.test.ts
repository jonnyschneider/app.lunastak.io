/**
 * Project Bundle — fragment evidence round-trip contract.
 *
 * The bundle is the documented way projects move between environments. A field
 * the mapping forgets is data silently destroyed on the next dev → preview → prod
 * hop, with nothing failing. These tests pin the three columns the ground-truth
 * work added: `evidence[]`, `interpretationType` and `reviewedAt`.
 *
 * The DB is faked, not mocked: `writeFragments` takes a structural client so the
 * test can assert on the exact rows that would be inserted.
 */
import {
  toBundleFragment,
  writeFragments,
  type EvidenceRow,
  type FragmentRow,
  type FragmentWriteClient,
  type DimensionTagRow,
} from '../../../../tools/project-bundle/fragments'
import { parseBundle, BUNDLE_VERSION } from '../../../../tools/project-bundle/schema'

/** Records what would have been inserted. */
function fakeTx() {
  const fragmentRows: FragmentRow[] = []
  const evidenceRows: EvidenceRow[] = []
  const dimensionTagRows: DimensionTagRow[] = []
  const client: FragmentWriteClient = {
    fragment: {
      createMany: async ({ data }) => {
        fragmentRows.push(...data)
        return { count: data.length }
      },
    },
    evidence: {
      createMany: async ({ data }) => {
        evidenceRows.push(...data)
        return { count: data.length }
      },
    },
    fragmentDimensionTag: {
      createMany: async ({ data }) => {
        dimensionTagRows.push(...data)
        return { count: data.length }
      },
    },
  }
  return { client, fragmentRows, evidenceRows, dimensionTagRows }
}

const REVIEWED_AT = new Date('2026-09-05T04:03:02.000Z')

/** A Fragment row as export.ts reads it, with evidence included. */
const dbFragment = {
  title: 'Margin is the moat',
  content: 'The customer pays for scarcity, not for the car.',
  contentType: 'insight',
  confidence: 'MEDIUM' as string | null,
  sourceType: 'extraction',
  interpretationType: 'interpretation' as string | null,
  reviewedAt: REVIEWED_AT as Date | null,
  generatedBy: 'claude-code-plugin@1.2.0' as string | null,
  importMode: 'transform' as string | null,
  dimensionTags: [
    { dimension: 'CUSTOMER_MARKET', confidence: 'HIGH' as string | null },
    { dimension: 'BUSINESS_MODEL_ECONOMICS', confidence: 'MEDIUM' as string | null },
  ],
  evidence: [
    { text: 'we never build the last thousand', sourceRole: 'user', verification: 'verified', ordinal: 0 },
    { text: 'scarcity is the product', sourceRole: 'assistant', verification: 'unverifiable', ordinal: 1 },
    { text: 'a span the source no longer holds', sourceRole: 'document', verification: 'failed', ordinal: 2 },
  ],
}

function bundleAround(fragments: unknown[]) {
  return {
    bundleVersion: BUNDLE_VERSION,
    projectId: 'proj_1',
    projectName: 'Test',
    isDemo: false,
    demoSlug: null,
    description: null,
    exportedAt: new Date().toISOString(),
    knowledgeSummary: null,
    suggestedQuestions: [],
    decisionStack: {
      vision: 'v',
      visionElaboration: null,
      strategy: 's',
      strategyElaboration: null,
      objectives: [],
      opportunities: [],
      principles: [],
    },
    fragments,
    syntheses: [],
  }
}

describe('Project Bundle fragment dimensions', () => {
  /**
   * Added with bundle v5, 2026-09-10. `FragmentDimensionTag` was NEVER carried by this format —
   * not dropped in a refactor, simply never included — so every restore produced a project whose
   * fragments belonged to no dimension: coverage grid empty, every ground truth filed under
   * "not filed anywhere".
   *
   * The four committed demos had shipped that way since they existed, which is exactly why nobody
   * connected the empty Harvey balls to a data problem — there was no working example to compare
   * against. It surfaced only when a freshly imported project (141 tags) was exported and restored
   * as a demo (0 tags) and the two were put side by side.
   *
   * THIRD TIME FOR THIS FORMAT: v3 carried evidence, v4 carried provenance, v5 carries dimensions.
   * The pattern is a column added to Fragment and this boundary not updated with it. That is what
   * these tests exist to make loud.
   */
  test('export → schema → restore preserves the dimension tags', async () => {
    const bundle = parseBundle(bundleAround([toBundleFragment(dbFragment)]))
    expect(bundle.fragments[0].dimensions).toEqual([
      { dimension: 'CUSTOMER_MARKET', confidence: 'HIGH' },
      { dimension: 'BUSINESS_MODEL_ECONOMICS', confidence: 'MEDIUM' },
    ])

    const { client, fragmentRows, dimensionTagRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)

    expect(dimensionTagRows).toHaveLength(2)
    expect(dimensionTagRows.map(t => t.dimension)).toEqual(
      ['CUSTOMER_MARKET', 'BUSINESS_MODEL_ECONOMICS'])
    // Every tag belongs to the fragment it was exported from — never matched by content.
    expect(dimensionTagRows.every(t => t.fragmentId === fragmentRows[0].id)).toBe(true)
  })

  test('a duplicate dimension is collapsed — the unique constraint would fail the whole write', async () => {
    const doubled = {
      ...dbFragment,
      dimensionTags: [
        { dimension: 'CUSTOMER_MARKET', confidence: 'HIGH' as string | null },
        { dimension: 'CUSTOMER_MARKET', confidence: 'LOW' as string | null },
      ],
    }
    const bundle = parseBundle(bundleAround([toBundleFragment(doubled)]))
    const { client, dimensionTagRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)

    expect(dimensionTagRows).toHaveLength(1)
    expect(dimensionTagRows[0].confidence).toBe('HIGH')  // first wins
  })

  test('a fragment with no tags writes none, rather than an empty row', async () => {
    const untagged = { ...dbFragment, dimensionTags: [] }
    const bundle = parseBundle(bundleAround([toBundleFragment(untagged)]))
    const { client, dimensionTagRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)
    expect(dimensionTagRows).toHaveLength(0)
  })

  test('a pre-v5 bundle omitting the field still restores', async () => {
    const exported = toBundleFragment(dbFragment) as Record<string, unknown>
    delete exported.dimensions

    const bundle = parseBundle(bundleAround([exported]))
    const { client, fragmentRows, dimensionTagRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)
    expect(fragmentRows).toHaveLength(1)
    expect(dimensionTagRows).toHaveLength(0)
  })

  test('tags land on the RIGHT fragment when several are restored together', async () => {
    /* The failure this guards is the one the evidence writer already documents: matching children
     * to parents by content is wrong the moment two fragments share text. */
    const a = { ...dbFragment, content: 'same text', dimensionTags: [{ dimension: 'GO_TO_MARKET', confidence: null as string | null }] }
    const b = { ...dbFragment, content: 'same text', dimensionTags: [{ dimension: 'RISKS_CONSTRAINTS', confidence: null as string | null }] }
    const bundle = parseBundle(bundleAround([toBundleFragment(a), toBundleFragment(b)]))

    const { client, fragmentRows, dimensionTagRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)

    const byFragment = new Map(dimensionTagRows.map(t => [t.fragmentId, t.dimension]))
    expect(byFragment.get(fragmentRows[0].id)).toBe('GO_TO_MARKET')
    expect(byFragment.get(fragmentRows[1].id)).toBe('RISKS_CONSTRAINTS')
  })
})

describe('Project Bundle fragment provenance', () => {
  /**
   * Added with bundle v4, 2026-09-10. `generatedBy` / `importMode` landed on Fragment
   * on 2026-09-09 and this boundary was never updated, so every dev → preview → prod
   * hop silently erased them — the same failure v3 fixed for evidence, repeated within
   * a fortnight. Caught when a restored preview showed 0 of 300 fragments carrying
   * provenance that the dev database had on all of them.
   *
   * Provenance exists so the different ways of preparing context can be compared. A
   * format that drops it on the way to the environment where the comparison happens
   * defeats the feature entirely.
   */
  test('export → schema → restore preserves generatedBy and importMode', async () => {
    const bundle = parseBundle(bundleAround([toBundleFragment(dbFragment)]))
    expect(bundle.fragments[0].generatedBy).toBe('claude-code-plugin@1.2.0')
    expect(bundle.fragments[0].importMode).toBe('transform')

    const { client, fragmentRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)
    expect(fragmentRows[0]).toMatchObject({
      generatedBy: 'claude-code-plugin@1.2.0',
      importMode: 'transform',
    })
  })

  test('a fragment with no provenance restores as null, not undefined', async () => {
    const noProvenance = { ...dbFragment, generatedBy: null, importMode: null }
    const bundle = parseBundle(bundleAround([toBundleFragment(noProvenance)]))

    const { client, fragmentRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)
    expect(fragmentRows[0].generatedBy).toBeNull()
    expect(fragmentRows[0].importMode).toBeNull()
  })

  test('a pre-v4 bundle omitting the fields still restores', async () => {
    const exported = toBundleFragment(dbFragment) as Record<string, unknown>
    delete exported.generatedBy
    delete exported.importMode

    const bundle = parseBundle(bundleAround([exported]))
    const { client, fragmentRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)
    expect(fragmentRows[0].generatedBy).toBeNull()
  })
})

describe('Project Bundle fragment evidence', () => {
  test('export → schema → restore preserves evidence, ordinal order and all three verification states', async () => {
    const exported = toBundleFragment(dbFragment)
    const bundle = parseBundle(bundleAround([exported]))

    const { client, fragmentRows, evidenceRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)

    expect(fragmentRows).toHaveLength(1)
    expect(fragmentRows[0]).toMatchObject({
      projectId: 'proj_1',
      title: 'Margin is the moat',
      content: dbFragment.content,
      contentType: 'insight',
      confidence: 'MEDIUM',
      sourceType: 'extraction',
      interpretationType: 'interpretation',
      status: 'active',
    })
    expect(fragmentRows[0].reviewedAt).toEqual(REVIEWED_AT)

    expect(evidenceRows).toHaveLength(3)
    // every evidence row hangs off the fragment that was actually inserted
    expect(new Set(evidenceRows.map((e) => e.fragmentId))).toEqual(new Set([fragmentRows[0].id]))
    expect(evidenceRows.map((e) => [e.ordinal, e.text, e.sourceRole, e.verification])).toEqual([
      [0, 'we never build the last thousand', 'user', 'verified'],
      [1, 'scarcity is the product', 'assistant', 'unverifiable'],
      [2, 'a span the source no longer holds', 'document', 'failed'],
    ])
  })

  test('two fragments sharing identical text keep their own evidence', async () => {
    const twin = { ...dbFragment, evidence: [{ text: 'a different span', sourceRole: 'user', verification: 'verified', ordinal: 0 }] }
    const bundle = parseBundle(bundleAround([toBundleFragment(dbFragment), toBundleFragment(twin)]))

    const { client, fragmentRows, evidenceRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)

    expect(fragmentRows).toHaveLength(2)
    expect(fragmentRows[0].id).not.toBe(fragmentRows[1].id)
    const byFragment = (id: unknown) => evidenceRows.filter((e) => e.fragmentId === id).map((e) => e.text)
    expect(byFragment(fragmentRows[0].id)).toHaveLength(3)
    expect(byFragment(fragmentRows[1].id)).toEqual(['a different span'])
  })

  test('a bundle written before evidence existed still parses and restores', async () => {
    const legacy = {
      title: 'Old fragment',
      content: 'No evidence, no type — exported before either existed.',
      contentType: 'theme',
      confidence: 'MEDIUM',
      sourceType: 'import',
    }
    const bundle = parseBundle(bundleAround([legacy]))

    const { client, fragmentRows, evidenceRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)

    expect(fragmentRows).toHaveLength(1)
    expect(fragmentRows[0].interpretationType).toBeNull()
    expect(fragmentRows[0].reviewedAt).toBeNull()
    expect(evidenceRows).toHaveLength(0)
  })

  test('an explicit interpretationType: null survives the round trip', async () => {
    const unTyped = { ...dbFragment, interpretationType: null, reviewedAt: null, evidence: [] }
    const exported = toBundleFragment(unTyped)
    expect(exported.interpretationType).toBeNull()
    expect(exported.reviewedAt).toBeNull()

    const bundle = parseBundle(bundleAround([exported]))
    const { client, fragmentRows, evidenceRows } = fakeTx()
    await writeFragments(client, 'proj_1', bundle.fragments)

    expect(fragmentRows[0].interpretationType).toBeNull()
    expect(fragmentRows[0].reviewedAt).toBeNull()
    expect(evidenceRows).toHaveLength(0)
  })

  test('an unknown verification state is rejected at the boundary', () => {
    const broken = toBundleFragment({
      ...dbFragment,
      evidence: [{ text: 'x', sourceRole: 'user', verification: 'probably-fine', ordinal: 0 }],
    })
    expect(() => parseBundle(bundleAround([broken]))).toThrow()
  })

  test('writeFragments makes no calls for an empty fragment list', async () => {
    const { client, fragmentRows, evidenceRows } = fakeTx()
    await writeFragments(client, 'proj_1', [])
    expect(fragmentRows).toHaveLength(0)
    expect(evidenceRows).toHaveLength(0)
  })
})
