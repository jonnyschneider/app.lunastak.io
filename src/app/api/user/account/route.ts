import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        upgradedAt: true,
        accounts: {
          select: {
            provider: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine login methods
    const providers = user.accounts.map(a => a.provider)
    const loginMethods = providers.length > 0 ? providers : ['email'] // Magic link fallback

    return NextResponse.json({
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      isPro: !!user.upgradedAt,
      upgradedAt: user.upgradedAt,
      loginMethods,
    })
  } catch (error) {
    console.error('[Account] Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account info' },
      { status: 500 }
    )
  }
}
