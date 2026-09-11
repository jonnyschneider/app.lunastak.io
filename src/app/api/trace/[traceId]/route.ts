import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDenied, requireTraceAccess } from '@/lib/auth/guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ traceId: string }> }
) {
  try {
    const { traceId } = await params

    // `read`: the owner, or anyone on a demo project's trace. There is no "has the id → allow" case
    // any more — a guest who just generated carries a validated cookie and passes as the owner, and
    // shared links go through /share/[token], not here.
    const auth = await requireTraceAccess(traceId, { access: 'read' })
    if (isDenied(auth)) return auth

    // projectId is denormalized directly on Trace
    const trace = await prisma.trace.findUnique({
      where: { id: traceId },
      include: {
        project: {
          select: { id: true, name: true, isDemo: true },
        },
      },
    })

    if (!trace) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: trace.id,
      output: trace.output,
      extractedContext: trace.extractedContext,
      claudeThoughts: trace.claudeThoughts,
      conversationId: trace.conversationId,
      timestamp: trace.timestamp,
      projectId: trace.projectId || null,
      projectName: trace.project?.name || null,
      isDemo: trace.project?.isDemo || false,
    })
  } catch (error) {
    console.error('Failed to fetch trace:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
