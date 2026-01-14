import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getOrCreateDefaultProject } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * GET /api/guest/init
 * Creates a new guest user with demo project, sets cookie, redirects to project.
 * Called from page.tsx when no guest cookie exists.
 */
export async function GET() {
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

  // Redirect to project
  return NextResponse.redirect(
    new URL(`/project/${project.id}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  )
}
