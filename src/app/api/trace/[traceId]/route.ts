import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ traceId: string }> }
) {
  try {
    const { traceId } = await params
    const session = await getServerSession(authOptions)
    const isReadOnly = request.nextUrl.searchParams.get('readonly') === 'true'

    // Find the trace with project info (projectId denormalized directly on Trace)
    const trace = await prisma.trace.findUnique({
      where: { id: traceId },
      include: {
        conversation: {
          select: { userId: true },
        },
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

    // Check access: user must own the trace or conversation
    // For guest users, we allow access if they have the trace ID (shared link scenario)
    // For authenticated users, verify ownership
    if (session?.user?.id && !isReadOnly) {
      const isOwner = trace.userId === session.user.id ||
                      trace.conversation?.userId === session.user.id

      if (!isOwner) {
        return NextResponse.json(
          { error: 'You do not have permission to view this strategy' },
          { status: 403 }
        )
      }
    }
    // Note: For guest users without a session, we currently allow access if they have the traceId
    // This enables the "just generated" scenario before auth transfer completes

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
