import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * POST /api/auth/prepare-transfer
 *
 * Called from the sign-in page before sending a magic link.
 * Stores the guest-to-email mapping server-side so the transfer
 * can happen even if the magic link opens in a different browser.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: true }) // No-op
    }

    const cookieStore = await cookies()
    const guestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value

    if (!guestUserId) {
      console.log('[PrepareTransfer] No guest cookie, nothing to prepare')
      return NextResponse.json({ success: true })
    }

    // Verify it's actually a guest user
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserId },
      select: { email: true },
    })

    if (!guestUser || !isGuestUser(guestUser.email)) {
      console.log('[PrepareTransfer] Invalid guest user, skipping')
      return NextResponse.json({ success: true })
    }

    // Upsert: delete any existing pending transfer for this email, then create
    await prisma.pendingGuestTransfer.deleteMany({
      where: { email: email.toLowerCase() },
    })

    await prisma.pendingGuestTransfer.create({
      data: {
        email: email.toLowerCase(),
        guestUserId,
      },
    })

    console.log(`[PrepareTransfer] Stored pending transfer: ${email} -> guest ${guestUserId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PrepareTransfer] Failed:', error)
    // Don't block sign-in flow on failure
    return NextResponse.json({ success: true })
  }
}
