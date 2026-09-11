/**
 * A dimension's summary must describe exactly its ACTIVE fragments.
 *
 * Refresh generation reads the dimensional summaries as its strategic context. Until 2026-09-11 a
 * discard-only change skipped the dimension ("no new fragments"), so a ground truth the user had
 * removed stayed in the summary the next stack was built on — and a dimension whose last ground truth
 * was discarded was never revisited at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fragmentFindMany = vi.fn()
const fragmentCount = vi.fn()
const synthesisFindUnique = vi.fn()
const synthesisFindMany = vi.fn()
const synthesisUpdate = vi.fn()
const tagFindMany = vi.fn()
const fullSynthesisMock = vi.fn()
const incrementalSynthesisMock = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    fragment: { findMany: (...a: unknown[]) => fragmentFindMany(...a), count: (...a: unknown[]) => fragmentCount(...a) },
    dimensionalSynthesis: {
      findUnique: (...a: unknown[]) => synthesisFindUnique(...a),
      findMany: (...a: unknown[]) => synthesisFindMany(...a),
      update: (...a: unknown[]) => synthesisUpdate(...a),
      create: vi.fn(),
    },
    fragmentDimensionTag: { findMany: (...a: unknown[]) => tagFindMany(...a) },
  },
}))
vi.mock('../full-synthesis', () => ({ fullSynthesis: (...a: unknown[]) => fullSynthesisMock(...a) }))
vi.mock('../incremental-synthesis', () => ({ incrementalSynthesis: (...a: unknown[]) => incrementalSynthesisMock(...a) }))

import { decideSynthesis, updateDimensionalSynthesis, updateAllSyntheses } from '../update-synthesis'

const LAST = new Date('2026-09-01T00:00:00Z')
const NOW = new Date('2026-09-10T00:00:00Z')
const existing = (fragmentCount: number, summary: string | null = 'prior') => ({
  summary, lastSynthesizedAt: LAST, fragmentCount,
})

describe('decideSynthesis', () => {
  it('skips a dimension where nothing changed', () => {
    expect(decideSynthesis({ existing: existing(8), allCount: 8, newCount: 0, discardedSince: 0, now: NOW })).toBe('skip')
  })

  it('REBUILDS on a discard-only change — the case that used to skip', () => {
    expect(decideSynthesis({ existing: existing(8), allCount: 7, newCount: 0, discardedSince: 1, now: NOW })).toBe('full')
  })

  it('rebuilds on a discard even when new fragments would otherwise go incremental', () => {
    expect(decideSynthesis({ existing: existing(20), allCount: 21, newCount: 2, discardedSince: 1, now: NOW })).toBe('full')
  })

  it('rebuilds when a discarded fragment is RESTORED — it looks neither new nor discarded', () => {
    // 8 seen last time; one restored (old capturedAt, archivedAt cleared) makes 9 "old" ones.
    expect(decideSynthesis({ existing: existing(8), allCount: 9, newCount: 0, discardedSince: 0, now: NOW })).toBe('full')
  })

  it('keeps the incremental path for a purely additive change', () => {
    expect(decideSynthesis({ existing: existing(20), allCount: 22, newCount: 2, discardedSince: 0, now: NOW })).toBe('incremental')
  })

  it('keeps the existing full-synthesis rules for additive changes', () => {
    // no summary yet
    expect(decideSynthesis({ existing: existing(0, null), allCount: 3, newCount: 3, discardedSince: 0, now: NOW })).toBe('full')
    // fewer than 5 fragments
    expect(decideSynthesis({ existing: existing(3), allCount: 4, newCount: 1, discardedSince: 0, now: NOW })).toBe('full')
    // more than half new
    expect(decideSynthesis({ existing: existing(4), allCount: 10, newCount: 6, discardedSince: 0, now: NOW })).toBe('full')
    // stale: more than 30 days since the last synthesis
    expect(decideSynthesis({ existing: existing(20), allCount: 21, newCount: 1, discardedSince: 0, now: new Date('2026-10-15') })).toBe('full')
  })
})

describe('updateDimensionalSynthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fullSynthesisMock.mockResolvedValue({ summary: 'rebuilt', gaps: [], confidence: 'MEDIUM' })
  })

  it('re-synthesises from the active fragments only after a discard', async () => {
    synthesisFindUnique.mockResolvedValue({ id: 's1', ...existing(3) })
    const active = [
      { id: 'a', content: 'kept one', capturedAt: new Date('2026-08-01'), evidence: [] },
      { id: 'b', content: 'kept two', capturedAt: new Date('2026-08-02'), evidence: [] },
    ]
    fragmentFindMany.mockResolvedValue(active)
    fragmentCount.mockResolvedValue(1) // the third was discarded after LAST

    await updateDimensionalSynthesis('p1', 'CUSTOMER_MARKET')

    expect(fullSynthesisMock).toHaveBeenCalledWith('CUSTOMER_MARKET', active)
    expect(synthesisUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ summary: 'rebuilt', fragmentCount: 2 }),
    }))
  })
})

describe('updateAllSyntheses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revisits a dimension whose last ground truth was discarded, so it resets to empty', async () => {
    tagFindMany.mockResolvedValue([{ dimension: 'CUSTOMER_MARKET' }])
    synthesisFindMany.mockResolvedValue([{ dimension: 'CUSTOMER_MARKET' }, { dimension: 'PRICING' }])
    synthesisFindUnique.mockImplementation(({ where }: { where: { projectId_dimension: { dimension: string } } }) =>
      Promise.resolve({ id: where.projectId_dimension.dimension, ...existing(2) }))
    fragmentFindMany.mockImplementation(({ where }: { where: { dimensionTags: { some: { dimension: string } } } }) =>
      Promise.resolve(where.dimensionTags.some.dimension === 'PRICING' ? [] : [
        { id: 'a', content: 'x', capturedAt: new Date('2026-08-01'), evidence: [] },
        { id: 'b', content: 'y', capturedAt: new Date('2026-08-01'), evidence: [] },
      ]))
    fragmentCount.mockResolvedValue(0)

    await updateAllSyntheses('p1')

    expect(synthesisUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'PRICING' },
      data: expect.objectContaining({ summary: null, fragmentCount: 0 }),
    }))
  })
})
