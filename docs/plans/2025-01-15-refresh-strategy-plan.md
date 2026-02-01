# Refresh Strategy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable incremental strategy refresh that incorporates new fragments without regenerating from scratch.

**Architecture:** Contract-first approach. Define API boundaries, then schema, then implementation. Delta-aware prompt uses dimensional syntheses as compressed context. Two-call flow: generate updated strategy, then summarize changes.

**Tech Stack:** Next.js API routes, Prisma, Claude API, React streaming dialog

---

## Task 1: Define Refresh Strategy Contracts

**Files:**
- Create: `src/lib/contracts/refresh-strategy.ts`
- Modify: `src/lib/contracts/index.ts`
- Create: `src/lib/__tests__/contracts/refresh-strategy-contracts.test.ts`

**Step 1: Write the contract test file**

```typescript
// src/lib/__tests__/contracts/refresh-strategy-contracts.test.ts
/**
 * Refresh Strategy Contract Tests
 */

import {
  validateRefreshStrategyOutput,
  RefreshStrategyOutputContract,
  RefreshStrategyDeltaContract,
} from '@/lib/contracts/refresh-strategy';

describe('Refresh Strategy Contracts', () => {
  describe('RefreshStrategyDeltaContract', () => {
    const validDelta: RefreshStrategyDeltaContract = {
      newFragmentCount: 3,
      removedFragmentCount: 1,
      newFragmentSummaries: ['Customer insight about pricing', 'Competitor analysis'],
      removedFragmentSummaries: ['Outdated market assumption'],
    };

    it('should represent delta information', () => {
      expect(validDelta.newFragmentCount).toBe(3);
      expect(validDelta.removedFragmentCount).toBe(1);
    });
  });

  describe('RefreshStrategyOutputContract', () => {
    const validOutput: RefreshStrategyOutputContract = {
      traceId: 'trace_abc123',
      statements: {
        vision: 'To transform business automation',
        strategy: 'AI-first platform approach',
        objectives: [
          {
            id: 'obj-1',
            pithy: 'Achieve PMF',
            metric: { summary: '100 customers', full: '100 paying customers', category: 'Growth' },
            explanation: 'Validate demand',
            successCriteria: '100+ paying monthly',
          },
        ],
        opportunities: [],
        principles: [],
      },
      changeSummary: 'Refined vision to emphasize automation. Added objective for Q2 expansion.',
      previousOutputId: 'prev_output_123',
      version: 2,
    };

    it('should validate correct output', () => {
      expect(validateRefreshStrategyOutput(validOutput)).toBe(true);
    });

    it('should reject output with missing traceId', () => {
      const { traceId, ...invalid } = validOutput;
      expect(validateRefreshStrategyOutput(invalid)).toBe(false);
    });

    it('should reject output with missing statements', () => {
      const { statements, ...invalid } = validOutput;
      expect(validateRefreshStrategyOutput(invalid)).toBe(false);
    });

    it('should accept output with null changeSummary', () => {
      const withNullSummary = { ...validOutput, changeSummary: null };
      expect(validateRefreshStrategyOutput(withNullSummary)).toBe(true);
    });

    it('should require previousOutputId for refresh', () => {
      const { previousOutputId, ...invalid } = validOutput;
      expect(validateRefreshStrategyOutput(invalid)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="refresh-strategy-contracts" --verbose`
Expected: FAIL with "Cannot find module '@/lib/contracts/refresh-strategy'"

**Step 3: Write the contract implementation**

```typescript
// src/lib/contracts/refresh-strategy.ts
/**
 * Refresh Strategy Contracts
 *
 * Defines what /api/project/[id]/refresh-strategy produces.
 * This is an incremental update flow, not full regeneration.
 */

import { StrategyStatementsContract } from './generation';

// Re-export for convenience
export type { StrategyStatementsContract };

// Delta information - what changed since last generation
export interface RefreshStrategyDeltaContract {
  newFragmentCount: number;
  removedFragmentCount: number;
  newFragmentSummaries: string[];      // First ~100 chars of each new fragment
  removedFragmentSummaries: string[];  // First ~100 chars of each removed fragment
}

// Streaming progress steps
export type RefreshStrategyStep =
  | 'loading_context'
  | 'generating_strategy'
  | 'summarizing_changes'
  | 'complete'
  | 'error';

// Streaming progress update
export interface RefreshStrategyProgressContract {
  step: RefreshStrategyStep;
  error?: string;
}

// Final output from /api/project/[id]/refresh-strategy
export interface RefreshStrategyOutputContract {
  traceId: string;
  statements: StrategyStatementsContract;
  changeSummary: string | null;  // May be null if summary generation failed
  previousOutputId: string;      // Link to previous version
  version: number;
}

// Validation
export function validateRefreshStrategyOutput(data: unknown): data is RefreshStrategyOutputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.traceId !== 'string' || !obj.traceId) return false;
  if (typeof obj.previousOutputId !== 'string' || !obj.previousOutputId) return false;
  if (typeof obj.version !== 'number') return false;

  // changeSummary can be null (best-effort)
  if (obj.changeSummary !== null && typeof obj.changeSummary !== 'string') return false;

  // Validate statements structure
  const statements = obj.statements as Record<string, unknown>;
  if (!statements || typeof statements !== 'object') return false;
  if (typeof statements.vision !== 'string' || !statements.vision) return false;
  if (typeof statements.strategy !== 'string' || !statements.strategy) return false;
  if (!Array.isArray(statements.objectives)) return false;

  return true;
}
```

**Step 4: Export from contracts index**

Modify `src/lib/contracts/index.ts`:
```typescript
export * from './refresh-strategy';
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --testPathPattern="refresh-strategy-contracts" --verbose`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/contracts/refresh-strategy.ts src/lib/contracts/index.ts src/lib/__tests__/contracts/refresh-strategy-contracts.test.ts
git commit -m "feat(contracts): add refresh-strategy contracts"
```

---

## Task 2: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add fields to GeneratedOutput model**

Find the `GeneratedOutput` model in `prisma/schema.prisma` and add:

```prisma
model GeneratedOutput {
  id        String  @id @default(cuid())
  projectId String
  userId    String?

  // Output metadata
  outputType String // vision | strategy | objectives | initiatives | principles | full_decision_stack
  version    Int    @default(1)

  // Content
  content Json

  // Generation metadata
  generatedFrom    String? @db.Text
  modelUsed        String
  promptTokens     Int?
  completionTokens Int?
  latencyMs        Int?

  // User feedback
  userFeedback    String?
  feedbackAt      DateTime?
  refinementNotes String?   @db.Text

  // NEW: Version chain
  previousOutputId String?
  previousOutput   GeneratedOutput?  @relation("VersionChain", fields: [previousOutputId], references: [id])
  nextOutputs      GeneratedOutput[] @relation("VersionChain")

  // NEW: Change tracking
  changeSummary String? @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id])
  user    User?   @relation(fields: [userId], references: [id])

  @@index([projectId, outputType])
}
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Push schema to database**

Run: `npx prisma db push`
Expected: Schema changes applied

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add version chain and change summary to GeneratedOutput"
```

---

## Task 3: Create Refresh Strategy API Route

**Files:**
- Create: `src/app/api/project/[id]/refresh-strategy/route.ts`

**Step 1: Create the route file with streaming response**

```typescript
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
```

**Step 2: Type-check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/project/[id]/refresh-strategy/route.ts
git commit -m "feat(api): add refresh-strategy endpoint with streaming"
```

---

## Task 4: Create RefreshStrategyDialog Component

**Files:**
- Create: `src/components/RefreshStrategyDialog.tsx`

**Step 1: Create the component**

```typescript
// src/components/RefreshStrategyDialog.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { RefreshStrategyStep } from '@/lib/contracts/refresh-strategy'

interface StepConfig {
  title: string
  description: string
}

const STEP_MESSAGES: Record<RefreshStrategyStep, StepConfig> = {
  loading_context: {
    title: 'Loading context',
    description: 'Gathering your strategic insights and recent changes',
  },
  generating_strategy: {
    title: 'Updating strategy',
    description: 'Incorporating new insights into your decision stack',
  },
  summarizing_changes: {
    title: 'Summarizing changes',
    description: 'Documenting what changed and why',
  },
  complete: {
    title: 'Strategy refreshed!',
    description: 'Your decision stack has been updated',
  },
  error: {
    title: 'Something went wrong',
    description: 'Failed to refresh strategy',
  },
}

interface RefreshStrategyDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (traceId: string) => void
}

export function RefreshStrategyDialog({
  projectId,
  open,
  onOpenChange,
  onComplete,
}: RefreshStrategyDialogProps) {
  const [currentStep, setCurrentStep] = useState<RefreshStrategyStep>('loading_context')
  const [error, setError] = useState<string | undefined>()
  const [changeSummary, setChangeSummary] = useState<string | null>(null)
  const refreshRunningRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!open) {
      setCurrentStep('loading_context')
      setError(undefined)
      setChangeSummary(null)
      refreshRunningRef.current = false
      return
    }

    if (refreshRunningRef.current) return
    refreshRunningRef.current = true

    const runRefresh = async () => {
      try {
        const response = await fetch(`/api/project/${projectId}/refresh-strategy`, {
          method: 'POST',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Refresh failed: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const update = JSON.parse(line)
              setCurrentStep(update.step)

              if (update.step === 'error') {
                setError(update.error || 'Refresh failed')
              } else if (update.step === 'complete') {
                setChangeSummary(update.changeSummary)
                setTimeout(() => {
                  onCompleteRef.current(update.traceId)
                }, 1500)
              }
            } catch (parseError) {
              console.error('Failed to parse progress:', line, parseError)
            }
          }
        }
      } catch (err) {
        console.error('Refresh error:', err)
        setCurrentStep('error')
        setError(err instanceof Error ? err.message : 'Refresh failed')
      }
    }

    runRefresh()
  }, [open, projectId])

  const stepConfig = STEP_MESSAGES[currentStep]
  const isError = currentStep === 'error'
  const isComplete = currentStep === 'complete'

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen && !isComplete && !isError) return
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Refreshing Strategy
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <div
            className={`rounded-lg p-6 ${
              isError ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'
            }`}
          >
            {/* Progress bars */}
            {!isComplete && !isError && (
              <div className="mb-6">
                <div className="flex justify-center space-x-2">
                  {(['loading_context', 'generating_strategy', 'summarizing_changes'] as const).map(
                    (step) => {
                      const stepOrder = [
                        'loading_context',
                        'generating_strategy',
                        'summarizing_changes',
                        'complete',
                      ]
                      const currentIdx = stepOrder.indexOf(currentStep)
                      const stepIdx = stepOrder.indexOf(step)
                      const isActive = stepIdx === currentIdx
                      const isDone = stepIdx < currentIdx

                      return (
                        <div
                          key={step}
                          className={`h-1.5 w-12 rounded-full transition-all duration-500 ${
                            isDone
                              ? 'bg-primary'
                              : isActive
                              ? 'bg-primary/60 animate-[pulse_3s_ease-in-out_infinite]'
                              : 'bg-primary/20'
                          }`}
                        />
                      )
                    }
                  )}
                </div>
              </div>
            )}

            {/* Status icon */}
            {(isComplete || isError) && (
              <div className="mb-4 flex justify-center">
                {isComplete ? (
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
                    <svg
                      className="w-6 h-6 text-red-600 dark:text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <p
              className={`font-medium text-center ${
                isError ? 'text-red-700 dark:text-red-300' : 'text-foreground'
              }`}
            >
              {stepConfig.title}
            </p>

            {/* Description or change summary */}
            <p
              className={`text-sm mt-2 text-center ${
                isError ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
              }`}
            >
              {error || (isComplete && changeSummary) || stepConfig.description}
            </p>
          </div>

          {/* Close button */}
          {(isComplete || isError) && (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => onOpenChange(false)}>
                {isComplete ? 'View Strategy' : 'Close'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Type-check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/RefreshStrategyDialog.tsx
git commit -m "feat(ui): add RefreshStrategyDialog component"
```

---

## Task 5: Wire Up Dialog in Project Page

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Import the new component**

Add import near other imports (~line 53):
```typescript
import { RefreshStrategyDialog } from '@/components/RefreshStrategyDialog'
```

**Step 2: Replace the inline Refresh Strategy dialog**

Find the existing refresh strategy dialog (around line 1361-1401) and replace with:

```typescript
{/* Refresh Strategy Dialog */}
<RefreshStrategyDialog
  projectId={projectId}
  open={refreshStrategyDialogOpen}
  onOpenChange={setRefreshStrategyDialogOpen}
  onComplete={(traceId) => {
    setRefreshStrategyDialogOpen(false)
    router.push(`/strategy/${traceId}`)
  }}
/>
```

**Step 3: Type-check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Test manually**

1. Start dev server: `npm run dev`
2. Navigate to a project with an existing strategy
3. Click "Refresh Strategy" button
4. Verify dialog opens with progress steps
5. Verify redirect to `/strategy/[traceId]` on complete

**Step 5: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(ui): wire up RefreshStrategyDialog in project page"
```

---

## Task 6: Run Full Verification

**Step 1: Type-check**

Run: `npm run type-check`
Expected: No errors

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Run verify**

Run: `npm run verify`
Expected: All checks pass

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any verification issues"
```

---

## Summary of Files

**Created:**
- `src/lib/contracts/refresh-strategy.ts` - Contract definitions
- `src/lib/__tests__/contracts/refresh-strategy-contracts.test.ts` - Contract tests
- `src/app/api/project/[id]/refresh-strategy/route.ts` - API endpoint
- `src/components/RefreshStrategyDialog.tsx` - UI component

**Modified:**
- `src/lib/contracts/index.ts` - Export new contracts
- `prisma/schema.prisma` - Add version chain fields
- `src/app/project/[id]/page.tsx` - Wire up dialog
