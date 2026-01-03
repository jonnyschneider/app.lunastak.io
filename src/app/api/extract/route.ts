import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ExtractedContext, ExtractionConfidence, Message, isEmergentContext } from '@/lib/types';
import { analyzeDimensionalCoverage } from '@/lib/dimensional-analysis';

export const maxDuration = 60;

const EXTRACTION_PROMPT = `You are analyzing a business strategy conversation. Extract structured information with core fields and enrichment.

Conversation:
{conversation}

Extract the following:

<extraction>
  <core>
    <industry>The specific industry (be specific, not generic)</industry>
    <target_market>The specific customer segment they're targeting</target_market>
    <unique_value>Their key differentiator or unique value proposition</unique_value>
  </core>

  <enrichment>
    <!-- Include any of these if clearly discussed -->
    <competitive_context>Competitive landscape insights (if mentioned)</competitive_context>
    <customer_segments>Specific customer segments (if mentioned)</customer_segments>
    <operational_capabilities>Key operational strengths (if mentioned)</operational_capabilities>
    <technical_advantages>Technical or product advantages (if mentioned)</technical_advantages>
  </enrichment>
</extraction>`;

const EMERGENT_EXTRACTION_PROMPT = `You are analyzing a business strategy conversation. Extract the key themes that emerged naturally from the discussion.

Conversation:
{conversation}

DO NOT force the conversation into predefined categories. Instead, identify 3-7 key themes that actually emerged and name them based on what was discussed.

Examples of emergent themes (adapt to actual conversation):
- "Customer Pain Points" if they discussed specific problems
- "Market Positioning" if they discussed competitive landscape
- "Technical Differentiation" if they discussed unique capabilities
- "Growth Economics" if they discussed business model
- "Operational Challenges" if they discussed execution concerns

Format your extraction:

<extraction>
  <theme>
    <theme_name>Name that describes this theme</theme_name>
    <content>Detailed summary of what was discussed about this theme</content>
  </theme>
  <!-- Repeat for each emergent theme (3-7 themes) -->
</extraction>`;

const REFLECTIVE_SUMMARY_PROMPT = `Based on this business strategy conversation, provide a reflective summary to support strategy development.

Conversation:
{conversation}

Provide:

<summary>
  <strengths>
    <!-- 2-3 strongest anchors from conversation -->
    <strength>What's clearly articulated and solid</strength>
  </strengths>

  <emerging>
    <!-- 1-2 areas with some clarity but room to develop -->
    <area>Themes that started to surface</area>
  </emerging>

  <opportunities_for_enrichment>
    <!-- 1-2 opportunities for further exploration -->
    <opportunity>Areas that could benefit from deeper thinking</opportunity>
  </opportunities_for_enrichment>

  <thought_prompt>Optional open-ended question to spark reflection</thought_prompt>
</summary>`;

function extractAllXML(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'gs');
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const value = match[1].trim();
    if (value) {
      matches.push(value);
    }
  }
  return matches;
}

function parseEmergentThemes(xml: string): { theme_name: string; content: string }[] {
  const themes: { theme_name: string; content: string }[] = [];
  const themeRegex = /<theme>([\s\S]*?)<\/theme>/g;
  let match;

  while ((match = themeRegex.exec(xml)) !== null) {
    const themeXML = match[1];
    const theme_name = extractXML(themeXML, 'theme_name');
    const content = extractXML(themeXML, 'content');

    if (theme_name && content) {
      themes.push({ theme_name, content });
    }
  }

  return themes;
}

export async function POST(req: Request) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Get conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Build conversation history
    const conversationHistory = conversation.messages
      .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n');

    // Determine extraction approach based on experiment variant
    const isEmergent = conversation.experimentVariant === 'emergent-extraction-e1a';
    console.log('[Extract] Conversation details:', {
      conversationId: conversation.id,
      experimentVariant: conversation.experimentVariant,
      isEmergent,
      messageCount: conversation.messages.length,
    });

    const extractionPrompt = isEmergent
      ? EMERGENT_EXTRACTION_PROMPT.replace('{conversation}', conversationHistory)
      : EXTRACTION_PROMPT.replace('{conversation}', conversationHistory);

    // Extract context
    const startTime = Date.now();
    const extractionResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: extractionPrompt
      }],
      temperature: 0.3
    });

    const extractionContent = extractionResponse.content[0]?.type === 'text'
      ? extractionResponse.content[0].text : '';

    const extractionXML = extractXML(extractionContent, 'extraction');

    let extractedContext: any;

    if (isEmergent) {
      // Parse emergent themes
      const themes = parseEmergentThemes(extractionXML);

      // Generate reflective summary (same for both approaches)
      const summaryResponse = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: REFLECTIVE_SUMMARY_PROMPT.replace('{conversation}', conversationHistory)
        }],
        temperature: 0.5
      });

      const summaryContent = summaryResponse.content[0]?.type === 'text'
        ? summaryResponse.content[0].text : '';
      const summaryXML = extractXML(summaryContent, 'summary');

      const reflective_summary = {
        strengths: extractAllXML(summaryXML, 'strength'),
        emerging: extractAllXML(summaryXML, 'area'),
        opportunities_for_enrichment: extractAllXML(summaryXML, 'opportunity'),
        thought_prompt: extractXML(summaryXML, 'thought_prompt') || undefined,
      };

      extractedContext = {
        themes,
        reflective_summary,
        extraction_approach: 'emergent',
      };
    } else {
      // Prescriptive extraction (baseline-v1)
      const coreXML = extractXML(extractionXML, 'core');
      const enrichmentXML = extractXML(extractionXML, 'enrichment');

      const core = {
        industry: extractXML(coreXML, 'industry'),
        target_market: extractXML(coreXML, 'target_market'),
        unique_value: extractXML(coreXML, 'unique_value'),
      };

      const enrichment: any = {};
      if (enrichmentXML) {
        const competitiveContext = extractXML(enrichmentXML, 'competitive_context');
        if (competitiveContext) enrichment.competitive_context = competitiveContext;

        const customerSegments = extractXML(enrichmentXML, 'customer_segments');
        if (customerSegments) enrichment.customer_segments = customerSegments.split(',').map(s => s.trim());

        const operationalCaps = extractXML(enrichmentXML, 'operational_capabilities');
        if (operationalCaps) enrichment.operational_capabilities = operationalCaps;

        const techAdvantages = extractXML(enrichmentXML, 'technical_advantages');
        if (techAdvantages) enrichment.technical_advantages = techAdvantages;
      }

      // Generate reflective summary
      const summaryResponse = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: REFLECTIVE_SUMMARY_PROMPT.replace('{conversation}', conversationHistory)
        }],
        temperature: 0.5
      });

      const summaryContent = summaryResponse.content[0]?.type === 'text'
        ? summaryResponse.content[0].text : '';
      const summaryXML = extractXML(summaryContent, 'summary');

      const reflective_summary = {
        strengths: extractAllXML(summaryXML, 'strength'),
        emerging: extractAllXML(summaryXML, 'area'),
        opportunities_for_enrichment: extractAllXML(summaryXML, 'opportunity'),
        thought_prompt: extractXML(summaryXML, 'thought_prompt') || undefined,
      };

      extractedContext = {
        core,
        enrichment,
        reflective_summary,
        extraction_approach: 'prescriptive',
      };
    }

    console.log('[Extract] Returning extraction data:', {
      extraction_approach: extractedContext.extraction_approach,
      hasCore: 'core' in extractedContext,
      hasThemes: 'themes' in extractedContext,
      keys: Object.keys(extractedContext),
    });

    // [E2] Run dimensional analysis for emergent extraction
    let dimensionalCoverage = null;

    if (isEmergentContext(extractedContext)) {
      console.log('[Extract] Running dimensional analysis...');
      dimensionalCoverage = await analyzeDimensionalCoverage(
        extractedContext,
        conversationHistory
      );

      console.log('[Extract] Dimensional coverage:', {
        dimensionsCovered: dimensionalCoverage.summary.dimensionsCovered,
        coveragePercentage: dimensionalCoverage.summary.coveragePercentage,
        gaps: dimensionalCoverage.summary.gaps,
      });
    }

    return NextResponse.json({
      extractedContext,
      dimensionalCoverage, // [E2] Include in response
    });
  } catch (error) {
    console.error('Extract context error:', error);
    return NextResponse.json(
      { error: 'Failed to extract context' },
      { status: 500 }
    );
  }
}
