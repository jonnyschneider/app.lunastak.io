import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireUser, isDenied } from '@/lib/auth/guard'
import { GUEST_COOKIE_NAME } from '@/lib/auth/current-user'
import { transferGuestToUser } from '@/lib/transfer-session'

export async function POST(_request: NextRequest) {
  try {
    // The receiving side must be a signed-in session. A guest cookie on its own is a 401 here —
    // and the cookie is left alone, so the guest isn't lost.
    const requester = await requireUser({ guests: false })
    if (isDenied(requester)) return requester
    const authenticatedUserId = requester.userId

    // The raw guest cookie (httpOnly, not readable from JS) is the thing being handed over, not an
    // identity — transferGuestToUser validates it's a real guest before moving anything.
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
