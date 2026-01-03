/**
 * Full synthesis - creates synthesis from all fragments
 */

import { anthropic, CLAUDE_MODEL } from '@/lib/claude'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { SynthesisResult, FragmentForSynthesis } from './types'

const FULL_SYNTHESIS_PROMPT = `You are synthesizing strategic understanding for the dimension: **{dimension}**.

You have {count} fragments captured from conversations. Your task is to synthesize these into a coherent understanding.

## Fragments:

{fragments}

## Your Task:

Synthesize these fragments into structured understanding:

1. **Summary** (2-3 paragraphs): What do we understand about {dimension}? Use the leader's authentic voice where possible.

2. **Key Themes** (3-7 themes): What are the main ideas? Each theme should be a short phrase or sentence.

3. **Key Quotes** (3-5 quotes): Verbatim quotes that capture the essence. Use exact wording from fragments.

4. **Gaps** (list): What's missing? What would deepen our understanding of {dimension}?

5. **Contradictions** (list): Are there conflicting fragments? Surface tensions, don't hide them.

6. **Subdimensions** (emergent): Are there natural groupings or sub-categories within these fragments? Only include if clearly evident.

7. **Confidence** (HIGH | MEDIUM | LOW): How comprehensive is this understanding?
   - HIGH: 5+ fragments, clear themes, few gaps
   - MEDIUM: 3-5 fragments, some gaps remain
   - LOW: <3 fragments or significant gaps

Return ONLY valid JSON (no markdown code blocks):
{
  "summary": "...",
  "keyThemes": ["...", "..."],
  "keyQuotes": ["...", "..."],
  "gaps": ["...", "..."],
  "contradictions": ["...", "..."],
  "subdimensions": null,
  "confidence": "MEDIUM"
}`

export async function fullSynthesis(
  dimension: Tier1Dimension,
  fragments: FragmentForSynthesis[]
): Promise<SynthesisResult> {
  if (fragments.length === 0) {
    return {
      summary: '',
      keyThemes: [],
      keyQuotes: [],
      gaps: [`No fragments captured yet for ${dimension}`],
      contradictions: [],
      subdimensions: null,
      confidence: 'LOW'
    }
  }

  const fragmentsText = fragments
    .map((f, i) => `### Fragment ${i + 1}\nType: ${f.contentType}\nConfidence: ${f.confidence || 'unknown'}\n\n${f.content}`)
    .join('\n\n---\n\n')

  const prompt = FULL_SYNTHESIS_PROMPT
    .replace(/{dimension}/g, dimension.replace(/_/g, ' '))
    .replace('{count}', String(fragments.length))
    .replace('{fragments}', fragmentsText)

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  })

  const content = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '{}'

  try {
    // Clean up response - remove markdown code blocks if present
    const cleanedContent = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const result = JSON.parse(cleanedContent) as SynthesisResult
    return result
  } catch (error) {
    console.error('[Synthesis] Failed to parse response:', content)
    return {
      summary: '',
      keyThemes: [],
      keyQuotes: [],
      gaps: ['Synthesis failed - could not parse LLM response'],
      contradictions: [],
      subdimensions: null,
      confidence: 'LOW'
    }
  }
}
