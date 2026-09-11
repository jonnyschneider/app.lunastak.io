import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRequester } from '@/lib/auth/current-user'

/**
 * POST /api/feedback — free-text feedback on a generated strategy. Anonymous-capable by design
 * (PUBLIC in route-auth.test.ts), but who filed it comes from the request — session or validated
 * guest cookie — never from the body. A body `userId` used to be stored as given, so anyone could
 * file feedback as anyone.
 */
export async function POST(request: NextRequest) {
  try {
    const { traceId, responseText } = await request.json()

    // Validate required fields
    if (!traceId || !responseText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const requester = await getRequester()

    const feedback = await prisma.feedback.create({
      data: {
        traceId,
        userId: requester?.userId ?? null,
        responseText,
      },
    })

    return NextResponse.json({ success: true, feedbackId: feedback.id })
  } catch (error) {
    console.error('Failed to save feedback:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
