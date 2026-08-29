/**
 * Incremental synthesis - merges new fragments into existing synthesis
 */

import { createMessage } from '@/lib/claude'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { SynthesisResult, FragmentForSynthesis } from './types'
import { DimensionalSynthesis } from '@prisma/client'
import { extractJsonFromResponse } from './extract-json'
import { StructuredProvocation } from '@/lib/types'
import { extractText } from '@/lib/extract-text';

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
      gaps: existingGaps,
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

  // Payload only — task framing and output format are the stage's system block
  // (prompts/stages/incremental-synthesis.ts), identical on every call.
  const prompt = [
    `Dimension: ${dimension.replace(/_/g, ' ')}`,
    '',
    '## Existing Synthesis:',
    '',
    'Summary:',
    existingSynthesis.summary || 'No summary yet',
    '',
    'Key Themes:',
    existingSynthesis.keyThemes.map(t => `- ${t}`).join('\n') || 'None',
    '',
    'Gaps:',
    existingGapsText,
    '',
    `Confidence: ${existingSynthesis.confidence}`,
    '',
    '---',
    '',
    '## New Fragments:',
    '',
    newFragmentsText,
  ].join('\n')

  const response = await createMessage({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  }, 'incremental_synthesis')

  const content = extractText(response) || '{}'

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
      gaps: existingGaps,
      confidence: existingSynthesis.confidence as 'HIGH' | 'MEDIUM' | 'LOW'
    }
  }
}
