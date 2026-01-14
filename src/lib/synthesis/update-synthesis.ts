/**
 * Update synthesis - orchestrates full vs incremental synthesis
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { fullSynthesis } from './full-synthesis'
import { incrementalSynthesis } from './incremental-synthesis'
import { FragmentForSynthesis } from './types'

/**
 * Determine if we should do full synthesis or incremental
 */
function shouldFullSynthesis(
  existingSynthesis: { summary: string | null; lastSynthesizedAt: Date; fragmentCount: number },
  allFragmentsCount: number,
  newFragmentsCount: number
): boolean {
  // 1. No existing synthesis
  if (!existingSynthesis.summary) return true

  // 2. Synthesis is stale (> 30 days old)
  const daysSinceLastSynthesis =
    (Date.now() - existingSynthesis.lastSynthesizedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceLastSynthesis > 30) return true

  // 3. Fragments changed significantly (> 50% new)
  if (allFragmentsCount > 0 && newFragmentsCount / allFragmentsCount > 0.5) return true

  // 4. Very few fragments (< 5) - full synthesis is cheap
  if (allFragmentsCount < 5) return true

  // Otherwise, use incremental
  return false
}

/**
 * Update synthesis for a specific dimension
 */
export async function updateDimensionalSynthesis(
  projectId: string,
  dimension: Tier1Dimension
): Promise<void> {
  console.log(`[Synthesis] Updating ${dimension} for project ${projectId}`)

  // 1. Get existing synthesis
  const existingSynthesis = await prisma.dimensionalSynthesis.findUnique({
    where: {
      projectId_dimension: { projectId, dimension }
    }
  })

  if (!existingSynthesis) {
    console.error(`[Synthesis] No synthesis record found for ${dimension}`)
    return
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
      capturedAt: true
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
        keyThemes: [],
        keyQuotes: [],
        gaps: [],
        contradictions: [],
        subdimensions: Prisma.JsonNull,
        confidence: 'LOW',
        fragmentCount: 0,
        lastSynthesizedAt: new Date(),
        synthesizedBy: 'claude-synthesis'
      }
    })
    return
  }

  // 3. Get new fragments (created after last synthesis)
  const newFragments = allFragments.filter(
    f => f.capturedAt > existingSynthesis.lastSynthesizedAt
  )

  // 4. Decide: full or incremental?
  const useFullSynthesis = shouldFullSynthesis(
    existingSynthesis,
    allFragments.length,
    newFragments.length
  )

  console.log(`[Synthesis] Using ${useFullSynthesis ? 'FULL' : 'INCREMENTAL'} synthesis (${newFragments.length} new fragments)`)

  // 5. Run synthesis
  const fragmentsForSynthesis: FragmentForSynthesis[] = useFullSynthesis
    ? allFragments
    : newFragments

  const result = useFullSynthesis
    ? await fullSynthesis(dimension, fragmentsForSynthesis)
    : await incrementalSynthesis(dimension, existingSynthesis, fragmentsForSynthesis)

  // 6. Save result
  await prisma.dimensionalSynthesis.update({
    where: { id: existingSynthesis.id },
    data: {
      summary: result.summary || null,
      keyThemes: result.keyThemes,
      keyQuotes: result.keyQuotes,
      gaps: result.gaps as unknown as Parameters<typeof prisma.dimensionalSynthesis.update>[0]['data']['gaps'],
      contradictions: result.contradictions,
      subdimensions: result.subdimensions ?? Prisma.JsonNull,
      confidence: result.confidence,
      fragmentCount: allFragments.length,
      lastSynthesizedAt: new Date(),
      synthesizedBy: 'claude-synthesis'
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

  const dimensions = dimensionsWithFragments.map(d => d.dimension as Tier1Dimension)

  console.log(`[Synthesis] Updating ${dimensions.length} dimensions for project ${projectId}`)

  // Run dimension syntheses in parallel - they're independent of each other
  // (Knowledge summary must still run AFTER all syntheses complete)
  await Promise.all(
    dimensions.map(dimension => updateDimensionalSynthesis(projectId, dimension))
  )
}
