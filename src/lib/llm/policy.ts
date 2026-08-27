/**
 * The exhaustive LLM stage policy table.
 *
 * One table, one decision per stage: model, reasoning effort, visible-output
 * budget, and which voice/language guidance the stage's output is governed by.
 *
 * WHY THIS EXISTS. Voice and language guidance used to be pasted into prompt
 * strings by hand at each call site. It reached 5 sites; there are 26. A new
 * LLM call producing user-readable output was governed only if its author
 * remembered the guidance existed, and nothing told them when they forgot.
 * That failed within a day of shipping: incremental-synthesis.ts writes the
 * same user-facing `summary` and `gaps[].title` as full-synthesis.ts and was
 * missed (fde9b04). It was caught by pricing a prompt, not by a test.
 *
 * The precedent was already in the same function: createMessage() resolved
 * model and effort from a `context` string, so no call site could escape the
 * per-stage model map. Model got that property; voice did not. This table
 * gives voice the same property — and closes the gap that let model keep it
 * only by luck, since STAGE_MODELS was a SPARSE map an unknown context fell
 * straight through.
 *
 * `Record<LlmContext, Policy>` is exhaustive by construction: omitting a key
 * is a compile error at the declaration. Adding a stage forces a guidance
 * decision at the moment the stage is added, which is the whole point.
 *
 * Design: docs/_plans/2026-08-27-llm-seam-consolidation-design.md
 */
import type { Effort } from '@/lib/model-config'
import { OBJECTIVE_GUIDELINES } from '@/lib/prompts/shared/objectives'
import { VISION_GUIDELINES, STRATEGY_GUIDELINES } from '@/lib/prompts/shared/vision-strategy'
import {
  PLAIN_LANGUAGE_TITLE_GUIDANCE,
  PLAIN_LANGUAGE_EXPLAINER_GUIDANCE,
} from '@/lib/prompts/shared/plain-language'
import { QUESTION_TITLE_GUIDANCE } from '@/lib/prompts/shared/question-titles'
import { VOICE_CONSTRAINT } from '@/lib/prompts/shared/voice'
import { FULL_SYNTHESIS_SYSTEM } from '@/lib/prompts/stages/full-synthesis'
import { INCREMENTAL_SYNTHESIS_SYSTEM } from '@/lib/prompts/stages/incremental-synthesis'
import { KNOWLEDGE_SUMMARY_SYSTEM } from '@/lib/prompts/stages/knowledge-summary'
import {
  STRATEGY_GENERATION_SYSTEM,
  REFRESH_STRATEGY_GENERATION_SYSTEM,
  OPPORTUNITY_GENERATION_SYSTEM,
} from '@/lib/prompts/stages/generation'

export type LlmContext =
  | 'strategy_generation' | 'refresh_strategy_generation' | 'refresh_strategy_summary'
  | 'opportunity_generation'
  | 'full_synthesis' | 'incremental_synthesis' | 'knowledge_summary'
  | 'reflective_summary_prescriptive'
  | 'conversation_start' | 'conversation_title'
  | 'continue_initial' | 'continue_confidence' | 'continue_questioning' | 'continue_early_exit'
  | 'suggest_opposite'
  | 'extraction' | 'document_extraction' | 'template_extraction' | 'import_dimension_tagging'
  | 'admin_regenerate'

export type GuidanceBundle = 'commitment' | 'opportunity' | 'question-gap' | 'summary' | 'chat' | 'none'

export interface Policy {
  /** undefined = DEFAULT_MODEL. Env overrides still win, resolved in model-config. */
  model?: string
  effort?: Effort
  /**
   * Visible-output budget. Reasoning headroom is added on top by maxTokensFor().
   *
   * 'per-call' means the call site computes it and MUST pass `max_tokens`; the
   * seam throws if it does not. Exactly one stage needs this.
   */
  maxTokens: number | 'per-call'
  guidance: GuidanceBundle
  /**
   * The stage's static prompt — task framing and output format, everything that
   * does not vary per call. Phase 2 moves these in so the whole block can serve
   * as a cache prefix, leaving only the payload in the user message.
   *
   * May contain a `{guidance}` placeholder marking where the bundle belongs.
   * Without one the bundle is appended, which is fine for a stage with no
   * trailing format instruction to protect.
   */
  system?: string
  /**
   * Send this stage's system block as a cached prefix.
   *
   * Only set where the block has been MEASURED with count_tokens at >= 1024
   * tokens (Anthropic's minimum). A ratio estimate must never back this flag:
   * being wrong means the cache silently never hits, which from the outside
   * looks exactly like one that works.
   *
   * Measured 2026-08-27, system-only token counts (count_tokens minus the
   * 7-token message overhead).
   */
  cacheable?: boolean
}

/**
 * The guidance bundles.
 *
 * The 20 stages collapse to four real bundles plus an explicit `none`. Guidance
 * is not bespoke per stage — selecting the WRONG bundle for an artefact type is
 * the bug fixed in 09a1050, which is why the choice is named rather than
 * assembled ad hoc at each site.
 *
 * Vision and Strategy are exempt from the jargon rules but NOT from voice —
 * preserved by `commitment` composing VISION_GUIDELINES/STRATEGY_GUIDELINES
 * (which carry no plain-language block) alongside VOICE_CONSTRAINT.
 * OBJECTIVE_GUIDELINES itself carries the two plain-language blocks.
 */
const GUIDANCE: Record<GuidanceBundle, string> = {
  commitment:     [VISION_GUIDELINES, STRATEGY_GUIDELINES, OBJECTIVE_GUIDELINES, VOICE_CONSTRAINT].join('\n\n'),
  opportunity:    [PLAIN_LANGUAGE_TITLE_GUIDANCE, PLAIN_LANGUAGE_EXPLAINER_GUIDANCE, VOICE_CONSTRAINT].join('\n\n'),
  'question-gap': [PLAIN_LANGUAGE_EXPLAINER_GUIDANCE, QUESTION_TITLE_GUIDANCE, VOICE_CONSTRAINT].join('\n\n'),

  /**
   * Prose summaries that carry NO titles.
   *
   * Added 2026-08-27, resolving design O-3 before it got baselined. Both stages
   * on this bundle started on `question-gap`, which was wrong in a way the
   * measurement made obvious: it hands a titleless prose change-summary 334
   * tokens of interrogative-TITLE rules — against, in the case of
   * refresh_strategy_summary, a 300-token output budget. The stage was being
   * told at length how to write things it does not emit.
   *
   * Explainer vocabulary and voice still apply; the title rules do not.
   */
  summary: [PLAIN_LANGUAGE_EXPLAINER_GUIDANCE, VOICE_CONSTRAINT].join('\n\n'),

  /**
   * DELIBERATELY EMPTY. Do not fill this in without running an A/B first.
   *
   * The voice constraint was measured on 4 prose stages producing ARTEFACTS —
   * documents a user reads, edits and keeps. These stages are 30-300 token
   * conversational turns. Nothing in that measurement transfers: a rule that
   * improves a strategy statement may well make a chat reply stilted, and we
   * have no evidence either way.
   *
   * The slot exists so these stages are CLASSIFIED, not silently ungoverned.
   * Filling it needs its own before/after on real transcripts.
   * See design D-6 / O-2.
   */
  chat: '',

  /** Structured output (XML/JSON). Guidance here is cost with no benefit and some parse risk. */
  none: '',
}

/**
 * Every LLM stage. Exhaustive — a new context is a compile error until it is
 * classified here.
 *
 * model/effort reproduce the shipped 2026-08-26 Phase 4 ruling exactly. This is
 * a move, not a retune. Likewise maxTokens: the ceilings arrive at their current
 * values; retuning them is separate work tracked in ARCHITECTURE -> Known
 * Compromises.
 */
export const LLM_POLICY: Record<LlmContext, Policy> = {
  // --- Commitments: vision, strategy, objectives ---
  strategy_generation:         { model: 'claude-opus-5', effort: 'low', maxTokens: 4000, guidance: 'commitment', system: STRATEGY_GENERATION_SYSTEM, cacheable: true },  // 3365 tok, measured
  refresh_strategy_generation: { model: 'claude-opus-5', effort: 'low', maxTokens: 3000, guidance: 'commitment', system: REFRESH_STRATEGY_GENERATION_SYSTEM, cacheable: true },  // 3226 tok, measured

  // --- Opportunities ---
  opportunity_generation:      { model: 'claude-opus-5', effort: 'low', maxTokens: 6000, guidance: 'opportunity', system: OPPORTUNITY_GENERATION_SYSTEM, cacheable: true },  // 2009 tok, measured

  // --- Prose over synthesised knowledge: summaries, syntheses, gaps ---
  // refresh_strategy_summary sat twenty lines below governed refresh generation,
  // in the same file, writing user-facing prose, and carried nothing.
  refresh_strategy_summary:         { maxTokens: 300,  guidance: 'summary' },
  full_synthesis:                   { maxTokens: 4000, guidance: 'question-gap', system: FULL_SYNTHESIS_SYSTEM, cacheable: true },  // 1858 tok, measured
  incremental_synthesis:            { maxTokens: 4000, guidance: 'question-gap', system: INCREMENTAL_SYNTHESIS_SYSTEM, cacheable: true },  // 1664 tok, measured
  knowledge_summary:                { maxTokens: 2000, guidance: 'question-gap', system: KNOWLEDGE_SUMMARY_SYSTEM, cacheable: true },  // 1935 tok, measured
  // Luna's Thinking tab — strengths/emerging/opportunities, not questions.
  // Moved off question-gap 2026-08-27 with refresh_strategy_summary (O-3).
  reflective_summary_prescriptive:  { maxTokens: 2000, guidance: 'summary' },

  // --- Conversational turns. Classified, awaiting an A/B. See GUIDANCE.chat. ---
  conversation_start:     { maxTokens: 200, guidance: 'chat' },
  conversation_title:     { maxTokens: 30,  guidance: 'chat' },
  continue_initial:       { maxTokens: 200, guidance: 'chat' },
  continue_confidence:    { maxTokens: 300, guidance: 'chat' },
  continue_questioning:   { maxTokens: 200, guidance: 'chat' },
  continue_early_exit:    { maxTokens: 150, guidance: 'chat' },
  suggest_opposite:       { maxTokens: 50,  guidance: 'chat' },

  // --- Structured output. Must NOT receive voice guidance. ---
  extraction:              { maxTokens: 2000, guidance: 'none' },
  document_extraction:     { maxTokens: 7500, guidance: 'none' },
  template_extraction:     { maxTokens: 2048, guidance: 'none' },
  // Batch-sized: Math.max(4000, batchChunks.length * 150) at the call site.
  import_dimension_tagging: { maxTokens: 'per-call', guidance: 'none' },
  // A curl-only admin endpoint; nothing in src/ fetches it. Kept and classified
  // rather than deleted — that call was deferred (design O-1, 2026-08-27).
  admin_regenerate:        { maxTokens: 1000, guidance: 'none' },
}

/** Marks where a stage prompt wants its guidance bundle placed. */
export const GUIDANCE_SLOT = '{guidance}'

/**
 * The full static system block for a stage, or undefined when there is nothing
 * to send.
 *
 * This is the ONLY sanctioned way to build a system block. Call sites cannot
 * pass `system` to createMessage() — that is what makes the guarantee hold.
 */
export function systemFor(context: LlmContext): string | undefined {
  const policy = LLM_POLICY[context]
  const guidance = GUIDANCE[policy.guidance]

  if (policy.system?.includes(GUIDANCE_SLOT)) {
    // Function form, not a string replacement: guidance is prose that may
    // contain `$&` / `$'`, which String.replace would treat as substitution
    // patterns and silently mangle.
    return policy.system.replace(GUIDANCE_SLOT, () => guidance).trim()
  }

  const parts = [policy.system, guidance].filter(Boolean)
  return parts.length ? parts.join('\n\n') : undefined
}

/** Whether this stage's system block ships as a cached prefix. */
export function isCacheable(context: LlmContext): boolean {
  return Boolean(LLM_POLICY[context].cacheable && systemFor(context))
}

/** Exposed for the guidance and cache-floor ratchets. Not for call sites. */
export function guidanceBlock(bundle: GuidanceBundle): string {
  return GUIDANCE[bundle]
}
