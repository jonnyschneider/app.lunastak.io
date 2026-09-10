/**
 * A review scoped to one ingest (`batch`) opens, and stamps, only what it shows.
 *
 * ⚠ BOTH USED THE UNFILTERED LIST until 2026-09-11. The list is fetched project-wide and filtered
 * at render, but the "first row opens itself" pick and the `reviewedAt` PATCH ran on the fetch
 * result. So a review of one document's 3 ground truths stamped all 19 in the project as
 * reviewed, and usually opened a row that was not in the batch — which, not being rendered, meant
 * nothing visibly opened (seen on a 3-of-19 review during 2.8.1 verification).
 *
 * `reviewedAt` is "was shown to the user"; stamping rows the user was never shown makes
 * `reviewedAt IS NULL` mean "arrived since any list last loaded" instead.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { GroundTruthReview } from '../GroundTruthReview'
import type { ApiFragment } from '@/lib/ground-truth/derive'

const frag = (id: string, dimension: string, reviewBatch: string): ApiFragment => ({
  id,
  title: `Claim ${id}`,
  content: `The full content of claim ${id}.`,
  contentType: 'theme',
  status: 'active',
  sourceType: 'extraction',
  interpretationType: 'verbatim',
  reviewedAt: null,
  dimensions: [{ dimension, confidence: 'HIGH' }],
  source: { type: 'document', id: reviewBatch.slice(4), name: 'notes.md' },
  reviewBatch,
  capturedAt: '2026-09-07T00:00:00.000Z',
  evidence: [{ text: `EVIDENCE-${id} `.padEnd(120, 'x'), verification: 'verified', sourceRole: 'document', ordinal: 0 }],
})

// `c` is outside the batch AND in the dimension that renders first — the old code opened it.
const FRAGMENTS = [
  frag('c', 'CUSTOMER_MARKET', 'doc:other'),
  frag('a', 'COMPETITIVE_LANDSCAPE', 'doc:mine'),
  frag('b', 'COMPETITIVE_LANDSCAPE', 'doc:mine'),
]

let patches: { ids: string[] }[] = []

beforeEach(() => {
  patches = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      patches.push(JSON.parse(String(init.body)))
      return { ok: true, json: async () => ({ success: true }) }
    }
    if (String(url).includes('status=active')) {
      return { ok: true, json: async () => ({ fragments: FRAGMENTS, total: 3, activeCount: 3, archivedCount: 0 }) }
    }
    return { ok: true, json: async () => ({ fragments: [], total: 0, activeCount: 0, archivedCount: 0 }) }
  }))
})

afterEach(() => vi.unstubAllGlobals())

const has = (needle: string) => screen.queryAllByText((t) => t.includes(needle)).length > 0

describe('GroundTruthReview — a batch-scoped review', () => {
  it('stamps only the rows in the batch as reviewed', async () => {
    render(<GroundTruthReview projectId="p1" batch="doc:mine" />)
    await waitFor(() => expect(patches.length).toBeGreaterThan(0))
    const stamped = patches.flatMap((p) => p.ids).sort()
    expect(stamped).toEqual(['a', 'b'])
  })

  it('opens the first row the user can actually see', async () => {
    render(<GroundTruthReview projectId="p1" batch="doc:mine" />)
    await waitFor(() => expect(has('EVIDENCE-a') || has('EVIDENCE-b')).toBe(true))
    expect(has('EVIDENCE-c')).toBe(false)
  })

  it('stamps the whole list when nothing is filtered — the unscoped behaviour is unchanged', async () => {
    render(<GroundTruthReview projectId="p1" />)
    await waitFor(() => expect(patches.length).toBeGreaterThan(0))
    expect(patches.flatMap((p) => p.ids).sort()).toEqual(['a', 'b', 'c'])
  })
})
