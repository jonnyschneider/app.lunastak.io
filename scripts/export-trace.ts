#!/usr/bin/env npx tsx
/**
 * Export Trace Script
 *
 * Exports trace data from DB to JSON files for evaluation.
 *
 * Usage:
 *   npx tsx scripts/export-trace.ts --traceId abc123
 *   npx tsx scripts/export-trace.ts --traceId abc123 --traceId def456
 *   npx tsx scripts/export-trace.ts --projectId xyz789
 *   npx tsx scripts/export-trace.ts --traceId abc123 --force
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import type { ExportedTrace } from '../src/lib/eval/types';

const prisma = new PrismaClient();

function parseArgs(): { traceIds: string[]; projectId?: string; force: boolean } {
  const args = process.argv.slice(2);
  const traceIds: string[] = [];
  let projectId: string | undefined;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--traceId' && args[i + 1]) {
      traceIds.push(args[++i]);
    } else if (args[i] === '--projectId' && args[i + 1]) {
      projectId = args[++i];
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  return { traceIds, projectId, force };
}

async function getOpportunities(projectId: string | null): Promise<ExportedTrace['components']['generation']['opportunities']> {
  if (!projectId) return undefined;
  try {
    const items = await prisma.userContent.findMany({
      where: { projectId, type: 'opportunity' },
      orderBy: { createdAt: 'asc' },
    });
    if (items.length === 0) return undefined;
    return items.map(item => {
      const meta = item.metadata as Record<string, unknown> | null;
      return {
        id: item.id,
        title: (meta?.title as string) || item.content.slice(0, 60),
        description: (meta?.description as string) || item.content,
        objectiveIds: (meta?.objectiveIds as string[]) || [],
        successMetrics: (meta?.successMetrics as any) || undefined,
      };
    });
  } catch {
    // UserContent table may not exist yet in this environment
    return undefined;
  }
}

async function exportTrace(traceId: string, force: boolean): Promise<string | null> {
  const outDir = path.join(process.cwd(), 'evals', 'traces');
  const outPath = path.join(outDir, `${traceId}.json`);

  // Check if already exists
  if (fs.existsSync(outPath) && !force) {
    console.log(`  Skipping ${traceId} (already exists, use --force to overwrite)`);
    return null;
  }

  // Fetch trace with related data
  const trace = await prisma.trace.findUnique({
    where: { id: traceId },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      },
    },
  });

  if (!trace) {
    console.error(`  Trace ${traceId} not found`);
    return null;
  }

  // Extract data from trace
  const extractedContext = trace.extractedContext as Record<string, unknown>;
  const output = trace.output as Record<string, unknown>;
  const dimensionalCoverage = trace.dimensionalCoverage as Record<string, unknown> | null;

  // Build exported trace
  const exported: ExportedTrace = {
    id: trace.id,
    exportedAt: new Date().toISOString(),
    promptVersions: {
      extraction: extractedContext?.extraction_approach as string || undefined,
      generation: undefined, // TODO: Track this in trace metadata
    },
    components: {
      conversation: {
        messages: trace.conversation?.messages.map(m => ({
          role: m.role as 'assistant' | 'user',
          content: m.content,
          stepNumber: m.stepNumber,
        })) || [],
        questionCount: trace.conversation?.questionCount || 0,
      },
      extraction: {
        themes: (extractedContext?.themes as Array<{ theme_name: string; content: string }>) || undefined,
        dimensionalCoverage: dimensionalCoverage || undefined,
        reflectiveSummary: extractedContext?.reflective_summary as ExportedTrace['components']['extraction']['reflectiveSummary'] || undefined,
      },
      generation: {
        vision: (output?.vision as string) || '',
        strategy: (output?.strategy as string) || '',
        objectives: (output?.objectives as ExportedTrace['components']['generation']['objectives']) || [],
        opportunities: await getOpportunities(trace.projectId),
      },
    },
    timing: {
      generationMs: trace.latencyMs,
    },
  };

  // Ensure directory exists
  fs.mkdirSync(outDir, { recursive: true });

  // Write file
  fs.writeFileSync(outPath, JSON.stringify(exported, null, 2));
  console.log(`  Exported ${traceId} → ${outPath}`);

  return outPath;
}

async function main() {
  const { traceIds, projectId, force } = parseArgs();

  if (traceIds.length === 0 && !projectId) {
    console.error('Usage: npx tsx scripts/export-trace.ts --traceId <id> [--traceId <id2>] [--projectId <id>] [--force]');
    process.exit(1);
  }

  let idsToExport = [...traceIds];

  // If projectId provided, get all traces for that project
  if (projectId) {
    const projectTraces = await prisma.trace.findMany({
      where: {
        conversation: {
          projectId,
        },
      },
      select: { id: true },
    });
    idsToExport.push(...projectTraces.map(t => t.id));
  }

  // Dedupe
  idsToExport = Array.from(new Set(idsToExport));

  console.log(`Exporting ${idsToExport.length} trace(s)...\n`);

  for (const id of idsToExport) {
    await exportTrace(id, force);
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch(console.error);
