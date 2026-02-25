import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import { transferGuestToUser } from '@/lib/transfer-session'

// Only available when ENABLE_TEST_ENDPOINTS is set (preview environment)
const ENABLED = process.env.ENABLE_TEST_ENDPOINTS === 'true'

export async function POST(req: Request) {
  if (!ENABLED) {
    return NextResponse.json({ error: 'Test endpoints disabled' }, { status: 404 })
  }

  const body = await req.json() as {
    email?: string
    guestUserId?: string // If provided, transfers guest data to new user
  }

  const email = body.email || `test-${randomUUID().slice(0, 8)}@test.lunastak.io`

  // Create or find user
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: 'Test User' },
    })
  }

  // Create session (NextAuth PrismaAdapter format)
  const sessionToken = randomUUID()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  })

  // Transfer guest data if requested
  let transferred = false
  if (body.guestUserId) {
    transferred = await transferGuestToUser(body.guestUserId, user.id)
  }

  return NextResponse.json({
    userId: user.id,
    email,
    sessionToken,
    transferred,
  })
}
