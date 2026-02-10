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
          purpose: content.purpose || '',
          summary: content.summary || '',
          outcome: content.outcome || '',
          traceCount: content.traces?.length || 0,
          baseline: content.baseline,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ evals: files });
  } catch (error) {
    console.error('Failed to list evals:', error);
    return NextResponse.json({ error: 'Failed to list evals' }, { status: 500 });
  }
}
