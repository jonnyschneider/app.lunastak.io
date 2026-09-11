import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser, isDenied } from '@/lib/auth/guard'

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

    // Only a guest has anything to hand over. The guard validates the guest cookie against the
    // database (this route used to do that by hand). Anyone else — no identity, or already signed
    // in — is a no-op, and still a 200: the sign-in page must never be blocked by this call.
    const requester = await requireUser()
    if (isDenied(requester) || !requester.isGuest) {
      console.log('[PrepareTransfer] No guest to transfer, nothing to prepare')
      return NextResponse.json({ success: true })
    }
    const guestUserId = requester.userId

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
