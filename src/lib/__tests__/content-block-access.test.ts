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

const ROOT = path.join(__dirname, '../../..')

/** Roots scanned. `tools/` is included — CLI scripts read responses too. */
const ROOTS = ['src', 'tools']

/** Only the helper may reach into content blocks. Shrink this set, never grow it. */
const ALLOW = [path.join('src', 'lib', 'extract-text.ts')]

/**
 * Every way we have actually got this wrong:
 *   response.content[0]                         — positional index
 *   content.find(b => b.type === 'text')        — first-match
 *   content.filter(b => b.type === 'text')      — hand-rolled join
 */
const PATTERNS: Array<[RegExp, string]> = [
  [/\.content\s*\[\s*\d+\s*\]/, 'positional index into content blocks'],
  [/type\s*===\s*['"]text['"]/, 'hand-rolled text-block selection'],
  [/is\s+Anthropic\.TextBlock/, 'hand-rolled text-block narrowing'],
]

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
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
  it('never reaches into content blocks outside the extractText helper', () => {
    const violations: string[] = []

    for (const root of ROOTS) {
      for (const file of walk(path.join(ROOT, root))) {
        const rel = path.relative(ROOT, file)
        if (ALLOW.includes(rel)) continue

        fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          const t = line.trim()
          if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return // comments
          for (const [re, why] of PATTERNS) {
            if (re.test(line)) violations.push(`${rel}:${i + 1} — ${why}`)
          }
        })
      }
    }

    expect(violations).toEqual([])
  })
})
