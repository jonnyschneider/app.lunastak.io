import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user's traces ordered by timestamp desc
    const traces = await prisma.trace.findMany({
      where: { userId: session.user.id },
      orderBy: { timestamp: 'desc' },
      take: 10, // Limit to 10 most recent
      select: {
        id: true,
        conversationId: true,
        timestamp: true,
        output: true,
      },
    })

    return NextResponse.json({
      strategies: traces.map(t => ({
        id: t.id,
        conversationId: t.conversationId,
        createdAt: t.timestamp,
        output: t.output,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch strategies:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
