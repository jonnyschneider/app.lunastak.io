import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser, isDenied } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const requester = await requireUser({ guests: false })
    if (isDenied(requester)) return requester

    // Fetch user's traces ordered by starred first, then timestamp desc
    const traces = await prisma.trace.findMany({
      where: { userId: requester.userId },
      orderBy: [
        { starred: 'desc' },
        { timestamp: 'desc' },
      ],
      take: 20, // Limit to 20 most recent
      select: {
        id: true,
        conversationId: true,
        timestamp: true,
        output: true,
        starred: true,
        starredAt: true,
        conversation: {
          select: {
            title: true,
          },
        },
      },
    })

    return NextResponse.json({
      strategies: traces.map(t => ({
        id: t.id,
        conversationId: t.conversationId,
        conversationTitle: t.conversation?.title || null,
        createdAt: t.timestamp,
        output: t.output,
        starred: t.starred,
        starredAt: t.starredAt,
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
