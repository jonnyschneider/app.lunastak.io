/**
 * Counting ground truths, server-side, in one place.
 *
 * WHY THIS EXISTS. The review filters out rows a user cannot be asked to verify, while every count
 * in the app included them. So the knowledgebase said 32 above a review showing 24, and a single
 * document upload could report "5 since last strategy" over three visible rows — a gap the user
 * has no way to account for, and should not have to: a bundle tension is the skill's reading
 * across themes, and a Luna turn is the assistant's own words.
 *
 * ⚠ THE EXCLUDED ROWS ARE NOT DELETED. They are SYSTEM CONTEXT — still stored, still fed to
 * synthesis and generation, still counted by the support model behind the Harvey balls (§16.4,
 * measured, must not move). They are simply not counted *at the user*. A smaller true number beats
 * a larger one nobody can reconcile.
 *
 * ⚠ WHY NOT `prisma.fragment.count()`. The predicate needs every fragment's evidence rows — a Luna
 * turn is one whose spans are ALL `sourceRole: 'assistant'` — which no `where` clause expresses.
 * So this reads the minimum and filters in memory. At these volumes (tens to low hundreds per
 * project) that is cheaper than the round trips it replaces.
 */
import { prisma } from '@/lib/db'
import { isGroundTruth } from '@/lib/ground-truth/derive'
import type { Prisma } from '@prisma/client'

/**
 * The minimum a row needs for `isGroundTruth`. Spread this into any `select` that will be filtered,
 * so a caller cannot forget `sourceRole` and silently count assistant turns as the user's.
 */
export const GROUND_TRUTH_SELECT = {
  contentType: true,
  title: true,
  evidence: { select: { sourceRole: true } },
} as const

/** Filter rows already loaded with `GROUND_TRUTH_SELECT`. */
export function onlyGroundTruths<T extends { contentType: string; title: string | null; evidence: { sourceRole: string | null }[] }>(
  fragments: T[],
): T[] {
  return fragments.filter(isGroundTruth)
}

/**
 * How many ground truths match this filter.
 *
 * @param where any `Fragment` filter — by project, document, conversation. `status: 'active'` is
 *              applied unless the caller overrides it, because an archived row is not something
 *              the user is being told they have.
 */
export async function countGroundTruths(where: Prisma.FragmentWhereInput): Promise<number> {
  const rows = await prisma.fragment.findMany({
    where: { status: 'active', ...where },
    select: GROUND_TRUTH_SELECT,
  })
  return onlyGroundTruths(rows).length
}
