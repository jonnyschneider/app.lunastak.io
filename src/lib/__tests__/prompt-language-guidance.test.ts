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

import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { describe, it, expect } from 'vitest'
import { LLM_POLICY, systemFor, guidanceBlock, isCacheable, GUIDANCE_SLOT, type LlmContext, type GuidanceBundle } from '@/lib/llm/policy'
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

      if (policy.guidance === 'summary') {
        expect(system).toContain(PLAIN_LANGUAGE_EXPLAINER_GUIDANCE)
        // The whole point of this bundle: no title rules on titleless prose.
        expect(system, 'summary stages emit no titles')
          .not.toContain(QUESTION_TITLE_GUIDANCE)
        expect(system, 'summary stages emit no titles')
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
 * No resolved system block ships an unsubstituted placeholder.
 *
 * Phase 2 moves each stage's static prompt into `policy.system`, where a
 * `{guidance}` slot marks where the bundle belongs. A typo in that token — or a
 * `{fragments}` left behind when the payload moved to the user message — does
 * not throw. It ships a literal brace token to the model and reads as an
 * instruction about nothing. Cheap to assert, invisible otherwise.
 */
describe('no stage ships an unsubstituted placeholder', () => {
  const SUSPECT = /\{(guidance|fragments|dimension|count|themes|userName)\}/

  for (const [ctx] of entries) {
    it(`${ctx} resolves every placeholder`, () => {
      const system = systemFor(ctx)
      if (!system) return
      const hit = system.match(SUSPECT)
      expect(hit?.[0], `${ctx} shipped a literal ${hit?.[0]} in its system block`).toBeUndefined()
    })
  }

  it('the slot token is what the stage prompts actually use', () => {
    // Guards a rename of GUIDANCE_SLOT that silently stops matching.
    const withSlot = entries.filter(([, p]) => p.system?.includes(GUIDANCE_SLOT))
    expect(withSlot.length, 'no stage uses the guidance slot — did the token change?')
      .toBeGreaterThan(0)
    for (const [ctx] of withSlot) {
      expect(systemFor(ctx)).not.toContain(GUIDANCE_SLOT)
      expect(systemFor(ctx)).toContain(VOICE_CONSTRAINT)
    }
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
  // Phase 2 moved the stage prompts here; the call sites keep only payload assembly.
  'lib/prompts/stages/full-synthesis.ts',
  'lib/prompts/stages/incremental-synthesis.ts',
  'lib/prompts/stages/knowledge-summary.ts',
  'lib/prompts/stages/generation.ts',
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
 * The guidance constants are never interpolated into a prompt string again.
 *
 * The seam supplies guidance now. A `${VOICE_CONSTRAINT}` back in a prompt
 * template does not fail anything — it sends the block TWICE, once in the
 * system block and once in the user message. That is invisible in output and
 * shows up only as a quietly larger bill.
 *
 * This was checked once by hand when the call sites were migrated (Task 1.5).
 * A one-time grep is not a ratchet: the whole premise of this design is that
 * guidance creeps back into prompt strings when nothing is watching. Every
 * Phase 2 stage conversion is another chance to reintroduce it.
 *
 * Exempt: `prompts/shared/` (the definition) and `llm/policy.ts` (the one
 * sanctioned composer). `prompts/stages/` is NOT exempt — stage prompts mark
 * their guidance with the `{guidance}` slot, never by interpolation.
 */
describe('guidance is never re-interpolated into a prompt', () => {
  const EXEMPT = [/prompts\/shared\//, /llm\/policy\.ts$/, /__tests__\//]
  const NAMES = [
    'VOICE_CONSTRAINT', 'PLAIN_LANGUAGE_TITLE_GUIDANCE', 'PLAIN_LANGUAGE_EXPLAINER_GUIDANCE',
    'QUESTION_TITLE_GUIDANCE', 'VISION_GUIDELINES', 'STRATEGY_GUIDELINES', 'OBJECTIVE_GUIDELINES',
  ]

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(full, out) }
      else if (/\.tsx?$/.test(e.name)) out.push(full)
    }
    return out
  }

  it('no prompt template interpolates a guidance constant', () => {
    const violations: string[] = []
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file)
      if (EXEMPT.some(re => re.test(rel))) continue
      const src = fs.readFileSync(file, 'utf8')
      for (const name of NAMES) {
        if (src.includes('${' + name + '}')) violations.push(`${rel}: \${${name}}`)
      }
    }
    expect(violations, `guidance re-inlined — the seam already sends it:\n${violations.join('\n')}`)
      .toEqual([])
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
 * WHY A HASH AND NOT A LENGTH. This started as an exact character count, which
 * is wrong in both directions: it false-positives on a whitespace reflow that
 * changes nothing, and — the real problem — it false-NEGATIVES on any
 * same-length edit. Swap one ✗ example for another of equal length and a length
 * check is blind to it, which is precisely the edit someone would make. A hash
 * pins the content; a length pins only the size of it. Same maintenance cost:
 * one number either way.
 *
 * Any edit fails, deliberately, including a typo fix. If the edit is intended,
 * re-run the harness and update the hash in the same commit — that is the point.
 * Truncated to 12 chars for legibility; collisions are not the threat model.
 */
const MEASURED_CONSTANTS: Record<string, string> = {
  VOICE_CONSTRAINT: 'c08fc08d3c5d',
  PLAIN_LANGUAGE_TITLE_GUIDANCE: 'fdcf930a6481',
  PLAIN_LANGUAGE_EXPLAINER_GUIDANCE: '14e056e9e094',
  QUESTION_TITLE_GUIDANCE: 'd56d684afc63',
  VISION_GUIDELINES: 'bdf1bfaad003',
  STRATEGY_GUIDELINES: '05aa317f4a09',
  OBJECTIVE_GUIDELINES: '97239676b087',
}

const contentHash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12)

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
        contentHash(actual[name]),
        `${name} changed. This content was measured in voice-constraint-ab/ on ` +
        `2026-08-27. If the edit is deliberate: re-run the harness, confirm em-dash ` +
        `density and gap-title shape still hold, and update this hash in the same commit.`,
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
interface BundleSize {
  /** Anthropic count_tokens, claude-sonnet-5. `derived` where noted. */
  tokens: number
  chars: number
  /** Whether this bundle is expected to be a cacheable prefix at all. */
  cacheable: boolean
  measured: 'count_tokens' | 'derived-from-ratio'
}

const MEASURED: Record<Exclude<GuidanceBundle, 'chat' | 'none'>, BundleSize> = {
  commitment:     { tokens: 2548, chars: 6878, cacheable: true,  measured: 'count_tokens' },
  opportunity:    { tokens: 1319, chars: 3529, cacheable: true,  measured: 'count_tokens' },
  'question-gap': { tokens: 1169, chars: 3238, cacheable: true,  measured: 'count_tokens' },
  // Added 2026-08-27. NOT count_tokens-measured — 2264 chars at the ~2.7
  // chars/token ratio the three above establish, so ~838 tokens. It sits
  // BELOW the 1024 floor by design and is not a caching candidate, so an
  // exact count buys nothing today. Phase 2 re-measures every block with
  // count_tokens before any cacheable flag is set; do not promote this to
  // cacheable on a derived number.
  summary:        { tokens: 838,  chars: 2264, cacheable: false, measured: 'derived-from-ratio' },
}

const CACHE_FLOOR_TOKENS = 1024
const TOLERANCE = 0.05

describe('guidance bundles stay above the prompt-cache floor', () => {
  for (const [bundle, m] of Object.entries(MEASURED) as [keyof typeof MEASURED, BundleSize][]) {
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

    it(`${bundle} sits on the expected side of the ${CACHE_FLOOR_TOKENS}-token floor`, () => {
      if (m.cacheable) {
        expect(m.tokens, `${bundle} is a caching candidate and must clear the floor`)
          .toBeGreaterThan(CACHE_FLOOR_TOKENS)
      } else {
        // Not a failure — a bundle can be legitimately too small to cache.
        // Asserted so that a bundle GROWING past the floor is noticed and
        // considered, rather than sitting there uncached by accident.
        expect(m.tokens, `${bundle} has grown past the cache floor — reconsider cacheable`)
          .toBeLessThan(CACHE_FLOOR_TOKENS)
      }
    })

    it(`${bundle} carries an honest provenance label`, () => {
      // A derived number must never be promoted to a caching decision.
      if (m.cacheable) expect(m.measured).toBe('count_tokens')
    })
  }
})

/**
 * CACHEABLE STAGES stay above the floor — and no stage claims to be cacheable
 * without having been measured.
 *
 * Two ways prompt caching dies silently, both guarded here:
 *
 * 1. A block is trimmed below 1024 tokens. Caching switches off; output is
 *    identical; the bill quietly goes back to full price. Verified live
 *    2026-08-27: all six write then read the cache.
 * 2. Someone adds `cacheable: true` to a new stage from a ratio estimate. Being
 *    wrong is invisible — an uncached prefix looks exactly like a cached one.
 *
 * Token counts are system-only: Anthropic count_tokens minus the 7-token
 * message overhead, claude-sonnet-5/opus-5 per the stage's model, 2026-08-27.
 * Re-measure and update both numbers in the same commit; do not widen the
 * tolerance.
 */
const MEASURED_STAGE_BLOCKS: Record<string, { tokens: number; chars: number }> = {
  strategy_generation:         { tokens: 3365, chars: 9160 },
  refresh_strategy_generation: { tokens: 3226, chars: 8797 },
  opportunity_generation:      { tokens: 2009, chars: 5486 },
  knowledge_summary:           { tokens: 1935, chars: 5610 },
  full_synthesis:              { tokens: 1858, chars: 5080 },
  incremental_synthesis:       { tokens: 1664, chars: 4648 },
}

describe('cacheable stages stay above the prompt-cache floor', () => {
  const cacheable = entries.filter(([ctx]) => isCacheable(ctx))

  it('every cacheable stage has a checked-in measurement', () => {
    const unmeasured = cacheable.map(([ctx]) => ctx).filter(ctx => !MEASURED_STAGE_BLOCKS[ctx])
    expect(
      unmeasured,
      `declared cacheable without a count_tokens measurement: ${unmeasured.join(', ')}. ` +
      `A ratio estimate cannot back this flag — if it is wrong the cache never hits ` +
      `and looks exactly like one that works.`,
    ).toEqual([])
  })

  it('nothing is measured that is not actually cacheable', () => {
    const stale = Object.keys(MEASURED_STAGE_BLOCKS).filter(ctx => !isCacheable(ctx as LlmContext))
    expect(stale, `measured but no longer cacheable: ${stale.join(', ')}`).toEqual([])
  })

  for (const [ctx, m] of Object.entries(MEASURED_STAGE_BLOCKS)) {
    it(`${ctx} measured clear of the ${CACHE_FLOOR_TOKENS}-token floor`, () => {
      expect(m.tokens).toBeGreaterThan(CACHE_FLOOR_TOKENS)
    })

    it(`${ctx} has not drifted from its measured size`, () => {
      const actual = systemFor(ctx as LlmContext)!.length
      const drift = Math.abs(actual - m.chars) / m.chars
      expect(
        drift,
        `${ctx} system block is ${actual} chars against a measured ${m.chars} ` +
        `(${(drift * 100).toFixed(1)}% drift, ${m.tokens} tok, floor ${CACHE_FLOOR_TOKENS}). ` +
        `Re-measure with count_tokens and update MEASURED_STAGE_BLOCKS.`,
      ).toBeLessThanOrEqual(TOLERANCE)
    })
  }
})
