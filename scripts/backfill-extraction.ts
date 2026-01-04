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

  // 5. Compute dimensional coverage
  const dimensionalCoverage = computeDimensionalCoverageFromInline(themes)
  console.log(`\n📊 Dimensional Coverage:`)
  console.log(`   Covered: ${dimensionalCoverage.summary.dimensionsCovered}/10`)
  console.log(`   Percentage: ${dimensionalCoverage.summary.coveragePercentage}%`)
  if (dimensionalCoverage.summary.gaps.length > 0) {
    console.log(`   Gaps: ${dimensionalCoverage.summary.gaps.join(', ')}`)
  }

  // 6. Create fragments
  console.log(`\n💾 Creating fragments...`)
  const fragments = await createFragmentsFromThemes(
    conversation.projectId,
    conversationId,
    themes as ThemeWithDimensions[]
  )
  console.log(`   Created ${fragments.length} fragments`)

  // 7. Create ExtractionRun record
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

  // 8. Trigger synthesis
  console.log(`\n🔄 Updating syntheses...`)
  await updateAllSyntheses(conversation.projectId)
  console.log(`   Syntheses updated`)

  // 9. Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Backfill complete!`)
  console.log(`   Conversation: ${conversationId}`)
  console.log(`   Themes: ${themes.length}`)
  console.log(`   Fragments: ${fragments.length}`)
  console.log(`   ExtractionRun: ${extractionRun.id}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  return {
    themes,
    fragments,
    extractionRun,
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
