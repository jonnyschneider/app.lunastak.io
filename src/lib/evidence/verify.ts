/**
 * Verify an evidence span against the source it claims to come from.
 *
 * Sources are NOT persisted (documents and bundles are ephemeral by design), so this runs at
 * ingest while the text is still in hand, and the three-state result is stored instead.
 *
 * `normaliseForMatch` strips markdown emphasis because models quote prose and drop formatting —
 * §14 measured that as an 11% false-failure rate before it was handled. It also expands
 * contractions, for the same reason found again on 2026-09-08.
 *
 * Pure by design: no I/O, no database, no model calls. The source text is passed in.
 */
export type Verification = 'verified' | 'unverifiable' | 'failed'

/** Shortest span we will treat as evidence. A four-character assent is not a citation. */
export const MIN_SPAN_CHARS = 12

/**
 * Contractions, expanded on BOTH sides so it does not matter which form each used.
 *
 * WHY: a model quoting speech will silently contract or expand a verb — faithful to the meaning,
 * not to the characters. Found on a real document: the transcript said "so I have seen some stuff
 * that does things like that", the model quoted "I've seen some stuff that does things like that",
 * and 97 otherwise character-perfect characters failed on one apostrophe. That was reported as a
 * fabrication before it was read properly. Same class as §14's markdown gotcha, and as task 15-27.
 *
 * ⚠ AMBIGUOUS FORMS ARE DELIBERATELY ABSENT. `'s` is is/has/possessive — expanding it would turn
 * "the builder's margin" into "the builder is margin" and break a correct match. `'d` is
 * would/had, equally undecidable. Both are left alone: a false NEGATIVE here costs one flagged
 * row, a false POSITIVE would let an actual misquote through as verified.
 */
const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, 'i am'],
  [/\b(i|you|we|they|would|could|should|might|must)'ve\b/g, '$1 have'],
  [/\b(i|you|he|she|it|we|they|that|there)'ll\b/g, '$1 will'],
  [/\b(you|we|they)'re\b/g, '$1 are'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\b(do|does|did|is|are|was|were|has|have|had|would|could|should|must|ain)n't\b/g, '$1 not'],
  [/\blet's\b/g, 'let us'],
]

export function normaliseForMatch(text: string): string {
  let t = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[*_`#]+/g, '')
  for (const [re, to] of CONTRACTIONS) t = t.replace(re, to)
  return t.replace(/\s+/g, ' ').trim()
}

export function verifySpan(span: string, source: string | null | undefined): Verification {
  // An empty source is the same fact as an absent one: there was nothing to check against. A
  // conversation with no turns of a role joins to '', and reading that as `failed` — "the source
  // was there and the span was not in it" — would demote fragments for a check never performed.
  if (source == null || source.trim() === '') return 'unverifiable'
  if (!span || span.trim().length < MIN_SPAN_CHARS) return 'failed'
  return normaliseForMatch(source).includes(normaliseForMatch(span)) ? 'verified' : 'failed'
}
