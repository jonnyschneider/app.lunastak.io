import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML, parseOKRObjectives } from '@/lib/utils';
import { StrategyStatements, ExtractedContextVariant, isEmergentContext, Objective } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import { createExtractionRun, updateExtractionRunWithSyntheses } from '@/lib/extraction-runs';
import { logStatsigEvent } from '@/lib/statsig';
import { checkAndIncrementGuestApiCalls } from '@/lib/projects';
import { getCurrentPrompt } from '@/lib/prompts';
import { waitUntil } from '@vercel/functions';
import type { GenerationStartedContract } from '@/lib/contracts/generation-status';

export const maxDuration = 300; // 5 minutes for Pro plan

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

/**
 * Fire-and-forget generation API.
 *
 * Creates a GeneratedOutput record immediately, starts generation in background,
 * and returns the generationId for polling.
 */
export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log('[Generate API] Request started (fire-and-forget mode)');

  // Parse request body
  let conversationId: string;
  let extractedContext: ExtractedContextVariant;
  let dimensionalCoverage: any;

  try {
    const body = await req.json();
    conversationId = body.conversationId;
    extractedContext = body.extractedContext;
    dimensionalCoverage = body.dimensionalCoverage;
    console.log('[Generate API] Parsed request body, conversationId:', conversationId);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!conversationId || !extractedContext) {
    console.error('[Generate API] Missing required fields');
    return NextResponse.json(
      { error: 'conversationId and extractedContext are required' },
      { status: 400 }
    );
  }

  // Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    console.error('[Generate API] Conversation not found:', conversationId);
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  // Check guest API limit
  if (conversation.userId) {
    const { blocked } = await checkAndIncrementGuestApiCalls(conversation.userId);
    if (blocked) {
      console.log('[Generate API] Guest API limit reached');
      return NextResponse.json(
        { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
        { status: 429 }
      );
    }
  }

  // Require projectId for fire-and-forget (need somewhere to store the output)
  if (!conversation.projectId) {
    console.error('[Generate API] No projectId for conversation:', conversationId);
    return NextResponse.json(
      { error: 'Conversation must have a projectId for generation' },
      { status: 400 }
    );
  }

  // Create GeneratedOutput record upfront with 'generating' status
  const generatedOutput = await prisma.generatedOutput.create({
    data: {
      projectId: conversation.projectId,
      userId: conversation.userId,
      outputType: 'full_decision_stack',
      version: 1,
      status: 'generating',
      startedAt: new Date(),
      content: {}, // Empty initially, populated on completion
    }
  });

  console.log('[Generate API] Created GeneratedOutput with ID:', generatedOutput.id, 'status: generating');

  // Start background generation
  waitUntil(
    runBackgroundGeneration({
      generatedOutputId: generatedOutput.id,
      conversationId,
      projectId: conversation.projectId,
      userId: conversation.userId,
      experimentVariant: conversation.experimentVariant,
      extractedContext,
      dimensionalCoverage,
    })
  );

  const setupTime = Date.now() - requestStartTime;
  console.log(`[Generate API] Returning immediately after ${setupTime}ms`);

  // Return immediately with generationId for polling
  const response: GenerationStartedContract = {
    status: 'started',
    generationId: generatedOutput.id,
  };

  return NextResponse.json(response);
}

interface BackgroundGenerationOptions {
  generatedOutputId: string;
  conversationId: string;
  projectId: string;
  userId: string | null;
  experimentVariant: string | null;
  extractedContext: ExtractedContextVariant;
  dimensionalCoverage: any;
}

/**
 * Background generation task.
 * Runs after response is sent, updates GeneratedOutput on completion/failure.
 */
async function runBackgroundGeneration(options: BackgroundGenerationOptions) {
  const {
    generatedOutputId,
    conversationId,
    projectId,
    userId,
    experimentVariant,
    extractedContext,
    dimensionalCoverage,
  } = options;

  const startTime = Date.now();
  console.log('[Generate Background] Starting generation for:', generatedOutputId);

  try {
    // Build prompt based on extraction approach
    const context = extractedContext as ExtractedContextVariant;
    let prompt: string;

    if (isEmergentContext(context)) {
      const generationPrompt = getCurrentPrompt('generation');
      const themesText = context.themes
        .map(theme => `${theme.theme_name}:\n${theme.content}`)
        .join('\n\n');
      prompt = generationPrompt.template.replace('{themes}', themesText);
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

    // Call Claude API
    console.log('[Generate Background] Calling Claude API...');
    const claudeStartTime = Date.now();
    const response = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7
    }, 'strategy_generation');
    const latency = Date.now() - claudeStartTime;
    console.log(`[Generate Background] Claude API responded in ${latency}ms`);

    // Parse response
    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const thoughts = extractXML(content, 'thoughts');
    const statementsXML = extractXML(content, 'statements');
    const objectivesXML = extractXML(statementsXML, 'objectives');

    // Detect format: OKR (has <objective> tags) vs legacy (numbered list)
    const isOKRFormat = objectivesXML.includes('<objective>');

    let objectives: Objective[];
    if (isOKRFormat) {
      objectives = parseOKRObjectives(objectivesXML);
      console.log('[Generate Background] Parsed OKR-style objectives:', objectives.length);
    } else {
      // Legacy: numbered list format
      const objectiveStrings = objectivesXML
        .split('\n')
        .filter(line => line.trim().length > 0);
      objectives = convertLegacyObjectives(objectiveStrings);
      console.log('[Generate Background] Parsed legacy objectives:', objectives.length);
    }

    const statements: StrategyStatements = {
      vision: extractXML(statementsXML, 'vision'),
      strategy: extractXML(statementsXML, 'strategy'),
      objectives,
      opportunities: [],
      principles: []
    };

    // Save trace (legacy)
    const trace = await prisma.trace.create({
      data: {
        conversationId,
        userId,
        extractedContext: extractedContext as any,
        dimensionalCoverage: dimensionalCoverage as any,
        output: statements as any,
        claudeThoughts: thoughts,
        modelUsed: CLAUDE_MODEL,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      },
    });
    console.log('[Generate Background] Trace saved with ID:', trace.id);

    // Update GeneratedOutput with results
    await prisma.generatedOutput.update({
      where: { id: generatedOutputId },
      data: {
        status: 'complete',
        content: statements as any,
        modelUsed: CLAUDE_MODEL,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      }
    });
    console.log('[Generate Background] GeneratedOutput updated to complete');

    // Seed initial StrategyVersion records
    const { vision, strategy: strategyText } = statements;
    await prisma.$transaction([
      // Vision version
      prisma.strategyVersion.create({
        data: {
          projectId,
          componentType: 'vision',
          content: { text: vision },
          version: 1,
          createdBy: 'ai',
          sourceType: 'generation',
          sourceId: trace.id,
        },
      }),
      // Strategy version
      prisma.strategyVersion.create({
        data: {
          projectId,
          componentType: 'strategy',
          content: { text: strategyText },
          version: 1,
          createdBy: 'ai',
          sourceType: 'generation',
          sourceId: trace.id,
        },
      }),
      // Objective versions
      ...objectives.map((obj) =>
        prisma.strategyVersion.create({
          data: {
            projectId,
            componentType: 'objective',
            componentId: obj.id,
            content: {
              title: obj.title,
              objective: obj.objective,
              pithy: obj.pithy || obj.objective,
              keyResults: obj.keyResults,
              metric: obj.metric,
              explanation: obj.explanation,
              successCriteria: obj.successCriteria,
            } as object,
            version: 1,
            createdBy: 'ai',
            sourceType: 'generation',
            sourceId: trace.id,
          },
        })
      ),
    ]);
    console.log('[Generate Background] StrategyVersion records seeded');

    // Get fragment IDs and create ExtractionRun
    const fragments = await prisma.fragment.findMany({
      where: { conversationId },
      select: { id: true }
    });
    const fragmentIds = fragments.map(f => f.id);

    const extractionRun = await createExtractionRun({
      projectId,
      conversationId,
      experimentVariant: experimentVariant || undefined,
      fragmentIds,
      modelUsed: CLAUDE_MODEL,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs: latency,
      generatedOutputId
    });
    console.log('[Generate Background] ExtractionRun saved with ID:', extractionRun.id);

    // Update with syntheses
    try {
      await updateExtractionRunWithSyntheses(extractionRun.id, projectId);
    } catch (err) {
      console.error('[Generate Background] Failed to update extraction run with syntheses:', err);
    }

    // Update conversation status
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'completed' },
    });

    // Log to Statsig
    if (userId) {
      await logStatsigEvent(
        userId,
        'strategy_generated',
        1,
        { variant: experimentVariant || 'unknown' }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Generate Background] Completed successfully in ${totalTime}ms`);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Generate Background] Error after ${totalTime}ms:`, error);

    // Update GeneratedOutput with error status
    await prisma.generatedOutput.update({
      where: { id: generatedOutputId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Generation failed',
      }
    });
    console.log('[Generate Background] GeneratedOutput updated to failed');
  }
}
