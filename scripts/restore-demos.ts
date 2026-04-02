#!/usr/bin/env npx tsx
/**
 * Restore demo projects from static JSON snapshots.
 * Creates projects + DecisionStack + components + fragments + syntheses.
 *
 * Usage:
 *   npx tsx scripts/restore-demos.ts              # dry run
 *   npx tsx scripts/restore-demos.ts --apply       # apply
 *   DATABASE_URL=<url> npx tsx scripts/restore-demos.ts --apply
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()
const dryRun = !process.argv.includes('--apply')

const DEMOS_DIR = path.join(__dirname, '../src/data/demos')

function generateCuid(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `c${timestamp}${random}`
}

async function main() {
  console.log(`\n${dryRun ? '🔍 DRY RUN' : '✏️  APPLYING'} — restore demo projects\n`)

  const files = fs.readdirSync(DEMOS_DIR).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DEMOS_DIR, file), 'utf8'))
    const { projectId, projectName, decisionStack: ds, fragments, syntheses } = data

    console.log(`=== ${projectName} (${projectId}) ===`)

    if (dryRun) {
      console.log(`  Vision: ${ds.vision.slice(0, 50)}`)
      console.log(`  ${ds.objectives.length}O ${ds.opportunities.length}Op ${ds.principles.length}P`)
      console.log(`  ${fragments.length} fragments, ${syntheses.length} syntheses`)
      console.log()
      continue
    }

    // Ensure demo user exists
    let user = await prisma.user.findFirst({ where: { email: 'demo@lunastak.io' } })
    if (!user) {
      user = await prisma.user.create({ data: { email: 'demo@lunastak.io', name: 'Demo' } })
    }

    // Delete existing project data if present
    const existing = await prisma.project.findUnique({ where: { id: projectId } })
    if (existing) {
      // Cascade handles children
      await prisma.project.delete({ where: { id: projectId } })
      console.log('  Deleted existing project')
    }

    // Create project
    await prisma.project.create({
      data: {
        id: projectId,
        userId: user.id,
        name: projectName,
        isDemo: true,
        status: 'active',
      },
    })

    // Create DecisionStack
    const stack = await prisma.decisionStack.create({
      data: {
        projectId,
        vision: ds.vision,
        visionElaboration: ds.visionElaboration,
        strategy: ds.strategy,
        strategyElaboration: ds.strategyElaboration,
      },
    })

    // Create components
    const components: Array<{
      decisionStackId: string
      componentType: string
      componentId: string
      content: object
      sortOrder: number
    }> = []

    for (const [type, items] of [
      ['objective', ds.objectives],
      ['opportunity', ds.opportunities],
      ['principle', ds.principles],
    ] as const) {
      ;(items as any[]).forEach((item: any, i: number) => {
        components.push({
          decisionStackId: stack.id,
          componentType: type,
          componentId: item.id || `${type.slice(0, 3)}-${i + 1}`,
          content: item,
          sortOrder: i,
        })
      })
    }

    if (components.length > 0) {
      await prisma.decisionStackComponent.createMany({ data: components })
    }

    // Create a synthetic conversation for fragment association
    const conversation = await prisma.conversation.create({
      data: {
        projectId,
        userId: user.id,
        title: 'Strategy Extraction (Acquired)',
        status: 'completed',
        currentPhase: 'GENERATION',
        isInitialConversation: true,
      },
    })

    // Create fragments
    for (const frag of fragments) {
      await prisma.fragment.create({
        data: {
          projectId,
          conversationId: conversation.id,
          title: frag.title,
          content: frag.content,
          contentType: frag.contentType || 'theme',
          confidence: frag.confidence || 'MEDIUM',
          sourceType: frag.sourceType || 'extraction',
          status: 'active',
        },
      })
    }

    // Create syntheses
    for (const synth of syntheses) {
      await prisma.dimensionalSynthesis.upsert({
        where: { projectId_dimension: { projectId, dimension: synth.dimension } },
        create: {
          projectId,
          dimension: synth.dimension,
          summary: synth.summary,
          keyThemes: synth.keyThemes || [],
          gaps: synth.gaps || [],
          confidence: synth.confidence || 'MEDIUM',
          fragmentCount: synth.fragmentCount || 0,
        },
        update: {
          summary: synth.summary,
          keyThemes: synth.keyThemes || [],
          gaps: synth.gaps || [],
          confidence: synth.confidence || 'MEDIUM',
          fragmentCount: synth.fragmentCount || 0,
        },
      })
    }

    // Create initial snapshot
    await prisma.decisionStackSnapshot.create({
      data: {
        projectId,
        version: 1,
        trigger: 'post_generation',
        content: {
          vision: ds.vision,
          visionElaboration: ds.visionElaboration,
          strategy: ds.strategy,
          strategyElaboration: ds.strategyElaboration,
          objectives: ds.objectives,
          opportunities: ds.opportunities,
          principles: ds.principles,
        },
      },
    })

    console.log(`  ✓ ${components.length} components, ${fragments.length} fragments, ${syntheses.length} syntheses, 1 snapshot`)
    console.log()
  }

  console.log(dryRun ? 'Run with --apply to write changes.' : 'Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
