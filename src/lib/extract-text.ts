/**
 * Reading model output safely.
 *
 * Standalone and side-effect free ON PURPOSE: `@/lib/claude` throws at import
 * when ANTHROPIC_API_KEY is absent, so it cannot be imported by tests or by
 * pure code paths.
 */

/**
 * Read the model's visible text from a response.
 *
 * Use this instead of `response.content[0].text`. Responses are NOT guaranteed
 * to have the text first: on the Claude 5 family with adaptive thinking, a
 * `thinking` block is returned FIRST, so indexing block 0 yields the thinking
 * block and any `type === 'text'` guard falls through to its empty-string
 * fallback — silently discarding a good response (verified against the live API
 * 2026-08-26: opus-5 returns [thinking, text]).
 *
 * Joins every text block in order and ignores thinking / redacted_thinking /
 * tool_use. Returns '' rather than throwing on a malformed response.
 */
export function extractText(response: unknown): string {
  const content = (response as { content?: unknown })?.content
  if (!Array.isArray(content)) return ''

  return content
    .filter((b): b is { type: string; text?: string } =>
      Boolean(b) && (b as { type?: string }).type === 'text')
    .map(b => b.text ?? '')
    .join('')
}
