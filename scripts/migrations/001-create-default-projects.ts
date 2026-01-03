#!/usr/bin/env tsx
/**
 * Migration: Create default Project for each User
 *
 * Phase 2 of schema V1 migration
 * Safe to run multiple times (idempotent)
 */

import { prisma } from '@/lib/db'

async function main() {
  console.log('Starting: Create default projects for users')

  const users = await prisma.user.findMany()
  console.log(`Found ${users.length} users`)

  let created = 0
  let skipped = 0

  for (const user of users) {
    // Check if user already has a project
    const existingProject = await prisma.project.findFirst({
      where: { userId: user.id }
    })

    if (existingProject) {
      console.log(`  ⏭  User ${user.email} already has project ${existingProject.id}`)
      skipped++
      continue
    }

    // Create default project
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: user.name ? `${user.name}'s Strategy` : 'My Strategy',
        status: 'active',
      }
    })

    console.log(`  ✓ Created project ${project.id} for ${user.email}`)
    created++
  }

  console.log(`\nComplete: ${created} created, ${skipped} skipped`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
