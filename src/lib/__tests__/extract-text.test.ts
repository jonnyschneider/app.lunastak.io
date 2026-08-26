/**
 * extractText() — read model output across ALL text blocks.
 *
 * Why this exists (found 2026-08-26, verified against the live API):
 *
 * Every call site read `response.content[0]`, which was safe only while
 * responses contained exactly one block. On the Claude 5 family with adaptive
 * thinking, a `thinking` block is returned FIRST:
 *
 *   claude-sonnet-4-5  -> [text]
 *   claude-sonnet-5    -> [text]              (thinking omitted on simple prompts)
 *   claude-opus-5      -> [thinking, text]    <-- content[0] is NOT the text
 *
 * So `content[0]?.type === 'text' ? ... : ''` silently discarded a perfectly
 * good response and returned the empty-string fallback. Nothing threw. On Opus 5
 * that would have happened on essentially every call.
 */

import { extractText } from '@/lib/extract-text'

describe('extractText', () => {
  it('reads a plain single text block', () => {
    expect(extractText({ content: [{ type: 'text', text: 'hello' }] })).toBe('hello')
  })

  it('SKIPS a leading thinking block — the Opus 5 shape', () => {
    expect(extractText({
      content: [
        { type: 'thinking', thinking: 'let me consider...' },
        { type: 'text', text: 'the real answer' },
      ],
    })).toBe('the real answer')
  })

  it('joins multiple text blocks in order', () => {
    expect(extractText({
      content: [
        { type: 'thinking', thinking: '...' },
        { type: 'text', text: 'part one ' },
        { type: 'text', text: 'part two' },
      ],
    })).toBe('part one part two')
  })

  it('ignores redacted_thinking and tool_use blocks', () => {
    expect(extractText({
      content: [
        { type: 'redacted_thinking', data: 'xxx' },
        { type: 'tool_use', id: 't1', name: 'x', input: {} },
        { type: 'text', text: 'answer' },
      ],
    })).toBe('answer')
  })

  it('returns empty string when there is genuinely no text', () => {
    expect(extractText({ content: [{ type: 'thinking', thinking: '...' }] })).toBe('')
    expect(extractText({ content: [] })).toBe('')
  })

  it('never throws on a malformed response', () => {
    expect(extractText({} as never)).toBe('')
    expect(extractText(null as never)).toBe('')
    expect(extractText({ content: null } as never)).toBe('')
  })
})
