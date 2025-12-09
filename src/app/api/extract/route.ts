import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ExtractedContext, ExtractionConfidence, Message } from '@/lib/types';

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

  <unexplored>
    <!-- 1-2 gaps or questions worth considering -->
    <gap>Opportunities for deeper thinking</gap>
  </unexplored>

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

    // Extract context
    const startTime = Date.now();
    const extractionResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: EXTRACTION_PROMPT.replace('{conversation}', conversationHistory)
      }],
      temperature: 0.3
    });

    const extractionContent = extractionResponse.content[0]?.type === 'text'
      ? extractionResponse.content[0].text : '';

    // Parse extraction
    const extractionXML = extractXML(extractionContent, 'extraction');
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
      unexplored: extractAllXML(summaryXML, 'gap'),
      thought_prompt: extractXML(summaryXML, 'thought_prompt') || undefined,
    };

    const extractedContext = {
      core,
      enrichment,
      reflective_summary,
    };

    return NextResponse.json({
      extractedContext,
    });
  } catch (error) {
    console.error('Extract context error:', error);
    return NextResponse.json(
      { error: 'Failed to extract context' },
      { status: 500 }
    );
  }
}
