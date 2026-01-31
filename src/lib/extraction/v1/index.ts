// src/lib/extraction/v1/index.ts
/**
 * Extraction Logic v1 - Archived 2026-01-31
 *
 * This is the synchronous extraction implementation that blocks while processing.
 * Archived for backtesting and comparison with future versions.
 *
 * Key characteristics:
 * - Streaming response with progress updates
 * - Two extraction approaches: emergent (E1a/E3) and prescriptive (baseline-v1)
 * - Inline dimensional tagging for emergent themes
 * - Background tasks for synthesis (via waitUntil)
 *
 * Contract: Returns ExtractionOutputContract (see src/lib/contracts/extraction.ts)
 */

import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { isEmergentContext } from '@/lib/types';
import { computeDimensionalCoverageFromInline } from '@/lib/dimensional-analysis';
import { createFragmentsFromThemes, ThemeWithDimensions } from '@/lib/fragments';
import { updateAllSyntheses } from '@/lib/synthesis';
import { logStatsigEvent } from '@/lib/statsig';
import { generateKnowledgeSummary } from '@/lib/knowledge-summary';
import { runBackgroundTasks } from '@/lib/background-tasks';

// Progress step type for streaming updates
export type ExtractionProgressStep =
  | 'starting'
  | 'extracting_themes'
  | 'analyzing_dimensions'
  | 'generating_summary'
  | 'saving_insights'
  | 'complete'
  | 'error';

export interface ExtractionProgressUpdate {
  step: ExtractionProgressStep;
  data?: any;
  error?: string;
}

// Prompts
export const EXTRACTION_PROMPT = `You are analyzing a business strategy conversation. Extract structured information with core fields and enrichment.

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

export const EMERGENT_EXTRACTION_PROMPT = `You are analyzing a business strategy conversation. Extract the key themes that emerged naturally from the discussion, and tag each theme with the strategic dimensions it relates to.

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
</extraction>`;

export const REFLECTIVE_SUMMARY_PROMPT = `Based on this business strategy conversation, provide a reflective summary to support strategy development.

Conversation:
{conversation}

Provide:

<summary>
  <title>Short descriptive title for this conversation (3-6 words, e.g. "Market expansion strategy", "Customer acquisition approach")</title>

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

// Helper functions
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

export interface ParsedTheme {
  theme_name: string;
  content: string;
  dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[];
}

export function parseEmergentThemes(xml: string): ParsedTheme[] {
  const themes: ParsedTheme[] = [];
  const themeRegex = /<theme>([\s\S]*?)<\/theme>/g;
  let match;

  while ((match = themeRegex.exec(xml)) !== null) {
    const themeXML = match[1];
    const theme_name = extractXML(themeXML, 'theme_name');
    const content = extractXML(themeXML, 'content');

    // Parse inline dimensions
    const dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[] = [];
    const dimensionRegex = /<dimension\s+name="([^"]+)"\s+confidence="([^"]+)"\s*\/>/g;
    let dimMatch;

    while ((dimMatch = dimensionRegex.exec(themeXML)) !== null) {
      const name = dimMatch[1];
      const confidence = dimMatch[2].toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW';
      if (['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) {
        dimensions.push({ name, confidence });
      }
    }

    if (theme_name && content) {
      themes.push({ theme_name, content, dimensions });
    }
  }

  return themes;
}

export interface ExtractionOptions {
  conversationId: string;
  lightweight?: boolean; // Skip heavy synthesis for follow-on conversations
}

export interface ExtractionResult {
  extractedContext: any;
  dimensionalCoverage: any;
}

/**
 * Perform extraction synchronously (blocking).
 * This is the v1 implementation archived for backtesting.
 */
export async function performExtraction(
  options: ExtractionOptions,
  sendProgress: (update: ExtractionProgressUpdate) => void
): Promise<ExtractionResult> {
  const { conversationId, lightweight } = options;

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
    throw new Error('Conversation not found');
  }

  // Build conversation history
  const conversationHistory = conversation.messages
    .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');

  // Determine extraction approach based on experiment variant
  const isEmergent = conversation.experimentVariant !== 'baseline-v1';
  console.log('[Extract v1] Conversation details:', {
    conversationId: conversation.id,
    experimentVariant: conversation.experimentVariant,
    isEmergent,
    messageCount: conversation.messages.length,
  });

  // Step 1: Extract themes
  sendProgress({ step: 'extracting_themes' });

  const extractionPrompt = isEmergent
    ? EMERGENT_EXTRACTION_PROMPT.replace('{conversation}', conversationHistory)
    : EXTRACTION_PROMPT.replace('{conversation}', conversationHistory);

  const extractionResponse = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: extractionPrompt
    }],
    temperature: 0.3
  }, 'extraction');

  const extractionContent = extractionResponse.content[0]?.type === 'text'
    ? extractionResponse.content[0].text : '';

  const extractionXML = extractXML(extractionContent, 'extraction');

  let extractedContext: any;
  let dimensionalCoverage: any = null;

  if (isEmergent) {
    // Parse emergent themes with inline dimensions
    const themes = parseEmergentThemes(extractionXML);

    // Compute dimensional coverage from inline dimensions
    sendProgress({ step: 'analyzing_dimensions' });
    dimensionalCoverage = computeDimensionalCoverageFromInline(themes);

    extractedContext = {
      themes,
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
    sendProgress({ step: 'generating_summary' });

    const summaryResponse = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: REFLECTIVE_SUMMARY_PROMPT.replace('{conversation}', conversationHistory)
      }],
      temperature: 0.5
    }, 'reflective_summary_prescriptive');

    const summaryContent = summaryResponse.content[0]?.type === 'text'
      ? summaryResponse.content[0].text : '';

    const summaryXML = extractXML(summaryContent, 'summary');

    const conversationTitleBaseline = extractXML(summaryXML, 'title') || undefined;
    const reflective_summary = {
      strengths: extractAllXML(summaryXML, 'strength'),
      emerging: extractAllXML(summaryXML, 'area'),
      opportunities_for_enrichment: extractAllXML(summaryXML, 'opportunity'),
      thought_prompt: extractXML(summaryXML, 'thought_prompt') || undefined,
    };

    // Save title to conversation
    if (conversationTitleBaseline) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: conversationTitleBaseline },
      });
    }

    extractedContext = {
      core,
      enrichment,
      reflective_summary,
      extraction_approach: 'prescriptive',
    };
  }

  console.log('[Extract v1] Returning extraction data:', {
    extraction_approach: extractedContext.extraction_approach,
    hasCore: 'core' in extractedContext,
    hasThemes: 'themes' in extractedContext,
    keys: Object.keys(extractedContext),
  });

  // Save insights (fragments) for emergent extraction
  if (isEmergentContext(extractedContext)) {
    sendProgress({ step: 'saving_insights' });

    if (dimensionalCoverage) {
      console.log('[Extract v1] Dimensional coverage:', {
        dimensionsCovered: dimensionalCoverage.summary.dimensionsCovered,
        coveragePercentage: dimensionalCoverage.summary.coveragePercentage,
        gaps: dimensionalCoverage.summary.gaps,
      });

      // Log to Statsig
      if (conversation.userId) {
        logStatsigEvent(
          conversation.userId,
          'dimensional_coverage',
          dimensionalCoverage.summary.coveragePercentage,
          {
            variant: conversation.experimentVariant || 'unknown',
            dimensionsCovered: String(dimensionalCoverage.summary.dimensionsCovered),
            gaps: dimensionalCoverage.summary.gaps.join(','),
          }
        ).catch(err => console.error('[Extract v1] Statsig event failed:', err));
      }
    }

    // Create fragments from themes
    if (conversation.projectId) {
      const projectId = conversation.projectId;
      try {
        const fragments = await createFragmentsFromThemes(
          projectId,
          conversationId,
          extractedContext.themes as ThemeWithDimensions[]
        );
        console.log(`[Extract v1] Created ${fragments.length} fragments with dimension tags`);
      } catch (error) {
        console.error('[Extract v1] Failed to create fragments:', error);
      }
    }
  }

  // Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'extracted' },
  });
  console.log(`[Extract v1] Updated conversation status to 'extracted'`);

  // Schedule background tasks (runs after response sent via waitUntil)
  if (isEmergent && conversation.projectId && !lightweight) {
    const projectId = conversation.projectId;

    runBackgroundTasks({
      projectId,
      tasks: [
        {
          name: 'updateAllSyntheses',
          fn: async () => { await updateAllSyntheses(projectId) }
        },
        {
          name: 'generateKnowledgeSummary',
          fn: async () => { await generateKnowledgeSummary(projectId) }
        }
      ]
    });
  }

  return { extractedContext, dimensionalCoverage };
}
