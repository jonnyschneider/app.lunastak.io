import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const FIXTURES_DIR = path.join(process.cwd(), 'scripts/seed/fixtures')

export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const indexPath = path.join(FIXTURES_DIR, 'index.json')
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    return NextResponse.json(index)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load fixture index' }, { status: 500 })
  }
}
