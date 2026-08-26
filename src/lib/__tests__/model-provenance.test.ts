/**
 * Ratchet: persisted model provenance must come from the API response.
 *
 * Since 2026-08-26 the model is resolved PER CONTEXT inside createMessage()
 * (see @/lib/model-config), so the CLAUDE_MODEL constant is no longer what
 * necessarily served a given call. Recording `modelUsed: CLAUDE_MODEL` would
 * therefore write a model into the DB that may not be the one that answered —
 * silently corrupting the provenance the model-bump experiment depends on, and
 * any future analysis of which model produced which strategy.
 *
 * Record `response.model` instead.
 *
 * Design: docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md
 */

import * as fs from 'fs'
import * as path from 'path'

const SRC = path.join(__dirname, '../..')

/** Files still permitted to record the constant. Shrink this set, never grow it. */
const ALLOW: string[] = []

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'dist', '.git', '__tests__'].includes(entry.name)) walk(full, out)
    } else if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) {
      out.push(full)
    }
  }
  return out
}

describe('model provenance', () => {
  it('never persists modelUsed from the CLAUDE_MODEL constant', () => {
    const violations: string[] = []

    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file)
      if (ALLOW.includes(rel)) continue

      const lines = fs.readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (/modelUsed:\s*CLAUDE_MODEL/.test(line)) {
          violations.push(`${rel}:${i + 1}`)
        }
      })
    }

    expect(violations).toEqual([])
  })
})
