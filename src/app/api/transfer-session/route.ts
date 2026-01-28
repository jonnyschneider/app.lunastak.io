import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const authenticatedUserId = session.user.id

    // Read guestUserId from httpOnly cookie (not accessible via JavaScript)
    const cookieStore = await cookies()
    const guestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value

    // Clear cookie immediately to prevent race conditions from concurrent calls
    cookieStore.delete(GUEST_COOKIE_NAME)

    if (!guestUserId) {
      // No guest session to transfer - this is fine
      console.log('[Transfer] No guest cookie found, nothing to transfer')
      return NextResponse.json({ success: true })
    }

    // Don't transfer if guest and authenticated are the same user
    if (guestUserId === authenticatedUserId) {
      console.log(`[Transfer] Guest and authenticated user are the same, skipping`)
      return NextResponse.json({ success: true })
    }

    // Verify it's actually a guest user
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserId },
      select: { email: true },
    })

    if (!guestUser || !isGuestUser(guestUser.email)) {
      return NextResponse.json(
        { error: 'Invalid guest user' },
        { status: 400 }
      )
    }

    // Check if authenticated user already has projects
    const authUserProjectCount = await prisma.project.count({
      where: { userId: authenticatedUserId, status: 'active' },
    })

    // Transfer ownership of all guest data to authenticated user
    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // If auth user already has projects, only transfer guest projects that have real work
      // This prevents duplicate empty projects when user signs out and back in
      if (authUserProjectCount > 0) {
        // Find guest projects with actual content (fragments or conversations)
        const guestProjects = await tx.project.findMany({
          where: { userId: guestUserId },
          include: {
            _count: {
              select: {
                fragments: true,
                conversations: true,
              },
            },
          },
        })

        for (const project of guestProjects) {
          const hasContent = project._count.fragments > 0 || project._count.conversations > 0
          if (hasContent) {
            // Transfer project with content
            await tx.project.update({
              where: { id: project.id },
              data: { userId: authenticatedUserId },
            })
            console.log(`[Transfer] Transferred project ${project.id} (has content)`)
          } else {
            // Delete empty project and its synthesis records
            await tx.dimensionalSynthesis.deleteMany({
              where: { projectId: project.id },
            })
            await tx.project.delete({
              where: { id: project.id },
            })
            console.log(`[Transfer] Deleted empty guest project ${project.id}`)
          }
        }
      } else {
        // Auth user has no projects - transfer all guest projects
        const projectsUpdated = await tx.project.updateMany({
          where: { userId: guestUserId },
          data: { userId: authenticatedUserId },
        })
        console.log(`[Transfer] Transferred ${projectsUpdated.count} projects`)
      }

      // Transfer conversations
      const conversationsUpdated = await tx.conversation.updateMany({
        where: { userId: guestUserId },
        data: { userId: authenticatedUserId },
      })
      console.log(`[Transfer] Transferred ${conversationsUpdated.count} conversations`)

      // Transfer traces
      const tracesUpdated = await tx.trace.updateMany({
        where: { userId: guestUserId },
        data: { userId: authenticatedUserId },
      })
      console.log(`[Transfer] Transferred ${tracesUpdated.count} traces`)

      // Transfer feedbacks
      const feedbacksUpdated = await tx.feedback.updateMany({
        where: { userId: guestUserId },
        data: { userId: authenticatedUserId },
      })
      console.log(`[Transfer] Transferred ${feedbacksUpdated.count} feedbacks`)

      // Transfer user dismissals
      const dismissalsUpdated = await tx.userDismissal.updateMany({
        where: { userId: guestUserId },
        data: { userId: authenticatedUserId },
      })
      console.log(`[Transfer] Transferred ${dismissalsUpdated.count} dismissals`)

      // Now delete the empty guest user (use deleteMany to avoid error if already deleted by concurrent call)
      await tx.user.deleteMany({
        where: { id: guestUserId },
      })
    })

    console.log(`[Transfer] Successfully transferred data from guest ${guestUserId} to user ${authenticatedUserId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to transfer session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
