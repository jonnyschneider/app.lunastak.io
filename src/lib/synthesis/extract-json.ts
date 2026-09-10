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
 * ## Unicode punctuation in structural positions
 *
 * A second, distinct class, observed 2026-09-02 on preview: the model closed the
 * `gaps` array and wrote U+3001 IDEOGRAPHIC COMMA where the ASCII comma belonged
 * — `}]\u3001"confidence": "MEDIUM"}`. Not truncation (stop_reason `end_turn`,
 * 1961 of 4000 output tokens) and not a control character, so neither the
 * max_tokens canary nor the escaping above catches it.
 *
 * Reproduced by replaying the exact fragments that failed (PRODUCT_EXPERIENCE,
 * 10 fragments) 12 times: 1 failure, 8%; the other 11 carried no structural
 * non-ASCII at all. It matters more than 8% suggests because the fallback writes
 * "Synthesis failed" into `gaps` — the one synthesis field rendered to the user
 * as a call to action.
 *
 * So the brace-matching walk below — which already has to track string and escape
 * state to find the closing brace — also escapes any control character it sees
 * inside a string. Newlines BETWEEN tokens are untouched; only those inside string
 * literals are illegal JSON.
 *
 * ## Stray structural closers
 *
 * A third class, observed 2026-09-10 during the Costco demo-fixture rerun: the model
 * closed the `summary` string and appended a `]` that closes nothing —
 * `"...the culture running it."], "gaps": [` — where `summary` is a plain string and
 * no array is open. `JSON.parse` reports `Expected ',' or '}' after property value`,
 * pointing at the bracket.
 *
 * 2 of 11 `full_synthesis` calls in one generation, and it hit the LONGEST, most
 * multi-paragraph summaries — the good ones. Both affected dimensions
 * (CAPABILITIES_ASSETS, VALUE_PROPOSITION) landed as empty syntheses carrying the
 * "Synthesis failed" gap, which is the one synthesis field rendered to the user.
 *
 * The walk below previously counted `{`/`}` only and never tracked `[`/`]` at all, so
 * a stray `]` sailed through untouched. It now keeps a container stack and DROPS any
 * closer that does not match what is actually open — the same rule
 * `dropStrayClosingTags` applies to XML, and the same underlying model behaviour:
 * emitting a closing delimiter for a container it never opened. Never invent
 * structure, never close on the model's behalf; only discard what cannot be valid.
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

  // Outside a string literal the only legal characters are `{}[]:,`, whitespace
  // and literals — so a non-ASCII character there is malformed by definition and
  // can be mapped to its ASCII twin without risk of touching content. Only
  // U+3001 has been observed (2026-09-02, see below); the rest are the same
  // class and would fail identically.
  const STRUCTURAL_ASCII: Record<string, string> = {
    '\u3001': ',', // IDEOGRAPHIC COMMA — observed
    '\uff0c': ',', // FULLWIDTH COMMA
    '\uff1a': ':', // FULLWIDTH COLON
    '\uff3b': '[', '\uff3d': ']',
    '\uff5b': '{', '\uff5d': '}',
  }

  const out: string[] = []
  // What is actually open, innermost last — '{' or '['. Counting braces alone cannot
  // tell a legitimate closer from one the model invented; the stack can.
  const open: string[] = []
  const strays: string[] = []
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

    // Structural position — normalise a unicode punctuation look-alike to the
    // ASCII character it stands in for, then treat it as that character.
    const norm = STRUCTURAL_ASCII[char] ?? char
    if (norm !== char) out[out.length - 1] = norm

    if (norm === '{' || norm === '[') {
      open.push(norm)
      continue
    }

    if (norm === '}' || norm === ']') {
      const expected = norm === '}' ? '{' : '['
      if (open[open.length - 1] !== expected) {
        // Closes nothing that is open — model noise, not structure. Drop it, and do
        // NOT touch the stack: the container it pretended to close is still open.
        out.pop()
        strays.push(norm)
        continue
      }
      open.pop()
      if (open.length === 0) {
        endIndex = i
        break
      }
    }
  }

  if (strays.length > 0) {
    console.warn(
      `[extractJson] dropped stray structural closer(s): ${strays.join(' ')} — model closed a container it never opened`
    )
  }

  if (endIndex !== -1) return out.join('')

  /**
   * The walk never closed the root object.
   *
   * ⚠ RETURN THE REPAIRED TEXT REGARDLESS. This previously returned `cleaned` — the
   * UNREPAIRED original — so every control character escaped along the way was thrown
   * away the moment the closing brace was missing. Observed 2026-09-10 (Nike rerun):
   * a complete, well-formed synthesis was reported as `Bad control character in string
   * literal`, naming a newline the repair had already fixed, because the repair was
   * discarded. The reported error pointed at the wrong defect entirely.
   *
   * When the ONLY thing outstanding is the root object's closer — nothing nested is
   * open and we did not end mid-string — the completion is unambiguous, so close it.
   * The Nike response ended `...told about the past?"}]`: the gaps array closed, every
   * value was complete, and the model simply dropped one final `}`. Discarding a whole
   * dimension of synthesis over one character is the worse failure.
   *
   * The guard is deliberately narrow. Ending INSIDE a string, or with nested containers
   * still open, is the signature of a genuinely cut-off response — there we let the
   * caller's catch fire rather than persist a plausible-looking fragment as if it were
   * whole. That distinction is the whole point: complete the punctuation, never the
   * content. (Real truncation has its own canary — `createMessage` warns on a
   * `max_tokens` stop reason. None fired here.)
   */
  if (!inString && open.length === 1 && open[0] === '{') {
    console.warn('[extractJson] closed an unterminated root object — model omitted the final "}"')
    return out.join('') + '}'
  }

  return out.join('')
}
