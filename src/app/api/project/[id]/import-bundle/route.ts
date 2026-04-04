// src/app/api/project/[id]/import-bundle/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'
import { planImport, executeImport } from '@/lib/import'
import type { ImportTrigger, ContextBundle } from '@/lib/import'

export const maxDuration = 120 // LLM dimensional tagging can take time

const GUEST_COOKIE_NAME = 'guestUserId'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const session = await getServerSession(authOptions)

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

  let bundle: ContextBundle
  try {
    bundle = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate: must have either chunks (transform mode) or themes (direct mode)
  const hasChunks = bundle.chunks && Array.isArray(bundle.chunks) && bundle.chunks.length > 0
  const hasThemes = bundle.themes && Array.isArray(bundle.themes) && bundle.themes.length > 0

  if (!hasChunks && !hasThemes) {
    return NextResponse.json({ error: 'Bundle must contain chunks or themes' }, { status: 400 })
  }

  // Determine mode: explicit param, or infer from bundle content
  const modeParam = request.nextUrl.searchParams.get('mode') as 'transform' | 'direct' | null
  const mode = modeParam || (hasChunks ? 'transform' : 'direct')

  const trigger: ImportTrigger = {
    type: 'context_bundle',
    projectId,
    mode,
    bundle,
  }

  const plan = planImport(trigger)

  try {
    const result = await executeImport(plan, trigger)

    // Track successful import
    if (userId) {
      const { logStatsigEvent } = await import('@/lib/statsig')
      logStatsigEvent(userId, 'bundle_imported', result.fragmentsCreated, {
        projectId,
        fragmentCount: String(result.fragmentsCreated),
        chunkCount: String(bundle.chunks?.length || bundle.themes?.length || 0),
        mode,
        importBatchId: result.importBatchId || '',
      })
    }

    return NextResponse.json({
      fragmentsCreated: result.fragmentsCreated,
      questionsAdded: result.questionsAdded,
      importBatchId: result.importBatchId,
    })
  } catch (error) {
    console.error('[ImportBundle] Error:', error)

    // Track failed import
    if (userId) {
      const { logStatsigEvent } = await import('@/lib/statsig')
      logStatsigEvent(userId, 'bundle_import_failed', 1, {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
        mode,
      })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
