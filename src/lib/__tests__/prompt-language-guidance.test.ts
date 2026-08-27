/**
 * Ratchet: every stage that produces user-facing prose resolves the guidance it
 * declares — DERIVED FROM `LLM_POLICY`, not from a hand-maintained file list.
 *
 * WHY THIS SHAPE. The predecessor listed four filenames. That inventory is the
 * bug it was meant to prevent: `incremental-synthesis.ts` writes the same
 * user-facing `summary` and `gaps[].title` as `full-synthesis.ts`, was missed,
 * was fixed in fde9b04 — and was never added to the list. The inventory that
 * failed went on failing, on the same file, silently, because nothing tells you
 * when a hand-list is incomplete.
 *
 * Iterating the policy table removes the failure mode rather than patching an
 * instance of it: a new stage is covered the moment it is classified, and the
 * type system already forced it to be classified. There is no list to update.
 *
 * The rules being enforced, each from a failure already observed:
 *
 * 1. **Every governed stage carries the voice constraint.** The Claude-ish
 *    register was measured as a constant across four model arms in the
 *    2026-08-26 model-bump experiment — i.e. a property of the prompt layer, not
 *    the model. A prose stage resolving without VOICE_CONSTRAINT reintroduces it.
 *
 * 2. **Question and gap titles do not take the objective title rules.**
 *    `PLAIN_LANGUAGE_TITLE_GUIDANCE` asks "does it start with a verb or an
 *    outcome?", which is right for a commitment and wrong for a question — it
 *    converted "What would kill this fastest?" into "Test the smallest version
 *    first" and "Who actually screws the kitchen to the wall?" into "Decide who
 *    installs the kitchen" (measured 2026-08-27, `voice-constraint-ab/`, fixed
 *    in 09a1050).
 *
 * 3. **No bundle may silently drop below the prompt-cache floor.** See the
 *    cache-floor block at the bottom — that one guards cost, not quality.
 */

import * as fs from 'fs'
import * as path from 'path'
import { describe, it, expect } from 'vitest'
import { LLM_POLICY, systemFor, guidanceBlock, type LlmContext, type GuidanceBundle } from '@/lib/llm/policy'
import { VOICE_CONSTRAINT } from '@/lib/prompts/shared/voice'
import {
  PLAIN_LANGUAGE_TITLE_GUIDANCE,
  PLAIN_LANGUAGE_EXPLAINER_GUIDANCE,
} from '@/lib/prompts/shared/plain-language'
import { QUESTION_TITLE_GUIDANCE } from '@/lib/prompts/shared/question-titles'
import { VISION_GUIDELINES, STRATEGY_GUIDELINES } from '@/lib/prompts/shared/vision-strategy'
import { OBJECTIVE_GUIDELINES } from '@/lib/prompts/shared/objectives'

const SRC = path.join(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')

const entries = Object.entries(LLM_POLICY) as [LlmContext, (typeof LLM_POLICY)[LlmContext]][]

describe('every governed stage resolves the guidance it declares', () => {
  const governed = entries.filter(([, p]) => p.guidance !== 'none' && p.guidance !== 'chat')

  it('there is at least one governed stage (guards a vacuous pass)', () => {
    expect(governed.length).toBeGreaterThan(0)
  })

  for (const [ctx, policy] of governed) {
    it(`${ctx} resolves a system block containing its declared guidance`, () => {
      const system = systemFor(ctx)
      expect(system, `${ctx} resolved no system block`).toBeDefined()
      expect(system).toContain(VOICE_CONSTRAINT)

      if (policy.guidance === 'question-gap') {
        expect(system).toContain(QUESTION_TITLE_GUIDANCE)
        expect(system).toContain(PLAIN_LANGUAGE_EXPLAINER_GUIDANCE)
        // 09a1050 — objective title rules turn questions into instructions.
        expect(system, 'objective title rules must not reach question/gap titles')
          .not.toContain(PLAIN_LANGUAGE_TITLE_GUIDANCE)
      }

      if (policy.guidance === 'opportunity') {
        expect(system).toContain(PLAIN_LANGUAGE_TITLE_GUIDANCE)
        expect(system).toContain(PLAIN_LANGUAGE_EXPLAINER_GUIDANCE)
      }

      if (policy.guidance === 'commitment') {
        expect(system).toContain(VISION_GUIDELINES)
        expect(system).toContain(STRATEGY_GUIDELINES)
        expect(system).toContain(OBJECTIVE_GUIDELINES)
      }
    })
  }
})

describe('structured stages receive no guidance', () => {
  for (const [ctx, policy] of entries.filter(([, p]) => p.guidance === 'none')) {
    it(`${ctx} resolves no system block`, () => {
      expect(systemFor(ctx), `${ctx} parses to XML/JSON — guidance is cost and parse risk`)
        .toBeUndefined()
      expect(policy.guidance).toBe('none')
    })
  }
})

describe('chat stages are classified but deliberately unauthored', () => {
  it('the chat bundle is empty, pending its own A/B (design D-6 / O-2)', () => {
    // If you are here because you filled this in: it needs a before/after on
    // real transcripts first. The voice constraint was measured on prose
    // artefacts, not on 30-300 token conversational turns.
    expect(guidanceBlock('chat')).toBe('')
  })
})

/**
 * The guidance is never re-inlined as a hand-typed paraphrase.
 *
 * `knowledge-summary.ts` and `synthesis/full-synthesis.ts` each carried one
 * instead of importing the constant, and both copies had already drifted
 * shorter than the shared original. A paraphrase is how guidance silently stops
 * matching itself. Now that the seam supplies guidance, a paraphrase anywhere
 * in the prompt layer is the only way it could come back.
 */
const PARAPHRASE_TELLS = [
  'Plain-language constraint:',
  'framework vocabulary lifted from the source',
  'framework vocabulary from the source',
]

const PROMPT_LAYER = [
  'lib/pipeline/generation.ts',
  'lib/knowledge-summary.ts',
  'lib/synthesis/full-synthesis.ts',
  'lib/synthesis/incremental-synthesis.ts',
  'app/api/extract/route.ts',
]

describe('language guidance is never re-inlined as a paraphrase', () => {
  for (const file of PROMPT_LAYER) {
    it(`${file} contains no hand-inlined paraphrase`, () => {
      const src = read(file)
      for (const tell of PARAPHRASE_TELLS) {
        expect(src, `re-inlined guidance found: "${tell}"`).not.toContain(tell)
      }
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

/**
 * CONTENT RATCHET — the guidance constants are MEASURED artefacts.
 *
 * The bundle assertions above check WIRING: that `full_synthesis` resolves a
 * block containing VOICE_CONSTRAINT. They compare the constant against itself,
 * so they pass no matter what the constant says — edit voice.ts and both sides
 * move together. Nothing there can catch a deleted line.
 *
 * That matters because this content is not arbitrary prose. It is the output of
 * a measured A/B: em-dash density 64 -> 2 across 16 calls, gap titles held
 * interrogative at 21-35 chars, 20 of 20 (2026-08-27, `voice-constraint-ab/`).
 * Editing it invalidates that measurement. The 5% bundle tolerance below is
 * sized for the CACHE floor and is far too loose to notice a line going
 * missing — one deleted example is ~1.5% of `question-gap`.
 *
 * So: exact lengths. Any edit fails, deliberately, and the failure tells you
 * what it costs. If the edit is intentional, re-run the harness and update the
 * number in the same commit — that is the whole point.
 */
const MEASURED_CONSTANTS: Record<string, number> = {
  VOICE_CONSTRAINT: 1630,
  PLAIN_LANGUAGE_TITLE_GUIDANCE: 1263,
  PLAIN_LANGUAGE_EXPLAINER_GUIDANCE: 632,
  QUESTION_TITLE_GUIDANCE: 972,
  VISION_GUIDELINES: 1065,
  STRATEGY_GUIDELINES: 414,
  OBJECTIVE_GUIDELINES: 3763,
}

describe('the measured guidance constants have not been edited unnoticed', () => {
  const actual: Record<string, string> = {
    VOICE_CONSTRAINT,
    PLAIN_LANGUAGE_TITLE_GUIDANCE,
    PLAIN_LANGUAGE_EXPLAINER_GUIDANCE,
    QUESTION_TITLE_GUIDANCE,
    VISION_GUIDELINES,
    STRATEGY_GUIDELINES,
    OBJECTIVE_GUIDELINES,
  }

  for (const [name, expected] of Object.entries(MEASURED_CONSTANTS)) {
    it(`${name} is unchanged since it was measured`, () => {
      expect(
        actual[name].length,
        `${name} changed (${actual[name].length} chars, was ${expected}). This content was ` +
        `measured in voice-constraint-ab/ on 2026-08-27. If the edit is deliberate: re-run the ` +
        `harness, confirm em-dash density and gap-title shape still hold, and update this ` +
        `number in the same commit.`,
      ).toBe(expected)
    })
  }
})

/**
 * CACHE FLOOR — this one guards cost, not quality.
 *
 * Anthropic will not cache a prefix below 1024 tokens. `question-gap` is the
 * bundle on `full_synthesis`, which is 61% of workload cost at 10-21 calls per
 * generation, and it clears the floor by only 14%. A well-meaning trim to the
 * guidance switches caching off silently — from the outside a cache that never
 * hits looks exactly like one that works.
 *
 * "Trim it" and "cache it" are competing strategies. This test makes the
 * conflict loud instead of expensive.
 *
 * Token counts measured with the Anthropic count_tokens API, claude-sonnet-5,
 * 2026-08-27. Character length is the proxy asserted here — it tracked tokens
 * at a stable ~2.7 chars/token across all three bundles when measured together,
 * so a material change in one shows up in the other.
 *
 * If you legitimately changed a bundle: RE-MEASURE with count_tokens, confirm
 * the result still clears 1024, and update both numbers here in the same commit.
 * Do not simply widen the tolerance.
 */
const MEASURED: Record<Exclude<GuidanceBundle, 'chat' | 'none'>, { tokens: number; chars: number }> = {
  commitment:     { tokens: 2548, chars: 6878 },
  opportunity:    { tokens: 1319, chars: 3529 },
  'question-gap': { tokens: 1169, chars: 3238 },
}

const CACHE_FLOOR_TOKENS = 1024
const TOLERANCE = 0.05

describe('guidance bundles stay above the prompt-cache floor', () => {
  for (const [bundle, m] of Object.entries(MEASURED) as [keyof typeof MEASURED, { tokens: number; chars: number }][]) {
    it(`${bundle} has not drifted from its measured size`, () => {
      const actual = guidanceBlock(bundle).length
      const drift = Math.abs(actual - m.chars) / m.chars
      expect(
        drift,
        `${bundle} is ${actual} chars against a measured ${m.chars} (${(drift * 100).toFixed(1)}% drift). ` +
        `That bundle measured ${m.tokens} tokens; the cache floor is ${CACHE_FLOOR_TOKENS}. ` +
        `Re-measure with count_tokens and update MEASURED — do not widen the tolerance.`,
      ).toBeLessThanOrEqual(TOLERANCE)
    })

    it(`${bundle} measured clear of the ${CACHE_FLOOR_TOKENS}-token floor`, () => {
      expect(m.tokens).toBeGreaterThan(CACHE_FLOOR_TOKENS)
    })
  }
})
