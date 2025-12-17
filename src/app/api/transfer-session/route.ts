import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { transferGuestSession } from '@/lib/transferSession'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { guestUserId } = await request.json()

    if (!guestUserId) {
      return NextResponse.json(
        { error: 'Missing guestUserId' },
        { status: 400 }
      )
    }

    // Transfer guest session to authenticated user
    await transferGuestSession(guestUserId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to transfer session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
