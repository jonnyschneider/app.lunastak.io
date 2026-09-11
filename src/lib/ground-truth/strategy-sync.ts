/**
 * "Is the stack still built from this context?" — what changed since the latest build, by id.
 *
 * Read by the knowledge panel's sync line and changed-since filter, and by guidance register row 4
 * on the stack's version control. Extracted from `api/project/[id]/route.ts` on 2026-09-11 so it
 * could be tested — it had none, and it was wrong:
 *
 * ⚠ DISCARDED MEANS "NO LONGER ACTIVE", NOT "NOT A GROUND TRUTH". The snapshot's `fragmentIds` holds
 * every active fragment the stack was built from, system context included (bundle tensions, Luna's
 * own turns). The old code measured those ids against the GROUND TRUTHS only, so every non-ground-
 * truth fragment in the snapshot was reported as discarded — the gate-baseline project on dev read
 * "10 discarded since v3" with one actual discard. Removal is now measured against ALL active
 * fragments; only the user can discard, and only a ground truth, so what remains is real.
 *
 * Additions stay ground-truths-only: the diff is a clickable filter over the review, and an id the
 * review will never render would be counted and then vanish when clicked.
 */

export interface SyncFragment {
  id: string
  createdAt: Date
}

export interface StrategySyncInputs {
  /** The latest post-generation snapshot's `fragmentIds`, or null when it predates that column. */
  snapshotIds: string[] | null
  /** When that snapshot was taken, or null when there is no snapshot at all. */
  snapshotAt: Date | null
  /** Every ACTIVE fragment in the project — ground truths and system context alike. */
  activeFragments: SyncFragment[]
  /** The active ground truths — what the user is shown (`onlyGroundTruths`). */
  groundTruths: SyncFragment[]
}

export interface StrategySyncDiff {
  addedIds: string[]
  removedIds: string[]
  /** False when the snapshot predates `fragmentIds`: only additions can be seen, by timestamp. */
  comparable: boolean
}

export function computeStrategySync(i: StrategySyncInputs): StrategySyncDiff {
  if (i.snapshotIds) {
    const built = new Set(i.snapshotIds)
    const active = new Set(i.activeFragments.map(f => f.id))
    return {
      addedIds: i.groundTruths.filter(f => !built.has(f.id)).map(f => f.id),
      removedIds: i.snapshotIds.filter(id => !active.has(id)),
      comparable: true,
    }
  }
  // Unknown, not empty: a pre-`fragmentIds` snapshot falls back to timestamps, which see additions only.
  const addedIds = i.snapshotAt
    ? i.groundTruths.filter(f => f.createdAt > i.snapshotAt!).map(f => f.id)
    : i.groundTruths.map(f => f.id)
  return { addedIds, removedIds: [], comparable: false }
}
