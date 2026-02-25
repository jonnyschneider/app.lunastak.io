import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { transferGuestToUser } from '@/lib/transfer-session'

const GUEST_COOKIE_NAME = 'guestUserId'

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const authenticatedUserId = session.user.id

    // Read guestUserId from httpOnly cookie (not accessible via JavaScript)
    const cookieStore = await cookies()
    const guestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value

    // Clear cookie immediately to prevent race conditions from concurrent calls
    cookieStore.delete(GUEST_COOKIE_NAME)

    if (!guestUserId) {
      // No guest session to transfer - this is fine
      console.log('[Transfer] No guest cookie found, nothing to transfer')
      return NextResponse.json({ success: true })
    }

    await transferGuestToUser(guestUserId, authenticatedUserId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to transfer session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
