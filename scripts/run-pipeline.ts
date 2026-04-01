#!/usr/bin/env npx tsx
/**
 * Run Archived Pipeline (v1)
 *
 * Runs extraction → generation using archived v1 API implementation.
 * Used for backtesting against historical versions.
 *
 * Usage:
 *   # Run against fixture (hydrates temp conversation)
 *   npm run pipeline -- --fixture demo-pre-generate --export
 *
 *   # Run against existing conversation
 *   npm run pipeline -- --conversationId <id> --export
 *
 *   # Keep temp data after fixture run (for inspection)
 *   npm run pipeline -- --fixture demo-pre-generate --keep
 *
 * For current API version, use the app directly then export:
 *   npx tsx scripts/export-trace.ts --traceId <id>
 */

import { prisma } from '../src/lib/db'
import * as fs from 'fs'
import * as path from 'path'

const FIXTURES_DIR = path.join(__dirname, 'seed', 'fixtures')

// V1 imports
import {
  performExtraction as performExtractionV1,
  ExtractionProgressUpdate,
} from '../src/lib/extraction/v1'
import {
  performGeneration as performGenerationV1,
  GenerationProgressUpdate,
} from '../src/lib/generation/v1'

// Fixture types (simplified from seed/types.ts)
interface FixtureMessage {
  role: 'user' | 'assistant'
  content: string
  stepNumber: number
}

interface FixtureConversation {
  id: string
  title?: string
  status: string
  currentPhase?: string
  selectedLens?: string
  questionCount?: number
  experimentVariant?: string
  messages: FixtureMessage[]
  traces: any[]
}

interface FixtureProject {
  id: string
  name: string
  conversations: FixtureConversation[]
  fragments: any[]
  syntheses?: any[]
  deepDives?: any[]
  documents?: any[]
  generatedOutputs?: any[]
  userContent?: any[]
}

interface Fixture {
  version: string
  description: string
  user: { id: string; email: string; name?: string }
  projects: FixtureProject[]
}

// Hydrate fixture to temp conversation
async function hydrateFixture(
  fixtureName: string,
  variantOverride?: string
): Promise<{ conversationId: string; userId: string; projectId: string; cleanup: () => Promise<void> }> {
  const fixturePath = path.join(FIXTURES_DIR, `${fixtureName}.json`)

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`)
  }

  const fixture: Fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))

  // Generate unique IDs for this run
  const runId = Date.now().toString(36)
  const userId = `pipeline_${runId}`
  const projectId = `proj_${runId}`

  console.log(`\n📂 Hydrating fixture: ${fixtureName}`)

  // Create temp user
  const user = await prisma.user.create({
    data: {
      id: userId,
      email: `pipeline-${runId}@backtest.local`,
      name: 'Pipeline Backtest',
    },
  })

  // Create temp project
  const project = await prisma.project.create({
    data: {
      id: projectId,
      userId: user.id,
      name: fixture.projects[0]?.name || 'Backtest Project',
    },
  })

  // Find the first conversation with messages
  const convFixture = fixture.projects[0]?.conversations?.find(c => c.messages?.length > 0)

  if (!convFixture) {
    throw new Error('Fixture has no conversations with messages')
  }

  const convId = `conv_${runId}`
  const variant = variantOverride || convFixture.experimentVariant

  // Create conversation
  const conversation = await prisma.conversation.create({
    data: {
      id: convId,
      userId: user.id,
      projectId: project.id,
      title: convFixture.title,
      status: 'active', // Reset to active for extraction
      currentPhase: convFixture.currentPhase,
      selectedLens: convFixture.selectedLens,
      questionCount: convFixture.questionCount,
      experimentVariant: variant,
    },
  })

  // Create messages
  for (const msg of convFixture.messages) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: msg.role,
        content: msg.content,
        stepNumber: msg.stepNumber,
      },
    })
  }

  console.log(`  ✓ Created conversation with ${convFixture.messages.length} messages`)
  console.log(`  ✓ Variant: ${variant}`)

  // Cleanup function
  const cleanup = async () => {
    console.log('\n🧹 Cleaning up temp data...')
    await prisma.message.deleteMany({ where: { conversationId: conversation.id } })
    await prisma.trace.deleteMany({ where: { conversationId: conversation.id } })
    await prisma.fragmentDimensionTag.deleteMany({
      where: { fragment: { projectId: project.id } }
    })
    await prisma.fragment.deleteMany({ where: { projectId: project.id } })
    await prisma.extractionRun.deleteMany({ where: { projectId: project.id } })
    await prisma.decisionStackComponent.deleteMany({ where: { decisionStack: { projectId: project.id } } })
    await prisma.decisionStack.deleteMany({ where: { projectId: project.id } })
    await prisma.decisionStackSnapshot.deleteMany({ where: { projectId: project.id } })
    await prisma.conversation.deleteMany({ where: { projectId: project.id } })
    await prisma.project.delete({ where: { id: project.id } })
    await prisma.user.delete({ where: { id: user.id } })
    console.log('  ✓ Temp data removed')
  }

  return {
    conversationId: conversation.id,
    userId: user.id,
    projectId: project.id,
    cleanup,
  }
}

interface PipelineOutput {
  conversationId: string
  extraction: {
    extractedContext: any
    dimensionalCoverage: any
    durationMs: number
  }
  generation: {
    traceId: string
    thoughts: string
    statements: any
    durationMs: number
  }
  totalDurationMs: number
  exportedTo?: string
}

// Progress logger (simple console output)
function createProgressLogger(prefix: string) {
  return (update: ExtractionProgressUpdate | GenerationProgressUpdate) => {
    console.log(`  [${prefix}] ${update.step}${update.error ? `: ${update.error}` : ''}`)
  }
}

async function runPipeline(conversationId: string): Promise<{
  extraction: { extractedContext: any; dimensionalCoverage: any; durationMs: number }
  generation: { traceId: string; thoughts: string; statements: any; durationMs: number }
}> {
  console.log('\n📦 Running v1 pipeline...')

  // Extraction
  console.log('\n🔍 Extraction (v1)')
  const extractStart = Date.now()
  const extractionResult = await performExtractionV1(
    { conversationId },
    createProgressLogger('extract')
  )
  const extractDuration = Date.now() - extractStart
  console.log(`  ✓ Extraction complete (${extractDuration}ms)`)

  // Generation
  console.log('\n✨ Generation (v1)')
  const genStart = Date.now()
  const generationResult = await performGenerationV1(
    {
      conversationId,
      extractedContext: extractionResult.extractedContext,
      dimensionalCoverage: extractionResult.dimensionalCoverage,
    },
    createProgressLogger('generate')
  )
  const genDuration = Date.now() - genStart
  console.log(`  ✓ Generation complete (${genDuration}ms)`)

  return {
    extraction: {
      ...extractionResult,
      durationMs: extractDuration,
    },
    generation: {
      ...generationResult,
      durationMs: genDuration,
    },
  }
}

async function exportTraceToEvals(
  output: PipelineOutput,
  conversationId: string
): Promise<string> {
  // Fetch conversation for export
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { stepNumber: 'asc' } },
    },
  })

  if (!conversation) {
    throw new Error('Conversation not found')
  }

  const exportData = {
    id: `${output.generation.traceId}-v1`,
    exportedAt: new Date().toISOString(),
    pipelineVersion: 'v1',
    promptVersions: {
      extraction: 'v1',
      generation: 'v1',
    },
    components: {
      conversation: {
        id: conversationId,
        messages: conversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        experimentVariant: conversation.experimentVariant,
      },
      extraction: {
        themes: output.extraction.extractedContext.themes || [],
        dimensionalCoverage: output.extraction.dimensionalCoverage,
        approach: output.extraction.extractedContext.extraction_approach,
      },
      generation: {
        vision: output.generation.statements.vision,
        strategy: output.generation.statements.strategy,
        objectives: output.generation.statements.objectives || [],
        thoughts: output.generation.thoughts,
      },
    },
    timing: {
      extraction: output.extraction.durationMs,
      generation: output.generation.durationMs,
      total: output.totalDurationMs,
    },
  }

  const outputPath = path.join(
    process.cwd(),
    'evals',
    'traces',
    `${exportData.id}.json`
  )

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2))
  return outputPath
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  const conversationIdArg = args.find((a) => a.startsWith('--conversationId='))
  const fixtureArg = args.find((a) => a.startsWith('--fixture='))
  const variantArg = args.find((a) => a.startsWith('--variant='))
  const exportFlag = args.includes('--export')
  const keepFlag = args.includes('--keep')
  const dryRun = args.includes('--dry-run')

  const variantOverride = variantArg?.split('=')[1]

  let conversationId: string
  let cleanup: (() => Promise<void>) | null = null
  let fixtureSource: string | null = null

  if (conversationIdArg) {
    conversationId = conversationIdArg.split('=')[1]
  } else if (fixtureArg) {
    const fixtureName = fixtureArg.split('=')[1]
    fixtureSource = fixtureName
    const hydrated = await hydrateFixture(fixtureName, variantOverride)
    conversationId = hydrated.conversationId
    cleanup = hydrated.cleanup
  } else {
    console.error('Must provide --conversationId=<id> or --fixture=<name>')
    console.error('')
    console.error('Usage:')
    console.error('  npm run pipeline -- --fixture demo-pre-generate --export')
    console.error('  npm run pipeline -- --conversationId <id> --export')
    console.error('')
    console.error('Options:')
    console.error('  --variant <variant>     Override experiment variant')
    console.error('  --export                Export trace to evals/traces/')
    console.error('  --keep                  Keep temp data after fixture run')
    console.error('  --dry-run               Preview without running')
    console.error('')
    console.error('For current API, use the app then: npx tsx scripts/export-trace.ts --traceId <id>')
    process.exit(1)
  }

  // Validate conversation exists
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, experimentVariant: true, status: true },
  })

  if (!conversation) {
    console.error(`Conversation not found: ${conversationId}`)
    process.exit(1)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔬 Pipeline Runner (v1)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (fixtureSource) {
    console.log(`Fixture:      ${fixtureSource}`)
  }
  console.log(`Conversation: ${conversationId}`)
  console.log(`Variant:      ${conversation.experimentVariant || 'unknown'}`)
  console.log(`Export:       ${exportFlag ? 'yes' : 'no'}`)
  if (cleanup) {
    console.log(`Cleanup:      ${keepFlag ? 'no (--keep)' : 'yes'}`)
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would run pipeline - exiting')
    if (cleanup && !keepFlag) await cleanup()
    await prisma.$disconnect()
    process.exit(0)
  }

  const startTime = Date.now()

  try {
    const result = await runPipeline(conversationId)
    const totalDuration = Date.now() - startTime

    const output: PipelineOutput = {
      conversationId,
      extraction: result.extraction,
      generation: result.generation,
      totalDurationMs: totalDuration,
    }

    // Export if requested
    if (exportFlag) {
      const exportPath = await exportTraceToEvals(output, conversationId)
      output.exportedTo = exportPath
      console.log(`\n📁 Exported to: ${exportPath}`)
    }

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 Results')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Total time:   ${totalDuration}ms`)
    console.log(`Extraction:   ${result.extraction.durationMs}ms`)
    console.log(`Generation:   ${result.generation.durationMs}ms`)
    console.log(`Trace ID:     ${result.generation.traceId}`)
    console.log('')
    console.log('💡 Vision:')
    console.log(`   ${result.generation.statements.vision}`)
    console.log('')
    console.log('🎯 Strategy:')
    console.log(`   ${result.generation.statements.strategy}`)
    console.log('')
    console.log('📈 Objectives:')
    const objectives = result.generation.statements.objectives || []
    objectives.forEach((obj: any, i: number) => {
      const text = typeof obj === 'string' ? obj : obj.pithy || obj.text || JSON.stringify(obj)
      console.log(`   ${i + 1}. ${text}`)
    })

    // Cleanup temp data unless --keep
    if (cleanup && !keepFlag) {
      await cleanup()
    }

    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error)
    // Still cleanup on error unless --keep
    if (cleanup && !keepFlag) {
      await cleanup()
    }
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
