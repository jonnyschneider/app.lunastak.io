/**
 * Verify an evidence span against the source it claims to come from.
 *
 * Sources are NOT persisted (documents and bundles are ephemeral by design), so this runs at
 * ingest while the text is still in hand, and the three-state result is stored instead.
 *
 * `normaliseForMatch` strips markdown emphasis because models quote prose and drop formatting —
 * §14 measured that as an 11% false-failure rate before it was handled.
 *
 * Pure by design: no I/O, no database, no model calls. The source text is passed in.
 */
export type Verification = 'verified' | 'unverifiable' | 'failed'

/** Shortest span we will treat as evidence. A four-character assent is not a citation. */
export const MIN_SPAN_CHARS = 12

export function normaliseForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[*_`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function verifySpan(span: string, source: string | null | undefined): Verification {
  // An empty source is the same fact as an absent one: there was nothing to check against. A
  // conversation with no turns of a role joins to '', and reading that as `failed` — "the source
  // was there and the span was not in it" — would demote fragments for a check never performed.
  if (source == null || source.trim() === '') return 'unverifiable'
  if (!span || span.trim().length < MIN_SPAN_CHARS) return 'failed'
  return normaliseForMatch(source).includes(normaliseForMatch(span)) ? 'verified' : 'failed'
}
