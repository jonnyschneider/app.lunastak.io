/**
 * Full synthesis - creates synthesis from all fragments
 */

import { createMessage } from '@/lib/claude'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { SynthesisResult, FragmentForSynthesis } from './types'
import { extractJsonFromResponse } from './extract-json'
import { extractText } from '@/lib/extract-text';

export async function fullSynthesis(
  dimension: Tier1Dimension,
  fragments: FragmentForSynthesis[]
): Promise<SynthesisResult> {
  if (fragments.length === 0) {
    return {
      summary: '',
      gaps: [{
        title: 'No insights yet',
        description: `No fragments captured yet for ${dimension.replace(/_/g, ' ').toLowerCase()}`
      }],
      confidence: 'LOW'
    }
  }

  const fragmentsText = fragments
    .map((f, i) => `### Fragment ${i + 1}\nType: ${f.contentType}\nConfidence: ${f.confidence || 'unknown'}\n\n${f.content}`)
    .join('\n\n---\n\n')

  // The user message carries ONLY what varies per call. The task framing and
  // output format live in the stage's system block (prompts/stages/full-synthesis.ts)
  // so the prefix is identical across all 10-21 calls in a generation and can be
  // cached. The dimension name and fragment count used to open the prompt, which
  // is precisely why no prefix was stable.
  const prompt = [
    `Dimension: ${dimension.replace(/_/g, ' ')}`,
    `Fragments: ${fragments.length}`,
    '',
    fragmentsText,
  ].join('\n')

  const response = await createMessage({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  }, 'full_synthesis')

  const content = extractText(response) || '{}'

  try {
    const cleanedContent = extractJsonFromResponse(content)
    const result = JSON.parse(cleanedContent) as SynthesisResult
    return result
  } catch (error) {
    console.error('[Synthesis] Failed to parse response:', content)
    return {
      summary: '',
      gaps: [{
        title: 'Synthesis failed',
        description: 'Could not parse LLM response - please try again'
      }],
      confidence: 'LOW'
    }
  }
}
