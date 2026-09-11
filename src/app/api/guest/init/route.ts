import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createGuestUser, createEmptyGuestProject } from '@/lib/projects'
import { GUEST_COOKIE_NAME } from '@/lib/auth/current-user'

/**
 * POST /api/guest/init
 * Creates a new guest user with an empty project, sets the cookie, returns the project id.
 *
 * POST, and called from the browser (`GuestStart`), so a visitor has to run JavaScript to become a
 * guest. It used to be a GET that `/` redirected to, which meant every crawler and link unfurler
 * following `/` minted a guest and a project: ~100 rows a week against ~70 real sessions across
 * the app and marketing site combined (measured 2026-09-11), burying the real guests in the funnel.
 */
export async function POST() {
  const guestUser = await createGuestUser()
  const projectId = await createEmptyGuestProject(guestUser.id)

  const cookieStore = await cookies()
  cookieStore.set(GUEST_COOKIE_NAME, guestUser.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return NextResponse.json({ projectId })
}

/** Old links to the GET land on `/`, which starts a guest from the browser. Mints nothing. */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/', request.nextUrl.origin))
}
