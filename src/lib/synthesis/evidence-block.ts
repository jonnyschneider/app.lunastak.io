/**
 * The evidence block appended to a fragment in a synthesis payload.
 *
 * WORDING IS MEASURED — do not reword. §18 of
 * docs/_plans/2026-08-27-ground-truth-preflight-design.md ran three payload shapes
 * on real material: evidence concatenated as prose, `content` alone, and evidence
 * MARKED as the user's own words. Marking the same characters nearly doubled how
 * much the summary echoed the user's actual language (4.9% -> 9.4%) and inverted a
 * 4.7x-toward-our-own-claims ratio into 3.6x-toward-the-user. It is the labelling
 * that does the work, not the extra text — so the heading below is the change.
 */
import { FragmentForSynthesis } from './types'

const HEADER = "The user's own words this rests on:"

/**
 * Returns the block to append after a fragment's content, or '' when the fragment
 * has no usable evidence — which is nearly every production fragment today, and
 * must stay byte-identical to the pre-evidence payload.
 *
 * `failed` spans are excluded: a failed span could NOT be found in the user's own
 * words (wrong speaker, or absent), so quoting it under this heading would be a
 * false attribution — §15 measured that as worse than an honest summary, because a
 * near-quote reads as authentic precisely by being close.
 *
 * `verified` and `unverifiable` render identically on purpose. The distinction is
 * bookkeeping for the user-facing badge; treating bundle evidence as second-class
 * would penalise roughly half of production fragments for a property of their
 * ingest path. Both are quoted material, which is all synthesis needs to know.
 */
export function renderEvidence(fragment: FragmentForSynthesis): string {
  const spans = (fragment.evidence ?? []).filter(
    (e) => e.verification !== 'failed' && e.text.trim() !== ''
  )
  if (spans.length === 0) return ''
  return `\n\n${HEADER}\n${spans.map((e) => `> ${e.text}`).join('\n')}`
}
