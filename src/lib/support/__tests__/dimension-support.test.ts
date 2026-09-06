/**
 * The support calculator is the Harvey ball's input (design §16.4). It is pure, so it is
 * tested as a pure function: every band boundary, the template no-source-id case, and each
 * arm of the modifier.
 */
import {
  computeDimensionSupport,
  supportBand,
  countSources,
  THIN_EVIDENCE_CHARS,
  type SupportFragment,
} from '../dimension-support'

/** A fragment from one conversation, with one healthy verified span. */
const frag = (over: Partial<SupportFragment> = {}): SupportFragment => ({
  conversationId: 'c1',
  documentId: null,
  importBatchId: null,
  sourceType: 'extraction',
  evidence: [{ text: 'a'.repeat(THIN_EVIDENCE_CHARS + 10), verification: 'verified' }],
  ...over,
})

/** n fragments spread across `sources` distinct conversations, evenly. */
const spread = (n: number, sources: number, over: Partial<SupportFragment> = {}) =>
  Array.from({ length: n }, (_, i) => frag({ conversationId: `c${i % sources}`, ...over }))

describe('supportBand — the bands from §16.4', () => {
  it('is empty with no fragments', () => {
    expect(supportBand(0, 0)).toBe('empty')
  })

  it('is quarter for 1 source with fewer than 5 fragments', () => {
    expect(supportBand(1, 1)).toBe('quarter')
    expect(supportBand(1, 4)).toBe('quarter')
  })

  it('is half for 1 source once it reaches 5 fragments — the soft floor', () => {
    expect(supportBand(1, 5)).toBe('half')
    expect(supportBand(1, 40)).toBe('half')
  })

  it('is half for 2 sources regardless of volume', () => {
    expect(supportBand(2, 1)).toBe('half')
    expect(supportBand(2, 30)).toBe('half')
  })

  it('is three-quarter for 3 to 4 sources', () => {
    expect(supportBand(3, 1)).toBe('three-quarter')
    expect(supportBand(4, 100)).toBe('three-quarter')
  })

  it('is full only for 5+ sources AND 8+ fragments', () => {
    expect(supportBand(5, 8)).toBe('full')
    expect(supportBand(9, 40)).toBe('full')
  })

  it('holds 5+ sources with fewer than 8 fragments at three-quarter', () => {
    expect(supportBand(5, 7)).toBe('three-quarter')
  })
})

describe('countSources', () => {
  it('counts distinct conversation, document and import-batch ids', () => {
    expect(
      countSources([
        frag({ conversationId: 'c1' }),
        frag({ conversationId: 'c1' }),
        frag({ conversationId: null, documentId: 'd1' }),
        frag({ conversationId: null, importBatchId: 'b1' }),
      ]),
    ).toBe(3)
  })

  it('counts the whole source-less template path as exactly one source', () => {
    const template = Array.from({ length: 12 }, () =>
      frag({ conversationId: null, documentId: null, importBatchId: null }),
    )
    expect(countSources(template)).toBe(1)
    // §17: substantial rows carrying no source id must not read as empty
    expect(computeDimensionSupport(template)).toBe('half')
  })

  it('is zero with no fragments', () => {
    expect(countSources([])).toBe(0)
  })
})

describe('computeDimensionSupport — the modifier', () => {
  it('returns empty for no fragments', () => {
    expect(computeDimensionSupport([])).toBe('empty')
  })

  it('leaves a healthy dimension at its structural band', () => {
    expect(computeDimensionSupport(spread(20, 5))).toBe('full')
  })

  it('demotes by exactly one band when a majority of fragments failed verification', () => {
    const fragments = [
      ...spread(11, 5, { evidence: [{ text: 'x'.repeat(80), verification: 'failed' }] }),
      ...spread(9, 5),
    ]
    // structural band is full (5 sources, 20 fragments); one demotion, not two
    expect(computeDimensionSupport(fragments)).toBe('three-quarter')
  })

  it('does NOT demote when unverifiable is the majority — that is the ingest path, not the evidence', () => {
    const fragments = spread(20, 5, {
      evidence: [{ text: 'x'.repeat(80), verification: 'unverifiable' }],
    })
    expect(computeDimensionSupport(fragments)).toBe('full')
  })

  it('demotes when a majority of fragments carry no evidence row on a path that produces them', () => {
    const fragments = [...spread(11, 5, { evidence: [] }), ...spread(9, 5)]
    expect(computeDimensionSupport(fragments)).toBe('three-quarter')
  })

  it('does not count a manual fragment as a missing-evidence failure — it has none by design', () => {
    const fragments = [
      ...spread(11, 5, { evidence: [], sourceType: 'manual' }),
      ...spread(9, 5),
    ]
    expect(computeDimensionSupport(fragments)).toBe('full')
  })

  it('demotes when the median evidence length is under the thin threshold', () => {
    const fragments = spread(20, 5, {
      evidence: [{ text: 'x'.repeat(THIN_EVIDENCE_CHARS - 1), verification: 'verified' }],
    })
    expect(computeDimensionSupport(fragments)).toBe('three-quarter')
  })

  it('demotes at most one band even when every trigger fires at once', () => {
    const fragments = spread(20, 5, {
      evidence: [{ text: 'x'.repeat(5), verification: 'failed' }],
    })
    expect(computeDimensionSupport(fragments)).toBe('three-quarter')
  })

  it('never promotes', () => {
    expect(computeDimensionSupport(spread(2, 1))).toBe('quarter')
  })

  it('never falls to empty — a dimension with fragments always shows something', () => {
    const fragments = spread(2, 1, { evidence: [{ text: 'x', verification: 'failed' }] })
    expect(computeDimensionSupport(fragments)).toBe('quarter')
  })

  it('does not demote while evidence is still backfilling — no rows anywhere means nothing measured', () => {
    // Every existing prod fragment looks like this until the backfill lands.
    expect(computeDimensionSupport(spread(20, 5, { evidence: [] }))).toBe('full')
    expect(computeDimensionSupport(spread(20, 5, { evidence: undefined }))).toBe('full')
  })
})
