import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

export async function GET() {
  const session = await getServerSession(authOptions)

  // Authenticated path
  if (session?.user?.email) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          upgradedAt: true,
          accounts: { select: { provider: true } },
        },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const providers = user.accounts.map(a => a.provider)
      const loginMethods = providers.length > 0 ? providers : ['email']

      return NextResponse.json({
        userId: user.id,
        userType: isGuestUser(user.email) ? 'guest' : 'signed_up',
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        isPro: !!user.upgradedAt,
        upgradedAt: user.upgradedAt,
        loginMethods,
      })
    } catch (error) {
      console.error('[Account] Error fetching user:', error)
      return NextResponse.json({ error: 'Failed to fetch account info' }, { status: 500 })
    }
  }

  // Guest path — resolved via cookie, same pattern as /api/projects
  const cookieStore = await cookies()
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)

  if (guestCookie?.value) {
    try {
      const guest = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { id: true, email: true, name: true, createdAt: true },
      })

      if (guest && isGuestUser(guest.email)) {
        return NextResponse.json({
          userId: guest.id,
          userType: 'guest',
          email: guest.email,
          name: guest.name,
          createdAt: guest.createdAt,
          isPro: false,
          upgradedAt: null,
          loginMethods: [],
        })
      }
    } catch (error) {
      console.error('[Account] Error fetching guest user:', error)
    }
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
