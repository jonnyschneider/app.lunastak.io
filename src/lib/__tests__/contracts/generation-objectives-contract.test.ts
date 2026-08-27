/**
 * Contract: generation always yields at least one PARSEABLE objective.
 *
 * The boundary this guards is not "did the model write objectives" — it did,
 * every time. It is "did they survive the parse into the Decision Stack".
 * Those came apart on 2026-08-27 and nothing noticed for as long as the current
 * prompt shape has existed.
 *
 * WHY A CONTRACT TEST AND NOT ONLY A UNIT TEST. `objectives-wrapper-recovery`
 * pins `extractObjectivesXML`. This pins the thing that actually matters: the
 * end-to-end path from a real model response to objectives on the stack. The
 * helper could stay perfect while a caller stops using it, or a fourth
 * malformation appears, and the unit test would still pass.
 *
 * The fixtures below are the real malformations observed in captured output,
 * trimmed but structurally verbatim. Add to them whenever a new one is found —
 * that is the point of the file.
 */

import { extractXML, parseOKRObjectives, extractObjectivesXML } from '@/lib/utils'
import { validateGenerationOutput } from '@/lib/contracts/generation'

/** Exactly the parse in runInitialGeneration / runRefreshGeneration. */
function parseObjectivesLikeProduction(content: string) {
  const statementsXML = extractXML(content, 'statements')
  const objectivesXML = extractObjectivesXML(statementsXML)
  return objectivesXML.includes('<objective>') ? parseOKRObjectives(objectivesXML) : []
}

const SHAPES: Record<string, string> = {
  /** The format the prompt actually specifies. */
  'well-formed (wrapper present)': `<statements>
  <vision><headline>V</headline><elaboration>VE</elaboration></vision>
  <strategy><headline>S</headline><elaboration>SE</elaboration></strategy>
  <objectives>
    <objective><title>One</title><statement>A</statement></objective>
    <objective><title>Two</title><statement>B</statement></objective>
  </objectives>
</statements>`,

  /**
   * Measured 2026-08-27: 0 of 16 pre-split responses carried the wrapper,
   * across claude-opus-5 @ effort:low AND claude-sonnet-4-5.
   */
  'no <objectives> wrapper (2026-08-27)': `<statements>
  <vision><headline>Know what your kitchen costs</headline></vision>
  <strategy><headline>Bring the judgement forward</headline></strategy>
  <objective>
      <title>Give a real number early</title>
      <statement>A price during design, not after.</statement>
    </objective>
  <objective>
      <title>Produce specs shops manufacture from</title>
      <statement>Drawings that need no rework.</statement>
    </objective>
</statements>`,

  /**
   * Measured 2026-08-26: tag imbalance in 8 of 40 XML responses across all four
   * model arms — the model closed <strategy> with </objectives>.
   */
  'mis-closed <strategy> (2026-08-26)': `<statements>
  <vision><headline>V</headline></vision>
  <strategy>
    <headline>Aggregate custom joinery demand into software.</headline>
  </objectives>
  <objectives>
    <objective><title>Recovered one</title><statement>A</statement></objective>
  </objectives>
</statements>`,
}

describe('CONTRACT: generation yields at least one parseable objective', () => {
  for (const [shape, xml] of Object.entries(SHAPES)) {
    it(`${shape} → objectives reach the stack`, () => {
      const objectives = parseObjectivesLikeProduction(xml)
      expect(
        objectives.length,
        `${shape}: the model wrote objectives and the parse dropped them. ` +
        `This is the 2026-08-27 failure class — malformed structure that degrades ` +
        `silently instead of failing.`,
      ).toBeGreaterThan(0)
      // Recovered, not invented: every objective carries real content.
      for (const o of objectives) expect(o.title || o.objective).toBeTruthy()
    })
  }

  it('does not leak vision or strategy prose into an objective', () => {
    const objectives = parseObjectivesLikeProduction(SHAPES['no <objectives> wrapper (2026-08-27)'])
    const blob = JSON.stringify(objectives)
    expect(blob).not.toContain('Know what your kitchen costs')
    expect(blob).not.toContain('Bring the judgement forward')
  })
})

describe('CONTRACT: an empty objectives layer is not a valid Decision Stack', () => {
  const stack = (objectives: unknown[]) => ({
    traceId: 't1',
    thoughts: 'x',
    statements: { vision: 'V', strategy: 'S', objectives },
  })

  it('rejects zero objectives — the exact signature of the parse failure', () => {
    expect(validateGenerationOutput(stack([]))).toBe(false)
  })

  it('accepts a stack that has them', () => {
    expect(validateGenerationOutput(stack([{ id: 'o1', title: 'One' }]))).toBe(true)
  })
})
