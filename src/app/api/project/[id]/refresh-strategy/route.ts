// src/app/api/project/[id]/refresh-strategy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser, checkAndIncrementGuestApiCalls } from '@/lib/projects'
import { planPipeline, executePipeline } from '@/lib/pipeline'
import { waitUntil } from '@vercel/functions'
import { setGenerationStatus, hasDecisionStack } from '@/lib/decision-stack'
import type { GenerationStartedContract } from '@/lib/contracts/generation-status'

export const maxDuration = 300 // 5 minutes for Pro plan

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

  // Verify project access
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Check strategy exists to refresh
  const hasStrategy = await hasDecisionStack(projectId)
  if (!hasStrategy) {
    return NextResponse.json(
      { error: 'No strategy to refresh. Complete a conversation first.' },
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

  console.log('[RefreshStrategy] Starting refresh', generationId)

  // Fire-and-forget: run synthesis + generation in background
  waitUntil((async () => {
    try {
      const trigger = {
        type: 'refresh_requested' as const,
        projectId,
        userId,
      }
      const plan = planPipeline(trigger)
      await executePipeline(plan, trigger)
    } catch (error) {
      console.error('[RefreshStrategy] Background generation failed:', error)
      await setGenerationStatus(projectId, null)
    }
  })())

  // Return immediately with generationId for polling
  const response: GenerationStartedContract = {
    status: 'started',
    generationId,
  }

  console.log('[RefreshStrategy] Returning immediately, generation running in background')
  return NextResponse.json(response)
}
