#!/usr/bin/env npx tsx
/**
 * Backtest Script
 *
 * Replays historical traces through different prompt versions to compare outputs.
 * Used for evaluating prompt changes before deployment.
 *
 * Usage:
 *   npx tsx scripts/backtest.ts --limit=10
 *   npx tsx scripts/backtest.ts --limit=5 --versions=v1-with-summary,v2-themes-only
 */

import { prisma } from '../src/lib/db'
import { getPrompt, listPromptVersions } from '../src/lib/prompts'
import { createMessage, CLAUDE_MODEL } from '../src/lib/claude'
import {
  BacktestConfig,
  EvaluationRun,
  SkippedResult,
  BacktestOutput,
} from '../src/lib/evaluation/types'
import {
  getTraceSchemaVersion,
  checkTraceDataCompatibility,
  TRACE_SCHEMA_VERSIONS,
} from '../src/lib/evaluation/compatibility'
import * as fs from 'fs'
import * as path from 'path'

async function backtest(config: BacktestConfig): Promise<BacktestOutput> {
  console.log('Starting backtest with config:', config)

  // 1. Fetch traces
  const traces = await prisma.trace.findMany({
    where: config.traceIds ? { id: { in: config.traceIds } } : {},
    take: config.limit || 10,
    orderBy: { timestamp: 'desc' },
    include: {
      conversation: {
        include: { messages: { orderBy: { stepNumber: 'asc' } } }
      }
    }
  })

  console.log(`Found ${traces.length} traces to process`)

  const results: EvaluationRun[] = []
  const skippedResults: SkippedResult[] = []

  // 2. Replay each trace through each prompt version
  for (const trace of traces) {
    if (!trace.conversation) {
      console.warn(`Trace ${trace.id} has no conversation, skipping`)
      continue
    }

    const conversationHistory = trace.conversation.messages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n')

    // Extract themes from original extractedContext
    const extractedContext = trace.extractedContext as any
    const themes = extractedContext?.themes || []

    if (themes.length === 0) {
      console.warn(`Trace ${trace.id} has no themes (likely prescriptive), skipping`)
      for (const version of config.promptVersions) {
        skippedResults.push({
          traceId: trace.id,
          promptVersion: version,
          status: 'skipped',
          reason: 'No themes in extractedContext (prescriptive extraction)',
        })
      }
      continue
    }

    for (const version of config.promptVersions) {
      const prompt = getPrompt('generation', version)
      if (!prompt) {
        console.warn(`Prompt version ${version} not found, skipping`)
        skippedResults.push({
          traceId: trace.id,
          promptVersion: version,
          status: 'skipped',
          reason: `Prompt version ${version} not found in registry`,
        })
        continue
      }

      // Check compatibility using runtime data check
      const compatibility = checkTraceDataCompatibility(extractedContext, prompt)
      if (!compatibility.compatible) {
        const schemaVersion = getTraceSchemaVersion(trace.timestamp)
        console.warn(`Trace ${trace.id} (schema ${schemaVersion}) incompatible with ${version}: missing ${compatibility.missingFields.join(', ')}`)
        skippedResults.push({
          traceId: trace.id,
          promptVersion: version,
          status: 'skipped',
          reason: `Incompatible: missing ${compatibility.missingFields.join(', ')}`,
        })
        continue
      }

      console.log(`Processing trace ${trace.id} with ${version}...`)

      // Build prompt based on version requirements
      const themesText = themes
        .map((t: any) => `${t.theme_name}:\n${t.content}`)
        .join('\n\n')

      let filledPrompt = prompt.template.replace('{themes}', themesText)

      // Fill reflective_summary placeholders if needed
      if (prompt.requiredInputs.includes('reflective_summary')) {
        const summary = extractedContext.reflective_summary
        const strengthsText = (summary?.strengths || []).map((s: string) => `- ${s}`).join('\n')
        const emergingText = (summary?.emerging || []).map((e: string) => `- ${e}`).join('\n')
        const opportunitiesText = (summary?.opportunities_for_enrichment || []).map((o: string) => `- ${o}`).join('\n')

        filledPrompt = filledPrompt
          .replace('{strengths}', strengthsText || 'None identified')
          .replace('{emerging}', emergingText || 'None identified')
          .replace('{unexplored}', opportunitiesText || 'None identified')
      }

      try {
        const start = Date.now()
        const response = await createMessage({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          messages: [{ role: 'user', content: filledPrompt }],
          temperature: 0.7
        }, `backtest_${version}`)
        const latencyMs = Date.now() - start

        const rawOutput = response.content[0]?.type === 'text'
          ? response.content[0].text
          : ''

        results.push({
          id: `${trace.id}_${version}`,
          traceId: trace.id,
          promptType: 'generation',
          promptVersion: version,
          input: { conversationHistory, themes },
          output: { raw: rawOutput, parsed: null },
          metrics: {
            latencyMs,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          createdAt: new Date(),
        })

        console.log(`  ✓ ${version}: ${latencyMs}ms, ${response.usage.input_tokens + response.usage.output_tokens} tokens`)
      } catch (error) {
        console.error(`  ✗ ${version}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        skippedResults.push({
          traceId: trace.id,
          promptVersion: version,
          status: 'skipped',
          reason: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    }
  }

  // 3. Build output with schema version breakdown
  const schemaVersionCounts: Record<string, number> = {}
  for (const trace of traces) {
    const schemaVersion = getTraceSchemaVersion(trace.timestamp)
    schemaVersionCounts[schemaVersion] = (schemaVersionCounts[schemaVersion] || 0) + 1
  }

  const output: BacktestOutput = {
    config,
    summary: {
      totalTraces: traces.length,
      byPromptVersion: Object.fromEntries(
        config.promptVersions.map(v => [v, {
          compatible: results.filter(r => r.promptVersion === v).length,
          skipped: skippedResults.filter(r => r.promptVersion === v).length,
        }])
      ),
      bySchemaVersion: schemaVersionCounts,
    },
    runs: results,
    skipped: skippedResults,
  }

  // 4. Write results
  const outputDir = config.outputDir || './backtest-results'
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, `backtest-${Date.now()}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`\nResults written to ${outputPath}`)

  // Print summary
  console.log('\n=== Backtest Summary ===')
  console.log(`Total traces: ${output.summary.totalTraces}`)
  for (const [version, stats] of Object.entries(output.summary.byPromptVersion)) {
    console.log(`  ${version}: ${stats.compatible} runs, ${stats.skipped} skipped`)
  }

  return output
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  const limitArg = args.find(a => a.startsWith('--limit='))
  const versionsArg = args.find(a => a.startsWith('--versions='))

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 5
  const versions = versionsArg
    ? versionsArg.split('=')[1].split(',')
    : ['v1-with-summary', 'v2-themes-only']

  // Validate versions exist
  const availableVersions = listPromptVersions('generation').map(p => p.id)
  for (const v of versions) {
    if (!availableVersions.includes(v)) {
      console.error(`Unknown version: ${v}`)
      console.error(`Available versions: ${availableVersions.join(', ')}`)
      process.exit(1)
    }
  }

  const config: BacktestConfig = {
    limit,
    promptVersions: versions,
  }

  try {
    await backtest(config)
    await prisma.$disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Backtest failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
