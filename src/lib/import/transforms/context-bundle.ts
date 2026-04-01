import type { EmergentThemeContract } from '@/lib/contracts/extraction'
import type { ContextBundle } from '../types'
import { createMessage, CLAUDE_MODEL } from '@/lib/claude'
import { extractXML } from '@/lib/utils'

// Map bundle area keys (UPPER_CASE) to extraction dimension keys (lower_case)
const AREA_TO_DIMENSION: Record<string, string> = {
  'CUSTOMER_MARKET': 'customer_market',
  'PROBLEM_OPPORTUNITY': 'problem_opportunity',
  'VALUE_PROPOSITION': 'value_proposition',
  'DIFFERENTIATION_ADVANTAGE': 'differentiation_advantage',
  'COMPETITIVE_LANDSCAPE': 'competitive_landscape',
  'BUSINESS_MODEL_ECONOMICS': 'business_model_economics',
  'BUSINESS_MODEL': 'business_model_economics',
  'GO_TO_MARKET': 'go_to_market',
  'PRODUCT_EXPERIENCE': 'product_experience',
  'CAPABILITIES_ASSETS': 'capabilities_assets',
  'RISKS_CONSTRAINTS': 'risks_constraints',
  'STRATEGIC_INTENT': 'strategic_intent',
}

/**
 * Direct transform: map BundleTheme[] to EmergentThemeContract[]
 * using the area-to-dimension mapping. No LLM call.
 *
 * @deprecated Superseded by transformContextBundle (LLM tagging).
 * Kept for backwards compat with v1 theme-based bundles.
 * Only triggered via explicit ?mode=direct query param.
 * Safe to remove when v1 bundles are no longer in circulation.
 */
export function transformContextBundleDirect(bundle: ContextBundle): EmergentThemeContract[] {
  const themes: EmergentThemeContract[] = []

  for (const theme of bundle.themes || []) {
    const dimensionKey = AREA_TO_DIMENSION[theme.area]
    if (!dimensionKey) continue

    const content = theme.evidence?.length
      ? `${theme.theme}\n\nEvidence:\n${theme.evidence.map(e => `- ${e}`).join('\n')}`
      : theme.theme

    themes.push({
      theme_name: theme.theme || theme.area,
      content,
      dimensions: [{
        name: dimensionKey,
        confidence: (theme.confidence || 'MEDIUM').toLowerCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      }],
    })
  }

  // Transform tensions into insight themes
  for (const tension of bundle.tensions || []) {
    const dims = (tension.areas || [])
      .map(a => AREA_TO_DIMENSION[a])
      .filter(Boolean)
      .map(name => ({ name: name!, confidence: 'MEDIUM' as const }))

    if (dims.length > 0) {
      themes.push({
        theme_name: 'Strategic tension',
        content: tension.tension,
        dimensions: dims,
      })
    }
  }

  return themes
}

// --- Transform mode: LLM dimensional tagging ---

const DIMENSION_TAGGING_PROMPT = `Tag each chunk with 1-3 strategic dimensions.

DIMENSIONS:
1. customer_market - Who we serve, their problems, buying behaviour
2. problem_opportunity - Problem space, opportunity size, why now
3. value_proposition - What we offer, how it solves problems
4. differentiation_advantage - What makes us unique, defensibility
5. competitive_landscape - Who else plays, positioning
6. business_model_economics - How we create/capture value, pricing
7. go_to_market - Sales strategy, channels, distribution
8. product_experience - The experience, usability, journey
9. capabilities_assets - Team, technology, IP
10. risks_constraints - What could go wrong, dependencies
11. strategic_intent - Vision, mission, long-term goals

CHUNKS:
{chunks}

For each chunk, output:
<tagging>
  <chunk index="0">
    <dimension name="dimension_key" confidence="high|medium|low"/>
  </chunk>
</tagging>`

/**
 * Transform mode: convert BundleChunk[] to EmergentThemeContract[]
 * using LLM for dimensional tagging. The chunks have topic/content
 * but no dimension assignments — Luna tags them.
 */
export async function transformContextBundle(bundle: ContextBundle): Promise<EmergentThemeContract[]> {
  const chunks = bundle.chunks || []
  if (chunks.length === 0) return []

  // Build chunks text for prompt
  const chunksText = chunks
    .map((c, i) => `[${i}] ${c.topic}\n${c.content}`)
    .join('\n\n---\n\n')

  // LLM call for dimensional tagging — batch in groups of 20 to avoid truncation
  const BATCH_SIZE = 20
  const tagsByIndex: Map<number, { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[]> = new Map()

  for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
    const batchChunks = chunks.slice(batchStart, batchStart + BATCH_SIZE)
    const batchText = batchChunks
      .map((c, i) => `[${batchStart + i}] ${c.topic}\n${c.content}`)
      .join('\n\n---\n\n')

    const response = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: Math.max(4000, batchChunks.length * 150),
      messages: [{ role: 'user', content: DIMENSION_TAGGING_PROMPT.replace('{chunks}', batchText) }],
      temperature: 0.3,
    }, 'import_dimension_tagging')

    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const taggingXML = extractXML(responseText, 'tagging')

    // Parse tags per chunk
    const chunkTagRegex = /<chunk index="(\d+)">([\s\S]*?)<\/chunk>/g
    const dimensionRegex = /<dimension\s+name="([^"]+)"\s+confidence="([^"]+)"\s*\/>/g

    let chunkMatch
    while ((chunkMatch = chunkTagRegex.exec(taggingXML)) !== null) {
      const index = parseInt(chunkMatch[1])
      const chunkContent = chunkMatch[2]
      const dims: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[] = []

      let dimMatch
      while ((dimMatch = dimensionRegex.exec(chunkContent)) !== null) {
        dims.push({ name: dimMatch[1], confidence: dimMatch[2].toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW' })
      }
      tagsByIndex.set(index, dims)
    }
  }

  // Build EmergentThemeContract[] from chunks + tags
  const untaggedCount = chunks.filter((_, i) => !tagsByIndex.has(i)).length
  if (untaggedCount > 0) {
    console.warn(`[Import] WARNING: ${untaggedCount}/${chunks.length} chunks fell through to fallback tagging (strategic_intent/LOW)`)
  }

  const themes: EmergentThemeContract[] = chunks.map((chunk, i) => {
    const sourceAttr = chunk.sources?.length
      ? `\n\nSource: ${chunk.sources.join(', ')}`
      : ''

    return {
      theme_name: chunk.topic,
      content: chunk.content + sourceAttr,
      dimensions: tagsByIndex.get(i) || [{ name: 'strategic_intent', confidence: 'LOW' as const }],
    }
  })

  // Also transform tensions
  for (const tension of bundle.tensions || []) {
    themes.push({
      theme_name: 'Strategic tension',
      content: tension.tension,
      dimensions: [{ name: 'risks_constraints', confidence: 'MEDIUM' as const }],
    })
  }

  console.log(`[Import] LLM tagged ${chunks.length} chunks into ${themes.length} themes`)

  return themes
}
