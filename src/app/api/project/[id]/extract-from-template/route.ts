import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { createFragmentsFromThemes, ThemeWithDimensions } from '@/lib/fragments';
import type { StrategyStatements } from '@/lib/types';

interface ExtractBody {
  statements: StrategyStatements;
  traceId: string;
}

/**
 * POST /api/project/[id]/extract-from-template
 * Extracts fragments post-hoc from user-entered Decision Stack content.
 * Called asynchronously after template entry.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  let body: ExtractBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { statements, traceId } = body;

  if (!statements || !traceId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Build content for extraction
  const principlesText = statements.principles.length > 0
    ? statements.principles.map((p) => `- ${p.priority} even over ${p.deprioritized}`).join('\n')
    : 'None specified';

  const content = `
Vision: ${statements.vision}

Strategy: ${statements.strategy}

Objectives:
${statements.objectives.map((o) => `- ${o.pithy}${o.metric?.summary ? ` (${o.metric.summary})` : ''}`).join('\n')}

Principles:
${principlesText}
`.trim();

  console.log('[Extract Template] Extracting themes from template entry:', projectId);

  try {
    // Extract themes using Claude
    const response = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Extract strategic themes from this Decision Stack. Return as JSON array with format:
[{
  "theme_name": "Theme title",
  "content": "Key insight or context extracted from the Decision Stack",
  "dimensions": [{ "name": "dimension_name", "confidence": "HIGH" | "MEDIUM" | "LOW" }]
}]

Valid dimension names:
- customer_market
- problem_opportunity
- value_proposition
- differentiation_advantage
- competitive_landscape
- business_model_economics
- go_to_market
- product_experience
- capabilities_assets
- risks_constraints
- strategic_intent

Extract 3-6 meaningful themes that capture the strategic essence. Focus on:
- Market positioning and target segments
- Key differentiators and value proposition
- Strategic priorities and trade-offs
- Success metrics and goals

Decision Stack:
${content}`,
        },
      ],
    }, 'template_extraction');

    // Parse themes from JSON in response
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    let themes: ThemeWithDimensions[] = [];
    if (jsonMatch) {
      try {
        themes = JSON.parse(jsonMatch[0]);
      } catch {
        console.log('[Extract Template] Failed to parse JSON from response');
      }
    }

    if (themes.length === 0) {
      console.log('[Extract Template] No themes extracted');
      return NextResponse.json({ fragmentsCreated: 0 });
    }

    // Create a synthetic conversation ID for template entries
    const syntheticConversationId = `template-${traceId}`;

    // Verify the conversation exists (created by template-entry)
    const conversation = await prisma.conversation.findFirst({
      where: {
        projectId,
        id: syntheticConversationId,
      },
    });

    // If no synthetic conversation, find the actual one from the trace
    let conversationId = syntheticConversationId;
    if (!conversation) {
      const trace = await prisma.trace.findUnique({
        where: { id: traceId },
        select: { conversationId: true },
      });
      if (trace) {
        conversationId = trace.conversationId;
      }
    }

    // Create fragments
    const fragments = await createFragmentsFromThemes(
      projectId,
      conversationId,
      themes
    );

    console.log(`[Extract Template] Created ${fragments.length} fragments from template`);

    return NextResponse.json({ fragmentsCreated: fragments.length });
  } catch (error) {
    console.error('[Extract Template] Error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
