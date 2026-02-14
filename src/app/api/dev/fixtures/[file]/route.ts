import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const FIXTURES_DIR = path.join(process.cwd(), 'scripts/seed/fixtures')

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { file } = await params

  // Prevent directory traversal
  if (file.includes('..') || file.includes('/')) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
  }

  try {
    const filePath = path.join(FIXTURES_DIR, file)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: `Fixture not found: ${file}` }, { status: 404 })
  }
}
