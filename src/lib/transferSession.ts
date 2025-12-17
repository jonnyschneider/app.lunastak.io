import { prisma } from '@/lib/db'

export async function transferGuestSession(guestUserId: string, authenticatedUserId: string) {
  try {
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

    console.log(`Transferred session from ${guestUserId} to ${authenticatedUserId}`)
  } catch (error) {
    console.error('Failed to transfer session:', error)
    throw error
  }
}
