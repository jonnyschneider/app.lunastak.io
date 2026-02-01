#!/usr/bin/env npx tsx
/**
 * Create Eval Script
 *
 * Scaffolds a new eval file referencing existing traces.
 *
 * Usage:
 *   npx tsx scripts/create-eval.ts --name "summary-vs-themes" --traces abc123,def456 --baseline abc123
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalFile, TagsFile } from '../src/lib/eval/types';

function parseArgs(): { name: string; traces: string[]; baseline: string; purpose?: string } {
  const args = process.argv.slice(2);
  let name = '';
  let traces: string[] = [];
  let baseline = '';
  let purpose = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === '--traces' && args[i + 1]) {
      traces = args[++i].split(',');
    } else if (args[i] === '--baseline' && args[i + 1]) {
      baseline = args[++i];
    } else if (args[i] === '--purpose' && args[i + 1]) {
      purpose = args[++i];
    }
  }

  return { name, traces, baseline, purpose };
}

function ensureTagsFile(): void {
  const tagsPath = path.join(process.cwd(), 'evals', 'tags.json');

  if (!fs.existsSync(tagsPath)) {
    const initialTags: TagsFile = {
      conversation: [],
      extraction: [],
      generation: [],
    };
    fs.mkdirSync(path.dirname(tagsPath), { recursive: true });
    fs.writeFileSync(tagsPath, JSON.stringify(initialTags, null, 2));
    console.log(`Created ${tagsPath}`);
  }
}

function main() {
  const { name, traces, baseline, purpose } = parseArgs();

  if (!name || traces.length === 0 || !baseline) {
    console.error('Usage: npx tsx scripts/create-eval.ts --name <name> --traces <id1,id2> --baseline <id> [--purpose "..."]');
    process.exit(1);
  }

  if (!traces.includes(baseline)) {
    console.error(`Baseline ${baseline} must be one of the traces`);
    process.exit(1);
  }

  // Check trace files exist
  const tracesDir = path.join(process.cwd(), 'evals', 'traces');
  for (const traceId of traces) {
    const tracePath = path.join(tracesDir, `${traceId}.json`);
    if (!fs.existsSync(tracePath)) {
      console.error(`Trace file not found: ${tracePath}`);
      console.error(`Run: npx tsx scripts/export-trace.ts --traceId ${traceId}`);
      process.exit(1);
    }
  }

  // Build eval file
  const date = new Date().toISOString().split('T')[0];
  const fileName = `${date}-${name}.eval.json`;
  const outPath = path.join(process.cwd(), 'evals', fileName);

  // Build empty evaluations for each trace
  const evaluation: EvalFile['evaluation'] = {};
  for (const traceId of traces) {
    evaluation[traceId] = {
      conversation: { notes: '', tags: [] },
      extraction: { notes: '', tags: [] },
      generation: { notes: '', tags: [] },
    };
  }

  const evalFile: EvalFile = {
    name: name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    date,
    purpose: purpose || '',
    traces,
    baseline,
    evaluation,
    summary: '',
    outcome: '',
  };

  // Ensure tags file exists
  ensureTagsFile();

  // Write eval file
  fs.writeFileSync(outPath, JSON.stringify(evalFile, null, 2));
  console.log(`Created ${outPath}`);
  console.log(`\nOpen in browser: /admin/eval/${date}-${name}`);
}

main();
