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
