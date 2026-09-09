'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * "There is a new strategy you have not looked at."
 *
 * WHY A CHIP AND NOT A TOAST. A toast announces that something is HAPPENING; this announces that
 * something is READY FOR REVIEW, which is a standing fact rather than a moment. The user pressed
 * Build from the knowledgebase and stayed there on purpose — they are still with their ground
 * truths — so the signal has to survive until they choose to go and look, including across a
 * reload. A toast that expired in five seconds would be the wrong instrument for a state that
 * outlives the session (design: docs/_plans/2026-09-10-empty-state-consolidation-design.md).
 *
 * The press itself is never dead, so this carries ARRIVAL only: the Build button already becomes a
 * disabled "Building your strategy…" spinner (added 2026-09-08, after two generations landed as
 * consecutive versions because the screen sat unchanged for ~37s).
 *
 * ⚠ NO COUNTER. "New thing to look at" is the entire message. A count implies a queue of distinct
 * items to work through; there is exactly one strategy.
 *
 * ⚠ NO NEW SCHEMA, AND NO "RAISED" RECORD. Readiness is DERIVED, not stored: a chip is due when a
 * strategy exists and its trace has not been dismissed. Storing a raise as well would give two
 * sources of truth that can disagree — the classic way a badge gets stuck on forever.
 *
 * Keyed on `traceId` rather than a boolean so a refresh raises a fresh chip for free (a new
 * strategy IS a new thing to look at) while a dismissal stays scoped to the version it dismissed.
 */
export const STRATEGY_READY_ITEM_TYPE = 'strategy_ready'

interface DismissalRow {
  itemType: string
  itemKey: string
  projectId: string | null
}

/**
 * @param projectId the project whose strategy this is
 * @param traceId   the latest strategy's trace, or null when there is no strategy yet
 */
export function useStrategyReady(projectId: string, traceId: string | null) {
  /**
   * The traces this user has already looked at. `null` means "not loaded yet" and is deliberately
   * distinct from the empty set: until the dismissals are back we do NOT know whether the chip is
   * due, and showing one optimistically would flash a badge at every user on every page load.
   */
  const [seen, setSeen] = useState<Set<string> | null>(null)
  /** The trace announced by a completion this session, before any refetch has landed. */
  const [justBuilt, setJustBuilt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/dismissal?projectId=${projectId}`)
      .then((r) => (r.ok ? r.json() : { dismissals: [] }))
      .then((d: { dismissals?: DismissalRow[] }) => {
        if (cancelled) return
        setSeen(
          new Set(
            (d.dismissals ?? [])
              .filter((row) => row.itemType === STRATEGY_READY_ITEM_TYPE)
              .map((row) => row.itemKey)
          )
        )
      })
      // A failed fetch means we cannot tell whether the chip is due. Say no rather than nag.
      .catch(() => { if (!cancelled) setSeen(new Set()) })
    return () => { cancelled = true }
  }, [projectId])

  /**
   * The orchestrator owns knowing that generation finished — `BackgroundTaskProvider` polls, and
   * dispatches `generationComplete` carrying the trace it just produced. Listening here means the
   * chip appears the moment the strategy lands, without waiting for the page's own refetch.
   */
  useEffect(() => {
    const onComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail as { projectId?: string; traceId?: string } | undefined
      if (!detail || detail.projectId !== projectId || !detail.traceId) return
      setJustBuilt(detail.traceId)
    }
    window.addEventListener('generationComplete', onComplete)
    return () => window.removeEventListener('generationComplete', onComplete)
  }, [projectId])

  const trace = justBuilt ?? traceId
  const ready = seen !== null && !!trace && !seen.has(trace)

  /**
   * Called when the user actually LOOKS — landing on the Decision Stack, not merely being near it.
   * Optimistic: the chip clears immediately and the write follows, because a badge that lingers
   * for a round-trip after you have already looked at the thing reads as broken.
   */
  const markSeen = useCallback(() => {
    if (!trace) return
    setSeen((prev) => {
      if (prev === null) return prev
      if (prev.has(trace)) return prev
      const next = new Set(prev)
      next.add(trace)
      return next
    })
    fetch('/api/dismissal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemType: STRATEGY_READY_ITEM_TYPE,
        itemContent: trace,
        projectId,
      }),
    }).catch(() => {
      // Best effort. Worst case the chip returns on the next load, which is a smaller failure
      // than blocking the view on a write the user did not ask for.
    })
  }, [trace, projectId])

  return { ready, markSeen }
}
