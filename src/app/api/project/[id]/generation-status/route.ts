import { NextResponse } from 'next/server'
import { getGenerationStatus } from '@/lib/decision-stack'

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
  const { status, startedAt } = await getGenerationStatus(projectId)

  return NextResponse.json({
    status: status || 'idle',
    startedAt: startedAt?.toISOString() || null,
  })
}
