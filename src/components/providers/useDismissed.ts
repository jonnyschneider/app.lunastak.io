'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * "Has this user already dealt with this thing, on this project?"
 *
 * A thin client over `/api/dismissal`, which is backed by `UserDismissal`
 * `(userId, itemType, itemKey, projectId)` and resolves guests from the `guestUserId` cookie —
 * so anything built on this survives a reload, works before signup, and needs no new schema.
 *
 * Two consumers as of 2026-09-10, which is why it is a hook rather than two hand-rolled fetches:
 * the strategy-ready chip (`useStrategyReady`) and the ground-truth review's Skip.
 *
 * ⚠ EACH CALL FETCHES THE PROJECT'S DISMISSALS. Two hooks on one page is two identical requests.
 * Left as-is deliberately: the response is a handful of rows, and sharing it would mean either a
 * provider or a module-level cache, both of which buy a staleness problem for a saving nobody can
 * perceive. Worth revisiting at the fourth consumer, not the second.
 */
export function useDismissed(projectId: string, itemType: string, itemKey: string | null) {
  /**
   * `null` means NOT LOADED, and is deliberately distinct from "nothing dismissed". Callers use it
   * to stay silent until the answer is known — showing a badge or a first-run screen optimistically
   * and then retracting it is worse than showing it a beat late.
   */
  const [dismissedKeys, setDismissedKeys] = useState<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/dismissal?projectId=${projectId}`)
      .then((r) => (r.ok ? r.json() : { dismissals: [] }))
      .then((d: { dismissals?: { itemType: string; itemKey: string }[] }) => {
        if (cancelled) return
        setDismissedKeys(
          new Set((d.dismissals ?? []).filter((row) => row.itemType === itemType).map((row) => row.itemKey))
        )
      })
      // Cannot tell. Answer "not dismissed yet" rather than blocking on a failed read.
      .catch(() => { if (!cancelled) setDismissedKeys(new Set()) })
    return () => { cancelled = true }
  }, [projectId, itemType])

  const loaded = dismissedKeys !== null
  const dismissed = loaded && !!itemKey && dismissedKeys.has(itemKey)

  /**
   * Optimistic: the UI updates now and the write follows. A control that lingers for a round-trip
   * after you have acted on it reads as broken, and the worst case here is that the thing comes
   * back on the next load — smaller than blocking the view on a write the user did not ask for.
   */
  const dismiss = useCallback((key?: string) => {
    const target = key ?? itemKey
    if (!target) return
    setDismissedKeys((prev) => {
      if (prev === null || prev.has(target)) return prev
      const next = new Set(prev)
      next.add(target)
      return next
    })
    fetch('/api/dismissal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType, itemContent: target, projectId }),
    }).catch(() => {})
  }, [itemKey, itemType, projectId])

  return { dismissed, loaded, dismiss }
}
