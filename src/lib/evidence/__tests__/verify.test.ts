/**
 * Span verification must tolerate the way models actually quote.
 *
 * §14 of the ground-truth spike found the trap that would otherwise ship silently: the model
 * quotes prose faithfully but DROPS MARKDOWN FORMATTING. A source containing
 *
 *   **This is the critical engagement hook.** If Lunastak…
 *
 * comes back as
 *
 *   This is the critical engagement hook. If Lunastak…
 *
 * — same words, no asterisks. A naive substring check calls that a failure. It was an entire 11%
 * "failure" rate that belonged to the checker, not the model. `normaliseForMatch` is what stops it,
 * and these tests exist so it cannot regress.
 *
 * The other load-bearing case: `verifySpan(span, null)` is 'unverifiable', NOT 'failed'. Imported
 * bundles have no retrievable source — sources are never persisted — and scoring "couldn't check"
 * as "failed the check" would penalise a whole ingest path for a reason unrelated to quality.
 */

import { describe, it, expect } from 'vitest'
import { verifySpan, normaliseForMatch } from '@/lib/evidence/verify'

describe('verifySpan', () => {
  it('verifies an exact span', () => {
    expect(verifySpan('builders keep it opaque', 'Well, builders keep it opaque, mostly.')).toBe('verified')
  })

  it('verifies across markdown emphasis in the SOURCE (the 2026-09-04 trap)', () => {
    const source = 'Text before. **This is the critical engagement hook.** If Lunastak is only for planning.'
    expect(verifySpan('This is the critical engagement hook. If Lunastak is only for planning', source)).toBe('verified')
  })

  it('verifies across smart quotes and collapsed whitespace', () => {
    expect(verifySpan("they can't estimate it", 'so they can’t   estimate it properly')).toBe('verified')
  })

  it('fails a span that is not in the source', () => {
    expect(verifySpan('builders protect their margin', 'Nothing about pricing here at all.')).toBe('failed')
  })

  it('fails a span too short to be meaningful', () => {
    expect(verifySpan('Both', 'The answer was Both, apparently.')).toBe('failed')
  })

  /**
   * Found 2026-09-08 in the gate baseline, on a real document.
   *
   * Source:  "…so I have seen some stuff that does things like that. But from, like,
   *            kind of a pre -selected library."
   * Model:   "I've seen some stuff that does things like that. But from, like,
   *            kind of a pre -selected library."
   *
   * One contraction. The other 97 characters are exact, including the ASR's odd `pre -selected`
   * spacing, which the model preserved faithfully. It was reported as the first observed
   * extraction-path fabrication and it was nothing of the kind — the same silent-tidying class as
   * task 15-27, and the same shape as the markdown gotcha above: the model is faithful, the
   * checker is not.
   *
   * Expansion runs on BOTH sides, so it does not matter which form each one used.
   */
  it('verifies across a contraction the model expanded or contracted', () => {
    const source = 'Yeah, so I have seen some stuff that does things like that. But from, like, kind of a pre -selected library.'
    expect(verifySpan("I've seen some stuff that does things like that", source)).toBe('verified')
  })

  it('verifies when the SOURCE is contracted and the model expanded it', () => {
    expect(verifySpan('we do not price it that way', "Honestly we don't price it that way, never have.")).toBe('verified')
  })

  it('leaves a possessive apostrophe alone', () => {
    // "the builder's margin" must not become "the builder is margin".
    expect(verifySpan("the builder's margin is the issue", "I think the builder's margin is the issue here")).toBe('verified')
  })

  it('still fails a span that is genuinely absent, contractions notwithstanding', () => {
    expect(verifySpan("I've never seen anything like it", 'They have seen some stuff that does things like that.')).toBe('failed')
  })

  it('returns unverifiable when there is no source to check against', () => {
    expect(verifySpan('anything at all here', null)).toBe('unverifiable')
  })

  it('treats an EMPTY source as no source — unverifiable, not failed', () => {
    // An empty (or whitespace-only) source is the same fact as a null one: there was nothing to
    // check against. `failed` means "the source was there and the span was not in it".
    expect(verifySpan('anything at all here', '')).toBe('unverifiable')
    expect(verifySpan('anything at all here', '   \n  ')).toBe('unverifiable')
  })
})

describe('normaliseForMatch', () => {
  it('strips markdown emphasis markers', () => {
    expect(normaliseForMatch('**bold** and _italic_ and `code` and # heading')).toBe(
      'bold and italic and code and heading'
    )
  })

  it('folds smart quotes to their ASCII equivalents', () => {
    // A possessive, deliberately: it exercises the curly-apostrophe fold without also tripping
    // contraction expansion, and doubles as a guard that a possessive is NOT expanded.
    expect(normaliseForMatch('“the builder’s margin”')).toBe('"the builder\'s margin"')
  })

  it('folds a curly apostrophe BEFORE expanding, so a smart-quoted contraction still expands', () => {
    expect(normaliseForMatch('they can’t')).toBe('they can not')
  })

  it('collapses runs of whitespace and trims', () => {
    expect(normaliseForMatch('  a \n\t b   c  ')).toBe('a b c')
  })

  it('is case-insensitive', () => {
    expect(normaliseForMatch('Mixed CASE')).toBe('mixed case')
  })
})
