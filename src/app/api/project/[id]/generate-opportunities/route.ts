// src/app/api/project/[id]/generate-opportunities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkAndIncrementGuestApiCalls } from '@/lib/projects'
import { requireProjectAccess, isDenied } from '@/lib/auth/guard'
import { planPipeline, executePipeline } from '@/lib/pipeline'
import { waitUntil } from '@vercel/functions'
import { setGenerationStatus, hasDecisionStack } from '@/lib/decision-stack'
import type { CoverageWarning } from '@/lib/contracts/opportunity-generation'

export const maxDuration = 300

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  // An archived project is as good as gone to this route.
  const auth = await requireProjectAccess(projectId, { active: true })
  if (isDenied(auth)) return auth
  const { project } = auth
  const { userId } = auth.requester

  // Check that a decision stack exists
  const hasStrategy = await hasDecisionStack(projectId)
  if (!hasStrategy) {
    return NextResponse.json(
      { error: 'No Direction found. Complete your Direction first.' },
      { status: 400 }
    )
  }

  // Check guest API limit
  if (!project.isDemo) {
    const { blocked } = await checkAndIncrementGuestApiCalls(userId)
    if (blocked) {
      return NextResponse.json(
        { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
        { status: 429 }
      )
    }
  }

  // Check dimensional coverage for warnings
  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: { projectId },
    select: { dimension: true, confidence: true, fragmentCount: true },
  })

  const coverageWarnings: CoverageWarning[] = syntheses
    .filter(s => s.confidence === 'LOW' || s.fragmentCount < 3)
    .map(s => ({
      dimension: s.dimension,
      dimensionLabel: s.dimension.replace(/_/g, ' ').toLowerCase(),
      confidence: s.confidence,
      fragmentCount: s.fragmentCount,
    }))

  // Set generation status for polling
  await setGenerationStatus(projectId, 'generating_opportunities')

  const generationId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  console.log('[GenerateOpportunities] Starting generation', generationId)

  const trigger = {
    type: 'generate_opportunities' as const,
    projectId,
    userId,
  }

  const generationWork = (async () => {
    try {
      const plan = planPipeline(trigger)
      await executePipeline(plan, trigger, { ownsGenerationStatus: true })
    } catch (error) {
      console.error('[GenerateOpportunities] Background generation failed:', error)
      await setGenerationStatus(projectId, null)
    }
  })()

  // On Vercel: fire-and-forget. Locally: await inline.
  if (process.env.VERCEL) {
    waitUntil(generationWork)
  } else {
    await generationWork
  }

  const response = {
    status: 'started' as const,
    generationId,
    ...(coverageWarnings.length > 0 ? { coverageWarnings } : {}),
  }

  console.log('[GenerateOpportunities] Returning, generation', process.env.VERCEL ? 'running in background' : 'complete')
  return NextResponse.json(response)
}
