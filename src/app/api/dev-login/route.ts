import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'
import { GUEST_COOKIE_NAME } from '@/lib/auth/current-user'

const SESSION_COOKIE = 'next-auth.session-token' // dev is http, so never the __Secure- name

/**
 * DEV ONLY. Be someone without an email round-trip or an LLM call.
 *
 *   ?email=<existing user>  sign in as them. A guest cookie already in the browser is left alone,
 *                           so this is also "a guest just signed up": SessionTransferProvider moves
 *                           the guest's work across, exactly as after a magic link.
 *   ?guest=<guest user id>  become that guest (signs out first). Pair with ?email= to try signup
 *                           from a guest who already has a stack.
 *
 * Sessions are database sessions (PrismaAdapter), so this writes a Session row, the way
 * auth/verify-marketing does. It used to mint a JWT, which the adapter never looks up, so it
 * silently left you signed out.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const guestId = searchParams.get('guest')
  const home = NextResponse.redirect(new URL('/', request.url))

  if (guestId) {
    const guest = await prisma.user.findUnique({ where: { id: guestId }, select: { email: true } })
    if (!guest || !isGuestUser(guest.email)) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
    }
    home.cookies.set(GUEST_COOKIE_NAME, guestId, { path: '/', httpOnly: true, sameSite: 'lax' })
    home.cookies.delete(SESSION_COOKIE)
    return home
  }

  if (!email) {
    return NextResponse.json({ error: 'email or guest param required' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const sessionToken = randomUUID()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } })

  home.cookies.set(SESSION_COOKIE, sessionToken, { path: '/', httpOnly: true, sameSite: 'lax', expires })
  return home
}
