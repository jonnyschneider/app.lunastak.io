#!/usr/bin/env tsx
/**
 * Migration: Initialize DimensionalSynthesis for all projects
 *
 * Phase 4 of schema V1 migration
 * Creates 11 synthesis records per project (one per Tier 1 dimension)
 * Safe to run multiple times (idempotent)
 */

import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

async function main() {
  console.log('Starting: Initialize dimensional syntheses')

  const projects = await prisma.project.findMany()
  console.log(`Found ${projects.length} projects`)

  let created = 0
  let skipped = 0

  for (const project of projects) {
    console.log(`\nProject ${project.id} (${project.name}):`)

    for (const dimension of TIER_1_DIMENSIONS) {
      // Check if synthesis already exists
      const existing = await prisma.dimensionalSynthesis.findUnique({
        where: {
          projectId_dimension: {
            projectId: project.id,
            dimension
          }
        }
      })

      if (existing) {
        console.log(`  ⏭  ${dimension} already exists`)
        skipped++
        continue
      }

      // Create empty synthesis
      await prisma.dimensionalSynthesis.create({
        data: {
          projectId: project.id,
          dimension,
          synthesisVersion: 'v1',
          summary: null,
          keyThemes: [],
          keyQuotes: [],
          gaps: [],
          contradictions: [],
          subdimensions: null,
          confidence: 'LOW',
          fragmentCount: 0,
        }
      })

      console.log(`  ✓ Created ${dimension}`)
      created++
    }
  }

  console.log(`\n\nComplete: ${created} created, ${skipped} skipped`)

  // Verify each project has 11 syntheses
  for (const project of projects) {
    const count = await prisma.dimensionalSynthesis.count({
      where: { projectId: project.id }
    })

    if (count !== 11) {
      console.warn(`⚠  Project ${project.id} has ${count} syntheses (expected 11)`)
    }
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
