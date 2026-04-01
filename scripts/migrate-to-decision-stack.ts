#!/usr/bin/env npx tsx
// @ts-nocheck
/**
 * Migrate existing GeneratedOutput + UserContent data to DecisionStack tables.
 * NOTE: This migration script has already run. Old tables (GeneratedOutput, UserContent)
 * have been dropped from the schema. Kept for historical reference only.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-decision-stack.ts              # dry run
 *   npx tsx scripts/migrate-to-decision-stack.ts --apply       # apply
 *   DATABASE_URL=<prod-url> npx tsx scripts/migrate-to-decision-stack.ts --apply
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = !process.argv.includes('--apply')

interface StrategyContent {
  vision: string
  visionExplainer?: string
  strategy: string
  strategyExplainer?: string
  objectives: Array<{ id: string; [key: string]: unknown }>
  opportunities: Array<{ id: string; [key: string]: unknown }>
  principles: Array<{ id: string; [key: string]: unknown }>
}

async function main() {
  console.log(`\n${dryRun ? '🔍 DRY RUN' : '✏️  APPLYING'} — migrate to Decision Stack\n`)

  // Find all projects that have at least one complete GeneratedOutput
  const projects = await prisma.project.findMany({
    where: {
      generatedOutputs: {
        some: { status: 'complete', outputType: 'full_decision_stack' },
      },
    },
    select: { id: true, name: true },
  })

  console.log(`Found ${projects.length} projects with generated strategies\n`)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const project of projects) {
    try {
      // Check if already migrated
      const existing = await prisma.decisionStack.findUnique({
        where: { projectId: project.id },
      })
      if (existing) {
        skipped++
        continue
      }

      // Get latest complete full_decision_stack
      const latestOutput = await prisma.generatedOutput.findFirst({
        where: {
          projectId: project.id,
          outputType: 'full_decision_stack',
          status: 'complete',
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!latestOutput) {
        skipped++
        continue
      }

      const content = latestOutput.content as unknown as StrategyContent

      // Get UserContent (opportunities + principles) — these take priority
      const userContent = await prisma.userContent.findMany({
        where: { projectId: project.id },
      })

      // Parse UserContent
      const ucOpportunities = userContent
        .filter(uc => uc.type === 'opportunity')
        .map(uc => {
          try { return JSON.parse(uc.content) } catch { return null }
        })
        .filter(Boolean)

      const ucPrinciples = userContent
        .filter(uc => uc.type === 'principle')
        .map(uc => {
          try { return JSON.parse(uc.content) } catch { return null }
        })
        .filter(Boolean)

      // Use UserContent O/P if available, otherwise fall back to GeneratedOutput content
      const rawOpportunities = ucOpportunities.length > 0 ? ucOpportunities : (content.opportunities || [])
      const rawPrinciples = ucPrinciples.length > 0 ? ucPrinciples : (content.principles || [])
      const rawObjectives = content.objectives || []

      // Deduplicate by id (keep last occurrence) to avoid unique constraint violations
      const dedup = <T extends { id?: string }>(items: T[], prefix: string): T[] => {
        const seen = new Map<string, T>()
        items.forEach((item, i) => {
          const id = item.id || `${prefix}-${i + 1}`
          seen.set(id, { ...item, id })
        })
        return Array.from(seen.values())
      }

      const objectives = dedup(rawObjectives, 'obj')
      const opportunities = dedup(rawOpportunities, 'opp')
      const principles = dedup(rawPrinciples, 'prin')

      if (dryRun) {
        console.log(`  ✓ "${project.name}" (${project.id})`)
        console.log(`    V/S from GeneratedOutput v${latestOutput.version}`)
        console.log(`    ${objectives.length} objectives, ${opportunities.length} opportunities, ${principles.length} principles`)
        console.log(`    Source: O=${ucOpportunities.length > 0 ? 'UserContent' : 'GenOutput'}, P=${ucPrinciples.length > 0 ? 'UserContent' : 'GenOutput'}`)
      } else {
        // Create DecisionStack
        const stack = await prisma.decisionStack.create({
          data: {
            projectId: project.id,
            vision: content.vision || '',
            visionElaboration: content.visionExplainer || null,
            strategy: content.strategy || '',
            strategyElaboration: content.strategyExplainer || null,
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

        objectives.forEach((obj: any, i: number) => {
          components.push({
            decisionStackId: stack.id,
            componentType: 'objective',
            componentId: obj.id || `obj-${i + 1}`,
            content: obj,
            sortOrder: i,
          })
        })

        opportunities.forEach((opp: any, i: number) => {
          components.push({
            decisionStackId: stack.id,
            componentType: 'opportunity',
            componentId: opp.id || `opp-${i + 1}`,
            content: opp,
            sortOrder: i,
          })
        })

        principles.forEach((prin: any, i: number) => {
          components.push({
            decisionStackId: stack.id,
            componentType: 'principle',
            componentId: prin.id || `prin-${i + 1}`,
            content: prin,
            sortOrder: i,
          })
        })

        if (components.length > 0) {
          await prisma.decisionStackComponent.createMany({ data: components })
        }

        // Create snapshots from all historic GeneratedOutputs
        const allOutputs = await prisma.generatedOutput.findMany({
          where: {
            projectId: project.id,
            outputType: 'full_decision_stack',
            status: 'complete',
          },
          orderBy: { createdAt: 'asc' },
        })

        for (let i = 0; i < allOutputs.length; i++) {
          const output = allOutputs[i]
          const outputContent = output.content as unknown as StrategyContent

          await prisma.decisionStackSnapshot.create({
            data: {
              projectId: project.id,
              version: i + 1,
              trigger: i === 0 ? 'post_generation' : 'post_refresh',
              content: {
                vision: outputContent.vision || '',
                visionElaboration: outputContent.visionExplainer || null,
                strategy: outputContent.strategy || '',
                strategyElaboration: outputContent.strategyExplainer || null,
                objectives: (outputContent.objectives || []) as object[],
                opportunities: (i === allOutputs.length - 1 ? opportunities : (outputContent.opportunities || [])) as object[],
                principles: (i === allOutputs.length - 1 ? principles : (outputContent.principles || [])) as object[],
              },
              modelUsed: output.modelUsed,
              promptTokens: output.promptTokens,
              completionTokens: output.completionTokens,
              latencyMs: output.latencyMs,
              changeSummary: output.changeSummary,
            },
          })
        }

        console.log(`  ✓ "${project.name}" — ${objectives.length}O ${opportunities.length}Op ${principles.length}P, ${allOutputs.length} snapshots`)
      }

      created++
    } catch (err) {
      errors++
      console.error(`  ✗ "${project.name}" (${project.id}):`, err)
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Migrated: ${created}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Errors:   ${errors}`)

  if (dryRun) {
    console.log(`\nRun with --apply to write changes.`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
