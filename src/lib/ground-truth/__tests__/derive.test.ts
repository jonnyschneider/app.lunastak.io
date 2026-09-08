/**
 * The review's view model is pure, so it gets the coverage the prototype never needed.
 *
 * Four of these guard decisions that were made against real data and would be easy to undo by
 * accident — each names the reasoning it protects.
 */
import { describe, it, expect } from 'vitest'
import {
  buildGateModel, groupByDimension, isLunaTalkingToItself, isNotGroundTruth, toItem,
  type ApiFragment, type ApiResponse,
} from '../derive'

const frag = (over: Partial<ApiFragment> = {}): ApiFragment => ({
  id: 'f1', title: 'A claim', content: 'The full content of the claim.', contentType: 'theme',
  status: 'active', sourceType: 'extraction', interpretationType: 'verbatim', reviewedAt: null,
  dimensions: [{ dimension: 'CUSTOMER_MARKET', confidence: 'HIGH' }],
  source: { type: 'document', id: 'd1', name: '2026-09-02-voice-memo-001.md' },
  capturedAt: '2026-09-07T00:00:00.000Z',
  evidence: [{ text: 'a'.repeat(120), verification: 'verified', sourceRole: 'document', ordinal: 0 }],
  ...over,
})
const res = (fragments: ApiFragment[]): ApiResponse =>
  ({ fragments, total: fragments.length, activeCount: fragments.length, archivedCount: 0 })

describe('exclusions — things that are not the user’s ground truth', () => {
  // Task 15-29: conversation extraction can build a "theme" entirely out of Luna's own turns.
  // With no user assent at all it is Luna quoting itself, which §13 distinguishes from seeding.
  it('drops a fragment whose every span is the assistant’s', () => {
    const f = frag({ evidence: [
      { text: 'x'.repeat(90), verification: 'failed', sourceRole: 'assistant', ordinal: 0 },
      { text: 'y'.repeat(90), verification: 'failed', sourceRole: 'assistant', ordinal: 1 },
    ] })
    expect(isLunaTalkingToItself(f)).toBe(true)
    expect(buildGateModel(res([f])).total).toBe(0)
  })

  it('keeps a fragment where only SOME spans are the assistant’s — that is seeding, not authorship', () => {
    const f = frag({ evidence: [
      { text: 'x'.repeat(90), verification: 'failed', sourceRole: 'assistant', ordinal: 0 },
      { text: 'y'.repeat(90), verification: 'verified', sourceRole: 'user', ordinal: 1 },
    ] })
    expect(isLunaTalkingToItself(f)).toBe(false)
  })

  // Task 15-28: a bundle tension is the skill's reading ACROSS themes, so it cannot cite a span.
  it('drops a bundle tension by type, and by legacy title for rows imported before typing', () => {
    expect(isNotGroundTruth(frag({ contentType: 'tension' }))).toBe(true)
    expect(isNotGroundTruth(frag({ title: 'Strategic tension', contentType: 'insight' }))).toBe(true)
    expect(isNotGroundTruth(frag())).toBe(false)
  })
})

describe('labels', () => {
  // A claim cut mid-word is disorienting exactly where a judgement is being asked for.
  it('never truncates a derived label, however long the content', () => {
    const long = 'A very long strategic observation that runs well past any sensible heading length and keeps going regardless'
    const item = toItem(frag({ title: 'Strategic tension', content: long }))
    expect(item.titleIsDerived).toBe(true)
    expect(item.claim).not.toContain('…')
  })

  it('uses a real title as-is', () => {
    expect(toItem(frag({ title: '  A real title  ' })).claim).toBe('A real title')
  })

  // A row needs the ingest PATH; the filename is one tap away — unless it is the only way to tell
  // two documents apart.
  it('says "Document" for a lone document and a filename when there are several', () => {
    const a = frag({ id: 'a', source: { type: 'document', id: 'd1', name: 'alpha-notes.md' } })
    const b = frag({ id: 'b', source: { type: 'document', id: 'd2', name: 'beta-notes.md' } })
    expect(buildGateModel(res([a])).confident[0].sourceShort).toBe('Document')
    const two = buildGateModel(res([a, b]))
    expect(two.confident.map(i => i.sourceShort)).toEqual(['alpha-notes', 'beta-notes'])
  })

  it('numbers conversations instead of printing their generated title', () => {
    const f = frag({ source: { type: 'conversation', id: 'c1', name: 'Would flat-pack manufacturers bid on…' } })
    expect(toItem(f, new Map([['c1', 1]])).sourceShort).toBe('Chat 1')
  })

  it('names a bundle by its import date, because no bundle filename is stored', () => {
    const f = frag({ source: null, sourceType: 'import' })
    expect(toItem(f).sourceShort).toBe('Bundle')
    expect(toItem(f).sourceName).toContain('Context bundle')
  })
})

describe('grouping', () => {
  // The taxonomy's own order, so the review reads like the Knowledgebase coverage grid.
  it('orders groups by TIER_1_DIMENSIONS and sorts untagged last', () => {
    const items = [
      toItem(frag({ id: '1', dimensions: [{ dimension: 'STRATEGIC_INTENT', confidence: null }] })),
      toItem(frag({ id: '2', dimensions: [] })),
      toItem(frag({ id: '3', dimensions: [{ dimension: 'CUSTOMER_MARKET', confidence: null }] })),
    ]
    expect(groupByDimension(items).map(g => g.label))
      .toEqual(['Customer & Market', 'Strategic Intent', 'Not filed anywhere'])
  })
})

describe('flagging', () => {
  it('flags a fragment with no evidence at all', () => {
    expect(toItem(frag({ evidence: [] })).weakReason).toBe('no-evidence')
  })

  // A fragment is thin on its STRONGEST span: one long span it can stand on is not made weak by a
  // short one sitting beside it.
  it('is not thin when one span clears the threshold', () => {
    const f = frag({ evidence: [
      { text: 'short', verification: 'verified', sourceRole: 'document', ordinal: 0 },
      { text: 'b'.repeat(120), verification: 'verified', sourceRole: 'document', ordinal: 1 },
    ] })
    expect(toItem(f).weakReason).toBeNull()
  })

  it('ignores archived fragments entirely', () => {
    expect(buildGateModel(res([frag({ status: 'archived' })])).total).toBe(0)
  })
})
