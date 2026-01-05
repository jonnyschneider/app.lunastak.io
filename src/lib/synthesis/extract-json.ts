/**
 * Extract JSON from LLM responses that may include preamble text
 */

/**
 * Cleans LLM response and extracts JSON object
 * Handles:
 * - Markdown code blocks (```json ... ```)
 * - Preamble text before JSON
 * - Trailing text after JSON
 */
export function extractJsonFromResponse(content: string): string {
  // Step 1: Remove markdown code blocks
  let cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  // Step 2: Find the JSON object by matching braces
  const startIndex = cleaned.indexOf('{')
  if (startIndex === -1) {
    return cleaned // No JSON object found
  }

  // Find matching closing brace by counting
  let depth = 0
  let inString = false
  let escaped = false
  let endIndex = -1

  for (let i = startIndex; i < cleaned.length; i++) {
    const char = cleaned[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\' && inString) {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) {
        endIndex = i
        break
      }
    }
  }

  if (endIndex !== -1) {
    cleaned = cleaned.substring(startIndex, endIndex + 1)
  }

  return cleaned
}
