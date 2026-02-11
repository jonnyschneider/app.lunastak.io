import { prisma } from '@/lib/db'

/**
 * Check if a user has Pro status (either paid or upgraded during beta)
 */
export async function isUserPro(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPaid: true, upgradedAt: true },
  })

  return !!(user?.isPaid || user?.upgradedAt)
}

/**
 * Get user's Pro status with details
 */
export async function getUserProStatus(userId: string): Promise<{
  isPro: boolean
  isPaid: boolean
  upgradedAt: Date | null
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPaid: true, upgradedAt: true },
  })

  return {
    isPro: !!(user?.isPaid || user?.upgradedAt),
    isPaid: user?.isPaid ?? false,
    upgradedAt: user?.upgradedAt ?? null,
  }
}
