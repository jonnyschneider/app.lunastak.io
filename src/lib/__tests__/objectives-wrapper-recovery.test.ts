/**
 * Objectives survive a missing <objectives> wrapper.
 *
 * Real failure, measured 2026-08-27 (Phase 2 seam work, both claude-opus-5 @
 * effort:low AND claude-sonnet-4-5 — so not a property of any one model):
 * the model emits bare <objective> siblings directly under <statements>, with
 * no <objectives> wrapper at all.
 *
 *   <statements>
 *     <vision>…</vision>
 *     <strategy>…</strategy>
 *     <objective><title>…</title></objective>   ← no wrapper
 *     <objective><title>…</title></objective>
 *   </statements>
 *
 * `extractXML(statementsXML, 'objectives')` correctly returns '' — that element
 * genuinely is not there. But the consumers then do:
 *
 *   const isOKRFormat = objectivesXML.includes('<objective>')   // false
 *   … else convertLegacyObjectives(objectivesXML.split('\n'))   // splits ''
 *
 * which yields ZERO objectives. No exception, no truncation, stop_reason
 * end_turn. The Decision Stack persists with an empty objectives layer while
 * three to five complete objectives sat in the response.
 *
 * Measured rate on the pre-split prompt: 0 of 16 responses parsed, across two
 * model generations. This is a sibling of the 2026-08-26 mis-closed-tag failure
 * (see extract-xml-tolerant.test.ts) — same family, different malformation:
 * that one closed the wrong tag, this one omits an element entirely.
 *
 * Recovery rule: if <objectives> is absent but <objective> elements exist in
 * the statements block, parse them from there. Never invent objectives.
 */

import { extractXML, parseOKRObjectives, extractObjectivesXML } from '@/lib/utils'

/** Trimmed from a real captured response; structure is verbatim. */
const NO_WRAPPER = `<statements>

<vision>
  <headline>Know what your kitchen costs before it's too late</headline>
  <elaboration>…</elaboration>
</vision>

<strategy>
  <headline>Bring the cabinet maker's judgement forward</headline>
  <elaboration>…</elaboration>
</strategy>

<objective>
    <title>Give a real number early</title>
    <statement>A price during design, not after.</statement>
  </objective>

<objective>
    <title>Produce specs shops manufacture from unchanged</title>
    <statement>Drawings that need no rework.</statement>
  </objective>

</statements>`

const WITH_WRAPPER = `<statements>
  <vision><headline>V</headline></vision>
  <strategy><headline>S</headline></strategy>
  <objectives>
    <objective><title>Wrapped one</title><statement>A</statement></objective>
    <objective><title>Wrapped two</title><statement>B</statement></objective>
  </objectives>
</statements>`

describe('extractObjectivesXML', () => {
  it('recovers bare <objective> siblings when the wrapper is missing', () => {
    const xml = extractObjectivesXML(NO_WRAPPER)
    expect(xml).toContain('<objective>')
    const objectives = parseOKRObjectives(xml)
    expect(objectives).toHaveLength(2)
    expect(objectives[0].title).toBe('Give a real number early')
    expect(objectives[1].title).toBe('Produce specs shops manufacture from unchanged')
  })

  it('uses the wrapper when it IS present (unchanged behaviour)', () => {
    const objectives = parseOKRObjectives(extractObjectivesXML(WITH_WRAPPER))
    expect(objectives).toHaveLength(2)
    expect(objectives[0].title).toBe('Wrapped one')
  })

  it('does not pull vision or strategy content into an objective', () => {
    const objectives = parseOKRObjectives(extractObjectivesXML(NO_WRAPPER))
    const blob = JSON.stringify(objectives)
    expect(blob).not.toContain('Know what your kitchen costs')
    expect(blob).not.toContain("cabinet maker's judgement")
  })

  it('invents nothing when there are genuinely no objectives', () => {
    const none = '<statements><vision><headline>V</headline></vision></statements>'
    expect(extractObjectivesXML(none)).toBe('')
    expect(parseOKRObjectives(extractObjectivesXML(none))).toHaveLength(0)
  })

  it('leaves the caller able to detect the OKR format either way', () => {
    for (const s of [NO_WRAPPER, WITH_WRAPPER]) {
      expect(extractObjectivesXML(s).includes('<objective>')).toBe(true)
    }
  })
})

/**
 * WHERE RECOVERY STOPS — a deliberate boundary, not an oversight.
 *
 * One response in sixteen (claude-sonnet-4-5, pre-split prompt) omitted the
 * <objective> wrappers as well, emitting bare <title>/<statement>/<explanation>
 * runs under <statements>.
 *
 * Recovering a missing <objectives> wrapper is safe: the <objective> elements
 * are self-delimiting, so grouping them is reading, not guessing. Recovering
 * missing <objective> wrappers means inferring where one objective ends and the
 * next begins. That is reconstruction, and a wrong guess fabricates a
 * commitment the model never made — worse than returning nothing, because it
 * looks like a real objective.
 *
 * Same call as the synthesis JSON repair, which also left one genuinely
 * malformed response to the fallback rather than inventing structure for it.
 * The split prompt eliminates this shape anyway.
 */
describe('recovery does not become reconstruction', () => {
  const NO_OBJECTIVE_WRAPPERS = `<statements>
  <vision><headline>V</headline></vision>
  <strategy><headline>S</headline></strategy>
  <title>Looks like an objective title</title>
  <statement>And a statement</statement>
  <explanation>And an explanation</explanation>
  <title>A second one</title>
  <statement>Second statement</statement>
  <explanation>Second explanation</explanation>
</statements>`

  it('returns nothing rather than inventing objective boundaries', () => {
    expect(extractObjectivesXML(NO_OBJECTIVE_WRAPPERS)).toBe('')
    expect(parseOKRObjectives(extractObjectivesXML(NO_OBJECTIVE_WRAPPERS))).toHaveLength(0)
  })
})

describe('the end-to-end parse path that was returning zero', () => {
  // Mirrors runInitialGeneration / runRefreshGeneration exactly.
  const parseLikeProduction = (content: string) => {
    const statementsXML = extractXML(content, 'statements')
    const objectivesXML = extractObjectivesXML(statementsXML)
    return objectivesXML.includes('<objective>') ? parseOKRObjectives(objectivesXML) : []
  }

  it('yields objectives from the real unwrapped response', () => {
    expect(parseLikeProduction(NO_WRAPPER).length).toBeGreaterThan(0)
  })
})
