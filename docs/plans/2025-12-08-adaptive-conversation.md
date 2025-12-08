# Adaptive Conversation Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement user-led framing through strategic lens selection and adaptive questioning (3-10 cycles) with confidence-based stopping and reflective summarization.

**Architecture:** Enhance existing conversation flow with phase-based state machine (INITIAL → LENS_SELECTION → QUESTIONING → EXTRACTION → GENERATION). Add confidence assessment system that evaluates coverage + specificity after each response. Store enrichment data beyond core 3 fields in flexible JSON structure.

**Tech Stack:** Next.js 14, TypeScript, Prisma (PostgreSQL), Anthropic Claude API, React

---

## Task 1: Update Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add new fields to Conversation model**

Add these fields to the Conversation model after line 15:

```prisma
  currentPhase  String   @default("INITIAL") // INITIAL | LENS_SELECTION | QUESTIONING | EXTRACTION | GENERATION
  selectedLens  String?  // A | B | C | D | E
  questionCount Int      @default(0)
```

**Step 2: Add new fields to Message model**

Add these fields to the Message model after line 30:

```prisma
  confidenceScore     String?  // HIGH | MEDIUM | LOW
  confidenceReasoning String?  @db.Text
```

**Step 3: Push schema changes to database**

Run: `npm run prisma:push`

Expected: Schema updated successfully, no data loss

**Step 4: Regenerate Prisma client**

Run: `npm run prisma:generate`

Expected: Client generated with new fields

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add conversation phase and confidence tracking fields"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add phase and lens types**

Add after line 24 (after ConversationStatus):

```typescript
export type ConversationPhase = 'INITIAL' | 'LENS_SELECTION' | 'QUESTIONING' | 'EXTRACTION' | 'GENERATION';
export type StrategyLens = 'A' | 'B' | 'C' | 'D' | 'E';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
```

**Step 2: Update Conversation interface**

Add these fields to the Conversation interface after line 31:

```typescript
  currentPhase: ConversationPhase;
  selectedLens?: StrategyLens;
  questionCount: number;
```

**Step 3: Update Message interface**

Add these fields to the Message interface after line 42:

```typescript
  confidenceScore?: ConfidenceLevel;
  confidenceReasoning?: string;
```

**Step 4: Add enrichment and reflective summary types**

Add after ExtractedContext interface (after line 54):

```typescript
export interface EnrichmentFields {
  competitive_context?: string;
  customer_segments?: string[];
  operational_capabilities?: string;
  technical_advantages?: string;
  [key: string]: any; // Allow additional emergent fields
}

export interface ReflectiveSummary {
  strengths: string[];
  emerging: string[];
  unexplored: string[];
  thought_prompt?: string;
}

export interface EnhancedExtractedContext {
  core: {
    industry: string;
    target_market: string;
    unique_value: string;
  };
  enrichment: EnrichmentFields;
  reflective_summary: ReflectiveSummary;
}
```

**Step 5: Verify TypeScript compiles**

Run: `npm run type-check`

Expected: No type errors

**Step 6: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add types for adaptive conversation flow"
```

---

## Task 3: Create Confidence Assessment API

**Files:**
- Create: `src/app/api/conversation/assess-confidence/route.ts`

**Step 1: Create the API route file**

Create file with this content:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ConfidenceLevel } from '@/lib/types';

export const maxDuration = 60;

const CONFIDENCE_ASSESSMENT_PROMPT = `Evaluate this business strategy conversation for readiness to generate quality strategy output.

Conversation:
{conversation}

Assessment Criteria:

1. COVERAGE - Has the conversation touched these key dimensions?
   - Customer/market understanding (who, what problem)
   - Value proposition (why you, differentiation)
   - Context (industry, competitive landscape)

2. SPECIFICITY - Are responses concrete enough to work with?
   - Enough concrete detail to anchor strategy
   - Clear enough to identify what's uncertain/unexplored
   - Sufficient for generating strategy + highlighting development opportunities

Remember: This is a development tool. We need enough to work with, not perfect knowledge.

Return your assessment:
<assessment>
  <confidence>HIGH or MEDIUM or LOW</confidence>
  <reasoning>Brief explanation (1-2 sentences)</reasoning>
</assessment>`;

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
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n');

    // Assess confidence
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: CONFIDENCE_ASSESSMENT_PROMPT.replace('{conversation}', conversationHistory)
      }],
      temperature: 0.3
    });
    const latency = Date.now() - startTime;

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const assessmentXML = extractXML(content, 'assessment');
    const confidence = extractXML(assessmentXML, 'confidence') as ConfidenceLevel;
    const reasoning = extractXML(assessmentXML, 'reasoning');

    return NextResponse.json({
      confidenceScore: confidence || 'MEDIUM',
      confidenceReasoning: reasoning || 'Unable to assess confidence',
      latencyMs: latency,
    });
  } catch (error) {
    console.error('Assess confidence error:', error);
    return NextResponse.json(
      { error: 'Failed to assess confidence' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the endpoint manually**

Create a test conversation in database, then:

Run: `curl -X POST http://localhost:3000/api/conversation/assess-confidence -H "Content-Type: application/json" -d '{"conversationId":"test-id"}'`

Expected: Returns confidence score and reasoning (or 404 if conversation doesn't exist)

**Step 3: Commit**

```bash
git add src/app/api/conversation/assess-confidence/route.ts
git commit -m "feat: add confidence assessment API endpoint"
```

---

## Task 4: Create Lens Prompts Module

**Files:**
- Create: `src/lib/lens-prompts.ts`

**Step 1: Create lens prompt definitions**

Create file with this content:

```typescript
import { StrategyLens } from './types';

export const LENS_DESCRIPTIONS = {
  A: 'Your customers - Who they are, what they need, jobs to be done',
  B: 'Your domain/operations - Your expertise, capabilities, how you work',
  C: 'Your industry/market - Competitive landscape, market dynamics, positioning',
  D: 'Your product/technology - Features, capabilities, technical approach',
  E: 'Let AI guide me - I\'ll choose the best path based on what you\'ve shared',
};

export const LENS_SELECTION_TEXT = `What do you know the most about?

A) Your customers
B) Your domain/operations
C) Your industry/market
D) Your product/technology
E) Let AI guide me

Type the letter of your choice (A, B, C, D, or E):`;

export function getLensFramingPrompt(lens: StrategyLens, conversationHistory: string): string {
  const baseInstruction = `You are a strategic consultant. Based on the conversation so far and the user's chosen lens, ask the next natural follow-up question.

Keep it conversational - reference something specific from their previous answer. Just ask the question, nothing else.

Conversation so far:
${conversationHistory}`;

  const lensSpecificFraming = {
    A: `
You're exploring their business through a CUSTOMER lens.

Frame questions around:
- Customer problems and opportunities
- Customer segments and needs
- Customer value and experience

First question should be: "What problem do you solve, or opportunity do you create for customers?"

Then build naturally from their responses using customer-centric language.`,

    B: `
You're exploring their business through a DOMAIN/OPERATIONS lens.

Frame questions around:
- Capabilities and domain knowledge
- Processes and delivery model
- Operational advantages
- What they do uniquely well

Build questions that explore their expertise and how they work.`,

    C: `
You're exploring their business through an INDUSTRY/MARKET lens.

Frame questions around:
- Competitive landscape and differentiation
- Market dynamics and trends
- Strategic positioning

First question should be: "What makes your product different and better than others?"

Then explore competitive context and market positioning.`,

    D: `
You're exploring their business through a PRODUCT/TECHNOLOGY lens.

Frame questions around:
- Product capabilities and features
- Technical approach and innovation
- Technology advantages
- Product roadmap

Explore what makes the product technically distinctive.`,

    E: `
Based on their initial response, choose the most natural framing.

Blend approaches as needed. Adapt to their language and mental model.
Use whichever lens (customer/domain/industry/product) feels most natural
given how they described their business.`,
  };

  return baseInstruction + '\n' + lensSpecificFraming[lens] + '\n\nAsk the next question:';
}

export function getAcknowledgmentPrompt(userResponse: string): string {
  return `You are a strategic consultant. The user just gave you this response:

"${userResponse}"

Acknowledge what they shared in 1-2 sentences, showing you understood. Be warm and conversational. Then you'll present lens options next.

Just write the acknowledgment, nothing else.`;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run type-check`

Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/lens-prompts.ts
git commit -m "feat: add lens-based prompting system"
```

---

## Task 5: Update Continue API with Phase Routing

**Files:**
- Modify: `src/app/api/conversation/continue/route.ts`

**Step 1: Replace entire file content**

Replace with this complete implementation:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { ConversationPhase, StrategyLens, ConfidenceLevel } from '@/lib/types';
import {
  LENS_SELECTION_TEXT,
  getLensFramingPrompt,
  getAcknowledgmentPrompt
} from '@/lib/lens-prompts';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { conversationId, userResponse, currentPhase } = await req.json();

    if (!conversationId || !userResponse) {
      return NextResponse.json(
        { error: 'conversationId and userResponse are required' },
        { status: 400 }
      );
    }

    // Get conversation and messages
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

    const currentStep = conversation.messages.length + 1;

    // Save user's response
    await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userResponse,
        stepNumber: currentStep,
      },
    });

    // Route based on phase
    const phase = currentPhase as ConversationPhase;

    if (phase === 'INITIAL') {
      return await handleInitialPhase(conversation.id, userResponse, currentStep);
    } else if (phase === 'LENS_SELECTION') {
      return await handleLensSelection(conversation.id, userResponse, currentStep);
    } else if (phase === 'QUESTIONING') {
      return await handleQuestioning(conversation.id, currentStep);
    }

    return NextResponse.json({ error: 'Invalid phase' }, { status: 400 });

  } catch (error) {
    console.error('Continue conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to continue conversation' },
      { status: 500 }
    );
  }
}

async function handleInitialPhase(
  conversationId: string,
  userResponse: string,
  currentStep: number
) {
  // Generate acknowledgment
  const startTime = Date.now();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: getAcknowledgmentPrompt(userResponse)
    }],
    temperature: 0.7
  });

  const acknowledgment = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'Thanks for sharing that.';

  // Combine acknowledgment with lens selection
  const fullMessage = `${acknowledgment}\n\n${LENS_SELECTION_TEXT}`;

  // Save assistant's message
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullMessage,
      stepNumber: currentStep + 1,
    },
  });

  // Update conversation phase
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { currentPhase: 'LENS_SELECTION' },
  });

  return NextResponse.json({
    conversationId,
    message: fullMessage,
    nextPhase: 'LENS_SELECTION',
    stepNumber: currentStep + 1,
  });
}

async function handleLensSelection(
  conversationId: string,
  userResponse: string,
  currentStep: number
) {
  // Validate lens choice
  const lens = userResponse.trim().toUpperCase();
  if (!['A', 'B', 'C', 'D', 'E'].includes(lens)) {
    const errorMessage = 'Please type A, B, C, D, or E to select your lens.';

    await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: errorMessage,
        stepNumber: currentStep + 1,
      },
    });

    return NextResponse.json({
      conversationId,
      message: errorMessage,
      nextPhase: 'LENS_SELECTION',
      stepNumber: currentStep + 1,
      error: 'Invalid lens choice',
    });
  }

  // Get conversation history for context
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  const conversationHistory = conversation!.messages
    .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');

  // Generate first lens-framed question
  const startTime = Date.now();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: getLensFramingPrompt(lens as StrategyLens, conversationHistory)
    }],
    temperature: 0.7
  });

  const firstQuestion = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'Tell me more about your business.';

  // Save question
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: firstQuestion,
      stepNumber: currentStep + 1,
    },
  });

  // Update conversation with lens and phase
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      selectedLens: lens,
      currentPhase: 'QUESTIONING',
      questionCount: 1,
    },
  });

  return NextResponse.json({
    conversationId,
    message: firstQuestion,
    nextPhase: 'QUESTIONING',
    stepNumber: currentStep + 1,
    selectedLens: lens,
  });
}

async function handleQuestioning(
  conversationId: string,
  currentStep: number
) {
  // Get conversation with full context
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

  const questionCount = conversation.questionCount;
  const selectedLens = conversation.selectedLens as StrategyLens;

  // Call confidence assessment
  const confidenceResponse = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/conversation/assess-confidence`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }
  );

  const { confidenceScore, confidenceReasoning } = await confidenceResponse.json();

  // Update last user message with confidence
  const lastUserMessage = conversation.messages
    .filter(m => m.role === 'user')
    .pop();

  if (lastUserMessage) {
    await prisma.message.update({
      where: { id: lastUserMessage.id },
      data: {
        confidenceScore,
        confidenceReasoning,
      },
    });
  }

  // Decision logic
  if (questionCount < 3) {
    // Must ask minimum 3 questions
    return await continueQuestioning(conversationId, selectedLens, questionCount, currentStep);
  } else if (questionCount >= 10) {
    // Max reached
    return await moveToExtraction(conversationId, currentStep);
  } else if (confidenceScore === 'HIGH') {
    // Offer early exit
    return await offerEarlyExit(conversationId, currentStep);
  } else {
    // Need more coverage/specificity
    return await continueQuestioning(conversationId, selectedLens, questionCount, currentStep);
  }
}

async function continueQuestioning(
  conversationId: string,
  selectedLens: StrategyLens,
  questionCount: number,
  currentStep: number
) {
  // Get conversation history
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  const conversationHistory = conversation!.messages
    .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');

  // Generate next question
  const startTime = Date.now();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: getLensFramingPrompt(selectedLens, conversationHistory)
    }],
    temperature: 0.7
  });

  const nextQuestion = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'Tell me more.';

  // Save question
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: nextQuestion,
      stepNumber: currentStep + 1,
    },
  });

  // Increment question count
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { questionCount: questionCount + 1 },
  });

  return NextResponse.json({
    conversationId,
    message: nextQuestion,
    nextPhase: 'QUESTIONING',
    stepNumber: currentStep + 1,
  });
}

async function offerEarlyExit(
  conversationId: string,
  currentStep: number
) {
  const exitMessage = `I think I have what I need to create your strategy.

Would you like to:
A) Continue exploring
B) Generate strategy

Type A or B:`;

  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: exitMessage,
      stepNumber: currentStep + 1,
    },
  });

  // Stay in QUESTIONING phase but flag early exit offered
  return NextResponse.json({
    conversationId,
    message: exitMessage,
    nextPhase: 'QUESTIONING',
    stepNumber: currentStep + 1,
    earlyExitOffered: true,
  });
}

async function moveToExtraction(
  conversationId: string,
  currentStep: number
) {
  const message = "We've covered a lot of ground. Let me show you what I've captured and we can refine from there.";

  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: message,
      stepNumber: currentStep + 1,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { currentPhase: 'EXTRACTION' },
  });

  return NextResponse.json({
    conversationId,
    message,
    nextPhase: 'EXTRACTION',
    stepNumber: currentStep + 1,
    complete: true,
  });
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run type-check`

Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/conversation/continue/route.ts
git commit -m "feat: implement phase-based routing in continue API"
```

---

## Task 6: Enhance Extract API with Enrichment

**Files:**
- Modify: `src/app/api/extract/route.ts`

**Step 1: Update extraction prompt**

Replace the EXTRACTION_PROMPT constant (lines 9-26) with:

```typescript
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
```

**Step 2: Update the extraction logic**

Replace the extraction logic section (lines 62-89) with:

```typescript
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
```

**Step 3: Add helper function for extracting multiple XML tags**

Add this function before the POST handler:

```typescript
function extractAllXML(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'gs');
  const matches = [...xml.matchAll(regex)];
  return matches.map(match => match[1].trim()).filter(Boolean);
}
```

**Step 4: Update return statement**

Replace the return statement (lines 91-95) with:

```typescript
    return NextResponse.json({
      extractedContext,
    });
```

**Step 5: Verify TypeScript compiles**

Run: `npm run type-check`

Expected: No type errors

**Step 6: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat: add enrichment fields and reflective summary to extraction"
```

---

## Task 7: Update ChatInterface Component

**Files:**
- Modify: `src/components/ChatInterface.tsx`

**Step 1: Update component props**

Replace the interface (lines 6-12) with:

```typescript
interface ChatInterfaceProps {
  conversationId: string | null;
  messages: Message[];
  onUserResponse: (response: string) => void;
  isLoading: boolean;
  isComplete: boolean;
  currentPhase: string;
}
```

**Step 2: Update component parameters**

Update the component function parameters (lines 14-20) to include currentPhase:

```typescript
export default function ChatInterface({
  conversationId,
  messages,
  onUserResponse,
  isLoading,
  isComplete,
  currentPhase,
}: ChatInterfaceProps) {
```

**Step 3: Add phase-specific placeholder text**

Add this helper function inside the component (after useState):

```typescript
  const getPlaceholderText = () => {
    if (currentPhase === 'LENS_SELECTION') {
      return 'Type A, B, C, D, or E...';
    }
    return 'Type your response...';
  };
```

**Step 4: Update input placeholder**

Replace line 69 with:

```typescript
              placeholder={getPlaceholderText()}
```

**Step 5: Verify component renders**

Run: `npm run dev`

Expected: App compiles, no console errors

**Step 6: Commit**

```bash
git add src/components/ChatInterface.tsx
git commit -m "feat: add phase awareness to ChatInterface"
```

---

## Task 8: Enhance ExtractionConfirm Component

**Files:**
- Modify: `src/components/ExtractionConfirm.tsx`

**Step 1: Update imports**

Replace line 4 with:

```typescript
import { EnhancedExtractedContext } from '@/lib/types';
```

**Step 2: Update component props**

Replace the interface (lines 6-10) with:

```typescript
interface ExtractionConfirmProps {
  extractedContext: EnhancedExtractedContext;
  onConfirm: () => void;
  onExplore: () => void;
}
```

**Step 3: Update component parameters and state**

Replace lines 12-18 with:

```typescript
export default function ExtractionConfirm({
  extractedContext,
  onConfirm,
  onExplore,
}: ExtractionConfirmProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCore, setEditedCore] = useState(extractedContext.core);
```

**Step 4: Replace component JSX**

Replace the entire return statement with:

```typescript
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white border rounded-lg p-6 shadow-sm space-y-6">

        {/* Core Fields Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Here&apos;s what I understood:</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedCore.industry}
                  onChange={(e) => setEditedCore({
                    ...editedCore,
                    industry: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-gray-900">{extractedContext.core.industry}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Market
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedCore.target_market}
                  onChange={(e) => setEditedCore({
                    ...editedCore,
                    target_market: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-gray-900">{extractedContext.core.target_market}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unique Value
              </label>
              {isEditing ? (
                <textarea
                  value={editedCore.unique_value}
                  onChange={(e) => setEditedCore({
                    ...editedCore,
                    unique_value: e.target.value
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-gray-900">{extractedContext.core.unique_value}</p>
              )}
            </div>
          </div>
        </div>

        {/* Enrichment Fields Section */}
        {Object.keys(extractedContext.enrichment).length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-3">Additional Context</h3>
            <div className="space-y-3">
              {Object.entries(extractedContext.enrichment).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <p className="text-gray-900 text-sm">
                    {Array.isArray(value) ? value.join(', ') : value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reflective Summary Section */}
        <div className="border-t pt-6 bg-blue-50 -m-6 p-6 rounded-b-lg">
          <h3 className="text-lg font-medium mb-4">Reflection</h3>

          {extractedContext.reflective_summary.strengths.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">What&apos;s Clear</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-gray-900">{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.emerging.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">What&apos;s Emerging</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.emerging.map((area, idx) => (
                  <li key={idx} className="text-sm text-gray-900">{area}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.unexplored.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">What&apos;s Unexplored</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.unexplored.map((gap, idx) => (
                  <li key={idx} className="text-sm text-gray-900">{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.thought_prompt && (
            <div className="bg-white border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm font-medium text-gray-900">
                {extractedContext.reflective_summary.thought_prompt}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Generate my strategy
          </button>
          <button
            onClick={onExplore}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Explore further
          </button>
        </div>
      </div>
    </div>
  );
```

**Step 5: Verify component renders**

Run: `npm run dev`

Expected: App compiles, component displays properly

**Step 6: Commit**

```bash
git add src/components/ExtractionConfirm.tsx
git commit -m "feat: add enrichment and reflective summary to ExtractionConfirm"
```

---

## Task 9: Update Main Chat Page Orchestration

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Read current implementation**

First, let's see the current page implementation to understand how to update it.

Run: `cat src/app/page.tsx`

Expected: See current page structure

**Step 2: Add phase state management**

After reading the current implementation, add state for tracking phase:

```typescript
const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL');
```

**Step 3: Update continue API call**

Update the API call to include currentPhase and handle phase transitions:

```typescript
const response = await fetch('/api/conversation/continue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId,
    userResponse,
    currentPhase,
  }),
});

const data = await response.json();
setCurrentPhase(data.nextPhase);
```

**Step 4: Pass currentPhase to ChatInterface**

Update the ChatInterface component usage to include currentPhase prop.

**Step 5: Handle exploration resume**

Add handler for "explore further" from extraction:

```typescript
const handleExplore = async () => {
  setCurrentPhase('QUESTIONING');
  setPhase('chat');
  // Continue conversation will pick up from reflective prompt
};
```

**Step 6: Verify full flow**

Run: `npm run dev`

Test: Complete conversation flow from start to extraction

Expected: Phases transition correctly, extraction shows enrichment and reflective summary

**Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add phase orchestration to main chat page"
```

---

## Task 10: Integration Testing

**Files:**
- None (manual testing)

**Step 1: Test INITIAL → LENS_SELECTION flow**

Start conversation, respond to first question.

Expected: Acknowledgment + lens selection options (A-E)

**Step 2: Test LENS_SELECTION → QUESTIONING flow**

Type "A" (or any valid lens).

Expected: First lens-framed question appears, conversation moves to QUESTIONING

**Step 3: Test QUESTIONING with confidence assessment**

Answer 3+ questions with detailed responses.

Expected: Confidence scores stored in database, early exit offered if HIGH confidence

**Step 4: Test early exit acceptance**

When offered early exit, type "B".

Expected: Move to EXTRACTION phase

**Step 5: Test EXTRACTION with enrichment**

View extraction page.

Expected: Core 3 fields + enrichment fields + reflective summary displayed

**Step 6: Test exploration resume**

Click "Explore further" button.

Expected: Return to QUESTIONING phase with thought prompt

**Step 7: Test max questions (10)**

Start new conversation, answer 10 questions.

Expected: Automatically move to EXTRACTION after question 10

**Step 8: Verify database storage**

Run: `npm run prisma:studio`

Check: Conversation has currentPhase, selectedLens, questionCount
Check: Messages have confidenceScore and confidenceReasoning

Expected: All fields populated correctly

**Step 9: Document test results**

Create: `docs/testing/2025-12-08-adaptive-flow-test-results.md`

Document: What worked, what didn't, any bugs found

**Step 10: Commit test documentation**

```bash
git add docs/testing/2025-12-08-adaptive-flow-test-results.md
git commit -m "test: document adaptive conversation flow testing"
```

---

## Success Criteria Checklist

- [ ] Database schema updated with phase and confidence fields
- [ ] TypeScript types include new phase system
- [ ] Confidence assessment API working
- [ ] Lens prompts defined for all 5 lenses
- [ ] Continue API routes correctly based on phase
- [ ] Extract API returns enrichment + reflective summary
- [ ] ChatInterface shows phase-appropriate placeholders
- [ ] ExtractionConfirm displays all sections
- [ ] Main page orchestrates phase transitions
- [ ] Full flow tested end-to-end
- [ ] User can complete flow with any lens choice (A-E)
- [ ] Conversations adapt between 3-10 questions
- [ ] Early exit offers appear when confidence HIGH
- [ ] Exploration resume returns to questioning
- [ ] All data logged to database for evals

---

## Notes for Implementation

**Key Principles:**
- Follow TDD where possible (test-first for new functions)
- Commit frequently (after each task)
- Keep changes focused (one task = one concern)
- Test incrementally (don't wait until end)

**Dependencies:**
- Tasks 1-2 must complete before others (schema and types)
- Task 3 (confidence API) needed for Task 5 (continue routing)
- Task 4 (lens prompts) needed for Task 5 (continue routing)
- Tasks 7-8 (components) can be done in parallel
- Task 9 (orchestration) requires all previous tasks

**Common Gotchas:**
- Remember to restart dev server after schema changes
- Prisma client must be regenerated after schema updates
- Next.js may need clearing cache: `rm -rf .next`
- TypeScript errors may require restarting TypeScript server in IDE

**Testing Strategy:**
- Test each API endpoint independently first
- Test UI components in isolation
- Then test full integration flow
- Use Prisma Studio to verify database state
- Check console for Claude API errors

**Performance Considerations:**
- Confidence assessment adds 1-2s latency per question
- Consider adding loading states for better UX
- Monitor Claude API token usage (enrichment + reflective summary adds tokens)

---

**End of Implementation Plan**
