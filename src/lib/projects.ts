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
 * Initialize dimensional synthesis records for a project
 * Creates empty synthesis records for all 11 tier-1 dimensions
 */
async function initializeSynthesisRecords(projectId: string): Promise<void> {
  const records = TIER_1_DIMENSIONS.map(dimension => ({
    projectId,
    dimension,
    summary: null,
    keyThemes: [],
    keyQuotes: [],
    gaps: [],
    contradictions: [],
    confidence: 'LOW' as const,
    fragmentCount: 0,
    lastSynthesizedAt: new Date(),
    synthesizedBy: 'init',
  }))

  await prisma.dimensionalSynthesis.createMany({
    data: records,
    skipDuplicates: true, // In case records already exist
  })
}

/**
 * Get or create a default project for a user
 * For authenticated users: returns existing project or creates one
 * For guests (userId is null): creates a new guest user and project
 */
export async function getOrCreateDefaultProject(userId: string | null): Promise<{
  userId: string
  project: { id: string; name: string }
  isGuest: boolean
}> {
  if (!userId) {
    // Create guest user and project
    const guestUser = await createGuestUser()
    const project = await prisma.project.create({
      data: {
        userId: guestUser.id,
        name: 'Guest Strategy',
        status: 'active',
      }
    })

    // Initialize synthesis records for the new project
    await initializeSynthesisRecords(project.id)

    return {
      userId: guestUser.id,
      project,
      isGuest: true,
    }
  }

  // Authenticated user - try to find existing project
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

  return {
    userId,
    project,
    isGuest: false,
  }
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
