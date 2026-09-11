/**
 * "Does this project have a strategy?" — the one definition the landing table and the page share.
 *
 * ⚠ THE SERVER AND THE CLIENT USED TO DISAGREE. The redirector (`project/[id]/page.tsx`) counted only
 * a DecisionStack with a non-empty vision; `ProjectClient` also counted a generation Trace, because
 * a legacy project can hold its strategy only in a Trace (the page's trace fallback renders it). On
 * such a project the server offered the first-contact review (`?mode=review`), the client — seeing a
 * strategy — refused to render it, and the user could never defer it: every bare visit re-offered it
 * and re-fired the one-shot arrival event.
 *
 * A Trace is written only by generation (initial, refresh, template, admin regenerate) — never by
 * extraction — so "a generation trace exists" is evidence of a strategy, not of an ingest.
 *
 * The vision check is `!== ''`, not "a DecisionStack row exists": `setGenerationStatus` creates the
 * row with an empty vision before generation completes (see `api/project/[id]/route.ts`).
 */
export interface StrategyEvidence {
  /** The DecisionStack exists AND its vision is non-empty — see `hasStackVision`. */
  hasVision: boolean
  /** How many generation Traces the project has (any positive number will do). */
  generationTraceCount: number
}

export function projectHasStrategy({ hasVision, generationTraceCount }: StrategyEvidence): boolean {
  return hasVision || generationTraceCount > 0
}

/** The vision half, from a DecisionStack's `vision` column (null when there is no row). */
export function hasStackVision(vision: string | null | undefined): boolean {
  return typeof vision === 'string' && vision !== ''
}
