/**
 * Ratchet: the experiment scaffolding must stay scaffolding.
 *
 * `src/lib/experiment/` is disposable eval instrumentation for the model-bump
 * comparison, not application code (see its README). The thing that turns
 * temporary scaffolding into permanent architecture is production code quietly
 * growing dependencies on it.
 *
 * Exactly ONE production import is allowed: createMessage() calls captureCall().
 * If a second appears, this stopped being scaffolding and needs a real design
 * decision rather than another import.
 */

import * as fs from 'fs'
import * as path from 'path'

const SRC = path.join(__dirname, '../..')

/** The single sanctioned production consumer. */
const ALLOWED_IMPORTERS = ['lib/claude.ts']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'dist', '.git', '__tests__', 'experiment'].includes(entry.name)) {
        walk(full, out)
      }
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(full)
    }
  }
  return out
}

describe('experiment scaffolding containment', () => {
  it('is imported by exactly one production module', () => {
    const importers: string[] = []

    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file)
      const src = fs.readFileSync(file, 'utf8')
      if (/from ['"]@\/lib\/experiment\//.test(src) || /from ['"]\.\.?\/experiment\//.test(src)) {
        importers.push(rel)
      }
    }

    expect(importers.sort()).toEqual(ALLOWED_IMPORTERS.sort())
  })
})
