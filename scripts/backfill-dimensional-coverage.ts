#!/usr/bin/env tsx
/**
 * Backfill dimensional coverage for existing emergent extraction traces
 *
 * Usage: npx tsx scripts/backfill-dimensional-coverage.ts [--dry-run] [--limit N] [--trace-id <id>]
 *
 * This script:
 * 1. Finds all traces with emergent extraction that don't have dimensionalCoverage
 * 2. For each trace, reconstructs the conversation history and runs dimensional analysis
 * 3. Updates the trace with the dimensional coverage data
 *
 * Options:
 *   --dry-run      Show what would be updated without actually updating
 *   --limit N      Only process N traces (default: all)
 *   --trace-id ID  Process only a specific trace ID
 */

import { prisma } from '../src/lib/db';
import { analyzeDimensionalCoverage } from '../src/lib/dimensional-analysis';
import { EmergentExtractedContext, isEmergentContext } from '../src/lib/types';

interface Options {
  dryRun: boolean;
  limit?: number;
  traceId?: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--limit') {
      const limitValue = parseInt(args[++i], 10);
      if (isNaN(limitValue)) {
        throw new Error(`Invalid limit value: ${args[i]}`);
      }
      options.limit = limitValue;
    } else if (arg === '--trace-id') {
      options.traceId = args[++i];
      if (!options.traceId) {
        throw new Error('--trace-id requires a trace ID');
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function backfillDimensionalCoverage(options: Options) {
  console.log('\n🔍 Finding traces to backfill...\n');

  // Build query based on options
  const whereClause: any = {
    dimensionalCoverage: null, // Only traces without coverage
  };

  if (options.traceId) {
    whereClause.id = options.traceId;
  }

  const traces = await prisma.trace.findMany({
    where: whereClause,
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      },
    },
    take: options.limit,
    orderBy: { timestamp: 'desc' },
  });

  console.log(`Found ${traces.length} trace(s) to process\n`);

  if (traces.length === 0) {
    console.log('✅ No traces need backfilling\n');
    return;
  }

  let processedCount = 0;
  let emergentCount = 0;
  let errorCount = 0;

  for (const trace of traces) {
    processedCount++;
    console.log(`\n[${ processedCount}/${traces.length}] Processing trace: ${trace.id}`);
    console.log(`  Conversation: ${trace.conversationId}`);
    console.log(`  Timestamp: ${trace.timestamp.toISOString()}`);

    try {
      // Check if this is emergent extraction
      const context = trace.extractedContext as any;

      if (!isEmergentContext(context)) {
        console.log(`  ⏭️  Skipping (not emergent extraction)`);
        continue;
      }

      emergentCount++;
      console.log(`  ✓ Emergent extraction confirmed`);

      // Build conversation history
      const conversationHistory = trace.conversation.messages
        .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
        .join('\n\n');

      console.log(`  📝 Conversation messages: ${trace.conversation.messages.length}`);

      if (options.dryRun) {
        console.log(`  🔍 DRY RUN - Would analyze dimensional coverage`);
        continue;
      }

      // Run dimensional analysis
      console.log(`  🤖 Running dimensional analysis...`);
      const startTime = Date.now();

      const dimensionalCoverage = await analyzeDimensionalCoverage(
        context as EmergentExtractedContext,
        conversationHistory
      );

      const analysisTime = Date.now() - startTime;
      console.log(`  ✓ Analysis complete in ${analysisTime}ms`);

      // Log coverage summary
      console.log(`  📊 Coverage: ${dimensionalCoverage.summary.dimensionsCovered}/10 dimensions (${dimensionalCoverage.summary.coveragePercentage}%)`);
      console.log(`  🎯 Primary dimensions: ${dimensionalCoverage.summary.primaryDimensions.length}`);
      console.log(`  ⚠️  Gaps: ${dimensionalCoverage.summary.gaps.length}`);

      // Update trace
      await prisma.trace.update({
        where: { id: trace.id },
        data: {
          dimensionalCoverage: dimensionalCoverage as any,
        },
      });

      console.log(`  ✅ Updated trace with dimensional coverage`);

    } catch (error) {
      errorCount++;
      console.error(`  ❌ Error processing trace:`, error instanceof Error ? error.message : error);
    }
  }

  // Final summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Backfill Summary:\n');
  console.log(`  Total traces found:     ${traces.length}`);
  console.log(`  Emergent extractions:   ${emergentCount}`);
  console.log(`  Successfully updated:   ${emergentCount - errorCount}`);
  console.log(`  Errors:                 ${errorCount}`);

  if (options.dryRun) {
    console.log(`\n  ℹ️  DRY RUN - No traces were actually updated`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Main
try {
  const options = parseArgs();

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (options.limit) {
    console.log(`\n📋 Limiting to ${options.limit} trace(s)\n`);
  }

  if (options.traceId) {
    console.log(`\n🎯 Processing specific trace: ${options.traceId}\n`);
  }

  backfillDimensionalCoverage(options)
    .then(() => {
      console.log('✅ Backfill complete\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
} catch (error) {
  console.error('\n❌ Error parsing arguments:', error instanceof Error ? error.message : error);
  console.log('\nUsage: npx tsx scripts/backfill-dimensional-coverage.ts [--dry-run] [--limit N] [--trace-id <id>]\n');
  process.exit(1);
}
