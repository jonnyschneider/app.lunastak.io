/**
 * Incremental synthesis - merges new fragments into existing synthesis
 */

import { createMessage, CLAUDE_MODEL } from '@/lib/claude'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { SynthesisResult, FragmentForSynthesis } from './types'
import { DimensionalSynthesis } from '@prisma/client'
import { extractJsonFromResponse } from './extract-json'
import { StructuredProvocation } from '@/lib/types'

const INCREMENTAL_SYNTHESIS_PROMPT = `You are updating strategic understanding for the dimension: **{dimension}**.

## Existing Synthesis:

Summary:
{existingSummary}

Key Themes:
{existingThemes}

Gaps:
{existingGaps}

Confidence: {existingConfidence}

---

## New Fragments:

{newFragments}

## Your Task:

These new fragments have been added since the last synthesis. Update the existing synthesis by:

1. **Enriching the summary** with new insights (don't rewrite, just enhance)
2. **Adding new themes** if distinct from existing
3. **Adding new quotes** that capture important ideas
4. **Updating gaps** (remove gaps that are now filled, add new gaps discovered). Each gap should have:
   - "title": A punchy, attention-grabbing title (max 60 chars)
   - "description": The full question or explanation of what's missing
5. **Surfacing contradictions** if new fragments conflict with existing understanding
6. **Re-assessing confidence** based on new information

IMPORTANT: Respond with ONLY the JSON object below. No preamble, no explanation, no markdown - just the raw JSON starting with { and ending with }

{"summary": "... (updated) ...", "keyThemes": ["... (existing + new) ..."], "keyQuotes": ["... (existing + new) ..."], "gaps": [{"title": "Short title", "description": "Full explanation"}], "contradictions": ["..."], "subdimensions": null, "confidence": "HIGH"}`

export async function incrementalSynthesis(
  dimension: Tier1Dimension,
  existingSynthesis: DimensionalSynthesis,
  newFragments: FragmentForSynthesis[]
): Promise<SynthesisResult> {
  // Cast gaps from Json to structured type
  const existingGaps = existingSynthesis.gaps as unknown as StructuredProvocation[]

  if (newFragments.length === 0) {
    return {
      summary: existingSynthesis.summary || '',
      keyThemes: existingSynthesis.keyThemes,
      keyQuotes: existingSynthesis.keyQuotes,
      gaps: existingGaps,
      contradictions: existingSynthesis.contradictions,
      subdimensions: existingSynthesis.subdimensions as SynthesisResult['subdimensions'],
      confidence: existingSynthesis.confidence as 'HIGH' | 'MEDIUM' | 'LOW'
    }
  }

  const newFragmentsText = newFragments
    .map((f, i) => `### Fragment ${i + 1}\n${f.content}`)
    .join('\n\n---\n\n')

  // Format existing gaps for prompt
  const existingGapsText = existingGaps.length > 0
    ? existingGaps.map(g => `- ${g.title}: ${g.description}`).join('\n')
    : 'None identified'

  const prompt = INCREMENTAL_SYNTHESIS_PROMPT
    .replace(/{dimension}/g, dimension.replace(/_/g, ' '))
    .replace('{existingSummary}', existingSynthesis.summary || 'No summary yet')
    .replace('{existingThemes}', existingSynthesis.keyThemes.map(t => `- ${t}`).join('\n') || 'None')
    .replace('{existingGaps}', existingGapsText)
    .replace('{existingConfidence}', existingSynthesis.confidence)
    .replace('{newFragments}', newFragmentsText)

  const response = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  }, 'incremental_synthesis')

  const content = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '{}'

  try {
    const cleanedContent = extractJsonFromResponse(content)
    const result = JSON.parse(cleanedContent) as SynthesisResult
    return result
  } catch (error) {
    console.error('[Synthesis] Failed to parse incremental response:', content)
    // Return existing synthesis unchanged on error
    return {
      summary: existingSynthesis.summary || '',
      keyThemes: existingSynthesis.keyThemes,
      keyQuotes: existingSynthesis.keyQuotes,
      gaps: existingGaps,
      contradictions: existingSynthesis.contradictions,
      subdimensions: existingSynthesis.subdimensions as SynthesisResult['subdimensions'],
      confidence: existingSynthesis.confidence as 'HIGH' | 'MEDIUM' | 'LOW'
    }
  }
}
