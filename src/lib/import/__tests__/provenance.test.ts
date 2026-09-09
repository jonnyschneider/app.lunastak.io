/**
 * `generatedBy` is the only field in a bundle that the app trusts about the bundle's own origin,
 * and it is written by an LLM into a blob the user can edit. These tests pin the boundary: a
 * closed set in, `unknown` for anything else, and `null` reserved for "said nothing at all".
 *
 * The distinction that matters: `null` and `'unknown'` are NOT the same. Null means the bundle was
 * silent — an old plugin, a Gem not yet republished, a pre-instrumentation import. `'unknown'`
 * means the bundle claimed something we do not recognise, which is a signal worth seeing.
 */
import { describe, it, expect } from 'vitest'
import { normaliseGeneratedBy, KNOWN_GENERATORS, UNKNOWN_GENERATOR } from '../provenance'

describe('normaliseGeneratedBy', () => {
  it('accepts every value in the closed set', () => {
    for (const g of KNOWN_GENERATORS) expect(normaliseGeneratedBy(g)).toBe(g)
  })

  it('distinguishes "said nothing" from "said something unrecognised"', () => {
    expect(normaliseGeneratedBy(undefined)).toBeNull()
    expect(normaliseGeneratedBy(null)).toBeNull()
    expect(normaliseGeneratedBy('')).toBeNull()
    expect(normaliseGeneratedBy('   ')).toBeNull()

    expect(normaliseGeneratedBy('chatgpt')).toBe(UNKNOWN_GENERATOR)
    expect(normaliseGeneratedBy('Gemini')).toBe(UNKNOWN_GENERATOR)
  })

  it('keeps the plugin version, because plugin copy updates independently of the app', () => {
    expect(normaliseGeneratedBy('claude-code-plugin@1.1.0')).toBe('claude-code-plugin@1.1.0')
    expect(normaliseGeneratedBy('claude-code-plugin')).toBe('claude-code-plugin')
  })

  it('rejects a junk version rather than salvaging the name', () => {
    // A malformed suffix means the whole claim is untrustworthy, not just its tail.
    expect(normaliseGeneratedBy('claude-code-plugin@latest')).toBe(UNKNOWN_GENERATOR)
    expect(normaliseGeneratedBy('claude-code-plugin@')).toBe(UNKNOWN_GENERATOR)
    expect(normaliseGeneratedBy('claude-code-plugin@1.1')).toBe(UNKNOWN_GENERATOR)
  })

  it('normalises case and surrounding whitespace', () => {
    expect(normaliseGeneratedBy('  Custom-GPT  ')).toBe('custom-gpt')
    expect(normaliseGeneratedBy('GEMINI-GEM-PUBLISHED')).toBe('gemini-gem-published')
  })

  it('keeps a hostile value out of the metrics dimension', () => {
    // The whole point of the allow-list: this is user-editable JSON reaching a grouping key.
    expect(normaliseGeneratedBy({ evil: true })).toBe(UNKNOWN_GENERATOR)
    expect(normaliseGeneratedBy(42)).toBe(UNKNOWN_GENERATOR)
    expect(normaliseGeneratedBy(['custom-gpt'])).toBe(UNKNOWN_GENERATOR)
    expect(normaliseGeneratedBy('x'.repeat(500))).toBe(UNKNOWN_GENERATOR)
    expect(normaliseGeneratedBy("'; DROP TABLE \"Fragment\"; --")).toBe(UNKNOWN_GENERATOR)
  })

  it('separates a hosted assistant from a self-built one', () => {
    // The only reason this is possible: we control the published instruction text.
    expect(normaliseGeneratedBy('gemini-gem')).toBe('gemini-gem')
    expect(normaliseGeneratedBy('gemini-gem-published')).toBe('gemini-gem-published')
    expect(normaliseGeneratedBy('custom-gpt')).not.toBe(normaliseGeneratedBy('custom-gpt-published'))
  })
})
