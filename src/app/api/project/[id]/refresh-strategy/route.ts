// src/app/api/project/[id]/refresh-strategy/route.ts
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser, checkAndIncrementGuestApiCalls } from '@/lib/projects'
import { createMessage, CLAUDE_MODEL } from '@/lib/claude'
import { extractXML } from '@/lib/utils'
import { convertLegacyObjectives } from '@/lib/placeholders'
import { StrategyStatements } from '@/lib/types'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'
import {
  RefreshStrategyStep,
  RefreshStrategyProgressContract,
  RefreshStrategyDeltaContract,
} from '@/lib/contracts/refresh-strategy'

export const maxDuration = 300 // 5 minutes for Pro plan

const GUEST_COOKIE_NAME = 'guestUserId'

// Prompts defined in design doc
const STRATEGY_UPDATE_PROMPT = `You are Luna, refining a business strategy based on new insights.

## Current Strategy
Vision: {current_vision}
Strategy: {current_strategy}
Objectives:
{current_objectives}

## Strategic Context (Dimensional Syntheses)
{dimensional_summaries}

## What's New (since last strategy)
{new_fragments_content}

## What's Been Removed
{archived_fragments_content}

---

Update the strategy to incorporate the new insights. Be conservative - only change what the new information warrants. If an objective is still valid, keep it. If the vision still holds, preserve it.

Output format:
<statements>
  <vision>Your updated or unchanged vision</vision>
  <strategy>Your updated or unchanged strategy</strategy>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`

const CHANGE_SUMMARY_PROMPT = `Compare these two versions of a business strategy and summarize what changed and why.

## Previous Strategy
Vision: {old_vision}
Strategy: {old_strategy}
Objectives: {old_objectives}

## Updated Strategy
Vision: {new_vision}
Strategy: {new_strategy}
Objectives: {new_objectives}

## New Insights That Informed Changes
{new_fragments_summary}

Write 2-4 sentences explaining what changed and why. Be specific. If nothing meaningful changed, say "No significant changes - strategy remains aligned with current insights."`

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const session = await getServerSession(authOptions)

  // Auth: session or guest cookie
  let userId: string | null = session?.user?.id || null
  if (!userId) {
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)
    if (guestCookie?.value) {
      const guestUser = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { email: true },
      })
      if (guestUser && isGuestUser(guestUser.email)) {
        userId = guestCookie.value
      }
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify project access
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true, knowledgeSummary: true },
  })

  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get previous strategy - REQUIRED for refresh
  const previousOutput = await prisma.generatedOutput.findFirst({
    where: { projectId, outputType: 'full_decision_stack' },
    orderBy: { createdAt: 'desc' },
  })

  if (!previousOutput) {
    return new Response(
      JSON.stringify({ error: 'No strategy to refresh. Complete a conversation first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Check guest API limit
  const { blocked } = await checkAndIncrementGuestApiCalls(userId)
  if (blocked) {
    return new Response(
      JSON.stringify({ error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Streaming response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (update: RefreshStrategyProgressContract) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(update) + '\n'))
        } catch (e) {
          // Controller may be closed
        }
      }

      try {
        // Step 1: Load context
        sendProgress({ step: 'loading_context' })

        const previousStatements = previousOutput.content as unknown as StrategyStatements

        // Get dimensional syntheses
        const syntheses = await prisma.dimensionalSynthesis.findMany({
          where: { projectId, fragmentCount: { gt: 0 } },
          orderBy: { fragmentCount: 'desc' },
        })

        // Get delta: new fragments since last generation
        const newFragments = await prisma.fragment.findMany({
          where: {
            projectId,
            status: 'active',
            createdAt: { gt: previousOutput.createdAt },
          },
          select: { content: true },
          take: 20,
        })

        // Get removed fragments (archived since last generation)
        const removedFragments = await prisma.fragment.findMany({
          where: {
            projectId,
            status: { in: ['archived', 'soft_deleted'] },
            updatedAt: { gt: previousOutput.createdAt },
          },
          select: { content: true },
          take: 10,
        })

        const delta: RefreshStrategyDeltaContract = {
          newFragmentCount: newFragments.length,
          removedFragmentCount: removedFragments.length,
          newFragmentSummaries: newFragments.map(f => f.content.slice(0, 100)),
          removedFragmentSummaries: removedFragments.map(f => f.content.slice(0, 100)),
        }

        // Build prompt context
        const dimensionalSummaries = syntheses
          .map(s => {
            const context = DIMENSION_CONTEXT[s.dimension as Tier1Dimension]
            const name = context?.name || s.dimension
            return `### ${name}\n${s.summary || 'No summary yet'}`
          })
          .join('\n\n')

        const currentObjectives = previousStatements.objectives
          .map((o, i) => `${i + 1}. ${o.pithy}: ${o.metric.summary}`)
          .join('\n')

        const newFragmentsContent = newFragments.length > 0
          ? newFragments.map(f => `- ${f.content}`).join('\n')
          : 'No new insights since last strategy.'

        const archivedContent = removedFragments.length > 0
          ? removedFragments.map(f => `- ${f.content}`).join('\n')
          : 'No insights removed.'

        // Step 2: Generate updated strategy
        sendProgress({ step: 'generating_strategy' })

        const updatePrompt = STRATEGY_UPDATE_PROMPT
          .replace('{current_vision}', previousStatements.vision)
          .replace('{current_strategy}', previousStatements.strategy)
          .replace('{current_objectives}', currentObjectives)
          .replace('{dimensional_summaries}', dimensionalSummaries)
          .replace('{new_fragments_content}', newFragmentsContent)
          .replace('{archived_fragments_content}', archivedContent)

        const genResponse = await createMessage({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          messages: [{ role: 'user', content: updatePrompt }],
          temperature: 0.7,
        }, 'refresh_strategy_generation')

        const genContent = genResponse.content[0]?.type === 'text'
          ? genResponse.content[0].text
          : ''

        const statementsXML = extractXML(genContent, 'statements')
        const objectiveStrings = extractXML(statementsXML, 'objectives')
          .split('\n')
          .filter(line => line.trim().length > 0)

        const newStatements: StrategyStatements = {
          vision: extractXML(statementsXML, 'vision') || previousStatements.vision,
          strategy: extractXML(statementsXML, 'strategy') || previousStatements.strategy,
          objectives: convertLegacyObjectives(objectiveStrings),
          opportunities: previousStatements.opportunities || [],
          principles: previousStatements.principles || [],
        }

        // Step 3: Generate change summary (best-effort)
        sendProgress({ step: 'summarizing_changes' })

        let changeSummary: string | null = null
        try {
          const oldObjectives = previousStatements.objectives
            .map((o, i) => `${i + 1}. ${o.pithy}`)
            .join('\n')
          const newObjectives = newStatements.objectives
            .map((o, i) => `${i + 1}. ${o.pithy}`)
            .join('\n')

          const summaryPrompt = CHANGE_SUMMARY_PROMPT
            .replace('{old_vision}', previousStatements.vision)
            .replace('{old_strategy}', previousStatements.strategy)
            .replace('{old_objectives}', oldObjectives)
            .replace('{new_vision}', newStatements.vision)
            .replace('{new_strategy}', newStatements.strategy)
            .replace('{new_objectives}', newObjectives)
            .replace('{new_fragments_summary}', delta.newFragmentSummaries.join('; '))

          const summaryResponse = await createMessage({
            model: CLAUDE_MODEL,
            max_tokens: 300,
            messages: [{ role: 'user', content: summaryPrompt }],
            temperature: 0.5,
          }, 'refresh_strategy_summary')

          changeSummary = summaryResponse.content[0]?.type === 'text'
            ? summaryResponse.content[0].text.trim()
            : null
        } catch (summaryError) {
          console.error('[RefreshStrategy] Change summary failed:', summaryError)
          // Continue without summary - it's best-effort
        }

        // Step 4: Persist
        // Create synthetic conversation for Trace (required field)
        const syntheticConversation = await prisma.conversation.create({
          data: {
            userId,
            projectId,
            status: 'completed',
            title: 'Strategy Refresh',
            currentPhase: 'generation',
          },
        })

        // Create Trace for /strategy/[traceId] view
        const trace = await prisma.trace.create({
          data: {
            conversationId: syntheticConversation.id,
            userId,
            extractedContext: { type: 'refresh', delta } as any,
            output: newStatements as any,
            claudeThoughts: `Incremental refresh based on ${delta.newFragmentCount} new and ${delta.removedFragmentCount} removed fragments.`,
            modelUsed: CLAUDE_MODEL,
            totalTokens: genResponse.usage.input_tokens + genResponse.usage.output_tokens,
            promptTokens: genResponse.usage.input_tokens,
            completionTokens: genResponse.usage.output_tokens,
            latencyMs: 0,
          },
        })

        // Create new GeneratedOutput with version chain
        const newOutput = await prisma.generatedOutput.create({
          data: {
            projectId,
            userId,
            outputType: 'full_decision_stack',
            version: previousOutput.version + 1,
            content: newStatements as any,
            generatedFrom: 'incremental_refresh',
            modelUsed: CLAUDE_MODEL,
            promptTokens: genResponse.usage.input_tokens,
            completionTokens: genResponse.usage.output_tokens,
            previousOutputId: previousOutput.id,
            changeSummary,
          },
        })

        // Reset unsynthesized fragment count by updating knowledgeUpdatedAt
        await prisma.project.update({
          where: { id: projectId },
          data: { knowledgeUpdatedAt: new Date() },
        })

        // Complete
        sendProgress({ step: 'complete' })
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              step: 'complete',
              traceId: trace.id,
              changeSummary,
              version: newOutput.version,
            }) + '\n'
          )
        )
        controller.close()
      } catch (error) {
        console.error('[RefreshStrategy] Error:', error)
        sendProgress({
          step: 'error',
          error: error instanceof Error ? error.message : 'Refresh failed',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
