#!/usr/bin/env tsx
/**
 * Backfill extraction from existing conversation
 *
 * Re-runs emergent extraction on a conversation to create fragments and synthesis.
 * Useful for:
 * - Conversations that failed extraction
 * - Conversations that used baseline instead of emergent
 * - Recovery of extraction data for evals
 *
 * Usage:
 *   npm run backfill:extraction <conversationId>
 *
 * Example:
 *   npm run backfill:extraction cmjz4zjdi0001a4kzehxif92h
 */

import { prisma } from '@/lib/db'
import { anthropic, CLAUDE_MODEL } from '@/lib/claude'
import { extractXML } from '@/lib/utils'
import { createFragmentsFromThemes, ThemeWithDimensions } from '@/lib/fragments'
import { updateAllSyntheses } from '@/lib/synthesis'
import { computeDimensionalCoverageFromInline } from '@/lib/dimensional-analysis'

const EMERGENT_EXTRACTION_PROMPT = `You are analyzing a business strategy conversation. Extract the key themes that emerged naturally from the discussion, and tag each theme with the strategic dimensions it relates to.

Conversation:
{conversation}

STRATEGIC DIMENSIONS (tag each theme with 1-3 relevant dimensions):
1. customer_market - Who we serve, their problems, buying behaviour, market dynamics
2. problem_opportunity - The problem space, opportunity size, why now, market need
3. value_proposition - What we offer, how it solves problems, why it matters
4. differentiation_advantage - What makes us unique, defensibility, moats
5. competitive_landscape - Who else plays, their strengths/weaknesses, positioning
6. business_model_economics - How we create/capture value, unit economics, pricing
7. go_to_market - Sales strategy, customer success, growth channels
8. product_experience - The experience we're creating, usability, customer journey
9. capabilities_assets - What we can do, team, technology, IP
10. risks_constraints - What could go wrong, dependencies, limitations

DO NOT force the conversation into predefined categories. Instead, identify 3-7 key themes that actually emerged and name them based on what was discussed.

Examples of emergent themes (adapt to actual conversation):
- "Customer Pain Points" → dimensions: customer_market, problem_opportunity
- "Market Positioning" → dimensions: competitive_landscape, differentiation_advantage
- "Technical Differentiation" → dimensions: capabilities_assets, differentiation_advantage
- "Growth Economics" → dimensions: business_model_economics, go_to_market

Format your extraction:

<extraction>
  <theme>
    <theme_name>Name that describes this theme</theme_name>
    <content>Detailed summary of what was discussed about this theme</content>
    <dimensions>
      <dimension name="dimension_key" confidence="high|medium|low"/>
      <!-- Include 1-3 most relevant dimensions per theme -->
    </dimensions>
  </theme>
  <!-- Repeat for each emergent theme (3-7 themes) -->
</extraction>`

const REFLECTIVE_SUMMARY_PROMPT = `Based on this business strategy conversation, provide a reflective summary to support strategy development.

Conversation:
{conversation}

IMPORTANT: You MUST respond using ONLY the XML format below. Do not use Markdown. Do not include any text outside the XML tags.

<summary>
  <strengths>
    <strength>First strength - what's clearly articulated and solid</strength>
    <strength>Second strength - another clear anchor point</strength>
  </strengths>

  <emerging>
    <area>First emerging area - themes starting to surface</area>
    <area>Second emerging area - room to develop</area>
  </emerging>

  <opportunities_for_enrichment>
    <opportunity>First opportunity - areas for deeper thinking</opportunity>
    <opportunity>Second opportunity - unexplored territory</opportunity>
  </opportunities_for_enrichment>

  <thought_prompt>An open-ended question to spark further reflection</thought_prompt>
</summary>

Respond with 2-3 strengths, 1-2 emerging areas, and 1-2 opportunities. Keep each item to 1-2 sentences. Output ONLY the XML.`

function extractAllXML(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gs')
  const matches: string[] = []
  let match
  while ((match = regex.exec(xml)) !== null) {
    const value = match[1].trim()
    if (value) {
      matches.push(value)
    }
  }
  return matches
}

interface ParsedTheme {
  theme_name: string
  content: string
  dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[]
}

function parseEmergentThemes(xml: string): ParsedTheme[] {
  const themes: ParsedTheme[] = []
  const themeRegex = /<theme>([\s\S]*?)<\/theme>/g
  let match

  while ((match = themeRegex.exec(xml)) !== null) {
    const themeXML = match[1]
    const theme_name = extractXML(themeXML, 'theme_name')
    const content = extractXML(themeXML, 'content')

    // Parse inline dimensions
    const dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[] = []
    const dimensionRegex = /<dimension\s+name="([^"]+)"\s+confidence="([^"]+)"\s*\/>/g
    let dimMatch

    while ((dimMatch = dimensionRegex.exec(themeXML)) !== null) {
      const name = dimMatch[1]
      const confidence = dimMatch[2].toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW'
      if (['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) {
        dimensions.push({ name, confidence })
      }
    }

    if (theme_name && content) {
      themes.push({ theme_name, content, dimensions })
    }
  }

  return themes
}

async function backfillExtraction(conversationId: string) {
  console.log(`\n🔄 Backfilling extraction for conversation: ${conversationId}\n`)

  // 1. Load conversation with messages
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  })

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  console.log(`📝 Found conversation:`)
  console.log(`   Project ID: ${conversation.projectId || 'NULL'}`)
  console.log(`   Experiment: ${conversation.experimentVariant}`)
  console.log(`   Messages: ${conversation.messages.length}`)
  console.log(`   Status: ${conversation.status}`)

  if (!conversation.projectId) {
    throw new Error('Conversation has no projectId - cannot create fragments')
  }

  // 2. Build conversation history
  const conversationHistory = conversation.messages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n')

  console.log(`\n🤖 Running emergent extraction...`)

  // 3. Run extraction
  const extractionPrompt = EMERGENT_EXTRACTION_PROMPT.replace('{conversation}', conversationHistory)

  const extractionResponse = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: extractionPrompt }],
  })

  const extractionXML = extractionResponse.content[0].type === 'text'
    ? extractionResponse.content[0].text
    : ''

  // 4. Parse themes
  const themes = parseEmergentThemes(extractionXML)
  console.log(`\n✨ Extracted ${themes.length} themes:`)
  themes.forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.theme_name}`)
    console.log(`      Dimensions: ${t.dimensions.map(d => `${d.name}(${d.confidence})`).join(', ')}`)
  })

  // 5. Generate reflective summary
  console.log(`\n🤔 Generating reflective summary...`)
  const summaryPrompt = REFLECTIVE_SUMMARY_PROMPT.replace('{conversation}', conversationHistory)

  const summaryResponse = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: summaryPrompt }],
    temperature: 0.5,
  })

  const summaryContent = summaryResponse.content[0].type === 'text'
    ? summaryResponse.content[0].text
    : ''

  // Debug: show raw response
  console.log(`\n   [Debug] Raw summary response length: ${summaryContent.length}`)
  console.log(`   [Debug] First 500 chars:`)
  console.log(`   ${summaryContent.substring(0, 500)}`)
  console.log(`\n   [Debug] Last 200 chars:`)
  console.log(`   ${summaryContent.substring(summaryContent.length - 200)}`)
  console.log(`\n   [Debug] Has </summary>: ${summaryContent.includes('</summary>')}`)

  const summaryXML = extractXML(summaryContent, 'summary')
  console.log(`   [Debug] Extracted summary XML length: ${summaryXML.length}`)
  if (summaryXML.length > 0) {
    console.log(`   [Debug] First 500 chars of extracted:`)
    console.log(`   ${summaryXML.substring(0, 500)}`)
  }

  const reflective_summary = {
    strengths: extractAllXML(summaryXML, 'strength'),
    emerging: extractAllXML(summaryXML, 'area'),
    opportunities_for_enrichment: extractAllXML(summaryXML, 'opportunity'),
    thought_prompt: extractXML(summaryXML, 'thought_prompt') || undefined,
  }

  console.log(`\n   Strengths: ${reflective_summary.strengths.length}`)
  console.log(`   Emerging: ${reflective_summary.emerging.length}`)
  console.log(`   Opportunities: ${reflective_summary.opportunities_for_enrichment.length}`)
  if (reflective_summary.thought_prompt) {
    console.log(`   Thought prompt: "${reflective_summary.thought_prompt.substring(0, 50)}..."`)
  }

  // 6. Build complete extractedContext
  const extractedContext = {
    themes,
    reflective_summary,
    extraction_approach: 'emergent' as const,
  }

  // 7. Compute dimensional coverage
  const dimensionalCoverage = computeDimensionalCoverageFromInline(themes)
  console.log(`\n📊 Dimensional Coverage:`)
  console.log(`   Covered: ${dimensionalCoverage.summary.dimensionsCovered}/10`)
  console.log(`   Percentage: ${dimensionalCoverage.summary.coveragePercentage}%`)
  if (dimensionalCoverage.summary.gaps.length > 0) {
    console.log(`   Gaps: ${dimensionalCoverage.summary.gaps.join(', ')}`)
  }

  // 8. Create fragments
  console.log(`\n💾 Creating fragments...`)
  const fragments = await createFragmentsFromThemes(
    conversation.projectId,
    conversationId,
    themes as ThemeWithDimensions[]
  )
  console.log(`   Created ${fragments.length} fragments`)

  // 9. Create ExtractionRun record
  console.log(`\n📝 Creating ExtractionRun record...`)
  const extractionRun = await prisma.extractionRun.create({
    data: {
      conversationId,
      projectId: conversation.projectId,
      experimentVariant: 'emergent-extraction-e1a',
      fragmentIds: fragments.map(f => f.id),
      modelUsed: CLAUDE_MODEL,
    },
  })
  console.log(`   ExtractionRun ID: ${extractionRun.id}`)

  // 10. Create new Trace with complete extractedContext
  console.log(`\n📝 Creating Trace with complete extractedContext...`)
  const totalTokens =
    extractionResponse.usage.input_tokens +
    extractionResponse.usage.output_tokens +
    summaryResponse.usage.input_tokens +
    summaryResponse.usage.output_tokens

  const trace = await prisma.trace.create({
    data: {
      conversationId,
      projectId: conversation.projectId,
      userId: conversation.userId,
      extractedContext: extractedContext as any,
      dimensionalCoverage: dimensionalCoverage as any,
      output: {}, // Empty - this is just for extraction, not generation
      modelUsed: CLAUDE_MODEL,
      totalTokens,
      promptTokens: extractionResponse.usage.input_tokens + summaryResponse.usage.input_tokens,
      completionTokens: extractionResponse.usage.output_tokens + summaryResponse.usage.output_tokens,
      latencyMs: 0, // Not tracking latency in backfill
    },
  })
  console.log(`   Trace ID: ${trace.id}`)

  // 11. Trigger synthesis
  console.log(`\n🔄 Updating syntheses...`)
  await updateAllSyntheses(conversation.projectId)
  console.log(`   Syntheses updated`)

  // 12. Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Backfill complete!`)
  console.log(`   Conversation: ${conversationId}`)
  console.log(`   Themes: ${themes.length}`)
  console.log(`   Fragments: ${fragments.length}`)
  console.log(`   ExtractionRun: ${extractionRun.id}`)
  console.log(`   Trace: ${trace.id}`)
  console.log(`\n   View extraction: http://localhost:3000/extraction/${conversationId}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  return {
    themes,
    fragments,
    extractionRun,
    trace,
    extractedContext,
    dimensionalCoverage,
  }
}

// Main
const conversationId = process.argv[2]

if (!conversationId) {
  console.error('\n❌ Error: Conversation ID required\n')
  console.log('Usage:')
  console.log('  npm run backfill:extraction <conversationId>\n')
  console.log('Example:')
  console.log('  npm run backfill:extraction cmjz4zjdi0001a4kzehxif92h\n')
  process.exit(1)
}

backfillExtraction(conversationId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message || error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
