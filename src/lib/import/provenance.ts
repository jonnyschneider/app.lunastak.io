/**
 * Which tool produced a context bundle.
 *
 * WHY THIS EXISTS. Four tools emit bundles — the Claude Code plugin, a self-built Claude Project,
 * a Custom GPT and a Gemini Gem — and until now nothing recorded which. `Fragment` stored only
 * `sourceType: 'import'` and a bare `importBatchId`; the one discriminating signal, `mode`, lived
 * in Statsig and never reached the database. Three of the four routes emit byte-identical bundles,
 * so they were not merely unrecorded but indistinguishable.
 *
 * ⚠ `generatedBy` IS SELF-REPORTED AND UNTRUSTED. It is a string an LLM was instructed to write,
 * inside a JSON blob the user can paste anything into. It can be absent, misspelled, hallucinated
 * or hand-edited. So it is validated against a closed set and anything unrecognised becomes
 * `unknown` — a free-text model-authored string must never reach a metrics dimension, because one
 * hallucinated value becomes a permanent phantom row in every breakdown thereafter.
 *
 * ⚠ NULL IS NOT A CATEGORY. Absent means "pre-instrumentation, or a stale installed plugin, or a
 * hosted assistant not yet republished" — three quite different things that cannot be told apart.
 * Expect null to dominate for weeks after launch. Do not chart it as a source.
 *
 * The `-published` values exist only because we control the published Gem and GPT instruction
 * text. A self-built variant cannot be distinguished from a hosted one any other way.
 *
 * Design: docs/_plans/2026-09-09-bundle-provenance-design.md
 */

/** The closed set. Anything else is `unknown`. */
export const KNOWN_GENERATORS = [
  'claude-project',
  'custom-gpt',
  'custom-gpt-published',
  'gemini-gem',
  'gemini-gem-published',
] as const

/**
 * The plugin reports its version too (`claude-code-plugin@1.1.0`), because it is the one route
 * whose copy updates independently of the app and whose staleness we may need to see.
 */
const PLUGIN_PREFIX = 'claude-code-plugin'

/** Cap the stored value — a version suffix is short, and this is user-supplied text. */
const MAX_LENGTH = 64

export const UNKNOWN_GENERATOR = 'unknown'

/**
 * Normalise a bundle's self-reported producer.
 *
 * @returns `null` when the bundle said nothing (do not treat as a category), the canonical value
 *          when recognised, or `'unknown'` when something was claimed but is not in the set.
 */
export function normaliseGeneratedBy(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string') return UNKNOWN_GENERATOR

  const value = raw.trim().toLowerCase()
  if (value === '') return null
  if (value.length > MAX_LENGTH) return UNKNOWN_GENERATOR

  if ((KNOWN_GENERATORS as readonly string[]).includes(value)) return value

  // `claude-code-plugin` with or without an `@version` suffix. The version is kept as reported —
  // it is only ever displayed or grouped, never parsed for comparison.
  if (value === PLUGIN_PREFIX) return PLUGIN_PREFIX
  if (value.startsWith(PLUGIN_PREFIX + '@')) {
    const version = value.slice(PLUGIN_PREFIX.length + 1)
    // Semver-ish only. A junk suffix means the whole claim is untrustworthy, not just the version.
    if (/^\d+\.\d+\.\d+$/.test(version)) return value
    return UNKNOWN_GENERATOR
  }

  return UNKNOWN_GENERATOR
}
