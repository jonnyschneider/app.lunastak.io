import { NextResponse } from 'next/server'
import { getGenerationStatus } from '@/lib/decision-stack'
import { isDenied, requireProjectAccess } from '@/lib/auth/guard'

// Polling endpoint — must never be cached
export const dynamic = 'force-dynamic'

/**
 * Project-level generation status polling.
 * Reads from DecisionStack.generationStatus instead of GeneratedOutput.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  // `read` so a demo project's polls still answer. Polled every few seconds — the guard's session
  // lookup plus one indexed findFirst is cheap enough not to cache.
  const auth = await requireProjectAccess(projectId, { access: 'read' })
  if (isDenied(auth)) return auth

  const { status, startedAt } = await getGenerationStatus(projectId)

  return NextResponse.json({
    status: status || 'idle',
    startedAt: startedAt?.toISOString() || null,
  })
}
