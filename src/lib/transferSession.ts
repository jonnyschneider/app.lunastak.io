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

    // Transfer projects (this transfers all related data: Fragments, Syntheses, ExtractionRuns, GeneratedOutputs)
    await prisma.project.updateMany({
      where: { userId: guestUserId },
      data: { userId: authenticatedUserId },
    })

    // Transfer conversations
    await prisma.conversation.updateMany({
      where: { userId: guestUserId },
      data: { userId: authenticatedUserId },
    })

    // Transfer traces
    await prisma.trace.updateMany({
      where: { userId: guestUserId },
      data: { userId: authenticatedUserId },
    })

    // Optionally: delete the guest user record (cleanup)
    // For now, keep it for audit trail - can add cleanup job later
    console.log(`Transferred session from guest ${guestUserId} to user ${authenticatedUserId}`)
  } catch (error) {
    console.error('Failed to transfer session:', error)
    throw error
  }
}
