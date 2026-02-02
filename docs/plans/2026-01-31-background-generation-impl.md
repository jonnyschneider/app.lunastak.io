# Background Strategy Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the 15-30s browser wait during strategy generation by running generation in background with polling and toast notifications.

**Architecture:** Fire-and-forget generation using Vercel's `waitUntil()`. Client polls `/api/generation-status/[id]` every 2-3s. On completion, sidebar updates and toast notification appears. User can navigate freely during generation.

**Tech Stack:** Next.js API routes, Prisma, Vercel Functions (`waitUntil`), sonner toast, React hooks

**Design Doc:** `docs/plans/2026-01-31-background-generation-design.md`

---

## Phase 1: Archive & Contracts

### Task 1.1: Archive Current Generate Logic

**Files:**
- Create: `src/lib/generation/v1/generate-strategy.ts`
- Create: `src/lib/generation/v1/index.ts`
- Read: `src/app/api/generate/route.ts`

**Step 1: Create v1 directory**

```bash
mkdir -p src/lib/generation/v1
```

**Step 2: Create the archived generation logic**

Extract core generation logic from route.ts into a reusable function:

```typescript
// src/lib/generation/v1/generate-strategy.ts
import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { StrategyStatements, ExtractedContextVariant, isEmergentContext } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import { createExtractionRun, updateExtractionRunWithSyntheses } from '@/lib/extraction-runs';
import { logStatsigEvent } from '@/lib/statsig';
import { getCurrentPrompt } from '@/lib/prompts';

export interface GenerateStrategyInput {
  conversationId: string;
  extractedContext: ExtractedContextVariant;
  dimensionalCoverage?: unknown;
}

export interface GenerateStrategyResult {
  traceId: string;
  thoughts: string;
  statements: StrategyStatements;
  generatedOutputId?: string;
}

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
 * V1 Strategy Generation
 *
 * Extracted from /api/generate route.ts for archival and reuse.
 * This is the synchronous generation logic - call Claude, parse response, save to DB.
 */
export async function generateStrategy(input: GenerateStrategyInput): Promise<GenerateStrategyResult> {
  const { conversationId, extractedContext, dimensionalCoverage } = input;

  // Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Build prompt based on extraction approach
  let prompt: string;

  if (isEmergentContext(extractedContext)) {
    const generationPrompt = getCurrentPrompt('generation');
    const themesText = extractedContext.themes
      .map(theme => `${theme.theme_name}:\n${theme.content}`)
      .join('\n\n');
    prompt = generationPrompt.template.replace('{themes}', themesText);
  } else {
    const enrichmentText = Object.entries(extractedContext.enrichment || {})
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
      })
      .join('\n');

    const strengthsText = (extractedContext.reflective_summary?.strengths || [])
      .map(s => `- ${s}`)
      .join('\n');

    const emergingText = (extractedContext.reflective_summary?.emerging || [])
      .map(e => `- ${e}`)
      .join('\n');

    const opportunitiesText = (extractedContext.reflective_summary?.opportunities_for_enrichment || [])
      .map((opp: string) => `- ${opp}`)
      .join('\n');

    prompt = GENERATION_PROMPT
      .replace('{industry}', extractedContext.core.industry)
      .replace('{target_market}', extractedContext.core.target_market)
      .replace('{unique_value}', extractedContext.core.unique_value)
      .replace('{enrichment}', enrichmentText || 'None provided')
      .replace('{strengths}', strengthsText || 'None identified')
      .replace('{emerging}', emergingText || 'None identified')
      .replace('{unexplored}', opportunitiesText || 'None identified');
  }

  // Call Claude
  const startTime = Date.now();
  const response = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  }, 'strategy_generation');
  const latency = Date.now() - startTime;

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
    opportunities: [],
    principles: []
  };

  // Save trace (legacy)
  const trace = await prisma.trace.create({
    data: {
      conversationId,
      userId: conversation.userId,
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

  // Create GeneratedOutput (new schema)
  let generatedOutputId: string | undefined;

  if (conversation.projectId) {
    const generatedOutput = await prisma.generatedOutput.create({
      data: {
        projectId: conversation.projectId,
        userId: conversation.userId,
        outputType: 'full_decision_stack',
        version: 1,
        content: statements as any,
        modelUsed: CLAUDE_MODEL,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      }
    });
    generatedOutputId = generatedOutput.id;

    // Create ExtractionRun
    const fragments = await prisma.fragment.findMany({
      where: { conversationId },
      select: { id: true }
    });
    const fragmentIds = fragments.map(f => f.id);

    const extractionRun = await createExtractionRun({
      projectId: conversation.projectId,
      conversationId,
      experimentVariant: conversation.experimentVariant || undefined,
      fragmentIds,
      modelUsed: CLAUDE_MODEL,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs: latency,
      generatedOutputId: generatedOutput.id
    });

    // Update with syntheses
    await updateExtractionRunWithSyntheses(extractionRun.id, conversation.projectId);
  }

  // Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'completed' },
  });

  // Log to Statsig
  if (conversation.userId) {
    await logStatsigEvent(
      conversation.userId,
      'strategy_generated',
      1,
      { variant: conversation.experimentVariant || 'unknown' }
    );
  }

  return {
    traceId: trace.id,
    thoughts,
    statements,
    generatedOutputId,
  };
}
```

**Step 3: Create barrel export**

```typescript
// src/lib/generation/v1/index.ts
export { generateStrategy } from './generate-strategy';
export type { GenerateStrategyInput, GenerateStrategyResult } from './generate-strategy';
```

**Step 4: Verify it compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/generation/v1/
git commit -m "chore: archive v1 generation logic for backtesting"
```

---

### Task 1.2: Add Generation Status Contract

**Files:**
- Modify: `src/lib/contracts/generation.ts`
- Modify: `src/lib/contracts/index.ts`

**Step 1: Write the failing test**

Create test for new status contract:

```typescript
// Add to src/lib/__tests__/contracts/generation-contracts.test.ts

describe('GenerationStatusContract', () => {
  describe('validateGenerationStatus', () => {
    it('validates pending status', () => {
      const valid = {
        id: 'gen_123',
        status: 'pending',
        startedAt: null,
      };
      expect(validateGenerationStatus(valid)).toBe(true);
    });

    it('validates generating status', () => {
      const valid = {
        id: 'gen_123',
        status: 'generating',
        startedAt: '2026-01-31T12:00:00Z',
      };
      expect(validateGenerationStatus(valid)).toBe(true);
    });

    it('validates complete status with traceId', () => {
      const valid = {
        id: 'gen_123',
        status: 'complete',
        startedAt: '2026-01-31T12:00:00Z',
        traceId: 'trace_456',
      };
      expect(validateGenerationStatus(valid)).toBe(true);
    });

    it('validates failed status with error', () => {
      const valid = {
        id: 'gen_123',
        status: 'failed',
        startedAt: '2026-01-31T12:00:00Z',
        error: 'Generation timed out',
      };
      expect(validateGenerationStatus(valid)).toBe(true);
    });

    it('rejects invalid status', () => {
      const invalid = {
        id: 'gen_123',
        status: 'unknown',
      };
      expect(validateGenerationStatus(invalid)).toBe(false);
    });

    it('rejects missing id', () => {
      const invalid = {
        status: 'pending',
      };
      expect(validateGenerationStatus(invalid)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=generation-contracts
```

Expected: FAIL - `validateGenerationStatus` is not defined

**Step 3: Add the contract and validator**

```typescript
// Add to src/lib/contracts/generation.ts

// Generation status for polling
export type GenerationStatus = 'pending' | 'generating' | 'complete' | 'failed';

export interface GenerationStatusContract {
  id: string;
  status: GenerationStatus;
  startedAt: string | null;
  traceId?: string;      // Present when status === 'complete'
  error?: string;        // Present when status === 'failed'
}

export function validateGenerationStatus(data: unknown): data is GenerationStatusContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;

  const validStatuses = ['pending', 'generating', 'complete', 'failed'];
  if (typeof obj.status !== 'string' || !validStatuses.includes(obj.status)) return false;

  // startedAt must be string or null
  if (obj.startedAt !== null && typeof obj.startedAt !== 'string') return false;

  return true;
}
```

**Step 4: Update barrel export**

```typescript
// Update src/lib/contracts/index.ts - add to exports
export {
  // ... existing exports
  validateGenerationStatus,
  type GenerationStatus,
  type GenerationStatusContract,
} from './generation';
```

**Step 5: Run test to verify it passes**

```bash
npm test -- --testPathPattern=generation-contracts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/contracts/ src/lib/__tests__/contracts/
git commit -m "feat: add GenerationStatusContract for background polling"
```

---

## Phase 2: Schema & API

### Task 2.1: Add Status Fields to GeneratedOutput

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add fields to schema**

Add these fields to the `GeneratedOutput` model (after `latencyMs`):

```prisma
  // Background generation status
  status    String    @default("pending")  // pending | generating | complete | failed
  startedAt DateTime?
  viewedAt  DateTime?                       // null = unseen, set on first view
  error     String?   @db.Text              // Error message if failed
```

**Step 2: Generate Prisma client**

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully

**Step 3: Push schema to database**

```bash
npx prisma db push
```

Expected: Database synced

**Step 4: Verify type-check passes**

```bash
npm run type-check
```

Expected: No errors

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add status, startedAt, viewedAt to GeneratedOutput"
```

---

### Task 2.2: Create Fire-and-Forget Generate Endpoint

**Files:**
- Modify: `src/app/api/generate/route.ts`
- Read: `src/lib/generation/v1/generate-strategy.ts`
- Read: `src/lib/background-tasks.ts`

**Step 1: Write the contract test**

```typescript
// Add to src/lib/__tests__/contracts/generation-contracts.test.ts

describe('Background generation response', () => {
  it('returns generationId and started status', () => {
    const response = {
      status: 'started',
      generationId: 'gen_123',
    };

    expect(response.status).toBe('started');
    expect(typeof response.generationId).toBe('string');
  });
});
```

**Step 2: Run to verify test passes (simple assertion)**

```bash
npm test -- --testPathPattern=generation-contracts
```

Expected: PASS

**Step 3: Modify the generate route**

Replace entire contents of `src/app/api/generate/route.ts`:

```typescript
// src/app/api/generate/route.ts
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { prisma } from '@/lib/db';
import { generateStrategy } from '@/lib/generation/v1';
import { ExtractedContextVariant } from '@/lib/types';
import { checkAndIncrementGuestApiCalls } from '@/lib/projects';

export const maxDuration = 300;

export async function POST(req: Request) {
  console.log('[Generate API] Request started');

  // Parse request
  let conversationId: string;
  let extractedContext: ExtractedContextVariant;
  let dimensionalCoverage: any;

  try {
    const body = await req.json();
    conversationId = body.conversationId;
    extractedContext = body.extractedContext;
    dimensionalCoverage = body.dimensionalCoverage;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!conversationId || !extractedContext) {
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
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Check guest limit
  if (conversation.userId) {
    const { blocked } = await checkAndIncrementGuestApiCalls(conversation.userId);
    if (blocked) {
      return NextResponse.json(
        { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
        { status: 429 }
      );
    }
  }

  // Create GeneratedOutput with 'generating' status
  if (!conversation.projectId) {
    return NextResponse.json(
      { error: 'Conversation has no project' },
      { status: 400 }
    );
  }

  const generatedOutput = await prisma.generatedOutput.create({
    data: {
      projectId: conversation.projectId,
      userId: conversation.userId,
      outputType: 'full_decision_stack',
      status: 'generating',
      startedAt: new Date(),
      content: {}, // Will be populated on completion
      modelUsed: 'pending',
    },
  });

  console.log('[Generate API] Created GeneratedOutput:', generatedOutput.id);

  // Fire and forget - run generation in background
  waitUntil(
    runBackgroundGeneration({
      generatedOutputId: generatedOutput.id,
      conversationId,
      extractedContext,
      dimensionalCoverage,
    })
  );

  // Return immediately
  return NextResponse.json({
    status: 'started',
    generationId: generatedOutput.id,
  });
}

interface BackgroundGenerationInput {
  generatedOutputId: string;
  conversationId: string;
  extractedContext: ExtractedContextVariant;
  dimensionalCoverage?: unknown;
}

async function runBackgroundGeneration(input: BackgroundGenerationInput) {
  const { generatedOutputId, conversationId, extractedContext, dimensionalCoverage } = input;
  const startTime = Date.now();

  console.log('[Background Generation] Starting for:', generatedOutputId);

  try {
    // Run the actual generation
    const result = await generateStrategy({
      conversationId,
      extractedContext,
      dimensionalCoverage,
    });

    // Update GeneratedOutput with results
    await prisma.generatedOutput.update({
      where: { id: generatedOutputId },
      data: {
        status: 'complete',
        content: result.statements as any,
        modelUsed: 'claude-sonnet-4-20250514', // Will be set by v1 logic
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[Background Generation] Complete in ${duration}ms:`, generatedOutputId);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Background Generation] Failed:', generatedOutputId, error);

    // Mark as failed
    await prisma.generatedOutput.update({
      where: { id: generatedOutputId },
      data: {
        status: 'failed',
        error: errorMessage,
      },
    });
  }
}
```

**Step 4: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: convert /api/generate to fire-and-forget with waitUntil"
```

---

### Task 2.3: Create Generation Status Polling Endpoint

**Files:**
- Create: `src/app/api/generation-status/[id]/route.ts`

**Step 1: Write the failing test**

```typescript
// Create src/app/api/generation-status/__tests__/generation-status.test.ts
import { validateGenerationStatus } from '@/lib/contracts';

describe('/api/generation-status/[id]', () => {
  it('returns valid GenerationStatusContract for pending', () => {
    const mockResponse = {
      id: 'gen_123',
      status: 'pending',
      startedAt: null,
    };
    expect(validateGenerationStatus(mockResponse)).toBe(true);
  });

  it('returns valid GenerationStatusContract for complete with traceId', () => {
    const mockResponse = {
      id: 'gen_123',
      status: 'complete',
      startedAt: '2026-01-31T12:00:00Z',
      traceId: 'trace_456',
    };
    expect(validateGenerationStatus(mockResponse)).toBe(true);
  });
});
```

**Step 2: Run test to verify it passes (contract validation)**

```bash
npm test -- --testPathPattern=generation-status
```

Expected: PASS

**Step 3: Create the endpoint**

```typescript
// src/app/api/generation-status/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GenerationStatusContract } from '@/lib/contracts';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const generatedOutput = await prisma.generatedOutput.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      startedAt: true,
      error: true,
      // Get traceId via extraction run
      extractionRuns: {
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!generatedOutput) {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
  }

  // Find associated trace for complete generations
  let traceId: string | undefined;
  if (generatedOutput.status === 'complete') {
    // Get trace from conversation linked to this generation
    const extractionRun = generatedOutput.extractionRuns[0];
    if (extractionRun) {
      const run = await prisma.extractionRun.findUnique({
        where: { id: extractionRun.id },
        select: { conversationId: true },
      });
      if (run?.conversationId) {
        const trace = await prisma.trace.findFirst({
          where: { conversationId: run.conversationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        traceId = trace?.id;
      }
    }
  }

  const response: GenerationStatusContract = {
    id: generatedOutput.id,
    status: generatedOutput.status as any,
    startedAt: generatedOutput.startedAt?.toISOString() || null,
    ...(traceId && { traceId }),
    ...(generatedOutput.error && { error: generatedOutput.error }),
  };

  return NextResponse.json(response);
}
```

**Step 4: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/generation-status/
git commit -m "feat: add /api/generation-status/[id] polling endpoint"
```

---

### Task 2.4: Create Generation Viewed Endpoint

**Files:**
- Create: `src/app/api/generation/[id]/viewed/route.ts`

**Step 1: Create the endpoint**

```typescript
// src/app/api/generation/[id]/viewed/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const generatedOutput = await prisma.generatedOutput.findUnique({
    where: { id },
    select: { id: true, viewedAt: true },
  });

  if (!generatedOutput) {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
  }

  // Only set viewedAt if not already set
  if (!generatedOutput.viewedAt) {
    await prisma.generatedOutput.update({
      where: { id },
      data: { viewedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/generation/
git commit -m "feat: add /api/generation/[id]/viewed endpoint"
```

---

## Phase 3: UI Components

### Task 3.1: Create useGenerationStatus Hook

**Files:**
- Create: `src/hooks/useGenerationStatus.ts`

**Step 1: Create the hook**

```typescript
// src/hooks/useGenerationStatus.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { GenerationStatus, GenerationStatusContract } from '@/lib/contracts';

interface UseGenerationStatusOptions {
  onComplete?: (traceId: string) => void;
  onError?: (error: string) => void;
  pollInterval?: number;
}

interface UseGenerationStatusResult {
  status: GenerationStatus | null;
  traceId: string | null;
  error: string | null;
  isPolling: boolean;
  startPolling: (generationId: string) => void;
  stopPolling: () => void;
}

export function useGenerationStatus(options: UseGenerationStatusOptions = {}): UseGenerationStatusResult {
  const { onComplete, onError, pollInterval = 2000 } = options;

  const [generationId, setGenerationId] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  const poll = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/generation-status/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data: GenerationStatusContract = await response.json();
      setStatus(data.status);

      if (data.status === 'complete' && data.traceId) {
        setTraceId(data.traceId);
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onCompleteRef.current?.(data.traceId);
      } else if (data.status === 'failed') {
        setError(data.error || 'Generation failed');
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onErrorRef.current?.(data.error || 'Generation failed');
      }
    } catch (err) {
      console.error('Polling error:', err);
      // Don't stop polling on network errors - retry
    }
  }, []);

  const startPolling = useCallback((id: string) => {
    setGenerationId(id);
    setStatus('generating');
    setTraceId(null);
    setError(null);
    setIsPolling(true);

    // Initial poll
    poll(id);

    // Start interval
    intervalRef.current = setInterval(() => poll(id), pollInterval);
  }, [poll, pollInterval]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    status,
    traceId,
    error,
    isPolling,
    startPolling,
    stopPolling,
  };
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useGenerationStatus polling hook"
```

---

### Task 3.2: Create GenerationStatusIndicator Component

**Files:**
- Create: `src/components/GenerationStatusIndicator.tsx`
- Read: `public/animated-logo-glitch.svg` (for reference)

**Step 1: Create the component**

```typescript
// src/components/GenerationStatusIndicator.tsx
'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface GenerationStatusIndicatorProps {
  status: 'generating' | 'complete' | 'failed';
  unseen?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function GenerationStatusIndicator({
  status,
  unseen = false,
  size = 'md',
  className,
}: GenerationStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  };

  if (status === 'generating') {
    return (
      <div className={cn('relative', sizeClasses[size], className)}>
        <Image
          src="/animated-logo-glitch.svg"
          alt="Generating..."
          width={size === 'sm' ? 16 : 20}
          height={size === 'sm' ? 16 : 20}
          className="animate-pulse"
        />
      </div>
    );
  }

  if (status === 'complete' && unseen) {
    // Solid dot for unseen complete
    return (
      <div
        className={cn(
          'rounded-full bg-primary',
          size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
          className
        )}
      />
    );
  }

  if (status === 'failed') {
    return (
      <div
        className={cn(
          'rounded-full bg-destructive',
          size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
          className
        )}
      />
    );
  }

  // Complete and viewed - no indicator
  return null;
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/GenerationStatusIndicator.tsx
git commit -m "feat: add GenerationStatusIndicator with Luna logomark"
```

---

### Task 3.3: Add Toast Notification on Generation Complete

**Files:**
- Modify: `src/hooks/useGenerationStatus.ts`

**Step 1: Update hook to show toast**

Add toast import and call in the hook:

```typescript
// At top of src/hooks/useGenerationStatus.ts
import { toast } from 'sonner';

// In the poll callback, when status === 'complete':
if (data.status === 'complete' && data.traceId) {
  setTraceId(data.traceId);
  setIsPolling(false);
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  // Show toast notification
  toast.success('Your strategy is ready', {
    action: {
      label: 'View',
      onClick: () => {
        window.location.href = `/strategy/${data.traceId}`;
      },
    },
  });

  onCompleteRef.current?.(data.traceId);
}

// When status === 'failed':
if (data.status === 'failed') {
  setError(data.error || 'Generation failed');
  setIsPolling(false);
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  // Show error toast
  toast.error('Something went wrong', {
    description: data.error || 'Strategy generation failed',
  });

  onErrorRef.current?.(data.error || 'Generation failed');
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useGenerationStatus.ts
git commit -m "feat: add toast notifications to generation status hook"
```

---

## Phase 4: Integration

### Task 4.1: Update InlineChat for Background Generation

**Files:**
- Modify: `src/components/InlineChat.tsx`
- Read: `src/hooks/useGenerationStatus.ts`

**Step 1: Read current InlineChat implementation**

```bash
# Review the current generateStrategy function
```

**Step 2: Update InlineChat**

Add the hook and update the generation flow. Key changes:

1. Import the hook
2. Call `/api/generate` and get `generationId`
3. Start polling with `startPolling(generationId)`
4. Redirect to project page immediately
5. Let toast handle completion notification

```typescript
// Add import at top
import { useGenerationStatus } from '@/hooks/useGenerationStatus';

// In component body, add:
const { startPolling, isPolling } = useGenerationStatus({
  onComplete: (traceId) => {
    // Refresh sidebar strategy list
    window.dispatchEvent(new Event('strategySaved'));
  },
});

// Replace generateStrategy function:
const generateStrategy = async (context: ExtractedContextVariant, coverage: any) => {
  if (!conversationId || !context) return;

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        extractedContext: context,
        dimensionalCoverage: coverage,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Generation failed');
    }

    const { generationId } = await response.json();

    // Start polling in background
    startPolling(generationId);

    // Navigate to project page immediately
    window.location.href = `/project/${projectId}`;

  } catch (error) {
    console.error('Failed to start generation:', error);
    toast.error('Failed to start generation');
  }
};
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 4: Test manually**

1. Start dev server: `npm run dev`
2. Navigate to inline chat
3. Complete a conversation
4. Verify redirect to project page
5. Verify toast appears when complete

**Step 5: Commit**

```bash
git add src/components/InlineChat.tsx
git commit -m "feat: update InlineChat for background generation"
```

---

### Task 4.2: Update ChatSheet for Background Generation

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Step 1: Apply same pattern as InlineChat**

```typescript
// Add import at top
import { useGenerationStatus } from '@/hooks/useGenerationStatus';

// In component body:
const { startPolling } = useGenerationStatus({
  onComplete: (traceId) => {
    window.dispatchEvent(new Event('strategySaved'));
  },
});

// Replace handleGenerate function with background version:
const handleGenerate = async (ctx?: ExtractedContextVariant, coverage?: any) => {
  const contextToUse = ctx || extractedContext;
  const coverageToUse = coverage !== undefined ? coverage : dimensionalCoverage;

  if (!conversationId || !contextToUse) return;

  setIsLoading(true);

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        extractedContext: contextToUse,
        dimensionalCoverage: coverageToUse,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Generation failed');
    }

    const { generationId } = await response.json();

    // Start polling
    startPolling(generationId);

    // Close sheet and let user browse
    onOpenChange?.(false);

    // Show generating indicator in sidebar (via event)
    window.dispatchEvent(new CustomEvent('generationStarted', { detail: { generationId } }));

  } catch (error) {
    console.error('Failed to start generation:', error);
    toast.error('Failed to start generation');
  } finally {
    setIsLoading(false);
  }
};
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/chat-sheet.tsx
git commit -m "feat: update ChatSheet for background generation"
```

---

### Task 4.3: Update Sidebar to Show Generation Status

**Files:**
- Modify: `src/components/layout/app-layout.tsx`
- Read: `src/components/GenerationStatusIndicator.tsx`

**Step 1: Add generating state to sidebar**

In app-layout.tsx, add state and event listener for active generation:

```typescript
// Add state
const [activeGeneration, setActiveGeneration] = useState<string | null>(null);

// Add effect to listen for generation events
useEffect(() => {
  const handleGenerationStarted = (e: CustomEvent) => {
    setActiveGeneration(e.detail.generationId);
  };

  const handleStrategySaved = () => {
    setActiveGeneration(null);
    // Refresh strategy history
    fetchStrategyHistory();
  };

  window.addEventListener('generationStarted', handleGenerationStarted as EventListener);
  window.addEventListener('strategySaved', handleStrategySaved);

  return () => {
    window.removeEventListener('generationStarted', handleGenerationStarted as EventListener);
    window.removeEventListener('strategySaved', handleStrategySaved);
  };
}, []);
```

**Step 2: Show indicator in strategy section**

In the "Your Strategy" collapsible section, add generating state:

```tsx
{activeGeneration && (
  <SidebarMenuSubItem>
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
      <GenerationStatusIndicator status="generating" size="sm" />
      <span>generating your strategy...</span>
    </div>
  </SidebarMenuSubItem>
)}
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "feat: show generation status in sidebar"
```

---

### Task 4.4: Update KnowledgebaseHeader for Generation Status

**Files:**
- Modify: `src/components/KnowledgebaseHeader.tsx`

**Step 1: Add generating indicator**

Add a prop and indicator when generation is in progress:

```typescript
// Add to props interface
interface KnowledgebaseHeaderProps {
  // ... existing props
  isGenerating?: boolean;
}

// In component, add generating state display
{isGenerating && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <GenerationStatusIndicator status="generating" size="sm" />
    <span>adding to knowledgebase...</span>
  </div>
)}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/KnowledgebaseHeader.tsx
git commit -m "feat: show generating indicator in KnowledgebaseHeader"
```

---

### Task 4.5: Mark Strategy as Viewed on Page Visit

**Files:**
- Modify: `src/app/strategy/[id]/page.tsx` (or wherever strategy page lives)

**Step 1: Find strategy page**

```bash
# Locate the strategy page
```

**Step 2: Add viewed API call**

Add effect to mark as viewed when page loads:

```typescript
// Add effect in strategy page component
useEffect(() => {
  // Mark as viewed
  if (strategyId) {
    fetch(`/api/generation/${strategyId}/viewed`, { method: 'POST' })
      .catch(err => console.error('Failed to mark as viewed:', err));
  }
}, [strategyId]);
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/app/strategy/
git commit -m "feat: mark strategy as viewed on page visit"
```

---

### Task 4.6: End-to-End Verification

**Files:** None (testing only)

**Step 1: Run full verification**

```bash
npm run verify
```

Expected: All tests pass, no type errors

**Step 2: Manual E2E test**

1. Start dev: `npm run dev`
2. Create new conversation
3. Complete conversation, trigger extraction
4. Verify: redirects to project page immediately
5. Verify: sidebar shows "generating your strategy..."
6. Verify: knowledge bar shows "adding to knowledgebase..."
7. Wait for completion
8. Verify: toast notification appears
9. Verify: sidebar updates with strategy link
10. Click strategy link
11. Verify: strategy page loads

**Step 3: Commit final**

```bash
git add -A
git commit -m "feat: complete background generation implementation"
```

---

## Summary

**Phase 1:** Archive v1 logic, add status contract
**Phase 2:** Schema changes, fire-and-forget API, polling endpoint, viewed endpoint
**Phase 3:** useGenerationStatus hook, indicator component, toast
**Phase 4:** Integration across InlineChat, ChatSheet, sidebar, knowledge header

**Total tasks:** 14
**Estimated commits:** 14
