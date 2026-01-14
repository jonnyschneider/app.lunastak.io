import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getOrCreateDefaultProject } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * GET /api/guest/init
 * Creates a new guest user with demo project, sets cookie, redirects to project.
 * Called from page.tsx when no guest cookie exists.
 */
export async function GET(request: NextRequest) {
  // Create new guest user with demo project
  const { userId, project } = await getOrCreateDefaultProject(null)

  // Set guest cookie
  const cookieStore = await cookies()
  cookieStore.set(GUEST_COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  // Use request origin to stay on same domain (important for preview deployments)
  const origin = request.nextUrl.origin
  return NextResponse.redirect(new URL(`/project/${project.id}`, origin))
}
