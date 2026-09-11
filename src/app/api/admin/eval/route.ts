import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// A local eval viewer over files in evals/ — dev-only, same production guard as the dev/* routes.
export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

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
