import { readFileSync } from 'fs'
import { join } from 'path'
import { extractJsonFromResponse } from '../synthesis/extract-json'

describe('extractJsonFromResponse', () => {
  it('returns clean JSON when input is already valid', () => {
    const input = '{"summary": "test", "confidence": "HIGH"}'
    expect(extractJsonFromResponse(input)).toBe(input)
  })

  it('removes markdown code block with json tag', () => {
    const input = '```json\n{"summary": "test"}\n```'
    expect(extractJsonFromResponse(input)).toBe('{"summary": "test"}')
  })

  it('removes markdown code block without json tag', () => {
    const input = '```\n{"summary": "test"}\n```'
    expect(extractJsonFromResponse(input)).toBe('{"summary": "test"}')
  })

  it('extracts JSON from preamble text', () => {
    const input = `Here is the synthesized understanding in JSON format:

{"summary": "test", "confidence": "MEDIUM"}`
    const result = extractJsonFromResponse(input)
    expect(JSON.parse(result)).toEqual({
      summary: 'test',
      confidence: 'MEDIUM'
    })
  })

  it('extracts JSON with complex preamble', () => {
    const input = `Here is the synthesized understanding of DIFFERENTIATION ADVANTAGE in valid JSON format:

{
  "summary": "CarbonCortex differentiates itself",
  "keyThemes": ["theme1", "theme2"],
  "confidence": "HIGH"
}`
    const result = extractJsonFromResponse(input)
    const parsed = JSON.parse(result)
    expect(parsed.summary).toBe('CarbonCortex differentiates itself')
    expect(parsed.keyThemes).toEqual(['theme1', 'theme2'])
  })

  it('handles trailing text after JSON', () => {
    const input = `{"summary": "test"}

Let me know if you need any clarification.`
    const result = extractJsonFromResponse(input)
    expect(JSON.parse(result)).toEqual({ summary: 'test' })
  })

  it('handles nested objects correctly', () => {
    const input = `Here is the result:
{
  "summary": "test",
  "subdimensions": {
    "pricing": {"value": 100},
    "packaging": {"value": 200}
  }
}`
    const result = extractJsonFromResponse(input)
    const parsed = JSON.parse(result)
    expect(parsed.subdimensions.pricing.value).toBe(100)
  })

  it('handles arrays in JSON', () => {
    const input = `{
  "keyThemes": ["theme1", "theme2", "theme3"],
  "gaps": []
}`
    const result = extractJsonFromResponse(input)
    const parsed = JSON.parse(result)
    expect(parsed.keyThemes).toHaveLength(3)
    expect(parsed.gaps).toHaveLength(0)
  })

  it('preserves whitespace inside strings', () => {
    const input = '{"summary": "This is a\\nmultiline summary"}'
    const result = extractJsonFromResponse(input)
    expect(JSON.parse(result).summary).toBe('This is a\nmultiline summary')
  })

  it('handles case-insensitive markdown tags', () => {
    const input = '```JSON\n{"test": true}\n```'
    expect(extractJsonFromResponse(input)).toBe('{"test": true}')
  })
})

/**
 * Raw control characters inside string literals.
 *
 * The models routinely emit a literal newline inside a JSON string rather than
 * an escaped `\n`. `JSON.parse` rejects that ("Bad control character in string
 * literal"), and `fullSynthesis()` / `incrementalSynthesis()` catch the throw and
 * return an EMPTY synthesis with a "Synthesis failed" placeholder gap — silently,
 * with only a console.error.
 *
 * Measured 2026-08-27 over 40 real `full_synthesis` outputs (claude-sonnet-5):
 * 7 failed, 17.5%. `full_synthesis` runs 10-21 times per generation, so roughly
 * 2-4 dimensions per generation were being discarded, and those syntheses feed
 * both refresh generation and the knowledge summary.
 *
 * Findings: Drive Test-Data/2026-08-27-seam-consolidation/findings-phase1.md
 */
describe('raw control characters inside string literals', () => {
  it('parses a string containing a literal newline', () => {
    const input = '{"summary": "First para.\n\nSecond para."}'
    const parsed = JSON.parse(extractJsonFromResponse(input))
    expect(parsed.summary).toBe('First para.\n\nSecond para.')
  })

  it('parses literal tabs and carriage returns', () => {
    const input = '{"a": "x\ty", "b": "p\r\nq"}'
    const parsed = JSON.parse(extractJsonFromResponse(input))
    expect(parsed.a).toBe('x\ty')
    expect(parsed.b).toBe('p\r\nq')
  })

  it('leaves already-escaped sequences alone', () => {
    const input = '{"summary": "First.\\n\\nSecond.", "path": "C:\\\\tmp"}'
    const parsed = JSON.parse(extractJsonFromResponse(input))
    expect(parsed.summary).toBe('First.\n\nSecond.')
    expect(parsed.path).toBe('C:\\tmp')
  })

  it('does not disturb newlines BETWEEN tokens', () => {
    const input = '{\n  "a": 1,\n  "b": 2\n}'
    expect(JSON.parse(extractJsonFromResponse(input))).toEqual({ a: 1, b: 2 })
  })

  it('parses a real captured full_synthesis response that used to fail', () => {
    const raw = readFileSync(
      join(__dirname, '../synthesis/__fixtures__/raw-newline-in-string.json.txt'), 'utf8')
    const parsed = JSON.parse(extractJsonFromResponse(raw))
    expect(parsed.summary).toBeTruthy()
    expect(parsed.summary.length).toBeGreaterThan(200)
    expect(Array.isArray(parsed.gaps)).toBe(true)
    // the failure mode this guards: an empty synthesis with a placeholder gap
    expect(parsed.gaps[0].title).not.toBe('Synthesis failed')
  })
})
