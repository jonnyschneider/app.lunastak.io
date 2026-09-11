/**
 * A saved discard tells the host, so the counts it owns (sync line, changed-since ids, stale flag,
 * version pointer, Rebuild dialog) can be re-read. Until 2026-09-11 nothing did, and on preview the
 * panel kept the old diff through eight restores while the dialog said nothing had changed.
 *
 * Only a SAVED change is reported — the discard is optimistic, and a failed write changed nothing.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GroundTruthReview } from '../GroundTruthReview'
import type { ApiFragment } from '@/lib/ground-truth/derive'

const frag: ApiFragment = {
  id: 'a',
  title: 'Claim a',
  content: 'The full content of claim a.',
  contentType: 'theme',
  status: 'active',
  sourceType: 'extraction',
  interpretationType: 'verbatim',
  reviewedAt: null,
  dimensions: [{ dimension: 'CUSTOMER_MARKET', confidence: 'HIGH' }],
  source: { type: 'document', id: 'd1', name: 'notes.md' },
  reviewBatch: 'doc:d1',
  capturedAt: '2026-09-07T00:00:00.000Z',
  evidence: [{ text: 'EVIDENCE-a '.padEnd(120, 'x'), verification: 'verified', sourceRole: 'document', ordinal: 0 }],
}

function stubFetch(statusPatchOk: boolean) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body))
      const isStatusChange = 'status' in body
      return { ok: isStatusChange ? statusPatchOk : true, json: async () => ({ success: true }) }
    }
    if (String(url).includes('status=active')) {
      return { ok: true, json: async () => ({ fragments: [frag], total: 1, activeCount: 1, archivedCount: 0 }) }
    }
    return { ok: true, json: async () => ({ fragments: [], total: 0, activeCount: 0, archivedCount: 0 }) }
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe('GroundTruthReview — onChanged', () => {
  it('reports a discard once the write has saved', async () => {
    stubFetch(true)
    const onChanged = vi.fn()
    render(<GroundTruthReview projectId="p1" onChanged={onChanged} />)
    fireEvent.click(await screen.findByLabelText('Discard'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('discarded'))
  })

  it('reports nothing when the write fails', async () => {
    stubFetch(false)
    const onChanged = vi.fn()
    render(<GroundTruthReview projectId="p1" onChanged={onChanged} />)
    fireEvent.click(await screen.findByLabelText('Discard'))
    await waitFor(() => expect(screen.queryAllByText((t) => t.includes('didn’t save')).length).toBeGreaterThan(0))
    expect(onChanged).not.toHaveBeenCalled()
  })
})
