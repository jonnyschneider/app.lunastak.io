#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Verification: Check migration data integrity
 * NOTE: References old tables (GeneratedOutput, UserContent) that have been dropped.
 * Kept for historical reference only.
 */

import { prisma } from '@/lib/db'

async function main() {
  console.log('=== Migration Verification ===\n')

  // Check 1: All users have at least one project
  console.log('Check 1: Users have projects')
  const usersWithoutProjects = await prisma.user.findMany({
    where: {
      projects: { none: {} }
    }
  })
  if (usersWithoutProjects.length > 0) {
    console.log(`  ✗ FAIL: ${usersWithoutProjects.length} users without projects`)
    for (const user of usersWithoutProjects) {
      console.log(`    - ${user.email} (${user.id})`)
    }
  } else {
    console.log('  ✓ PASS: All users have projects')
  }

  // Check 2: Authenticated conversations have projectId
  console.log('\nCheck 2: Authenticated conversations have projectId')
  const authConversationsWithoutProject = await prisma.conversation.count({
    where: {
      projectId: null,
      userId: { not: null }
    }
  })
  if (authConversationsWithoutProject > 0) {
    console.log(`  ✗ FAIL: ${authConversationsWithoutProject} authenticated conversations without projectId`)
  } else {
    console.log('  ✓ PASS: All authenticated conversations have projectId')
  }

  // Check 2b: Guest conversations (expected to have null projectId)
  const guestConversations = await prisma.conversation.count({
    where: {
      projectId: null,
      userId: null
    }
  })
  console.log(`  ℹ  INFO: ${guestConversations} guest conversations (projectId=null, expected)`)

  // Check 3: All projects have 11 syntheses
  console.log('\nCheck 3: Projects have dimensional syntheses')
  const projects = await prisma.project.findMany({
    include: {
      _count: {
        select: { dimensionalSyntheses: true }
      }
    }
  })

  const projectsWithWrongCount = projects.filter(p => p._count.dimensionalSyntheses !== 11)
  if (projectsWithWrongCount.length > 0) {
    console.log(`  ✗ FAIL: ${projectsWithWrongCount.length} projects without exactly 11 syntheses`)
    for (const project of projectsWithWrongCount) {
      console.log(`    - ${project.name} has ${project._count.dimensionalSyntheses}`)
    }
  } else {
    console.log(`  ✓ PASS: All ${projects.length} projects have 11 syntheses`)
  }

  // Check 4: Foreign key integrity for authenticated conversations
  console.log('\nCheck 4: Foreign key integrity')
  const orphanedConversations = await prisma.conversation.count({
    where: {
      userId: { not: null },
      project: null
    }
  })
  if (orphanedConversations > 0) {
    console.log(`  ✗ FAIL: ${orphanedConversations} orphaned authenticated conversations`)
  } else {
    console.log('  ✓ PASS: No orphaned authenticated conversations')
  }

  // Check 5: Fragments exist
  console.log('\nCheck 5: Fragments created')
  const fragmentCount = await prisma.fragment.count()
  const tagCount = await prisma.fragmentDimensionTag.count()
  console.log(`  ℹ  INFO: ${fragmentCount} fragments, ${tagCount} dimension tags`)

  // Check 6: Syntheses have been updated
  console.log('\nCheck 6: Syntheses updated')
  const updatedSyntheses = await prisma.dimensionalSynthesis.count({
    where: { fragmentCount: { gt: 0 } }
  })
  console.log(`  ℹ  INFO: ${updatedSyntheses} syntheses have fragments`)

  // Check 7: GeneratedOutputs exist
  console.log('\nCheck 7: GeneratedOutputs created')
  const outputCount = await prisma.generatedOutput.count()
  console.log(`  ℹ  INFO: ${outputCount} generated outputs`)

  // Check 8: ExtractionRuns exist
  console.log('\nCheck 8: ExtractionRuns created')
  const runCount = await prisma.extractionRun.count()
  console.log(`  ℹ  INFO: ${runCount} extraction runs`)

  // Summary
  console.log('\n=== Summary ===')
  const totalProjects = await prisma.project.count()
  const totalConversations = await prisma.conversation.count()
  const totalFragments = await prisma.fragment.count()
  const totalSyntheses = await prisma.dimensionalSynthesis.count()
  const totalOutputs = await prisma.generatedOutput.count()
  const totalRuns = await prisma.extractionRun.count()

  console.log(`Projects: ${totalProjects}`)
  console.log(`Conversations: ${totalConversations}`)
  console.log(`  - With projectId: ${totalConversations - guestConversations}`)
  console.log(`  - Guest (no projectId): ${guestConversations}`)
  console.log(`Fragments: ${totalFragments}`)
  console.log(`Syntheses: ${totalSyntheses} (${updatedSyntheses} with fragments)`)
  console.log(`Expected syntheses: ${totalProjects * 11}`)
  console.log(`GeneratedOutputs: ${totalOutputs}`)
  console.log(`ExtractionRuns: ${totalRuns}`)

  if (totalSyntheses === totalProjects * 11 &&
      usersWithoutProjects.length === 0 &&
      authConversationsWithoutProject === 0) {
    console.log('\n✓ All checks passed!')
  } else {
    console.log('\n⚠ Some checks failed - review output above')
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
