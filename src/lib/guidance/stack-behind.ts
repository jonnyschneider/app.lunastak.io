/**
 * Guidance register row 4 — "My stack is behind my knowledge."
 *
 * Register: `docs/_plans/2026-09-10-navigation-and-guidance-map-design.md` §6. Every row is a job in
 * the user's voice, a trigger computed from data that already exists, and a destination that already
 * exists. This module owns row 4's trigger and its words; the stack's version control renders them,
 * and the destination is the knowledgebase's changed-since filter (`knowledgeHref` with
 * `{ kind: 'changed' }`), where Rebuild already lives.
 *
 * ⚠ STATE, NOT A PROMPT — ruled 2026-09-11. It sits on the Version control it is about and is shown
 * for exactly as long as it is true, so it has no dismissal. A dismissible banner for a persistent
 * fact either nags or, once dismissed, hides something still true. (The design doc's
 * `stale_stack:v<n>` dismissal key was for the banner shape, and went with it.)
 *
 * ⚠ ONLY WHEN THE DIFF IS COMPARABLE. A snapshot written before `fragmentIds` existed can see only
 * additions, by timestamp, and the knowledge panel deliberately shows no changed-since filter for
 * it — so linking there would land on a filter with no visible control to leave it. Such a project
 * already reads "context has changed since" in the panel, and the next rebuild makes it comparable.
 */

export interface StrategySync {
  version: number | null
  added: number
  removed: number
  comparable: boolean
}

export interface StackBehindInputs {
  sync: StrategySync | null | undefined
  hasStrategy: boolean
  isDemo: boolean
  /** A generation or refresh is running — the counts are about to be replaced, so say nothing. */
  generating: boolean
}

export interface StackBehind {
  added: number
  removed: number
  version: number | null
  /** "5 changes since v3" */
  label: string
  /** The long form, for a tooltip or screen reader: "4 ground truths added, 1 discarded since Version 3" */
  detail: string
}

export function stackBehind({ sync, hasStrategy, isDemo, generating }: StackBehindInputs): StackBehind | null {
  if (!sync || !hasStrategy || isDemo || generating || !sync.comparable) return null
  const { added, removed, version } = sync
  const total = added + removed
  if (total === 0) return null

  const since = version ? `v${version}` : 'this version'
  const label = `${total} ${total === 1 ? 'change' : 'changes'} since ${since}`
  const detail = `${describeStackChanges({ added, removed })} since ${version ? `Version ${version}` : 'this version'}`

  return { added, removed, version, label, detail }
}

/**
 * "4 ground truths added, 1 discarded" — the one wording for what changed since a build, shared by
 * the version pointer and the Rebuild dialog so the two cannot describe the same diff differently.
 * Empty string when nothing changed.
 *
 * ⚠ BOTH DIRECTIONS. The Rebuild dialog used to count additions only ("N new insights added"), so a
 * change made purely of discards — the curation the whole ground-truth layer exists for — told the
 * user nothing had changed and offered "Refresh anyway", the copy meant for re-rolling identical
 * context.
 */
export function describeStackChanges({ added, removed }: { added: number; removed: number }): string {
  const parts: string[] = []
  if (added) parts.push(`${added} ground ${added === 1 ? 'truth' : 'truths'} added`)
  if (removed) parts.push(`${removed} discarded`)
  return parts.join(', ')
}
