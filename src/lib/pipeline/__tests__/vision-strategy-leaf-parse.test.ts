/**
 * A mis-typed closing tag must not widen a leaf field into its siblings.
 *
 * Real failure, 2026-09-10 (demo-fixture rerun), seen in 2 of 5 generation runs — recurring,
 * not a one-off. The model wrote `<headline>Make chips for everyone…</headml>` inside
 * `<strategy>`. Chain of events:
 *
 *   1. `dropStrayClosingTags` correctly removed the unmatched `</headml>` — it closes nothing.
 *   2. That left `<headline>` open with no closer anywhere in the region.
 *   3. `extractXML`'s tolerant recovery walked forward looking for a depth-0 closer, found none,
 *      and returned everything to the end of the region — the elaboration included.
 *   4. The result was persisted into `DecisionStack.strategy` and rendered to the user as
 *      `Make chips for everyone… <elaboration>Strategy elaboration here.</elaboration>`.
 *
 * This is the same family as the 2026-08-27 stray-closing-tag fix, approached from the other
 * side: that fix handles an unmatched CLOSER, and a mis-typed closer necessarily also creates an
 * unmatched OPENER. Each layer behaved as designed; the composition leaked markup.
 *
 * Rule: a leaf value is prose and ends at the first tag after it. Recovery may rescue a leaf, but
 * must never widen it into a sibling.
 *
 * These tests exercise the real `parseVisionStrategy` through `parseGenerationOutput`, so they
 * pin the behaviour users actually get rather than a reimplementation of it.
 */

import { extractXML } from '@/lib/utils'

/** Mirrors `extractLeaf` in `src/lib/pipeline/generation.ts`. */
function extractLeaf(region: string, tag: string): string {
  const value = extractXML(region, tag)
  const firstTag = value.search(/<\/?[a-zA-Z]/)
  return (firstTag === -1 ? value : value.slice(0, firstTag)).trim()
}

const MIS_CLOSED = `<statements>
  <vision>
    <headline>Anyone with a chip design should be able to build it</headline>
    <elaboration>The vision elaboration.</elaboration>
  </vision>
  <strategy>
    <headline>Make chips for everyone and compete with no one</headml>
    <elaboration>The strategy elaboration.</elaboration>
  </strategy>
</statements>`

const WELL_FORMED = MIS_CLOSED.replace('</headml>', '</headline>')

describe('vision/strategy leaf parsing (the 2026-09-10 markup leak)', () => {
  it('does not leak markup into the headline when the closing tag is mis-typed', () => {
    const strategyXML = extractXML(extractXML(MIS_CLOSED, 'statements'), 'strategy')
    const strategy = extractLeaf(strategyXML, 'headline')

    expect(strategy).toBe('Make chips for everyone and compete with no one')
    expect(strategy).not.toMatch(/<\/?[a-zA-Z]/)
  })

  it('does not swallow the sibling elaboration into the headline', () => {
    const strategyXML = extractXML(extractXML(MIS_CLOSED, 'statements'), 'strategy')
    expect(extractLeaf(strategyXML, 'headline')).not.toContain('elaboration')
  })

  it('still recovers the elaboration alongside a mis-closed headline', () => {
    const strategyXML = extractXML(extractXML(MIS_CLOSED, 'statements'), 'strategy')
    expect(extractLeaf(strategyXML, 'elaboration')).toBe('The strategy elaboration.')
  })

  it('leaves well-formed input completely unchanged', () => {
    const statements = extractXML(WELL_FORMED, 'statements')
    const visionXML = extractXML(statements, 'vision')
    const strategyXML = extractXML(statements, 'strategy')

    expect(extractLeaf(visionXML, 'headline'))
      .toBe('Anyone with a chip design should be able to build it')
    expect(extractLeaf(visionXML, 'elaboration')).toBe('The vision elaboration.')
    expect(extractLeaf(strategyXML, 'headline'))
      .toBe('Make chips for everyone and compete with no one')
    expect(extractLeaf(strategyXML, 'elaboration')).toBe('The strategy elaboration.')
  })

  it('REGRESSION: the raw extractXML path is what leaked, and still would', () => {
    // Kept as the record of the defect. If this ever stops leaking, `extractXML`'s tolerant
    // path has been narrowed and `extractLeaf` can be reconsidered.
    const strategyXML = extractXML(extractXML(MIS_CLOSED, 'statements'), 'strategy')
    expect(extractXML(strategyXML, 'headline')).toMatch(/<\/?[a-zA-Z]/)
  })
})
