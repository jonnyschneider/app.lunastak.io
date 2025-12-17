import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { traceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const traceId = params.traceId

    // Fetch trace
    const trace = await prisma.trace.findUnique({
      where: { id: traceId },
    })

    if (!trace) {
      return NextResponse.json(
        { error: 'Trace not found' },
        { status: 404 }
      )
    }

    // Check authorization - user must be authenticated and own the trace
    if (trace.userId !== session?.user?.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      id: trace.id,
      conversationId: trace.conversationId,
      output: trace.output,
      claudeThoughts: trace.claudeThoughts,
      timestamp: trace.timestamp,
    })
  } catch (error) {
    console.error('Failed to fetch trace:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
