#!/usr/bin/env tsx
/**
 * Integration test: Fragment extraction and synthesis flow
 *
 * This script simulates the extraction flow to verify fragments are created
 * and synthesis is triggered.
 */

import { prisma } from '@/lib/db'
import { createFragmentsFromThemes } from '@/lib/fragments'
import { updateAllSyntheses } from '@/lib/synthesis'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

async function main() {
  console.log('=== Fragment Flow Integration Test ===\n')

  // 1. Get a project
  const project = await prisma.project.findFirst()
  if (!project) {
    console.error('No project found. Run migration scripts first.')
    process.exit(1)
  }
  console.log(`Using project: ${project.id} (${project.name})`)

  // 2. Get a conversation
  const conversation = await prisma.conversation.findFirst({
    where: { projectId: project.id }
  })
  if (!conversation) {
    console.error('No conversation found for project.')
    process.exit(1)
  }
  console.log(`Using conversation: ${conversation.id}`)

  // 3. Create test fragments with inline dimensions
  console.log('\n--- Creating Test Fragments ---')
  const testThemes = [
    {
      theme_name: 'Customer Pain Points',
      content: 'Enterprise customers struggle with data integration across multiple SaaS tools. They spend hours manually moving data between systems.',
      dimensions: [{ name: 'customer_market', confidence: 'HIGH' as const }]
    },
    {
      theme_name: 'Market Opportunity',
      content: 'The integration market is growing at 25% annually. Most solutions are too technical for non-developers.',
      dimensions: [{ name: 'problem_opportunity', confidence: 'MEDIUM' as const }]
    }
  ]

  const fragments = await createFragmentsFromThemes(
    project.id,
    conversation.id,
    testThemes
  )
  console.log(`Created ${fragments.length} fragments`)
  fragments.forEach(f => {
    console.log(`  - ${f.id}: ${f.dimensionTags.length} dimension tags`)
  })

  // 4. Run synthesis
  console.log('\n--- Running Synthesis ---')
  await updateAllSyntheses(project.id)

  // 5. Check results
  console.log('\n--- Checking Results ---')
  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: {
      projectId: project.id,
      fragmentCount: { gt: 0 }
    }
  })

  console.log(`Syntheses with fragments: ${syntheses.length}`)
  for (const s of syntheses) {
    console.log(`  - ${s.dimension}: ${s.fragmentCount} fragments, confidence=${s.confidence}`)
    if (s.summary) {
      console.log(`    Summary: ${s.summary.substring(0, 100)}...`)
    }
  }

  // 6. Verify fragment counts
  const fragmentCount = await prisma.fragment.count({
    where: { projectId: project.id }
  })
  const tagCount = await prisma.fragmentDimensionTag.count()

  console.log(`\n--- Summary ---`)
  console.log(`Fragments: ${fragmentCount}`)
  console.log(`Dimension Tags: ${tagCount}`)
  console.log(`Syntheses updated: ${syntheses.length}`)

  console.log('\n✅ Integration test complete!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
