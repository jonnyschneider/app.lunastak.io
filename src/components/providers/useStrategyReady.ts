'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDismissed } from './useDismissed'

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

/**
 * @param projectId the project whose strategy this is
 * @param traceId   the latest strategy's trace, or null when there is no strategy yet
 */
export function useStrategyReady(projectId: string, traceId: string | null) {
  /** The trace announced by a completion this session, before any refetch has landed. */
  const [justBuilt, setJustBuilt] = useState<string | null>(null)

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
  const { dismissed, loaded, dismiss } = useDismissed(projectId, STRATEGY_READY_ITEM_TYPE, trace)
  const ready = loaded && !!trace && !dismissed

  /**
   * Called when the user actually LOOKS — landing on the Decision Stack, not merely being near it.
   */
  const markSeen = useCallback(() => { dismiss() }, [dismiss])

  return { ready, markSeen }
}
