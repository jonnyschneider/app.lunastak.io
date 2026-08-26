/**
 * Ratchet: persisted model provenance must come from the API RESPONSE.
 *
 * The model is resolved per stage inside createMessage() (see @/lib/model-config), so no
 * constant, parameter or plan field reliably names the model that actually answered. Only
 * `<response>.model` does.
 *
 * WHY THIS TEST IS SHAPED THIS WAY — it failed once already:
 *
 * The first version forbade the literal `modelUsed: CLAUDE_MODEL`. Six sites in
 * pipeline/generation.ts wrote `modelUsed: model`, where `model` was a function parameter
 * carrying CLAUDE_MODEL down from planPipeline(). Same bug, different spelling; the ratchet
 * checked for a name instead of a property and sailed straight past them.
 *
 * Caught 2026-08-27 by a deployed-preview smoke: the trace recorded `claude-sonnet-5` while
 * `claude-opus-5` had actually served the request (proved by token count and latency). That is
 * precisely the provenance a future model comparison would rest on.
 *
 * So: `modelUsed` must be assigned from something ending in `.model`, or from an explicit
 * non-LLM marker in NON_LLM_MARKERS. Nothing else.
 */

import * as fs from 'fs'
import * as path from 'path'

const SRC = path.join(__dirname, '../..')

/** Legitimate non-LLM provenance values — these rows were not produced by a model call. */
const NON_LLM_MARKERS = ['inline-extraction', 'template-entry']

/** Assignment sites only (`modelUsed: <expr>`), not type declarations or field selections. */
const ASSIGN = /modelUsed:\s*(.+?)(?:,|\s*$|\s*\})/

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

function isAcceptable(expr: string): boolean {
  const e = expr.trim().replace(/;$/, '')
  if (/\.model\b/.test(e)) return true                      // <response>.model — the only live source
  // Pass-through: forwarding a value a CALLER supplied (e.g. `input.modelUsed`). Safe, because
  // every producer site is an assignment checked by this same rule — a bad value cannot enter
  // through the pass-through without being flagged where it originates.
  if (/\.modelUsed\b/.test(e)) return true
  const literal = e.match(/^['"](.+)['"]$/)                 // explicit non-LLM marker
  if (literal && NON_LLM_MARKERS.includes(literal[1])) return true
  if (/^(string|string \| null|true|boolean)$/.test(e)) return true  // type decls / prisma selects
  return false
}

describe('model provenance', () => {
  it('is always sourced from the response, never a constant, parameter or plan field', () => {
    const violations: string[] = []

    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file)
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim()
        if (t.startsWith('*') || t.startsWith('//')) return
        const m = t.match(ASSIGN)
        if (!m) return
        if (!isAcceptable(m[1])) violations.push(`${rel}:${i + 1} — modelUsed: ${m[1].trim()}`)
      })
    }

    expect(violations).toEqual([])
  })
})
