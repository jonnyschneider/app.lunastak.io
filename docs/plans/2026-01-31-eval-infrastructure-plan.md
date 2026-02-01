# Eval Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build eval infrastructure for comparing trace outputs across prompt versions with component-level evaluation notes and tags.

**Architecture:** Export traces from DB to JSON files, store evaluations in JSON, view/edit via admin UI. Tags evolve organically and are component-scoped.

**Tech Stack:** TypeScript, Next.js, Prisma, shadcn/ui components

---

## Task 1: Create Eval Type Definitions

**Files:**
- Create: `src/lib/eval/types.ts`

**Step 1: Create the types file**

```typescript
/**
 * Eval Infrastructure Types
 *
 * Defines the shape of exported traces and evaluation files.
 */

// Component types for evaluation
export type EvalComponent = 'conversation' | 'extraction' | 'generation';

// Evaluation entry for a single component
export interface ComponentEvaluation {
  notes: string;
  tags: string[];
}

// Exported trace structure
export interface ExportedTrace {
  id: string;
  exportedAt: string;
  promptVersions: {
    extraction?: string;
    generation?: string;
  };
  components: {
    conversation: {
      messages: Array<{
        role: 'assistant' | 'user';
        content: string;
        stepNumber: number;
      }>;
      questionCount: number;
    };
    extraction: {
      themes?: Array<{
        theme_name: string;
        content: string;
        dimensions?: Array<{
          name: string;
          confidence?: string;
        }>;
      }>;
      dimensionalCoverage?: Record<string, unknown>;
      reflectiveSummary?: {
        strengths: string[];
        emerging: string[];
        opportunities_for_enrichment: string[];
      };
    };
    generation: {
      vision: string;
      strategy: string;
      objectives: Array<{
        id: string;
        pithy: string;
        metric: {
          summary: string;
          full: string;
          category: string;
          direction?: string;
          metricName?: string;
          metricValue?: string;
          timeframe?: string;
        };
        explanation: string;
        successCriteria: string;
      }>;
    };
  };
  timing: {
    extractionMs?: number;
    generationMs?: number;
  };
}

// Eval file structure
export interface EvalFile {
  name: string;
  date: string;
  purpose: string;
  traces: string[]; // trace IDs
  baseline: string; // which trace is the baseline
  evaluation: Record<string, Record<EvalComponent, ComponentEvaluation>>;
  summary: string;
  outcome: string;
}

// Tags file structure
export interface TagsFile {
  conversation: string[];
  extraction: string[];
  generation: string[];
}
```

**Step 2: Commit**

```bash
git add src/lib/eval/types.ts
git commit -m "feat(eval): add type definitions for eval infrastructure"
```

---

## Task 2: Create Export Trace Script

**Files:**
- Create: `scripts/export-trace.ts`

**Step 1: Create the export script**

```typescript
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
  idsToExport = [...new Set(idsToExport)];

  console.log(`Exporting ${idsToExport.length} trace(s)...\n`);

  for (const id of idsToExport) {
    await exportTrace(id, force);
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch(console.error);
```

**Step 2: Verify script runs**

```bash
npx tsx scripts/export-trace.ts --help
```

Expected: Shows usage error (no args provided)

**Step 3: Commit**

```bash
git add scripts/export-trace.ts
git commit -m "feat(eval): add export-trace script"
```

---

## Task 3: Create Eval Scaffolding Script

**Files:**
- Create: `scripts/create-eval.ts`

**Step 1: Create the script**

```typescript
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
```

**Step 2: Commit**

```bash
git add scripts/create-eval.ts
git commit -m "feat(eval): add create-eval scaffolding script"
```

---

## Task 4: Create Eval API Routes

**Files:**
- Create: `src/app/api/admin/eval/route.ts`
- Create: `src/app/api/admin/eval/[evalId]/route.ts`

**Step 1: Create list evals route**

```typescript
// src/app/api/admin/eval/route.ts
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    const evalsDir = path.join(process.cwd(), 'evals');

    if (!fs.existsSync(evalsDir)) {
      return NextResponse.json({ evals: [] });
    }

    const files = fs.readdirSync(evalsDir)
      .filter(f => f.endsWith('.eval.json'))
      .map(f => {
        const content = JSON.parse(fs.readFileSync(path.join(evalsDir, f), 'utf-8'));
        return {
          id: f.replace('.eval.json', ''),
          name: content.name,
          date: content.date,
          traceCount: content.traces?.length || 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ evals: files });
  } catch (error) {
    console.error('Failed to list evals:', error);
    return NextResponse.json({ error: 'Failed to list evals' }, { status: 500 });
  }
}
```

**Step 2: Create get/update eval route**

```typescript
// src/app/api/admin/eval/[evalId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { EvalFile, ExportedTrace, TagsFile } from '@/lib/eval/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ evalId: string }> }
) {
  try {
    const { evalId } = await params;
    const evalPath = path.join(process.cwd(), 'evals', `${evalId}.eval.json`);

    if (!fs.existsSync(evalPath)) {
      return NextResponse.json({ error: 'Eval not found' }, { status: 404 });
    }

    const evalFile: EvalFile = JSON.parse(fs.readFileSync(evalPath, 'utf-8'));

    // Load referenced traces
    const traces: Record<string, ExportedTrace> = {};
    for (const traceId of evalFile.traces) {
      const tracePath = path.join(process.cwd(), 'evals', 'traces', `${traceId}.json`);
      if (fs.existsSync(tracePath)) {
        traces[traceId] = JSON.parse(fs.readFileSync(tracePath, 'utf-8'));
      }
    }

    // Load tags
    const tagsPath = path.join(process.cwd(), 'evals', 'tags.json');
    const tags: TagsFile = fs.existsSync(tagsPath)
      ? JSON.parse(fs.readFileSync(tagsPath, 'utf-8'))
      : { conversation: [], extraction: [], generation: [] };

    return NextResponse.json({ eval: evalFile, traces, tags });
  } catch (error) {
    console.error('Failed to load eval:', error);
    return NextResponse.json({ error: 'Failed to load eval' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ evalId: string }> }
) {
  try {
    const { evalId } = await params;
    const evalPath = path.join(process.cwd(), 'evals', `${evalId}.eval.json`);

    if (!fs.existsSync(evalPath)) {
      return NextResponse.json({ error: 'Eval not found' }, { status: 404 });
    }

    const body = await request.json();
    const { evaluation, summary, outcome, newTags } = body;

    // Load existing eval
    const evalFile: EvalFile = JSON.parse(fs.readFileSync(evalPath, 'utf-8'));

    // Update fields
    if (evaluation) evalFile.evaluation = evaluation;
    if (summary !== undefined) evalFile.summary = summary;
    if (outcome !== undefined) evalFile.outcome = outcome;

    // Save eval
    fs.writeFileSync(evalPath, JSON.stringify(evalFile, null, 2));

    // Update tags if new ones added
    if (newTags) {
      const tagsPath = path.join(process.cwd(), 'evals', 'tags.json');
      const tags: TagsFile = fs.existsSync(tagsPath)
        ? JSON.parse(fs.readFileSync(tagsPath, 'utf-8'))
        : { conversation: [], extraction: [], generation: [] };

      let updated = false;
      for (const [component, tagList] of Object.entries(newTags) as [keyof TagsFile, string[]][]) {
        for (const tag of tagList) {
          if (!tags[component].includes(tag)) {
            tags[component].push(tag);
            updated = true;
          }
        }
      }

      if (updated) {
        fs.writeFileSync(tagsPath, JSON.stringify(tags, null, 2));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update eval:', error);
    return NextResponse.json({ error: 'Failed to update eval' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/admin/eval/route.ts src/app/api/admin/eval/[evalId]/route.ts
git commit -m "feat(eval): add API routes for eval CRUD"
```

---

## Task 5: Create Eval Viewer Page

**Files:**
- Create: `src/app/admin/eval/[evalId]/page.tsx`

**Step 1: Create the page component**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ChevronDown, ChevronUp, Save, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { EvalFile, ExportedTrace, TagsFile, EvalComponent } from '@/lib/eval/types'

interface EvalData {
  eval: EvalFile
  traces: Record<string, ExportedTrace>
  tags: TagsFile
}

export default function EvalViewerPage() {
  const params = useParams()
  const evalId = params.evalId as string

  const [data, setData] = useState<EvalData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Track new tags to persist
  const [newTags, setNewTags] = useState<TagsFile>({ conversation: [], extraction: [], generation: [] })

  useEffect(() => {
    fetchEval()
  }, [evalId])

  const fetchEval = async () => {
    try {
      const response = await fetch(`/api/admin/eval/${evalId}`)
      if (!response.ok) {
        throw new Error('Failed to load eval')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!data) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/eval/${evalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluation: data.eval.evaluation,
          summary: data.eval.summary,
          outcome: data.eval.outcome,
          newTags: Object.values(newTags).some(arr => arr.length > 0) ? newTags : undefined,
        }),
      })
      if (!response.ok) throw new Error('Failed to save')
      setHasChanges(false)
      setNewTags({ conversation: [], extraction: [], generation: [] })
    } catch (err) {
      alert('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data.eval, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${evalId}.eval.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateEvaluation = useCallback((
    traceId: string,
    component: EvalComponent,
    field: 'notes' | 'tags',
    value: string | string[]
  ) => {
    if (!data) return
    setData(prev => {
      if (!prev) return prev
      const updated = { ...prev }
      updated.eval = { ...updated.eval }
      updated.eval.evaluation = { ...updated.eval.evaluation }
      updated.eval.evaluation[traceId] = { ...updated.eval.evaluation[traceId] }
      updated.eval.evaluation[traceId][component] = {
        ...updated.eval.evaluation[traceId][component],
        [field]: value,
      }
      return updated
    })
    setHasChanges(true)
  }, [data])

  const addTag = useCallback((traceId: string, component: EvalComponent, tag: string) => {
    if (!data) return
    const currentTags = data.eval.evaluation[traceId][component].tags
    if (!currentTags.includes(tag)) {
      updateEvaluation(traceId, component, 'tags', [...currentTags, tag])

      // Track if it's a new tag
      if (!data.tags[component].includes(tag)) {
        setNewTags(prev => ({
          ...prev,
          [component]: [...prev[component], tag],
        }))
      }
    }
  }, [data, updateEvaluation])

  const removeTag = useCallback((traceId: string, component: EvalComponent, tag: string) => {
    if (!data) return
    const currentTags = data.eval.evaluation[traceId][component].tags
    updateEvaluation(traceId, component, 'tags', currentTags.filter(t => t !== tag))
  }, [data, updateEvaluation])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (error || !data) {
    return <div className="flex items-center justify-center h-screen text-destructive">{error || 'No data'}</div>
  }

  const { eval: evalFile, traces, tags } = data
  const traceIds = evalFile.traces

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{evalFile.name}</h1>
            <p className="text-sm text-muted-foreground">{evalFile.date}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Purpose */}
        {evalFile.purpose && (
          <p className="text-muted-foreground mb-6">{evalFile.purpose}</p>
        )}

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-6">
          {traceIds.map(traceId => (
            <TraceColumn
              key={traceId}
              traceId={traceId}
              trace={traces[traceId]}
              evaluation={evalFile.evaluation[traceId]}
              isBaseline={traceId === evalFile.baseline}
              tags={tags}
              onNotesChange={(component, value) => updateEvaluation(traceId, component, 'notes', value)}
              onAddTag={(component, tag) => addTag(traceId, component, tag)}
              onRemoveTag={(component, tag) => removeTag(traceId, component, tag)}
            />
          ))}
        </div>

        {/* Summary & Outcome */}
        <div className="mt-8 space-y-4 border-t pt-6">
          <div>
            <label className="text-sm font-medium">Summary</label>
            <Textarea
              value={evalFile.summary}
              onChange={e => {
                setData(prev => prev ? { ...prev, eval: { ...prev.eval, summary: e.target.value } } : prev)
                setHasChanges(true)
              }}
              placeholder="What did you learn from this comparison?"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Outcome</label>
            <Textarea
              value={evalFile.outcome}
              onChange={e => {
                setData(prev => prev ? { ...prev, eval: { ...prev.eval, outcome: e.target.value } } : prev)
                setHasChanges(true)
              }}
              placeholder="What action will you take based on this eval?"
              className="mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface TraceColumnProps {
  traceId: string
  trace: ExportedTrace | undefined
  evaluation: Record<EvalComponent, { notes: string; tags: string[] }>
  isBaseline: boolean
  tags: TagsFile
  onNotesChange: (component: EvalComponent, value: string) => void
  onAddTag: (component: EvalComponent, tag: string) => void
  onRemoveTag: (component: EvalComponent, tag: string) => void
}

function TraceColumn({
  traceId,
  trace,
  evaluation,
  isBaseline,
  tags,
  onNotesChange,
  onAddTag,
  onRemoveTag,
}: TraceColumnProps) {
  if (!trace) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-destructive">Trace {traceId} not found</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={cn(
        'px-4 py-2 font-medium',
        isBaseline ? 'bg-blue-50 text-blue-900' : 'bg-gray-50'
      )}>
        {isBaseline ? 'BASELINE' : 'VARIANT'} ({traceId.slice(0, 8)}...)
      </div>

      {/* Components */}
      <ComponentSection
        title="Conversation"
        component="conversation"
        evaluation={evaluation.conversation}
        tags={tags.conversation}
        onNotesChange={v => onNotesChange('conversation', v)}
        onAddTag={t => onAddTag('conversation', t)}
        onRemoveTag={t => onRemoveTag('conversation', t)}
      >
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {trace.components.conversation.messages.map((msg, idx) => (
            <div key={idx} className={cn(
              'text-xs p-2 rounded',
              msg.role === 'assistant' ? 'bg-blue-50' : 'bg-gray-50'
            )}>
              <span className="font-medium">{msg.role}:</span> {msg.content.slice(0, 200)}
              {msg.content.length > 200 && '...'}
            </div>
          ))}
        </div>
      </ComponentSection>

      <ComponentSection
        title="Extraction"
        component="extraction"
        evaluation={evaluation.extraction}
        tags={tags.extraction}
        onNotesChange={v => onNotesChange('extraction', v)}
        onAddTag={t => onAddTag('extraction', t)}
        onRemoveTag={t => onRemoveTag('extraction', t)}
      >
        {trace.components.extraction.themes && (
          <div className="space-y-2">
            {trace.components.extraction.themes.map((theme, idx) => (
              <div key={idx} className="text-xs">
                <span className="font-medium">{theme.theme_name}:</span>{' '}
                {theme.content.slice(0, 150)}...
              </div>
            ))}
          </div>
        )}
      </ComponentSection>

      <ComponentSection
        title="Generation"
        component="generation"
        evaluation={evaluation.generation}
        tags={tags.generation}
        onNotesChange={v => onNotesChange('generation', v)}
        onAddTag={t => onAddTag('generation', t)}
        onRemoveTag={t => onRemoveTag('generation', t)}
      >
        <div className="space-y-3 text-xs">
          <div>
            <span className="font-medium">Vision:</span>{' '}
            {trace.components.generation.vision}
          </div>
          <div>
            <span className="font-medium">Strategy:</span>{' '}
            {trace.components.generation.strategy}
          </div>
          <div>
            <span className="font-medium">Objectives ({trace.components.generation.objectives.length}):</span>
            <ul className="list-disc list-inside mt-1">
              {trace.components.generation.objectives.map(obj => (
                <li key={obj.id}>{obj.pithy}</li>
              ))}
            </ul>
          </div>
        </div>
      </ComponentSection>
    </div>
  )
}

interface ComponentSectionProps {
  title: string
  component: EvalComponent
  evaluation: { notes: string; tags: string[] }
  tags: string[]
  children: React.ReactNode
  onNotesChange: (value: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

function ComponentSection({
  title,
  component,
  evaluation,
  tags,
  children,
  onNotesChange,
  onAddTag,
  onRemoveTag,
}: ComponentSectionProps) {
  const [expanded, setExpanded] = useState(component === 'generation')
  const [tagInput, setTagInput] = useState('')

  const handleAddTag = (tag: string) => {
    if (tag.trim()) {
      onAddTag(tag.trim().toLowerCase().replace(/\s+/g, '-'))
      setTagInput('')
    }
  }

  const availableTags = tags.filter(t => !evaluation.tags.includes(t))

  return (
    <div className="border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium text-sm">{title}</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Content */}
          <div className="border rounded p-2 bg-gray-50">
            {children}
          </div>

          {/* Notes */}
          <Textarea
            value={evaluation.notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Notes..."
            className="text-xs min-h-[60px]"
          />

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {evaluation.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded cursor-pointer hover:bg-blue-200"
                onClick={() => onRemoveTag(tag)}
              >
                {tag} ×
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag(tagInput)
                }
              }}
              placeholder="+ tag"
              className="text-xs px-2 py-0.5 border rounded w-20"
              list={`${component}-tags`}
            />
            <datalist id={`${component}-tags`}>
              {availableTags.map(t => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/admin/eval/[evalId]/page.tsx
git commit -m "feat(eval): add eval viewer page"
```

---

## Task 6: Create Eval List Page

**Files:**
- Create: `src/app/admin/eval/page.tsx`

**Step 1: Create the list page**

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface EvalSummary {
  id: string
  name: string
  date: string
  traceCount: number
}

export default function EvalListPage() {
  const [evals, setEvals] = useState<EvalSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/eval')
      .then(r => r.json())
      .then(data => setEvals(data.evals || []))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Evaluations</h1>

      {evals.length === 0 ? (
        <p className="text-muted-foreground">
          No evals yet. Create one with:
          <code className="block mt-2 p-2 bg-gray-100 rounded text-sm">
            npx tsx scripts/create-eval.ts --name "my-eval" --traces id1,id2 --baseline id1
          </code>
        </p>
      ) : (
        <div className="space-y-2">
          {evals.map(ev => (
            <Link
              key={ev.id}
              href={`/admin/eval/${ev.id}`}
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-medium">{ev.name}</h2>
                  <p className="text-sm text-muted-foreground">{ev.date}</p>
                </div>
                <span className="text-sm text-muted-foreground">{ev.traceCount} traces</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/admin/eval/page.tsx
git commit -m "feat(eval): add eval list page"
```

---

## Task 7: Initialize Evals Directory Structure

**Files:**
- Create: `evals/.gitkeep`
- Create: `evals/traces/.gitkeep`
- Create: `evals/tags.json`
- Update: `.gitignore` (if needed)

**Step 1: Create directory structure**

```bash
mkdir -p evals/traces
touch evals/.gitkeep
touch evals/traces/.gitkeep
```

**Step 2: Create initial tags.json**

```json
{
  "conversation": [],
  "extraction": [],
  "generation": []
}
```

Save to `evals/tags.json`.

**Step 3: Commit**

```bash
git add evals/
git commit -m "chore(eval): initialize evals directory structure"
```

---

## Task 8: Archive Notebooks

**Files:**
- Move: `notebooks/` → `docs/notebooks/`

**Step 1: Move notebooks**

```bash
mkdir -p docs/notebooks
mv notebooks/* docs/notebooks/
rmdir notebooks
```

**Step 2: Verify docs is gitignored**

Check `.gitignore` includes `docs/` (it should based on CLAUDE.md).

**Step 3: Commit removal**

```bash
git add -A
git commit -m "chore: archive notebooks to docs/ (gitignored)"
```

---

## Task 9: Migrate Existing Eval

**Files:**
- Update: `evals/2026-01-31-extraction-optimisation.json`

**Step 1: Rename and update format**

The existing eval at `evals/2026-01-31-extraction-optimisation.json` uses the old format. Update it to match the new structure or leave as historical artifact.

Given it's a one-shot eval already complete, leave it as-is. New evals will use the new format.

**Step 2: No commit needed**

Historical eval preserved as-is.

---

## Task 10: Test End-to-End Flow

**Step 1: Export a trace**

```bash
npx tsx scripts/export-trace.ts --traceId cml1lvd1b000fcz9eyd6t7sh0
```

Expected: Creates `evals/traces/cml1lvd1b000fcz9eyd6t7sh0.json`

**Step 2: Create an eval**

```bash
npx tsx scripts/create-eval.ts --name "test-eval" --traces cml1lvd1b000fcz9eyd6t7sh0 --baseline cml1lvd1b000fcz9eyd6t7sh0
```

Expected: Creates `evals/2026-01-31-test-eval.eval.json`

**Step 3: View in browser**

Open: `http://localhost:3000/admin/eval/2026-01-31-test-eval`

Expected: Eval viewer loads with trace data

**Step 4: Add notes and save**

Add notes to a component, click Save.

Expected: File updated on disk

**Step 5: Cleanup test files**

```bash
rm evals/traces/cml1lvd1b000fcz9eyd6t7sh0.json
rm evals/2026-01-31-test-eval.eval.json
```

---

## Task 11: Final Commit

**Step 1: Run verify**

```bash
npm run verify
```

Expected: All checks pass

**Step 2: Commit any remaining changes**

```bash
git add -A
git commit -m "feat(eval): complete eval infrastructure implementation"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Type definitions for traces and evals |
| 2 | Export trace script |
| 3 | Create eval scaffolding script |
| 4 | API routes for eval CRUD |
| 5 | Eval viewer page (side-by-side) |
| 6 | Eval list page |
| 7 | Initialize evals directory |
| 8 | Archive notebooks |
| 9 | Migrate existing eval (skip) |
| 10 | End-to-end test |
| 11 | Final verification and commit |
