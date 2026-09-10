/**
 * One ingest, one review.
 *
 * ⚠ THE MODEL CHANGED ON 2026-09-10, AND THE OLD ONE SHIPPED. The review was keyed on the PROJECT —
 * "one first look per project" — so deferring it once meant no later ingest ever offered a review
 * again. On prod that meant a context bundle imported 26 seconds after a deferral landed straight on
 * the dashboard, with its 20 new ground truths never shown as the focused thing they arrived as.
 *
 * Every ingest is a moment of high context: the user has just handed something over and wants to
 * see what was drawn from it. A second bundle is exactly as high-context as the first. So the key
 * is the ingest — the document, or the import batch — and each one gets its own look.
 */
import { reviewBatchKey, parseReviewBatchKey, pickPendingBatch } from '../review-batch'

describe('reviewBatchKey', () => {
  it('keys a document and a bundle into distinct namespaces', () => {
    expect(reviewBatchKey('document', 'abc')).toBe('doc:abc')
    expect(reviewBatchKey('bundle', 'abc')).toBe('bundle:abc')
  })

  it('round-trips through the parser', () => {
    expect(parseReviewBatchKey('doc:abc')).toEqual({ source: 'document', id: 'abc' })
    expect(parseReviewBatchKey('bundle:x-1')).toEqual({ source: 'bundle', id: 'x-1' })
  })

  it('rejects anything that is not a batch key, rather than guessing', () => {
    // A URL param is user input. `?batch=banana` must not filter the review to nothing.
    for (const junk of ['', 'abc', 'doc:', 'chat:abc', 'bundle', null, undefined]) {
      expect(parseReviewBatchKey(junk as string | null | undefined)).toBeNull()
    }
  })

  it('does not confuse a legacy per-project dismissal with a batch', () => {
    // The old model wrote `itemKey = projectId`. Those rows must read as "not a batch" — ignored,
    // not mistaken for a dismissal of some ingest.
    expect(parseReviewBatchKey('cmtvgo1zl00035xhgbuyqp8s9')).toBeNull()
  })
})

describe('pickPendingBatch', () => {
  const at = (m: number) => new Date(Date.UTC(2026, 8, 10, 11, m))

  it('offers the most recent ingest that has not been deferred', () => {
    const batches = [
      { key: 'doc:a', at: at(47) },
      { key: 'bundle:b', at: at(51) },
    ]
    expect(pickPendingBatch(batches, new Set())).toBe('bundle:b')
  })

  it('skips a deferred ingest and falls back to an older one still pending', () => {
    const batches = [
      { key: 'doc:a', at: at(47) },
      { key: 'bundle:b', at: at(51) },
    ]
    expect(pickPendingBatch(batches, new Set(['bundle:b']))).toBe('doc:a')
  })

  it('is null once every ingest has had its look', () => {
    const batches = [{ key: 'doc:a', at: at(47) }]
    expect(pickPendingBatch(batches, new Set(['doc:a']))).toBeNull()
  })

  it('reproduces the prod case: the deferral no longer swallows the later bundle', () => {
    // cmtvgo1zl… on 2026-09-10: doc extracted 11:47, review deferred 11:50:36, bundle 11:51:02.
    // Under the old per-project key the deferral covered both. Per ingest, it covers the doc only.
    const batches = [
      { key: 'doc:d', at: at(47) },
      { key: 'bundle:b', at: at(51) },
    ]
    expect(pickPendingBatch(batches, new Set(['doc:d']))).toBe('bundle:b')
  })

  it('is null for a project with no ingests', () => {
    expect(pickPendingBatch([], new Set())).toBeNull()
  })
})
