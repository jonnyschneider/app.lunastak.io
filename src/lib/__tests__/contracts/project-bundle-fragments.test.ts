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
} from '../../../../tools/project-bundle/fragments'
import { parseBundle, BUNDLE_VERSION } from '../../../../tools/project-bundle/schema'

/** Records what would have been inserted. */
function fakeTx() {
  const fragmentRows: FragmentRow[] = []
  const evidenceRows: EvidenceRow[] = []
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
  }
  return { client, fragmentRows, evidenceRows }
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
