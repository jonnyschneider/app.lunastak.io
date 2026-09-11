/**
 * Project utilities for managing user projects
 */

import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

/**
 * Generate a random ID (similar to cuid but simpler)
 */
function generateId(): string {
  return randomBytes(12).toString('hex')
}

/**
 * Check if a user is a guest user by their email pattern
 */
export function isGuestUser(email: string): boolean {
  return email.endsWith('@guest.lunastak.io')
}

/**
 * Create a guest user with a unique email
 */
export async function createGuestUser() {
  const guestId = generateId()
  const guestEmail = `guest_${guestId}@guest.lunastak.io`

  const user = await prisma.user.create({
    data: {
      email: guestEmail,
    }
  })

  return user
}

/**
 * Create an empty project for a guest user (no demo data)
 */
export async function createEmptyGuestProject(userId: string): Promise<string> {
  const project = await prisma.project.create({
    data: {
      userId,
      name: 'My Strategy',
      status: 'active',
    },
  })

  // Initialize synthesis records
  const records = TIER_1_DIMENSIONS.map(dimension => ({
    projectId: project.id,
    dimension,
    summary: null,
    gaps: [],
    confidence: 'LOW' as const,
    fragmentCount: 0,
    lastSynthesizedAt: new Date(),
  }))

  await prisma.dimensionalSynthesis.createMany({
    data: records,
    skipDuplicates: true,
  })

  return project.id
}

/**
 * Initialize dimensional synthesis records for a project
 * Creates empty synthesis records for all 11 tier-1 dimensions
 */
async function initializeSynthesisRecords(projectId: string): Promise<void> {
  const records = TIER_1_DIMENSIONS.map(dimension => ({
    projectId,
    dimension,
    summary: null,
    gaps: [],
    confidence: 'LOW' as const,
    fragmentCount: 0,
    lastSynthesizedAt: new Date(),
  }))

  await prisma.dimensionalSynthesis.createMany({
    data: records,
    skipDuplicates: true, // In case records already exist
  })
}

/**
 * The requester's oldest (default) project, created if they have none. Takes an existing user —
 * minting a guest is `/api/guest/init`'s job (and the project GET's, for a demo deep link), because
 * a guest is only usable once its cookie is set.
 */
export async function getOrCreateDefaultProject(userId: string): Promise<{
  userId: string
  project: { id: string; name: string }
}> {
  // Try to find an existing project
  let project = await prisma.project.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' } // Get oldest (default) project
  })

  if (!project) {
    // Create default project
    project = await prisma.project.create({
      data: {
        userId,
        name: 'My Strategy',
        status: 'active',
      }
    })

    // Initialize synthesis records for the new project
    await initializeSynthesisRecords(project.id)
  }

  return { userId, project }
}

/**
 * Get all projects for a user
 */
export async function getUserProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  })
}

/**
 * Guest API call limit
 */
export const GUEST_API_LIMIT = 20

/**
 * Check if a guest user has exceeded their API call limit.
 * If not exceeded, increments the counter.
 * Returns { blocked: true } if limit reached.
 */
export async function checkAndIncrementGuestApiCalls(userId: string): Promise<{ blocked: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, apiCallCount: true },
  })

  if (!user) return { blocked: false }
  if (!isGuestUser(user.email)) return { blocked: false }

  if (user.apiCallCount >= GUEST_API_LIMIT) {
    return { blocked: true }
  }

  // Increment counter
  await prisma.user.update({
    where: { id: userId },
    data: { apiCallCount: { increment: 1 } },
  })

  return { blocked: false }
}
