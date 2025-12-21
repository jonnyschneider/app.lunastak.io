#!/usr/bin/env tsx
/**
 * Regenerate strategy from existing trace context
 *
 * Usage: npx tsx scripts/regenerate.ts <traceId>
 *
 * This script takes a trace ID, loads its extractedContext,
 * and regenerates the strategy without going through the conversation flow.
 * Useful for testing prompt changes or model variations.
 */

import { prisma } from '../src/lib/db';
import { anthropic, CLAUDE_MODEL } from '../src/lib/claude';
import { extractXML } from '../src/lib/utils';
import { StrategyStatements, ExtractedContextVariant, isEmergentContext } from '../src/lib/types';
import { convertLegacyObjectives } from '../src/lib/placeholders';

const GENERATION_PROMPT = `Generate compelling strategy statements based on the comprehensive business context provided.

CORE CONTEXT:
Industry: {industry}
Target Market: {target_market}
Unique Value: {unique_value}

ENRICHMENT DETAILS:
{enrichment}

INSIGHTS FROM CONVERSATION:
Strengths identified:
{strengths}

Emerging themes:
{emerging}

Areas to explore further:
{unexplored}

Guidelines:
- Use the core context as foundation
- Leverage enrichment details to add specificity and differentiation
- Incorporate the strengths and emerging themes identified
- Vision: Should be aspirational, future-focused, and memorable
- Strategy: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)

Format your response as:
<thoughts>Your reasoning about the strategy, referencing specific insights from the context</thoughts>
<statements>
  <vision>The vision statement</vision>
  <strategy>The strategy statement</strategy>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`;

const EMERGENT_GENERATION_PROMPT = `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

INSIGHTS FROM CONVERSATION:
Strengths identified:
{strengths}

Emerging patterns:
{emerging}

Areas to explore further:
{unexplored}

Guidelines:
- Use the emergent themes as your foundation - these represent what actually matters to this business
- Vision: Should be aspirational, future-focused, and memorable
- Strategy: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Use their language and themes - make it feel authentic to their business, not generic corporate speak

Format your response as:
<thoughts>Your reasoning about the strategy, referencing specific themes that emerged</thoughts>
<statements>
  <vision>The vision statement</vision>
  <strategy>The strategy statement</strategy>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`;

async function regenerate(traceId: string) {
  console.log(`\n🔄 Regenerating strategy from trace: ${traceId}\n`);

  // Load original trace
  const originalTrace = await prisma.trace.findUnique({
    where: { id: traceId },
    include: { conversation: true },
  });

  if (!originalTrace) {
    throw new Error(`Trace not found: ${traceId}`);
  }

  console.log('✓ Loaded original trace');
  console.log(`  Conversation: ${originalTrace.conversationId}`);
  console.log(`  Model: ${originalTrace.modelUsed}`);
  if (originalTrace.createdAt) {
    console.log(`  Created: ${originalTrace.createdAt.toISOString()}`);
  }
  console.log();

  const context = originalTrace.extractedContext as ExtractedContextVariant;
  let prompt: string;

  // Build prompt based on context type
  if (isEmergentContext(context)) {
    const themesText = context.themes
      .map(theme => `${theme.theme_name}:\n${theme.content}`)
      .join('\n\n');

    const strengthsText = (context.reflective_summary?.strengths || [])
      .map(s => `- ${s}`)
      .join('\n');

    const emergingText = (context.reflective_summary?.emerging || [])
      .map(e => `- ${e}`)
      .join('\n');

    const opportunitiesText = (context.reflective_summary?.opportunities_for_enrichment || [])
      .map((opp: string) => `- ${opp}`)
      .join('\n');

    prompt = EMERGENT_GENERATION_PROMPT
      .replace('{themes}', themesText)
      .replace('{strengths}', strengthsText || 'None identified')
      .replace('{emerging}', emergingText || 'None identified')
      .replace('{unexplored}', opportunitiesText || 'None identified');
  } else {
    const enrichmentText = Object.entries(context.enrichment || {})
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
      })
      .join('\n');

    const strengthsText = (context.reflective_summary?.strengths || [])
      .map(s => `- ${s}`)
      .join('\n');

    const emergingText = (context.reflective_summary?.emerging || [])
      .map(e => `- ${e}`)
      .join('\n');

    const opportunitiesText = (context.reflective_summary?.opportunities_for_enrichment || [])
      .map((opp: string) => `- ${opp}`)
      .join('\n');

    prompt = GENERATION_PROMPT
      .replace('{industry}', context.core.industry)
      .replace('{target_market}', context.core.target_market)
      .replace('{unique_value}', context.core.unique_value)
      .replace('{enrichment}', enrichmentText || 'None provided')
      .replace('{strengths}', strengthsText || 'None identified')
      .replace('{emerging}', emergingText || 'None identified')
      .replace('{unexplored}', opportunitiesText || 'None identified');
  }

  console.log('🤖 Calling Claude API...');
  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: prompt
    }],
    temperature: 0.7
  });

  const latency = Date.now() - startTime;
  console.log(`✓ Claude responded in ${latency}ms\n`);

  const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

  const thoughts = extractXML(content, 'thoughts');
  const statementsXML = extractXML(content, 'statements');

  const objectiveStrings = extractXML(statementsXML, 'objectives')
    .split('\n')
    .filter(line => line.trim().length > 0);

  const statements: StrategyStatements = {
    vision: extractXML(statementsXML, 'vision'),
    strategy: extractXML(statementsXML, 'strategy'),
    objectives: convertLegacyObjectives(objectiveStrings),
    initiatives: [],
    principles: []
  };

  // Save new trace
  const newTrace = await prisma.trace.create({
    data: {
      conversationId: originalTrace.conversationId,
      userId: originalTrace.userId,
      extractedContext: originalTrace.extractedContext,
      output: statements as any,
      claudeThoughts: thoughts,
      modelUsed: CLAUDE_MODEL,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs: latency,
    },
  });

  console.log('✓ Saved new trace\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Results:\n');
  console.log(`  Original trace: ${traceId}`);
  console.log(`  New trace:      ${newTrace.id}`);
  console.log(`\n  View at: http://localhost:3000/strategy/${newTrace.id}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 Vision:');
  console.log(`  ${statements.vision}\n`);
  console.log('🎯 Strategy:');
  console.log(`  ${statements.strategy}\n`);
  console.log('📈 Objectives:');
  statements.objectives.forEach((obj, i) => {
    console.log(`  ${i + 1}. ${obj.pithy}`);
  });
  console.log('\n');
}

// Main
const traceId = process.argv[2];

if (!traceId) {
  console.error('\n❌ Error: Trace ID required\n');
  console.log('Usage: npx tsx scripts/regenerate.ts <traceId>\n');
  process.exit(1);
}

regenerate(traceId)
  .then(() => {
    console.log('✅ Regeneration complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
