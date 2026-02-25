import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

/**
 * Transfer all guest data to an authenticated user.
 * Returns true if transfer was performed, false if skipped (no valid guest).
 */
export async function transferGuestToUser(
  guestUserId: string,
  authenticatedUserId: string
): Promise<boolean> {
  // Don't transfer to self
  if (guestUserId === authenticatedUserId) {
    console.log(`[Transfer] Guest and authenticated user are the same, skipping`)
    return false
  }

  // Verify it's actually a guest user
  const guestUser = await prisma.user.findUnique({
    where: { id: guestUserId },
    select: { email: true },
  })

  if (!guestUser || !isGuestUser(guestUser.email)) {
    console.log(`[Transfer] Invalid guest user ${guestUserId}, skipping`)
    return false
  }

  // Check if authenticated user already has projects
  const authUserProjectCount = await prisma.project.count({
    where: { userId: authenticatedUserId, status: 'active' },
  })

  await prisma.$transaction(async (tx) => {
    // If auth user already has projects, only transfer guest projects that have real work
    if (authUserProjectCount > 0) {
      const guestProjects = await tx.project.findMany({
        where: { userId: guestUserId },
        include: {
          _count: {
            select: {
              fragments: true,
              conversations: true,
              documents: true,
              deepDives: true,
              generatedOutputs: true,
            },
          },
        },
      })

      for (const project of guestProjects) {
        const counts = project._count
        const hasContent = counts.fragments > 0 || counts.conversations > 0 ||
                          counts.documents > 0 || counts.deepDives > 0 ||
                          counts.generatedOutputs > 0
        if (hasContent) {
          await tx.project.update({
            where: { id: project.id },
            data: { userId: authenticatedUserId },
          })
          console.log(`[Transfer] Transferred project ${project.id} (has content)`)
        } else {
          console.log(`[Transfer] Deleting empty guest project ${project.id} (counts: ${JSON.stringify(counts)})`)
          try {
            await tx.dimensionalSynthesis.deleteMany({
              where: { projectId: project.id },
            })
            await tx.project.delete({
              where: { id: project.id },
            })
            console.log(`[Transfer] Deleted empty guest project ${project.id}`)
          } catch (deleteError) {
            console.error(`[Transfer] Failed to delete project ${project.id}:`, deleteError)
          }
        }
      }
    } else {
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

    // Delete the guest user
    await tx.user.deleteMany({
      where: { id: guestUserId },
    })
  })

  console.log(`[Transfer] Successfully transferred data from guest ${guestUserId} to user ${authenticatedUserId}`)
  return true
}
