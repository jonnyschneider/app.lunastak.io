/**
 * The ground-truth review is keyed on the INGEST, not the project.
 *
 * ⚠ CHANGED 2026-09-10, after the per-project model shipped to prod in 2.8.0. That model was "one
 * first look per project", so a single deferral meant no later ingest ever offered a review again —
 * a bundle imported 26 seconds after deferring a document's review landed straight on the dashboard
 * (prod project `cmtvgo1zl…`). Each ingest is its own moment of high context: the user has just
 * handed something over and wants to see what was drawn from it. So each gets its own look.
 *
 * The key is used in three places, which is why it has one definition:
 *   - the `?batch=` param that filters the review to one ingest,
 *   - the `itemKey` of its `ground_truth_review` row in `UserDismissal` ("Review these later"),
 *   - the fragments API's `reviewBatch` field, so the review can filter client-side.
 *
 * Chats are deliberately absent: a conversation's extraction finishes in the background, often after
 * the user has moved on, and the pre-strategy review is for material handed over in one piece.
 */

export type ReviewBatchSource = 'document' | 'bundle'

const PREFIX: Record<ReviewBatchSource, string> = { document: 'doc', bundle: 'bundle' }

export function reviewBatchKey(source: ReviewBatchSource, id: string): string {
  return `${PREFIX[source]}:${id}`
}

/**
 * `?batch=` is user input, and `UserDismissal.itemKey` holds legacy rows from the per-project model
 * (`itemKey = projectId`). Anything that is not exactly `doc:<id>` or `bundle:<id>` is null — never
 * guessed at — so junk cannot filter the review down to nothing, and a legacy row cannot be mistaken
 * for a deferral of some ingest.
 */
export function parseReviewBatchKey(key: string | null | undefined): { source: ReviewBatchSource; id: string } | null {
  if (!key) return null
  const match = /^(doc|bundle):(.+)$/.exec(key)
  if (!match) return null
  return { source: match[1] === 'doc' ? 'document' : 'bundle', id: match[2] }
}

/** The most recent ingest whose review has not been deferred, or null when every one has had its look. */
export function pickPendingBatch(batches: { key: string; at: Date }[], deferred: Set<string>): string | null {
  const pending = batches
    .filter((b) => !deferred.has(b.key))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
  return pending[0]?.key ?? null
}
