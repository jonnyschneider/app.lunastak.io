#!/usr/bin/env npx tsx
/**
 * Run Pipeline Through Versioned APIs
 *
 * Runs extraction → generation using specified API version.
 * Useful for comparing outputs across API changes, not just prompt changes.
 *
 * Usage:
 *   # Run v1 (archived) against a conversation
 *   npx tsx scripts/run-pipeline.ts --conversationId <id> --version v1
 *
 *   # Run current against a conversation
 *   npx tsx scripts/run-pipeline.ts --conversationId <id> --version current
 *
 *   # Run against fixture (hydrates temp conversation)
 *   npx tsx scripts/run-pipeline.ts --fixture demo-pre-generate --version v1
 *
 *   # Export trace to evals directory
 *   npx tsx scripts/run-pipeline.ts --conversationId <id> --version v1 --export
 *
 * Versions:
 *   v1      - Archived extraction/generation (2026-01-31)
 *   current - Current API implementation
 */

import { prisma } from '../src/lib/db'
import * as fs from 'fs'
import * as path from 'path'

// V1 imports
import {
  performExtraction as performExtractionV1,
  ExtractionProgressUpdate,
} from '../src/lib/extraction/v1'
import {
  performGeneration as performGenerationV1,
  GenerationProgressUpdate,
} from '../src/lib/generation/v1'

// Types
interface PipelineInput {
  conversationId: string
  version: 'v1' | 'current'
  exportTrace?: boolean
  dryRun?: boolean
}

interface PipelineOutput {
  version: string
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

async function runPipelineV1(conversationId: string): Promise<{
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

async function runPipelineCurrent(conversationId: string): Promise<{
  extraction: { extractedContext: any; dimensionalCoverage: any; durationMs: number }
  generation: { traceId: string; thoughts: string; statements: any; durationMs: number }
}> {
  console.log('\n📦 Running current pipeline via API...')

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

  // Extraction via API
  console.log('\n🔍 Extraction (current)')
  const extractStart = Date.now()

  const extractRes = await fetch(`${baseUrl}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  })

  if (!extractRes.ok) {
    throw new Error(`Extraction failed: ${extractRes.status} ${await extractRes.text()}`)
  }

  // Parse streaming response
  const extractText = await extractRes.text()
  const extractLines = extractText.trim().split('\n')
  let extractionResult: any = null

  for (const line of extractLines) {
    try {
      const parsed = JSON.parse(line)
      if (parsed.step === 'complete' && parsed.data) {
        extractionResult = parsed.data
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  if (!extractionResult) {
    throw new Error('Failed to parse extraction result')
  }

  const extractDuration = Date.now() - extractStart
  console.log(`  ✓ Extraction complete (${extractDuration}ms)`)

  // Generation via API
  console.log('\n✨ Generation (current)')
  const genStart = Date.now()

  // Get project ID for generation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { projectId: true },
  })

  if (!conversation?.projectId) {
    throw new Error('Conversation has no project')
  }

  const genRes = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      projectId: conversation.projectId,
      extractedContext: extractionResult.extractedContext,
      dimensionalCoverage: extractionResult.dimensionalCoverage,
    }),
  })

  if (!genRes.ok) {
    throw new Error(`Generation failed: ${genRes.status} ${await genRes.text()}`)
  }

  // Parse streaming response
  const genText = await genRes.text()
  const genLines = genText.trim().split('\n')
  let generationResult: any = null

  for (const line of genLines) {
    try {
      const parsed = JSON.parse(line)
      if (parsed.step === 'complete' && parsed.data) {
        generationResult = parsed.data
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  if (!generationResult) {
    throw new Error('Failed to parse generation result')
  }

  const genDuration = Date.now() - genStart
  console.log(`  ✓ Generation complete (${genDuration}ms)`)

  return {
    extraction: {
      extractedContext: extractionResult.extractedContext,
      dimensionalCoverage: extractionResult.dimensionalCoverage,
      durationMs: extractDuration,
    },
    generation: {
      traceId: generationResult.traceId,
      thoughts: generationResult.thoughts || '',
      statements: generationResult.statements,
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
    id: `${output.generation.traceId}-${output.version}`,
    exportedAt: new Date().toISOString(),
    pipelineVersion: output.version,
    promptVersions: {
      extraction: output.version,
      generation: output.version,
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
  const versionArg = args.find((a) => a.startsWith('--version='))
  const exportFlag = args.includes('--export')
  const dryRun = args.includes('--dry-run')

  const version = versionArg?.split('=')[1] || 'current'

  if (version !== 'v1' && version !== 'current') {
    console.error('Invalid version. Must be "v1" or "current"')
    process.exit(1)
  }

  let conversationId: string

  if (conversationIdArg) {
    conversationId = conversationIdArg.split('=')[1]
  } else if (fixtureArg) {
    // TODO: Hydrate fixture to temp conversation
    console.error('Fixture hydration not yet implemented. Use --conversationId for now.')
    process.exit(1)
  } else {
    console.error('Must provide --conversationId=<id> or --fixture=<name>')
    console.error('')
    console.error('Usage:')
    console.error('  npx tsx scripts/run-pipeline.ts --conversationId <id> --version v1')
    console.error('  npx tsx scripts/run-pipeline.ts --conversationId <id> --version current --export')
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
  console.log('🔬 Pipeline Runner')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Version:      ${version}`)
  console.log(`Conversation: ${conversationId}`)
  console.log(`Variant:      ${conversation.experimentVariant || 'unknown'}`)
  console.log(`Export:       ${exportFlag ? 'yes' : 'no'}`)

  if (dryRun) {
    console.log('\n[DRY RUN] Would run pipeline - exiting')
    await prisma.$disconnect()
    process.exit(0)
  }

  const startTime = Date.now()

  try {
    let result
    if (version === 'v1') {
      result = await runPipelineV1(conversationId)
    } else {
      result = await runPipelineCurrent(conversationId)
    }

    const totalDuration = Date.now() - startTime

    const output: PipelineOutput = {
      version,
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

    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
