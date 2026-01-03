/**
 * Project utilities for managing user projects
 */

import { prisma } from '@/lib/db'

/**
 * Get or create a default project for a user
 * Returns the first (oldest) project, or creates one if none exist
 */
export async function getOrCreateDefaultProject(userId: string | null) {
  if (!userId) {
    // Guest user - return null, projectId will be null on conversation
    return null
  }

  // Try to find existing project
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
  }

  return project
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
