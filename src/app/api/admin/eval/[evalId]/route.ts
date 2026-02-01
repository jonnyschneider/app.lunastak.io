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
