/**
 * What `onCountChange` reports when the list is filtered to one dimension.
 *
 * The host (`KnowledgeSummaryPanel`) prints this number beside a heading that names the selected
 * dimension, so the two have to answer the same question. They did not: the count was always the
 * project total, which made clicking a Harvey ball look like a broken filter — Jonny, 2026-09-10:
 * *"the count never changes"*.
 *
 * `archived` is deliberately NOT filtered. It arrives from the server as a project-wide figure and
 * the recovery list is not grouped by dimension either, so scoping it would be a lie about a number
 * nothing else can corroborate.
 */

import { render, waitFor } from '@testing-library/react'
import { GroundTruthReview } from '../GroundTruthReview'
import type { ApiFragment } from '@/lib/ground-truth/derive'

const frag = (id: string, dimension: string): ApiFragment => ({
  id,
  title: `Claim ${id}`,
  content: 'The full content of the claim.',
  contentType: 'theme',
  status: 'active',
  sourceType: 'extraction',
  interpretationType: 'verbatim',
  reviewedAt: null,
  dimensions: [{ dimension, confidence: 'HIGH' }],
  source: { type: 'document', id: 'd1', name: 'notes.md' },
  capturedAt: '2026-09-07T00:00:00.000Z',
  evidence: [{ text: 'a'.repeat(120), verification: 'verified', sourceRole: 'document', ordinal: 0 }],
})

const FRAGMENTS = [
  frag('a', 'CUSTOMER_MARKET'),
  frag('b', 'CUSTOMER_MARKET'),
  frag('c', 'COMPETITIVE_LANDSCAPE'),
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('status=active')) {
      return {
        ok: true,
        json: async () => ({
          fragments: FRAGMENTS,
          total: FRAGMENTS.length,
          activeCount: FRAGMENTS.length,
          archivedCount: 4,
        }),
      }
    }
    // The reviewed-at PATCH, and the archived list if it is asked for.
    return { ok: true, json: async () => ({ fragments: [], total: 0, activeCount: 0, archivedCount: 4 }) }
  }))
})

afterEach(() => vi.unstubAllGlobals())

describe('GroundTruthReview — the count follows the dimension filter', () => {
  it('reports the whole list when nothing is filtered', async () => {
    const onCountChange = vi.fn()
    render(<GroundTruthReview projectId="p1" onCountChange={onCountChange} />)
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(3, 3, 4))
  })

  it('reports only the selected dimension', async () => {
    const onCountChange = vi.fn()
    render(<GroundTruthReview projectId="p1" dimension="CUSTOMER_MARKET" onCountChange={onCountChange} />)
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2, 2, 4))
  })

  it('reports zero for a dimension nothing is filed under, rather than the total', async () => {
    const onCountChange = vi.fn()
    render(<GroundTruthReview projectId="p1" dimension="ECONOMIC_MODEL" onCountChange={onCountChange} />)
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(0, 0, 4))
  })

  it('goes back to the full total when the filter is cleared', async () => {
    const onCountChange = vi.fn()
    const { rerender } = render(
      <GroundTruthReview projectId="p1" dimension="CUSTOMER_MARKET" onCountChange={onCountChange} />
    )
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2, 2, 4))

    rerender(<GroundTruthReview projectId="p1" onCountChange={onCountChange} />)
    await waitFor(() => expect(onCountChange).toHaveBeenLastCalledWith(3, 3, 4))
  })
})
