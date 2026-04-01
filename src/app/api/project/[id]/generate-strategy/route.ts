// src/app/api/project/[id]/generate-strategy/route.ts
// Generate strategy from existing fragments — no conversation required.
// Thin route: auth + validation, then delegates to pipeline orchestrator.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser, checkAndIncrementGuestApiCalls } from '@/lib/projects'
import { planPipeline, executePipeline } from '@/lib/pipeline'
import { waitUntil } from '@vercel/functions'
import { setGenerationStatus } from '@/lib/decision-stack'
import type { GenerationStartedContract } from '@/lib/contracts/generation-status'

export const maxDuration = 300

const GUEST_COOKIE_NAME = 'guestUserId'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const session = await getServerSession(authOptions)

  // Auth: session or guest cookie
  let userId: string | null = session?.user?.id || null
  if (!userId) {
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)
    if (guestCookie?.value) {
      const guestUser = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { email: true },
      })
      if (guestUser && isGuestUser(guestUser.email)) {
        userId = guestCookie.value
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Check we have fragments to work with
  const fragmentCount = await prisma.fragment.count({
    where: { projectId, status: 'active' },
  })

  if (fragmentCount === 0) {
    return NextResponse.json(
      { error: 'No fragments found. Upload documents or import a context bundle first.' },
      { status: 400 }
    )
  }

  // Check guest API limit
  const { blocked } = await checkAndIncrementGuestApiCalls(userId)
  if (blocked) {
    return NextResponse.json(
      { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
      { status: 429 }
    )
  }

  // Set generation status for polling
  await setGenerationStatus(projectId, 'generating')

  const generationId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  console.log('[GenerateStrategy] Starting generation', generationId, 'from', fragmentCount, 'fragments')

  const trigger = {
    type: 'generate_from_knowledge' as const,
    projectId,
    userId,
  }

  const generationWork = (async () => {
    try {
      const plan = planPipeline(trigger)
      await executePipeline(plan, trigger)
    } catch (error) {
      console.error('[GenerateStrategy] Background generation failed:', error)
      await setGenerationStatus(projectId, null)
    }
  })()

  if (process.env.VERCEL) {
    waitUntil(generationWork)
  } else {
    await generationWork
  }

  const response: GenerationStartedContract = {
    status: 'started',
    generationId,
  }

  return NextResponse.json(response)
}
