import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { seedDemoProject } from '@/lib/seed-demo'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * POST /api/demo/create
 * Creates a demo project on-demand for the current user (guest or authenticated)
 */
export async function POST() {
  // Get user ID from session or guest cookie
  const session = await getServerSession(authOptions)
  let userId = session?.user?.id

  if (!userId) {
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)
    if (guestCookie?.value) {
      // Verify it's a valid guest
      const user = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { email: true },
      })
      if (user && isGuestUser(user.email)) {
        userId = guestCookie.value
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user already has a demo project
  const existingDemo = await prisma.project.findFirst({
    where: { userId, isDemo: true },
    select: { id: true },
  })

  if (existingDemo) {
    return NextResponse.json({ projectId: existingDemo.id, existed: true })
  }

  // Create new demo project
  const projectId = await seedDemoProject(userId)

  return NextResponse.json({ projectId, existed: false })
}
