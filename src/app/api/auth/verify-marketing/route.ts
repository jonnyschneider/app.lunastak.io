import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { verifyMagicLinkToken } from '@/lib/jwt'
import { notifySlackNewUser } from '@/lib/notifications'

/**
 * GET /api/auth/verify-marketing
 * Verifies a magic link token from the marketing site and creates a session.
 * Token is a signed JWT containing the user's email.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin?error=missing-token', request.url))
  }

  // Verify JWT
  const payload = await verifyMagicLinkToken(token)
  if (!payload) {
    return NextResponse.redirect(new URL('/auth/signin?error=invalid-token', request.url))
  }

  const { email } = payload

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    user = await prisma.user.create({
      data: { email },
    })
    notifySlackNewUser(email)
  }

  // Create session token
  // NextAuth uses a session token in cookies
  const sessionToken = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  })

  // Set session cookie (NextAuth expects this format)
  const cookieStore = await cookies()
  const secureCookie = process.env.NODE_ENV === 'production'
  const cookieName = secureCookie
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    expires,
    path: '/',
  })

  // Redirect to home (will land on project)
  return NextResponse.redirect(new URL('/', request.url))
}
