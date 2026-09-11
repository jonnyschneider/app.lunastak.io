import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'
import { requireUser, isDenied } from '@/lib/auth/guard'

/**
 * GET /api/user/account
 * Who the requester is, for the account page, the upgrade flow and Statsig. A guest gets a
 * guest-shaped answer (no login methods, never Pro) rather than a 401 — they're a real user row.
 */
export async function GET() {
  const requester = await requireUser()
  if (isDenied(requester)) return requester

  if (requester.isGuest) {
    try {
      const guest = await prisma.user.findUnique({
        where: { id: requester.userId },
        select: { id: true, email: true, name: true, createdAt: true },
      })

      if (guest) {
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
    // As before: a guest whose row can't be read is treated as no one.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: requester.userId },
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
