import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

export async function transferGuestSession(guestUserId: string, authenticatedUserId: string) {
  try {
    // Verify this is actually a guest user
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserId },
      select: { email: true }
    })

    if (!guestUser) {
      console.warn(`Guest user ${guestUserId} not found, skipping transfer`)
      return
    }

    if (!isGuestUser(guestUser.email)) {
      console.warn(`User ${guestUserId} is not a guest user, skipping transfer`)
      return
    }

    // Check if authenticated user already has a project
    const existingProject = await prisma.project.findFirst({
      where: { userId: authenticatedUserId },
      orderBy: { createdAt: 'asc' }
    })

    // Get guest's project
    const guestProject = await prisma.project.findFirst({
      where: { userId: guestUserId }
    })

    if (guestProject && existingProject) {
      // Merge: Move guest project's data into existing project
      console.log(`[Transfer] Merging guest project ${guestProject.id} into existing project ${existingProject.id}`)

      // Move fragments to existing project
      await prisma.fragment.updateMany({
        where: { projectId: guestProject.id },
        data: { projectId: existingProject.id }
      })

      // Move conversations to existing project
      await prisma.conversation.updateMany({
        where: { projectId: guestProject.id },
        data: { projectId: existingProject.id, userId: authenticatedUserId }
      })

      // Move generated outputs to existing project
      await prisma.generatedOutput.updateMany({
        where: { projectId: guestProject.id },
        data: { projectId: existingProject.id, userId: authenticatedUserId }
      })

      // Move extraction runs to existing project
      await prisma.extractionRun.updateMany({
        where: { projectId: guestProject.id },
        data: { projectId: existingProject.id }
      })

      // Delete guest's dimensional syntheses (existing project has its own)
      await prisma.dimensionalSynthesis.deleteMany({
        where: { projectId: guestProject.id }
      })

      // Delete guest project
      await prisma.project.delete({
        where: { id: guestProject.id }
      })

      console.log(`[Transfer] Merged and deleted guest project`)
    } else if (guestProject && !existingProject) {
      // No existing project - just transfer ownership and rename
      await prisma.project.update({
        where: { id: guestProject.id },
        data: { userId: authenticatedUserId, name: 'My Strategy' }
      })
      console.log(`[Transfer] Transferred and renamed guest project`)
    } else {
      // No guest project - just update userId on any orphaned records
      await prisma.project.updateMany({
        where: { userId: guestUserId },
        data: { userId: authenticatedUserId }
      })
    }

    // Transfer conversations that might not be linked to a project
    await prisma.conversation.updateMany({
      where: { userId: guestUserId },
      data: { userId: authenticatedUserId }
    })

    // Transfer traces
    await prisma.trace.updateMany({
      where: { userId: guestUserId },
      data: { userId: authenticatedUserId }
    })

    console.log(`Transferred session from guest ${guestUserId} to user ${authenticatedUserId}`)
  } catch (error) {
    console.error('Failed to transfer session:', error)
    throw error
  }
}
