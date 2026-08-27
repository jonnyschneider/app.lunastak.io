/**
 * extractXML must not leak a stray closing tag into extracted prose.
 *
 * Real failure, 2026-08-27 (preview UAT of the seam-consolidation branch, PR #30):
 * the third objective rendered on the card front as
 *
 *   "Direct subscriptions grow as the margin engine of the business while our top
 *    wholesale accounts stay, renew and say they understand where we are going.</explanation>"
 *
 * The model emitted a stray, unmatched </explanation> immediately before the true
 * </statement>. The STRICT `<tag>(.*?)</tag>` match succeeded and returned the inner text
 * verbatim, stray markup included, and parseOKRObjectives persisted it into both `objective`
 * and `pithy`. Raw XML, rendered to the user, silently — no exception, no warning.
 *
 * This is the third variant in a documented family:
 *   1. mis-closed tag        (2026-08-26) — handled by the tolerant recovery path
 *   2. missing wrapper       (2026-08-27) — handled by extractObjectivesXML
 *   3. stray closing tag inside a well-closed element  ← this file
 *
 * Note the asymmetry that hid it: the tolerant path handles the HARDER malformation (no
 * closing tag at all) correctly. It never runs here, because the strict path SUCCEEDS. The
 * safety net only covered malformations that make the match FAIL.
 *
 * Recovery rule: drop closing tags that have no matching opening tag WITHIN the captured
 * span. Never remove legitimately nested well-formed markup — extractObjectivesXML depends
 * on nested <objective> blocks surviving inside <objectives> — and never invent content.
 */

import { extractXML, parseOKRObjectives } from '@/lib/utils'

describe('extractXML — stray closing tag inside a well-closed element (the 2026-08-27 failure)', () => {
  it('drops a stray closing tag that has no opening tag in the captured span', () => {
    expect(extractXML('<statement>going.</explanation></statement>', 'statement')).toBe('going.')
  })

  it('preserves legitimately nested well-formed markup', () => {
    // extractObjectivesXML relies on this: nested <objective> blocks must survive.
    const nested = '<objectives><objective><title>T</title></objective></objectives>'
    expect(extractXML(nested, 'objectives')).toBe('<objective><title>T</title></objective>')
  })

  it('leaves well-formed prose untouched', () => {
    expect(extractXML('<statement>plain prose</statement>', 'statement')).toBe('plain prose')
  })

  it('drops several stray closing tags', () => {
    expect(extractXML('<a>x</foo>y</bar></a>', 'a')).toBe('xy')
  })

  it('keeps a nested pair while dropping a stray beside it', () => {
    expect(extractXML('<a><b>x</b></foo></a>', 'a')).toBe('<b>x</b>')
  })
})

describe('parseOKRObjectives — the production objective that leaked', () => {
  // Reconstructed from the persisted value in preview project cmtbbnek2000255m84o8a1ehx,
  // component obj-1787824895859-2.
  const REAL = `<objective>
<title>Grow direct without losing the room</title>
<statement>Direct subscriptions grow as the margin engine of the business while our top wholesale accounts stay, renew and say they understand where we are going.</explanation></statement>
<explanation>Two accounts complained and one threatened to leave. The economics point to direct, so the growth has to come with a story cafe owners can hear.</explanation>
<omtm>Subscription Revenue</omtm>
<aspiration>Majority of gross profit</aspiration>
</objective>`

  it('does not persist raw markup in the objective statement', () => {
    const [obj] = parseOKRObjectives(REAL)
    expect(obj.objective).not.toContain('</explanation>')
    expect(obj.objective).toBe(
      'Direct subscriptions grow as the margin engine of the business while our top wholesale accounts stay, renew and say they understand where we are going.',
    )
  })

  it('does not persist raw markup in the pithy duplicate', () => {
    const [obj] = parseOKRObjectives(REAL)
    expect(obj.pithy).not.toContain('</explanation>')
  })

  it('still parses the real explanation, title and OMTM correctly', () => {
    const [obj] = parseOKRObjectives(REAL)
    expect(obj.title).toBe('Grow direct without losing the room')
    expect(obj.omtm).toBe('Subscription Revenue')
    expect(obj.aspiration).toBe('Majority of gross profit')
    expect(obj.explanation).toContain('Two accounts complained')
  })
})
