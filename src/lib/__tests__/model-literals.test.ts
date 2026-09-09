/**
 * Ratchet: model IDs live in one place.
 *
 * A hardcoded 'claude-*' literal at a call site bypasses the per-context model
 * map — it silently pins that stage to one model, which is exactly the bug
 * suggest-opposite/route.ts carried (a stale claude-sonnet-4-20250514, a full
 * generation behind the rest of the app, unnoticed for months).
 *
 * Model IDs belong in @/lib/model-config.
 *
 * Design: docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md
 */

import * as fs from 'fs'
import * as path from 'path'

const SRC = path.join(__dirname, '../..')

/**
 * The only files allowed to name a model.
 *
 * The bar for entry is narrow: a file may name models when models ARE its
 * subject (resolution, rate tables) — never to pick one at a call site, which
 * is the bug this ratchet exists to prevent. Shrink this set where you can;
 * grow it only with a reason written down.
 */
const ALLOW = [
  'lib/llm/policy.ts',          // the per-stage table — where a stage's model IS the subject
  'lib/model-config.ts',        // resolution — reads the table, applies env overrides
  'lib/experiment/pricing.ts',  // $/MTok rate table, keyed by model prefix
]

/*
 * `lib/llm/policy.ts` added 2026-08-27. STAGE_MODELS moved out of model-config
 * and into the exhaustive policy table, so the per-stage map now lives there.
 * This is the opposite of the bug the ratchet guards: policy.ts IS the map a
 * call site would otherwise bypass. model-config still owns resolution — env
 * override precedence, sampling-param stripping, headroom, timeouts.
 */

/*
 * Narrowed 2026-09-09: a model ID always carries a version number, so require a DIGIT.
 *
 * The original `claude-[a-z0-9-]+` matched any quoted string starting `claude-`, which caught
 * `'claude-project'` and `'claude-code-plugin'` in lib/import/provenance.ts — bundle-producer
 * names, not models. Neither can pin a stage to a model, which is the only thing this ratchet
 * exists to prevent.
 *
 * The fix is NOT to allow-list provenance.ts: the allow set is for files where models ARE the
 * subject, and adding one would let a genuine stale model ID hide there forever. Requiring a
 * digit keeps every real ID in scope — claude-opus-5, claude-sonnet-4-5-20250929,
 * claude-haiku-4-5-20251001, claude-3-5-sonnet-20241022 — while letting non-model `claude-*`
 * strings through. Any future family still carries a version, so this does not rot.
 */
const MODEL_LITERAL = /['"]claude-[a-z0-9.-]*\d[a-z0-9.-]*['"]/

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

describe('model literals', () => {
  it('are confined to model-config', () => {
    const violations: string[] = []

    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file)
      if (ALLOW.includes(rel)) continue

      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (MODEL_LITERAL.test(line)) violations.push(`${rel}:${i + 1}`)
      })
    }

    expect(violations).toEqual([])
  })
})
