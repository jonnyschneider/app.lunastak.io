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
 */

/** The model that ships today. Arm A of the comparison — do not change during the experiment. */
export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'

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
  return process.env.LUNASTAK_MODEL || DEFAULT_MODEL
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
