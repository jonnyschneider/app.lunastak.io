import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createGuestUser, createEmptyGuestProject } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * GET /api/guest/init
 * Creates a new guest user with empty project, sets cookie, redirects to project.
 */
export async function GET(request: NextRequest) {
  // Create new guest user
  const guestUser = await createGuestUser()

  // Create empty project (not demo)
  const projectId = await createEmptyGuestProject(guestUser.id)

  // Set guest cookie
  const cookieStore = await cookies()
  cookieStore.set(GUEST_COOKIE_NAME, guestUser.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  // Redirect to project
  const origin = request.nextUrl.origin
  return NextResponse.redirect(new URL(`/project/${projectId}`, origin))
}
