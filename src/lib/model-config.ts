/**
 * Per-context model resolution + sampling-param compatibility.
 *
 * Background: the Claude 5 family removed `temperature`/`top_p`/`top_k` (they
 * return a 400), while the model we ship today accepts them. To compare arms
 * honestly we must be able to (a) point any pipeline stage at any model without
 * a code change, and (b) keep the control arm's request shape byte-identical to
 * what production sends.
 *
 * Design doc: docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATUS after the Phase 4 ruling (2026-08-26) — decision record:
 * Drive Test-Data/20260826-model-upgrade/decision.md
 *
 *   modelFor()        PERMANENT. The ruling is a per-stage map, which is what this
 *                     exists to serve. Env overrides stay first: they are how the next
 *                     forced model migration gets tested without a code change, and how
 *                     any arm of the experiment is reproduced.
 *
 *   effortFor()       PERMANENT. effort:low is adopted on the Opus stages — measured 30%
 *                     cheaper and 34% faster than Opus at default effort.
 *
 *   timeoutFor()      PERMANENT. Thinking models genuinely exceed the 60s client default.
 *
 *   stripUnsupportedParams()
 *                     PERMANENT while any 5-family model is in use. Once no call site
 *                     passes `temperature` at all this becomes a pure safety net.
 *
 *   maxTokensFor()    STILL A WORKAROUND — the one unresolved item. The real fix is
 *                     re-tuning the per-stage max_tokens ceilings, which were fitted to
 *                     sonnet-4-5's verbosity. Measured demand: continue_questioning needs
 *                     ~459 against a shipped ceiling of 200; continue_confidence ~765
 *                     against 300. Tracked in ARCHITECTURE → Known Compromises.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { LLM_POLICY, type LlmContext } from '@/lib/llm/policy'

/**
 * The default model for any stage whose policy names none.
 *
 * Changed 2026-08-26 from claude-sonnet-4-5-20250929 by the Phase 4 ruling. The prior incumbent
 * remains reachable via LUNASTAK_MODEL for reproducing the experiment's control arm.
 */
export const DEFAULT_MODEL = 'claude-sonnet-5'

/**
 * Model-ID prefixes that REJECT sampling params.
 *
 * Prefix matching is safe here: 'claude-sonnet-5' does not match
 * 'claude-sonnet-4-5-20250929'.
 */
const REJECTS_SAMPLING_PARAMS = [
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
]

const SAMPLING_PARAMS = ['temperature', 'top_p', 'top_k'] as const

/**
 * Resolve the model for a pipeline stage.
 *
 * Precedence: per-context env override -> global env override -> DEFAULT_MODEL.
 *
 * The per-context form is `LUNASTAK_MODEL_<CONTEXT>` upper-cased, e.g.
 * `LUNASTAK_MODEL_STRATEGY_GENERATION=claude-opus-5`. That is what lets the
 * experiment run a mixed per-stage map, and what the final decision ships as.
 */
export function modelFor(context?: string): string {
  if (context) {
    const perContext = process.env[`LUNASTAK_MODEL_${context.toUpperCase()}`]
    if (perContext) return perContext
  }
  if (process.env.LUNASTAK_MODEL) return process.env.LUNASTAK_MODEL
  if (context) return LLM_POLICY[context as LlmContext]?.model ?? DEFAULT_MODEL
  return DEFAULT_MODEL
}

/** Whether this model accepts temperature/top_p/top_k. */
export function supportsSamplingParams(model: string): boolean {
  return !REJECTS_SAMPLING_PARAMS.some(prefix => model.startsWith(prefix))
}

/**
 * Drop sampling params the target model would reject.
 *
 * Returns a copy — call sites keep passing `temperature` unchanged, and it is
 * silently dropped only where unsupported. This is deliberately a wrapper-level
 * concern rather than ~10 call-site edits: it keeps the control arm's requests
 * identical to production while making the 5-family arms legal.
 */
export function stripUnsupportedParams<T extends { model: string }>(params: T): T {
  if (supportsSamplingParams(params.model)) return params

  const out = { ...params }
  for (const key of SAMPLING_PARAMS) {
    delete (out as Record<string, unknown>)[key]
  }
  return out
}

/**
 * Models where thinking is adaptive by default, i.e. omitting the `thinking`
 * parameter still spends reasoning tokens out of `max_tokens`.
 *
 * This is the same trap hub hit in catchup/extract.py: max_tokens is a budget
 * SHARED with reasoning you never see, so a ceiling sized against the visible
 * answer truncates before the answer is emitted.
 */
const THINKS_BY_DEFAULT = REJECTS_SAMPLING_PARAMS

/** Default reasoning headroom added on top of a stage's visible-output budget. */
const DEFAULT_THINKING_HEADROOM = 4000

/** Request timeout for thinking models. The 60s client default is too tight for adaptive thinking. */
const THINKING_TIMEOUT_MS = 300_000
const DEFAULT_TIMEOUT_MS = 60_000

function thinksByDefault(model: string): boolean {
  return THINKS_BY_DEFAULT.some(prefix => model.startsWith(prefix))
}

/**
 * The max_tokens to actually send.
 *
 * For thinking models, the stage's configured ceiling is treated as the
 * VISIBLE-output budget and reasoning headroom is added on top — so the
 * comparison is like-for-like on what the user sees, rather than handing the
 * thinking arms a 30-token budget they must spend reasoning inside.
 *
 * The control model is returned untouched.
 */
export function maxTokensFor(model: string, requested: number): number {
  if (!thinksByDefault(model)) return requested

  const headroom = process.env.LUNASTAK_THINKING_HEADROOM
    ? Number(process.env.LUNASTAK_THINKING_HEADROOM)
    : DEFAULT_THINKING_HEADROOM

  return headroom + requested
}

/** Per-request timeout in ms. Thinking models get materially longer. */
export function timeoutFor(model: string): number {
  return thinksByDefault(model) ? THINKING_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
}

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

const VALID_EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

/**
 * Reasoning effort, when explicitly requested for this run (arm D of the
 * experiment sweeps this). Returns undefined unless LUNASTAK_EFFORT is set to a
 * valid level AND the model supports it — the control model would 400 on an
 * effort parameter, and so would a typo'd level.
 */
export function effortFor(model: string, context?: string): Effort | undefined {
  if (!thinksByDefault(model)) return undefined

  const envEffort = process.env.LUNASTAK_EFFORT
  if (envEffort) {
    if (!VALID_EFFORTS.includes(envEffort as Effort)) {
      console.warn(`[model-config] Ignoring invalid LUNASTAK_EFFORT="${envEffort}" (expected one of ${VALID_EFFORTS.join(', ')})`)
      return undefined
    }
    return envEffort as Effort
  }

  if (context) return LLM_POLICY[context as LlmContext]?.effort
  return undefined
}
