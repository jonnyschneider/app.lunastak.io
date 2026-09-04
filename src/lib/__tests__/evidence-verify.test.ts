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

  it('returns unverifiable when there is no source to check against', () => {
    expect(verifySpan('anything at all here', null)).toBe('unverifiable')
  })
})

describe('normaliseForMatch', () => {
  it('strips markdown emphasis markers', () => {
    expect(normaliseForMatch('**bold** and _italic_ and `code` and # heading')).toBe(
      'bold and italic and code and heading'
    )
  })

  it('folds smart quotes to their ASCII equivalents', () => {
    expect(normaliseForMatch('“they can’t”')).toBe('"they can\'t"')
  })

  it('collapses runs of whitespace and trims', () => {
    expect(normaliseForMatch('  a \n\t b   c  ')).toBe('a b c')
  })

  it('is case-insensitive', () => {
    expect(normaliseForMatch('Mixed CASE')).toBe('mixed case')
  })
})
