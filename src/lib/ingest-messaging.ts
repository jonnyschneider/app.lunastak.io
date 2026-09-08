/**
 * The words the app uses when context arrives — for every path that brings it in.
 *
 * WHY THIS EXISTS. Bundle import, document upload and conversation extraction are three
 * mechanisms but ONE user-facing event: context was added to your project. They had drifted into
 * three vocabularies — "20 ground truths added… Check what was extracted", `"file.md" processed`,
 * and "Ready for you to check / then build your strategy" — which read as three different products
 * (measured on preview, 2026-09-08).
 *
 * ⚠ THIS IS A NARROW EXCEPTION TO "CALLERS OWN MESSAGING".
 * `docs/architecture/background-task-messaging.md` deliberately has no default message table,
 * because one keyed by action forces every future action into a preexisting slot. That reasoning
 * still stands and this does not break it: this is a preset for ONE family of event, not a
 * registry for all of them. Callers still pass `TaskMessaging`; ingest callers just build theirs
 * from here instead of hand-rolling strings. Generation, opportunities and refresh keep owning
 * their own copy, because they are not this event.
 *
 * ⚠ ADDITIVE, NEVER TERMINAL. Two of the three used to end with "then build your strategy", which
 * frames every ingest as the last one — while the natural behaviour is to add a bundle, then a
 * document, then a chat, and review the lot once. The review is a standing state of the
 * pre-strategy project page, not a per-ingest gate, so the copy should never imply otherwise.
 * The Build action lives on the review itself and does not need advertising three times.
 */

/** Every way context can arrive. Add a case here and the wording follows automatically. */
export type IngestSource = 'conversation' | 'document' | 'bundle'

const SOURCE_NOUN: Record<IngestSource, string> = {
  conversation: 'conversation',
  document: 'document',
  bundle: 'context bundle',
}

/** "1 ground truth" / "8 ground truths" — the unit the user sees everywhere else in the app. */
export function groundTruths(n: number): string {
  return `${n} ground truth${n === 1 ? '' : 's'}`
}

export interface IngestCompletion {
  title: string
  description: string
}

/**
 * What to say when an ingest finishes.
 *
 * @param source     which path brought the context in
 * @param count      how many ground truths this ingest added, when known
 * @param total      the project's total afterwards, when known — turns "8 added" into "8 of 34",
 *                   which is what makes accumulating across several ingests legible
 * @param hasStrategy whether a strategy already exists. If it does, the review is NOT on screen —
 *                   it lives in the knowledgebase panel — so the copy must not imply otherwise.
 */
export function ingestComplete({
  source,
  count,
  total,
  hasStrategy = false,
}: {
  source: IngestSource
  count?: number
  total?: number
  hasStrategy?: boolean
}): IngestCompletion {
  const added = count === undefined ? 'Context added' : `${groundTruths(count)} added`
  const title = `${added} from your ${SOURCE_NOUN[source]}`

  const running = total !== undefined && total !== count
    ? `That is ${total} in all.`
    : ''

  const where = hasStrategy
    ? 'Check them under Summary and ground truths in your knowledgebase.'
    : 'Check them whenever you are ready — add more first if you want to.'

  return { title, description: [running, where].filter(Boolean).join(' ') }
}

/** What the status banner says while an ingest is still running. */
export function ingestRunning(source: IngestSource): string {
  switch (source) {
    case 'conversation':
      return 'Reading what you told me...'
    case 'document':
      return 'Reading your document...'
    case 'bundle':
      return 'Reading your bundle...'
  }
}

/** What to say when an ingest fails. The context is never lost, so say so. */
export function ingestFailed(source: IngestSource): IngestCompletion {
  return {
    title: `Couldn't read your ${SOURCE_NOUN[source]}`,
    description:
      source === 'conversation'
        ? 'Your conversation is saved — nothing was lost.'
        : 'Nothing was lost. Try again, or get in touch if it keeps happening.',
  }
}
