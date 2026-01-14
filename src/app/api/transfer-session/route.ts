import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

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

    // Verify it's actually a guest user
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserId },
      select: { email: true },
    })

    if (!guestUser || !isGuestUser(guestUser.email)) {
      return NextResponse.json(
        { error: 'Invalid guest user' },
        { status: 400 }
      )
    }

    // Cascade delete the guest user and all their data
    await prisma.user.delete({
      where: { id: guestUserId },
    })

    // Clear the guest cookie
    const cookieStore = await cookies()
    cookieStore.delete(GUEST_COOKIE_NAME)

    console.log(`[Transfer] Deleted guest user ${guestUserId} on signup`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to process signup:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
