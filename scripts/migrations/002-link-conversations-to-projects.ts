#!/usr/bin/env tsx
/**
 * Migration: Link conversations to projects
 *
 * Phase 3.2 of schema V1 migration
 * Safe to run multiple times (idempotent)
 */

import { prisma } from '@/lib/db'

async function main() {
  console.log('Starting: Link conversations to projects')

  const conversations = await prisma.conversation.findMany({
    where: { projectId: null },
    include: { user: true }
  })

  console.log(`Found ${conversations.length} conversations without projectId`)

  let linked = 0
  let skipped = 0

  for (const conv of conversations) {
    if (!conv.userId) {
      console.log(`  ⚠  Conversation ${conv.id} has no userId, skipping`)
      skipped++
      continue
    }

    // Find user's default project (first created)
    const project = await prisma.project.findFirst({
      where: { userId: conv.userId },
      orderBy: { createdAt: 'asc' }
    })

    if (!project) {
      console.error(`  ✗ No project found for user ${conv.userId}`)
      skipped++
      continue
    }

    // Update conversation
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { projectId: project.id }
    })

    console.log(`  ✓ Linked conversation ${conv.id} to project ${project.id}`)
    linked++
  }

  console.log(`\nComplete: ${linked} linked, ${skipped} skipped`)

  // Verify no nulls remain
  const remaining = await prisma.conversation.count({
    where: { projectId: null }
  })

  if (remaining > 0) {
    console.warn(`\n⚠  ${remaining} conversations still have null projectId`)
  } else {
    console.log('\n✓ All conversations linked to projects')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
