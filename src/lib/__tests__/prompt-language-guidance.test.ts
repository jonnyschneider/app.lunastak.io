/**
 * Ratchet: language guidance has ONE definition, and every prose prompt gets it.
 *
 * Two rules established 2026-08-27, both from failures already observed:
 *
 * 1. **No re-inlining.** `knowledge-summary.ts` and `synthesis/full-synthesis.ts`
 *    each carried a hand-typed paraphrase of the plain-language guidance instead
 *    of importing it, and both copies had already drifted shorter than the shared
 *    constant. A paraphrase is how guidance silently stops matching itself.
 *
 * 2. **Every prose prompt carries the voice constraint.** The Claude-ish register
 *    was measured as a constant across four model arms in the 2026-08-26
 *    model-bump experiment, i.e. a property of the prompt layer. A prompt that
 *    generates prose without VOICE_CONSTRAINT reintroduces it.
 *
 * 3. **Question and gap titles do not take the objective title rules.**
 *    `PLAIN_LANGUAGE_TITLE_GUIDANCE` asks "does it start with a verb or an
 *    outcome?", which is right for a commitment and wrong for a question — it
 *    converted "What would kill this fastest?" into "Test the smallest version
 *    first" and "Who actually screws the kitchen to the wall?" into "Decide who
 *    installs the kitchen" (measured 2026-08-27, `voice-constraint-ab/`). The
 *    question/gap prompts import `QUESTION_TITLE_GUIDANCE` instead.
 *
 * The ALLOW set below only shrinks.
 */

import * as fs from 'fs'
import * as path from 'path'
import { describe, it, expect } from 'vitest'

const SRC = path.join(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')

/** Every prompt that generates user-facing prose. */
const PROSE_PROMPT_FILES = [
  'lib/pipeline/generation.ts',
  'lib/knowledge-summary.ts',
  'lib/synthesis/full-synthesis.ts',
]

/**
 * Phrases that only appear in a hand-inlined paraphrase of the shared guidance.
 * The shared constants live in `prompts/shared/`, which is exempt: it is the
 * definition.
 */
const PARAPHRASE_TELLS = [
  'Plain-language constraint:',
  'framework vocabulary lifted from the source',
  'framework vocabulary from the source',
]

describe('language guidance is imported, never re-inlined', () => {
  for (const file of PROSE_PROMPT_FILES) {
    it(`${file} imports the shared constants`, () => {
      const src = read(file)
      expect(src).toMatch(/from ['"][@./\w-]*shared\/voice['"]/)
    })

    it(`${file} contains no hand-inlined paraphrase`, () => {
      const src = read(file)
      for (const tell of PARAPHRASE_TELLS) {
        expect(src, `re-inlined guidance found: "${tell}"`).not.toContain(tell)
      }
    })

    it(`${file} interpolates VOICE_CONSTRAINT`, () => {
      expect(read(file)).toContain('${VOICE_CONSTRAINT}')
    })
  }
})

/** Prompts whose only titles are questions or gaps. */
const QUESTION_TITLE_FILES = [
  'lib/knowledge-summary.ts',
  'lib/synthesis/full-synthesis.ts',
]

describe('question and gap titles use their own rules', () => {
  for (const file of QUESTION_TITLE_FILES) {
    it(`${file} does not apply the objective title guidance`, () => {
      expect(read(file), 'objective/opportunity title rules turn questions into instructions')
        .not.toContain('PLAIN_LANGUAGE_TITLE_GUIDANCE')
    })

    it(`${file} interpolates QUESTION_TITLE_GUIDANCE`, () => {
      expect(read(file)).toContain('${QUESTION_TITLE_GUIDANCE}')
    })
  }
})

describe('the voice constraint does not commit the tics it bans', () => {
  const body = read('lib/prompts/shared/voice.ts')
    .split('export const VOICE_CONSTRAINT')[1]

  it('uses em-dashes only inside the ✗ examples', () => {
    const offenders = body
      .split('\n')
      .filter(l => l.includes('—') && !l.trimStart().startsWith('- ✗'))
    expect(offenders, `em-dash outside a ✗ example:\n${offenders.join('\n')}`).toEqual([])
  })
})
