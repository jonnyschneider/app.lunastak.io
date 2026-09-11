/**
 * Update synthesis - orchestrates full vs incremental synthesis
 */

import { prisma } from '@/lib/db'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { fullSynthesis } from './full-synthesis'
import { incrementalSynthesis } from './incremental-synthesis'
import { FragmentForSynthesis } from './types'

export type SynthesisDecision = 'skip' | 'full' | 'incremental'

export interface SynthesisDecisionInputs {
  existing: { summary: string | null; lastSynthesizedAt: Date; fragmentCount: number }
  /** Active fragments tagged to the dimension now. */
  allCount: number
  /** Of those, captured after the last synthesis. */
  newCount: number
  /** Fragments tagged to the dimension that were discarded (archived / soft-deleted) since then. */
  discardedSince: number
  now?: Date
}

/**
 * Skip, rebuild, or add to a dimension's synthesis.
 *
 * ⚠ A SUMMARY MUST DESCRIBE EXACTLY THE ACTIVE FRAGMENTS. Until 2026-09-11 this only ever asked
 * "is anything new?", so a discard-only change skipped the dimension outright and the discarded
 * ground truth stayed baked into the summary that refresh generation reads as its strategic
 * context — the user removed it, and the next stack was still built on it. Incremental synthesis
 * cannot fix that either: it is handed the existing summary plus the new fragments, and has no way
 * to take anything out.
 *
 * So any change to the set of fragments the summary was built from forces a FULL rebuild:
 *
 *   - `discardedSince > 0` — something was taken out;
 *   - `allCount - newCount !== existing.fragmentCount` — the already-seen set is not the one the
 *     summary counted. Catches a discarded fragment being RESTORED (restore clears `archivedAt` and
 *     its `capturedAt` is old, so it looks neither new nor discarded), and a fragment whose
 *     `capturedAt` predates the last run but which that run never saw.
 *
 * Only when nothing was added or changed is the dimension skipped. This runs on refresh and on the
 * 15-fragment threshold — never on a discard itself (Dispositions, service-blueprints.md: do NOT
 * auto-regenerate on archive).
 */
export function decideSynthesis(i: SynthesisDecisionInputs): SynthesisDecision {
  const { existing, allCount, newCount, discardedSince } = i
  if (!existing.summary) return 'full'

  const setChanged = discardedSince > 0 || allCount - newCount !== existing.fragmentCount
  if (newCount === 0 && !setChanged) return 'skip'
  if (setChanged) return 'full'

  // Unchanged rules for a purely additive change.
  const now = i.now ?? new Date()
  const daysSinceLastSynthesis =
    (now.getTime() - existing.lastSynthesizedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceLastSynthesis > 30) return 'full' // stale
  if (allCount > 0 && newCount / allCount > 0.5) return 'full' // >50% new
  if (allCount < 5) return 'full' // very few fragments — full is cheap
  return 'incremental'
}

/**
 * Update synthesis for a specific dimension
 */
export async function updateDimensionalSynthesis(
  projectId: string,
  dimension: Tier1Dimension
): Promise<void> {
  console.log(`[Synthesis] Updating ${dimension} for project ${projectId}`)

  // 1. Get or create synthesis record
  let existingSynthesis = await prisma.dimensionalSynthesis.findUnique({
    where: {
      projectId_dimension: { projectId, dimension }
    }
  })

  if (!existingSynthesis) {
    // Record missing (e.g. reset/migration) — create it so synthesis can proceed
    console.log(`[Synthesis] Creating missing synthesis record for ${dimension}`)
    existingSynthesis = await prisma.dimensionalSynthesis.create({
      data: {
        projectId,
        dimension,
        confidence: 'LOW',
        fragmentCount: 0,
        lastSynthesizedAt: new Date(0), // epoch — ensures all fragments count as "new"
      },
    })
  }

  // 2. Get all active fragments for this dimension
  const allFragments = await prisma.fragment.findMany({
    where: {
      projectId,
      status: 'active',
      dimensionTags: {
        some: { dimension }
      }
    },
    select: {
      id: true,
      content: true,
      contentType: true,
      confidence: true,
      capturedAt: true,
      // Verbatim spans, ordinal order — rendered into the synthesis payload as the
      // user's own words (§18 of the ground-truth preflight design).
      evidence: {
        select: { text: true, verification: true },
        orderBy: { ordinal: 'asc' },
      },
    },
    orderBy: { capturedAt: 'asc' }
  })

  console.log(`[Synthesis] Found ${allFragments.length} fragments for ${dimension}`)

  if (allFragments.length === 0) {
    // No fragments - update to empty state
    await prisma.dimensionalSynthesis.update({
      where: { id: existingSynthesis.id },
      data: {
        summary: null,
        gaps: [],
        confidence: 'LOW',
        fragmentCount: 0,
        lastSynthesizedAt: new Date(),
      }
    })
    return
  }

  // 3. Get new fragments (created after last synthesis)
  const newFragments = allFragments.filter(
    f => f.capturedAt > existingSynthesis.lastSynthesizedAt
  )

  // 4. Anything taken out of this dimension since the summary was written?
  const since = existingSynthesis.lastSynthesizedAt
  const discardedSince = await prisma.fragment.count({
    where: {
      projectId,
      dimensionTags: { some: { dimension } },
      OR: [
        { status: 'archived', archivedAt: { gt: since } },
        { status: 'soft_deleted', softDeletedAt: { gt: since } },
      ],
    },
  })

  // 5. Skip, rebuild, or add — see `decideSynthesis`
  const decision = decideSynthesis({
    existing: existingSynthesis,
    allCount: allFragments.length,
    newCount: newFragments.length,
    discardedSince,
  })
  if (decision === 'skip') {
    console.log(`[Synthesis] Skipping ${dimension} - no change since last synthesis`)
    return
  }
  const useFullSynthesis = decision === 'full'

  console.log(`[Synthesis] Using ${useFullSynthesis ? 'FULL' : 'INCREMENTAL'} synthesis (${newFragments.length} new, ${discardedSince} discarded)`)

  // 6. Run synthesis
  const fragmentsForSynthesis: FragmentForSynthesis[] = useFullSynthesis
    ? allFragments
    : newFragments

  const result = useFullSynthesis
    ? await fullSynthesis(dimension, fragmentsForSynthesis)
    : await incrementalSynthesis(dimension, existingSynthesis, fragmentsForSynthesis)

  // 7. Save result
  await prisma.dimensionalSynthesis.update({
    where: { id: existingSynthesis.id },
    data: {
      summary: result.summary || null,
      gaps: result.gaps as unknown as Parameters<typeof prisma.dimensionalSynthesis.update>[0]['data']['gaps'],
      confidence: result.confidence,
      fragmentCount: allFragments.length,
      lastSynthesizedAt: new Date(),
    }
  })

  console.log(`[Synthesis] Updated ${dimension} with confidence ${result.confidence}`)
}

/**
 * Update all syntheses that have new fragments
 */
export async function updateAllSyntheses(projectId: string): Promise<void> {
  // Get all dimensions that have fragments
  const dimensionsWithFragments = await prisma.fragmentDimensionTag.findMany({
    where: {
      fragment: {
        projectId,
        status: 'active'
      }
    },
    select: {
      dimension: true
    },
    distinct: ['dimension']
  })

  /*
   * ⚠ PLUS every dimension that HAD a summary. Asking only "which dimensions have active fragments"
   * meant a dimension whose last ground truth was discarded was never revisited, so its old summary
   * (and `fragmentCount > 0`) kept feeding refresh generation. `updateDimensionalSynthesis` resets a
   * dimension with no active fragments to empty; it has to be called for that to happen.
   */
  const previouslySynthesised = await prisma.dimensionalSynthesis.findMany({
    where: { projectId, fragmentCount: { gt: 0 } },
    select: { dimension: true },
  })

  const dimensions = Array.from(new Set([
    ...dimensionsWithFragments.map(d => d.dimension),
    ...previouslySynthesised.map(d => d.dimension),
  ])) as Tier1Dimension[]

  console.log(`[Synthesis] Updating ${dimensions.length} dimensions for project ${projectId}`)

  // Run dimension syntheses in parallel - they're independent of each other
  // (Knowledge summary must still run AFTER all syntheses complete)
  await Promise.all(
    dimensions.map(dimension => updateDimensionalSynthesis(projectId, dimension))
  )
}
