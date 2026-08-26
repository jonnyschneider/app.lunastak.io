/**
 * Ratchet: never index Claude response content blocks directly.
 *
 * `response.content[0]` is only the text block when the response has exactly
 * one block. On the Claude 5 family with adaptive thinking, a `thinking` block
 * comes FIRST (verified live 2026-08-26: opus-5 returns [thinking, text]), so
 * `content[0]?.type === 'text' ? ... : ''` silently discards a good response
 * and returns the fallback. Nothing throws — extraction just finds no themes
 * and generation produces no statements.
 *
 * This was live across 25 call sites and would have made the model comparison
 * conclude "Opus 5 is catastrophically bad" when the app was simply not reading
 * its output.
 *
 * Use extractText() from @/lib/extract-text.
 */

import * as fs from 'fs'
import * as path from 'path'

const SRC = path.join(__dirname, '../..')

/** Only the helper may index content blocks. Shrink this set, never grow it. */
const ALLOW = ['lib/extract-text.ts']

const DIRECT_INDEX = /\.content\s*\[\s*\d+\s*\]/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'dist', '.git', '__tests__'].includes(entry.name)) walk(full, out)
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(full)
    }
  }
  return out
}

describe('claude response content access', () => {
  it('never indexes content blocks directly outside the extractText helper', () => {
    const violations: string[] = []

    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file)
      if (ALLOW.includes(rel)) continue

      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('*') || line.trim().startsWith('//')) return // comments
        if (DIRECT_INDEX.test(line)) violations.push(`${rel}:${i + 1}`)
      })
    }

    expect(violations).toEqual([])
  })
})
