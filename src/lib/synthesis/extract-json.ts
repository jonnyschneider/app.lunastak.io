/**
 * Extract JSON from LLM responses that may include preamble text
 */

/**
 * Cleans LLM response and extracts JSON object
 * Handles:
 * - Markdown code blocks (```json ... ```)
 * - Preamble text before JSON
 * - Trailing text after JSON
 * - Raw control characters inside string literals (see below)
 *
 * ## Raw control characters
 *
 * The models routinely emit a LITERAL newline inside a JSON string rather than an
 * escaped `\n`. `JSON.parse` rejects that outright, and both callers
 * (`fullSynthesis`, `incrementalSynthesis`) catch the throw and return an EMPTY
 * synthesis carrying a "Synthesis failed" placeholder gap — silently, with only a
 * console.error to show for it.
 *
 * Measured 2026-08-27 across 40 real `full_synthesis` responses (claude-sonnet-5):
 * **7 failed, 17.5%**. That stage runs 10-21 times per generation, so roughly 2-4
 * dimensions per generation were being discarded, and the empty results propagate
 * into refresh generation and the knowledge summary.
 *
 * Evidence: Drive `Test-Data/2026-08-27-seam-consolidation/findings-phase1.md`.
 *
 * So the brace-matching walk below — which already has to track string and escape
 * state to find the closing brace — also escapes any control character it sees
 * inside a string. Newlines BETWEEN tokens are untouched; only those inside string
 * literals are illegal JSON.
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

  // Find matching closing brace by counting, repairing control characters inside
  // string literals as we go. One pass: the walk already tracks the state needed.
  const CONTROL_ESCAPES: Record<string, string> = {
    '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f',
  }

  const out: string[] = []
  let depth = 0
  let inString = false
  let escaped = false
  let endIndex = -1

  for (let i = startIndex; i < cleaned.length; i++) {
    const char = cleaned[i]
    out.push(char)

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

    if (inString) {
      // Illegal raw control character in a string literal — escape it.
      const known = CONTROL_ESCAPES[char]
      if (known) {
        out[out.length - 1] = known
      } else if (char < ' ') {
        out[out.length - 1] = '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')
      }
      continue
    }

    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) {
        endIndex = i
        break
      }
    }
  }

  return endIndex !== -1 ? out.join('') : cleaned
}
