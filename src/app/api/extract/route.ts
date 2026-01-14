import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ExtractedContext, ExtractionConfidence, Message, isEmergentContext } from '@/lib/types';
import { computeDimensionalCoverageFromInline } from '@/lib/dimensional-analysis';
import { createFragmentsFromThemes, ThemeWithDimensions } from '@/lib/fragments';
import { updateAllSyntheses } from '@/lib/synthesis';
import { logStatsigEvent } from '@/lib/statsig';
import { generateKnowledgeSummary } from '@/lib/knowledge-summary';
import { checkAndIncrementGuestApiCalls } from '@/lib/projects';

export const maxDuration = 300; // 5 minutes for Pro plan

// Progress step type for streaming updates
type ProgressStep =
  | 'starting'
  | 'extracting_themes'
  | 'analyzing_dimensions'
  | 'generating_summary'
  | 'saving_insights'
  | 'complete'
  | 'error';

interface ProgressUpdate {
  step: ProgressStep;
  data?: any;
  error?: string;
}

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
</extraction>`;

const REFLECTIVE_SUMMARY_PROMPT = `Based on this business strategy conversation, provide a reflective summary to support strategy development.

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

interface ParsedTheme {
  theme_name: string;
  content: string;
  dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[];
}

function parseEmergentThemes(xml: string): ParsedTheme[] {
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

export async function POST(req: Request) {
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

  // Check guest API limit
  if (conversation.userId) {
    const { blocked } = await checkAndIncrementGuestApiCalls(conversation.userId);
    if (blocked) {
      return NextResponse.json(
        { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
        { status: 429 }
      );
    }
  }

  // Create a streaming response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (update: ProgressUpdate) => {
        controller.enqueue(encoder.encode(JSON.stringify(update) + '\n'));
      };

      try {
        // Build conversation history
        const conversationHistory = conversation.messages
          .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
          .join('\n\n');

        // Determine extraction approach based on experiment variant
        // Both E1a (emergent questioning) and E3 (dimension-guided questioning) use emergent extraction
        // Only baseline-v1 uses the prescriptive 3-field extraction
        const isEmergent = conversation.experimentVariant !== 'baseline-v1';
        console.log('[Extract] Conversation details:', {
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
          max_tokens: 2000, // Increased for inline dimensions
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

          // Compute dimensional coverage from inline dimensions (no Claude call needed!)
          sendProgress({ step: 'analyzing_dimensions' });
          dimensionalCoverage = computeDimensionalCoverageFromInline(themes);

          // Generate reflective summary (only 1 Claude call now)
          sendProgress({ step: 'generating_summary' });

          const summaryResponse = await createMessage({
            model: CLAUDE_MODEL,
            max_tokens: 2000,
            messages: [{
              role: 'user',
              content: REFLECTIVE_SUMMARY_PROMPT.replace('{conversation}', conversationHistory)
            }],
            temperature: 0.5
          }, 'reflective_summary_emergent');

          const summaryContent = summaryResponse.content[0]?.type === 'text'
            ? summaryResponse.content[0].text : '';

          // Note: truncation is now automatically detected and logged by createMessage()
          const wasTerminatedNormally = summaryResponse.stop_reason === 'end_turn';
          if (!wasTerminatedNormally) {
            console.warn('[Extract] Summary response may be truncated, stop_reason:', summaryResponse.stop_reason);
          }

          const summaryXML = extractXML(summaryContent, 'summary');

          // Debug logging for reflective summary parsing
          console.log('[Extract] Summary response length:', summaryContent.length);
          console.log('[Extract] Summary stop_reason:', summaryResponse.stop_reason);
          console.log('[Extract] Summary XML extracted:', summaryXML ? 'OK' : 'EMPTY');

          const conversationTitle = extractXML(summaryXML, 'title') || undefined;
          const reflective_summary = {
            strengths: extractAllXML(summaryXML, 'strength'),
            emerging: extractAllXML(summaryXML, 'area'),
            opportunities_for_enrichment: extractAllXML(summaryXML, 'opportunity'),
            thought_prompt: extractXML(summaryXML, 'thought_prompt') || undefined,
          };

          console.log('[Extract] Reflective summary parsed:', {
            strengthsCount: reflective_summary.strengths.length,
            emergingCount: reflective_summary.emerging.length,
            opportunitiesCount: reflective_summary.opportunities_for_enrichment.length,
            hasThoughtPrompt: !!reflective_summary.thought_prompt,
          });

          // Save title to conversation
          if (conversationTitle) {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { title: conversationTitle },
            });
          }

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

          // Note: truncation is now automatically detected and logged by createMessage()
          if (summaryResponse.stop_reason !== 'end_turn') {
            console.warn('[Extract] Prescriptive - Summary may be truncated, stop_reason:', summaryResponse.stop_reason);
          }

          const summaryXML = extractXML(summaryContent, 'summary');

          // Debug logging for reflective summary parsing (prescriptive path)
          console.log('[Extract] Prescriptive - Summary response length:', summaryContent.length);
          console.log('[Extract] Prescriptive - Summary stop_reason:', summaryResponse.stop_reason);
          console.log('[Extract] Prescriptive - Summary XML extracted:', summaryXML ? 'OK' : 'EMPTY');

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

        console.log('[Extract] Returning extraction data:', {
          extraction_approach: extractedContext.extraction_approach,
          hasCore: 'core' in extractedContext,
          hasThemes: 'themes' in extractedContext,
          keys: Object.keys(extractedContext),
        });

        // Step 4: Save insights (fragments)
        // Use inline dimensions from extraction (more reliable than post-hoc matching)
        if (isEmergentContext(extractedContext)) {
          sendProgress({ step: 'saving_insights' });

          if (dimensionalCoverage) {
            console.log('[Extract] Dimensional coverage:', {
              dimensionsCovered: dimensionalCoverage.summary.dimensionsCovered,
              coveragePercentage: dimensionalCoverage.summary.coveragePercentage,
              gaps: dimensionalCoverage.summary.gaps,
            });

            // Log to Statsig for experiment metrics
            if (conversation.userId) {
              await logStatsigEvent(
                conversation.userId,
                'dimensional_coverage',
                dimensionalCoverage.summary.coveragePercentage,
                {
                  variant: conversation.experimentVariant || 'unknown',
                  dimensionsCovered: String(dimensionalCoverage.summary.dimensionsCovered),
                  gaps: dimensionalCoverage.summary.gaps.join(','),
                }
              );
            }
          }

          // Create fragments from themes with inline dimension tags
          if (conversation.projectId) {
            const projectId = conversation.projectId; // Capture for async callback
            try {
              // themes already have dimensions from parseEmergentThemes
              const fragments = await createFragmentsFromThemes(
                projectId,
                conversationId,
                extractedContext.themes as ThemeWithDimensions[]
              );
              console.log(`[Extract] Created ${fragments.length} fragments with dimension tags`);

              // Trigger synthesis update, then knowledge summary
              // IMPORTANT: Must await - Vercel terminates after stream closes
              // Knowledge summary must run AFTER synthesis so fragmentCount is accurate
              try {
                await updateAllSyntheses(projectId);
                await generateKnowledgeSummary(projectId);
              } catch (error) {
                console.error('[Extract] Failed to update syntheses or generate knowledge summary:', error);
              }
            } catch (error) {
              // Log but don't fail extraction if fragment creation fails
              console.error('[Extract] Failed to create fragments:', error);
            }
          }
        }

        // Step 5: Complete
        sendProgress({
          step: 'complete',
          data: {
            extractedContext,
            dimensionalCoverage,
          },
        });

        controller.close();
      } catch (error) {
        console.error('Extract context error:', error);
        sendProgress({
          step: 'error',
          error: error instanceof Error ? error.message : 'Failed to extract context',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
