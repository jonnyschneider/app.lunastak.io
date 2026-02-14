import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const SNAPSHOTS_FILE = path.join(process.cwd(), 'docs/evals/snapshots/pending-import.json')
const SNAPSHOTS_DIR = path.join(process.cwd(), 'docs/evals/snapshots')

/**
 * GET: Read pending snapshot imports (consumed by the UI on load)
 * POST: Write a snapshot to the pending import file
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    if (!fs.existsSync(SNAPSHOTS_FILE)) {
      return NextResponse.json({ snapshots: [] })
    }
    const data = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf-8'))
    // Delete after reading so they only import once
    fs.unlinkSync(SNAPSHOTS_FILE)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ snapshots: [] })
  }
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const snapshot = await req.json()

  // Append to pending imports
  let existing: { snapshots: unknown[] } = { snapshots: [] }
  try {
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      existing = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf-8'))
    }
  } catch { /* ignore */ }

  existing.snapshots.push(snapshot)

  const dir = path.dirname(SNAPSHOTS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(existing, null, 2))

  return NextResponse.json({ ok: true })
}

/**
 * PUT: Persist a snapshot to disk as an individual JSON file.
 * Files land in docs/evals/snapshots/<id>.json for VS Code diffing and R&D records.
 */
export async function PUT(req: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const snapshot = await req.json()
  if (!snapshot.id) {
    return NextResponse.json({ error: 'snapshot.id required' }, { status: 400 })
  }

  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })

  const filePath = path.join(SNAPSHOTS_DIR, `${snapshot.id}.json`)
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2))

  return NextResponse.json({ ok: true, path: `docs/evals/snapshots/${snapshot.id}.json` })
}
