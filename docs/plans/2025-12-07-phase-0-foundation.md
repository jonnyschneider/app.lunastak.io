# Phase 0 Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Decision Stack v4 foundation with conversational chat interface, database layer, context extraction, and comprehensive logging.

**Architecture:** Next.js 14 App Router with Prisma/Postgres for data persistence, NextAuth for magic link authentication, Claude API for conversational flow and context extraction, ReactFlow for strategy visualization.

**Tech Stack:** Next.js 14.1.0, TypeScript 5, Prisma 5.22.0, NextAuth 4.24.5, Anthropic SDK 0.17.1, ReactFlow 11.11.4, Tailwind CSS 3.3.0

---

## Prerequisites

- [x] Next.js 14 project structure initialized
- [x] Dependencies installed (npm install complete)
- [x] Dev server verified working
- [ ] Vercel Postgres database provisioned
- [ ] Environment variables configured

---

## Task 1: Copy Reusable v3 Components

**Goal:** Bring over proven components from v3 that don't need modification.

**Files:**
- Copy: `/Users/Jonny/Desktop/decision-stack-v3/web/src/lib/types.ts` → `src/lib/types.ts`
- Copy: `/Users/Jonny/Desktop/decision-stack-v3/web/src/lib/utils.ts` → `src/lib/utils.ts`
- Copy: `/Users/Jonny/Desktop/decision-stack-v3/web/src/components/StrategyFlow.tsx` → `src/components/StrategyFlow.tsx`

**Step 1: Copy types.ts**

```bash
cp /Users/Jonny/Desktop/decision-stack-v3/web/src/lib/types.ts src/lib/types.ts
```

**Step 2: Copy utils.ts**

```bash
cp /Users/Jonny/Desktop/decision-stack-v3/web/src/lib/utils.ts src/lib/utils.ts
```

**Step 3: Copy StrategyFlow.tsx**

```bash
cp /Users/Jonny/Desktop/decision-stack-v3/web/src/components/StrategyFlow.tsx src/components/StrategyFlow.tsx
```

**Step 4: Verify imports compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/utils.ts src/components/StrategyFlow.tsx
git commit -m "feat: copy reusable v3 components (types, utils, StrategyFlow)"
```

---

## Task 2: Extend Types for v4 Features

**Goal:** Add new TypeScript types for conversations, messages, traces, and database models.

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add conversation and message types**

Add to `src/lib/types.ts`:

```typescript
// Existing types remain...

// Conversation types
export type ConversationStatus = 'in_progress' | 'completed' | 'abandoned';

export interface Conversation {
  id: string;
  userId: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageRole = 'assistant' | 'user';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  stepNumber: number;
  timestamp: Date;
}

// Context extraction types
export type ExtractionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ExtractedContext {
  industry: string;
  targetMarket: string;
  uniqueValue: string;
  extractionConfidence: ExtractionConfidence;
  rawConversation: Message[];
}

// Trace types
export type UserFeedback = 'helpful' | 'not_helpful';

export interface Trace {
  id: string;
  conversationId: string;
  userId: string;
  timestamp: Date;
  extractedContext: ExtractedContext;
  output: StrategyStatements;
  claudeThoughts: string;
  modelUsed: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  userFeedback?: UserFeedback;
  feedbackTimestamp?: Date;
  refinementRequested: boolean;
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add conversation, message, and trace types for v4"
```

---

## Task 3: Create Prisma Schema

**Goal:** Define database schema for Conversations, Messages, and Traces tables.

**Files:**
- Create: `prisma/schema.prisma`

**Step 1: Create prisma directory and schema file**

```bash
mkdir -p prisma
```

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Conversation {
  id        String   @id @default(cuid())
  userId    String
  status    String   // 'in_progress' | 'completed' | 'abandoned'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  messages  Message[]
  traces    Trace[]

  @@index([userId])
  @@index([createdAt])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // 'assistant' | 'user'
  content        String   @db.Text
  stepNumber     Int
  timestamp      DateTime @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([timestamp])
}

model Trace {
  id                  String   @id @default(cuid())
  conversationId      String
  userId              String
  timestamp           DateTime @default(now())

  // Extracted Context (stored as JSON)
  extractedContext    Json

  // Generated Output (stored as JSON)
  output              Json
  claudeThoughts      String?  @db.Text

  // Metadata
  modelUsed           String
  totalTokens         Int
  promptTokens        Int
  completionTokens    Int
  latencyMs           Int

  // User Feedback
  userFeedback        String?  // 'helpful' | 'not_helpful'
  feedbackTimestamp   DateTime?
  refinementRequested Boolean  @default(false)

  conversation        Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([timestamp])
  @@index([userFeedback])
}
```

**Step 2: Generate Prisma client**

Run: `npm run prisma:generate`
Expected: "Generated Prisma Client"

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Prisma schema for conversations, messages, traces"
```

**Note:** Database push deferred until environment variables configured.

---

## Task 4: Create Database Client Utility

**Goal:** Create singleton Prisma client for database access.

**Files:**
- Create: `src/lib/db.ts`

**Step 1: Create db.ts**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 2: Verify imports compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add Prisma client singleton utility"
```

---

## Task 5: Create Anthropic Client Utility

**Goal:** Create reusable Claude API client wrapper.

**Files:**
- Create: `src/lib/claude.ts`

**Step 1: Create claude.ts**

Create `src/lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

export const anthropic = new Anthropic({
  apiKey,
  maxRetries: 3,
  timeout: 180_000, // 3 minute timeout
});

export const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022'; // Updated from v3's opus
```

**Step 2: Verify imports compile**

Run: `npm run type-check`
Expected: No TypeScript errors (will show warning about missing env var in dev, this is expected)

**Step 3: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add Anthropic client utility"
```

---

## Task 6: Create Conversation API - Start New Conversation

**Goal:** API endpoint to create new conversation and ask first question.

**Files:**
- Create: `src/app/api/conversation/start/route.ts`

**Step 1: Create directory structure**

```bash
mkdir -p src/app/api/conversation/start
```

**Step 2: Create start conversation endpoint**

Create `src/app/api/conversation/start/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';

export const runtime = 'edge';
export const maxDuration = 300;

const FIRST_QUESTION_PROMPT = `You are a strategic consultant helping someone articulate their business strategy.

Ask them to describe their business challenge or opportunity in their own words. Keep it warm, conversational, and open-ended. Just ask the question, nothing else.`;

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        status: 'in_progress',
      },
    });

    // Generate first question
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: FIRST_QUESTION_PROMPT
      }],
      temperature: 0.7
    });
    const latency = Date.now() - startTime;

    const firstQuestion = response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'What business challenge or opportunity are you working on right now?';

    // Save first message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: firstQuestion,
        stepNumber: 1,
      },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      message: firstQuestion,
      stepNumber: 1,
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to start conversation' },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/app/api/conversation/start/route.ts
git commit -m "feat: add API endpoint to start conversation"
```

---

## Task 7: Create Conversation API - Continue Conversation

**Goal:** API endpoint to continue conversation with follow-up questions.

**Files:**
- Create: `src/app/api/conversation/continue/route.ts`

**Step 1: Create continue conversation endpoint**

Create `src/app/api/conversation/continue/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';

export const runtime = 'edge';
export const maxDuration = 300;

const FOLLOW_UP_PROMPT = `You are a strategic consultant. Based on the conversation so far, ask the next natural follow-up question to understand their business better.

Focus on understanding:
- Question 2: Who they're serving (target market)
- Question 3: What makes their approach unique (differentiation)

Keep it conversational - reference something specific from their previous answer. Just ask the question, nothing else.

Conversation so far:
{conversation}

Ask the next question:`;

export async function POST(req: Request) {
  try {
    const { conversationId, userResponse } = await req.json();

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

    // If we have 3 questions answered, don't ask another
    const userMessages = conversation.messages.filter(m => m.role === 'user').length + 1;
    if (userMessages >= 3) {
      return NextResponse.json({
        conversationId,
        complete: true,
        stepNumber: currentStep,
      });
    }

    // Build conversation history
    const conversationHistory = conversation.messages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n');
    const fullHistory = `${conversationHistory}\n\nUser: ${userResponse}`;

    // Generate next question
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: FOLLOW_UP_PROMPT.replace('{conversation}', fullHistory)
      }],
      temperature: 0.7
    });
    const latency = Date.now() - startTime;

    const nextQuestion = response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'What else would you like to share about your business?';

    // Save next question
    await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: nextQuestion,
        stepNumber: currentStep + 1,
      },
    });

    return NextResponse.json({
      conversationId,
      message: nextQuestion,
      stepNumber: currentStep + 1,
      complete: false,
    });
  } catch (error) {
    console.error('Continue conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to continue conversation' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/api/conversation/continue/route.ts
git commit -m "feat: add API endpoint to continue conversation"
```

---

## Task 8: Create Extraction API - Extract Context

**Goal:** Extract structured context from conversation using Claude.

**Files:**
- Create: `src/app/api/extract/route.ts`

**Step 1: Create extract endpoint**

Create `src/app/api/extract/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ExtractedContext, ExtractionConfidence } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 300;

const EXTRACTION_PROMPT = `You are analyzing a business strategy conversation. Extract structured information and assess confidence.

Conversation:
{conversation}

Extract the following and assess your confidence (HIGH/MEDIUM/LOW):

<context>
  <industry>The specific industry (be specific, not generic)</industry>
  <target_market>The specific customer segment they're targeting</target_market>
  <unique_value>Their key differentiator or unique value proposition</unique_value>
  <confidence>HIGH/MEDIUM/LOW</confidence>
</context>

If confidence is not HIGH, also include:
<missing>
What specific information is unclear or missing
</missing>`;

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

    // Extract context
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: EXTRACTION_PROMPT.replace('{conversation}', conversationHistory)
      }],
      temperature: 0.3
    });
    const latency = Date.now() - startTime;

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const contextXML = extractXML(content, 'context');
    const industry = extractXML(contextXML, 'industry');
    const targetMarket = extractXML(contextXML, 'target_market');
    const uniqueValue = extractXML(contextXML, 'unique_value');
    const confidence = extractXML(contextXML, 'confidence') as ExtractionConfidence;
    const missing = extractXML(content, 'missing');

    const extractedContext: ExtractedContext = {
      industry,
      targetMarket,
      uniqueValue,
      extractionConfidence: confidence || 'MEDIUM',
      rawConversation: conversation.messages,
    };

    return NextResponse.json({
      extractedContext,
      missing: missing || null,
      needsClarification: confidence !== 'HIGH',
    });
  } catch (error) {
    console.error('Extract context error:', error);
    return NextResponse.json(
      { error: 'Failed to extract context' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat: add API endpoint to extract context from conversation"
```

---

## Task 9: Create Generation API - Generate Strategy

**Goal:** Generate strategy statements and save trace to database.

**Files:**
- Create: `src/app/api/generate/route.ts`

**Step 1: Create generate endpoint**

Create `src/app/api/generate/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ExtractedContext, StrategyStatements, Trace } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 300;

const GENERATION_PROMPT = `Generate compelling strategy statements based on the business context provided.

Context:
Industry: {industry}
Target Market: {targetMarket}
Unique Value: {uniqueValue}

Guidelines:
- Vision: Should be aspirational, future-focused, and memorable
- Mission: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)

Format your response as:
<thoughts>Your reasoning about the strategy</thoughts>
<statements>
  <vision>The vision statement</vision>
  <mission>The mission statement</mission>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`;

export async function POST(req: Request) {
  try {
    const { conversationId, extractedContext } = await req.json();

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
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const { industry, targetMarket, uniqueValue } = extractedContext as ExtractedContext;

    const prompt = GENERATION_PROMPT
      .replace('{industry}', industry)
      .replace('{targetMarket}', targetMarket)
      .replace('{uniqueValue}', uniqueValue);

    // Generate strategy
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7
    });
    const latency = Date.now() - startTime;

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const thoughts = extractXML(content, 'thoughts');
    const statementsXML = extractXML(content, 'statements');

    const statements: StrategyStatements = {
      vision: extractXML(statementsXML, 'vision'),
      mission: extractXML(statementsXML, 'mission'),
      objectives: extractXML(statementsXML, 'objectives')
        .split('\n')
        .filter(line => line.trim().length > 0)
    };

    // Save trace
    const trace = await prisma.trace.create({
      data: {
        conversationId,
        userId: conversation.userId,
        extractedContext: extractedContext as any,
        output: statements as any,
        claudeThoughts: thoughts,
        modelUsed: CLAUDE_MODEL,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      },
    });

    // Update conversation status
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'completed' },
    });

    return NextResponse.json({
      traceId: trace.id,
      thoughts,
      statements,
    });
  } catch (error) {
    console.error('Generate strategy error:', error);
    return NextResponse.json(
      { error: 'Failed to generate strategy' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: add API endpoint to generate strategy with trace logging"
```

---

## Task 10: Create Feedback API

**Goal:** Save user feedback on generated strategies.

**Files:**
- Create: `src/app/api/feedback/route.ts`

**Step 1: Create feedback endpoint**

Create `src/app/api/feedback/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UserFeedback } from '@/lib/types';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { traceId, feedback } = await req.json();

    if (!traceId || !feedback) {
      return NextResponse.json(
        { error: 'traceId and feedback are required' },
        { status: 400 }
      );
    }

    if (feedback !== 'helpful' && feedback !== 'not_helpful') {
      return NextResponse.json(
        { error: 'feedback must be "helpful" or "not_helpful"' },
        { status: 400 }
      );
    }

    // Update trace with feedback
    await prisma.trace.update({
      where: { id: traceId },
      data: {
        userFeedback: feedback,
        feedbackTimestamp: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: add API endpoint to save user feedback"
```

---

## Task 11: Create Chat Interface Component

**Goal:** Build conversational chat UI with message bubbles.

**Files:**
- Create: `src/components/ChatInterface.tsx`

**Step 1: Create ChatInterface component**

Create `src/components/ChatInterface.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Message } from '@/lib/types';

interface ChatInterfaceProps {
  conversationId: string | null;
  messages: Message[];
  onUserResponse: (response: string) => void;
  isLoading: boolean;
  isComplete: boolean;
}

export default function ChatInterface({
  conversationId,
  messages,
  onUserResponse,
  isLoading,
  isComplete,
}: ChatInterfaceProps) {
  const [userInput, setUserInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    onUserResponse(userInput);
    setUserInput('');
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <p className="text-gray-500">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {!isComplete && (
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your response..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ChatInterface.tsx
git commit -m "feat: add chat interface component"
```

---

## Task 12: Create Extraction Confirmation Component

**Goal:** Display extracted context with edit capability.

**Files:**
- Create: `src/components/ExtractionConfirm.tsx`

**Step 1: Create ExtractionConfirm component**

Create `src/components/ExtractionConfirm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { ExtractedContext } from '@/lib/types';

interface ExtractionConfirmProps {
  extractedContext: ExtractedContext;
  onConfirm: (context: ExtractedContext) => void;
  onEdit: () => void;
}

export default function ExtractionConfirm({
  extractedContext,
  onConfirm,
  onEdit,
}: ExtractionConfirmProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContext, setEditedContext] = useState(extractedContext);

  const handleSave = () => {
    onConfirm(editedContext);
    setIsEditing(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Here&apos;s what I understood:</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedContext.industry}
                onChange={(e) => setEditedContext({
                  ...editedContext,
                  industry: e.target.value
                })}
                className="w-full px-3 py-2 border rounded-md"
              />
            ) : (
              <p className="text-gray-900">{extractedContext.industry}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Market
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedContext.targetMarket}
                onChange={(e) => setEditedContext({
                  ...editedContext,
                  targetMarket: e.target.value
                })}
                className="w-full px-3 py-2 border rounded-md"
              />
            ) : (
              <p className="text-gray-900">{extractedContext.targetMarket}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unique Value
            </label>
            {isEditing ? (
              <textarea
                value={editedContext.uniqueValue}
                onChange={(e) => setEditedContext({
                  ...editedContext,
                  uniqueValue: e.target.value
                })}
                rows={3}
                className="w-full px-3 py-2 border rounded-md"
              />
            ) : (
              <p className="text-gray-900">{extractedContext.uniqueValue}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedContext(extractedContext);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onConfirm(extractedContext)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Looks Good →
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ExtractionConfirm.tsx
git commit -m "feat: add extraction confirmation component with edit capability"
```

---

## Task 13: Create Strategy Display Component

**Goal:** Display generated strategy with ReactFlow visualization.

**Files:**
- Create: `src/components/StrategyDisplay.tsx`

**Step 1: Create StrategyDisplay component**

Create `src/components/StrategyDisplay.tsx`:

```typescript
'use client';

import { StrategyStatements } from '@/lib/types';
import StrategyFlow from './StrategyFlow';

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  thoughts?: string;
}

export default function StrategyDisplay({ strategy, thoughts }: StrategyDisplayProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Thoughts (optional) */}
      {thoughts && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Strategic Thinking:</h3>
          <p className="text-blue-800 whitespace-pre-wrap">{thoughts}</p>
        </div>
      )}

      {/* Strategy Statements */}
      <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Vision</h3>
          <p className="text-lg text-gray-900">{strategy.vision}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Mission</h3>
          <p className="text-lg text-gray-900">{strategy.mission}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Objectives</h3>
          <ul className="list-disc list-inside space-y-1">
            {strategy.objectives.map((objective, index) => (
              <li key={index} className="text-gray-900">{objective}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ReactFlow Visualization */}
      <div className="bg-white border rounded-lg shadow-sm" style={{ height: '600px' }}>
        <StrategyFlow strategy={strategy} />
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git commit -m "feat: add strategy display component with visualization"
```

---

## Task 14: Create Feedback Buttons Component

**Goal:** Simple thumbs up/down feedback UI.

**Files:**
- Create: `src/components/FeedbackButtons.tsx`

**Step 1: Create FeedbackButtons component**

Create `src/components/FeedbackButtons.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { UserFeedback } from '@/lib/types';

interface FeedbackButtonsProps {
  traceId: string;
  onFeedback?: (feedback: UserFeedback) => void;
}

export default function FeedbackButtons({ traceId, onFeedback }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<UserFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (selectedFeedback: UserFeedback) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId, feedback: selectedFeedback }),
      });

      if (response.ok) {
        setFeedback(selectedFeedback);
        onFeedback?.(selectedFeedback);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (feedback) {
    return (
      <div className="text-center py-4 text-gray-600">
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className="flex gap-4 justify-center py-6">
      <button
        onClick={() => handleFeedback('helpful')}
        disabled={isSubmitting}
        className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <span className="text-2xl">👍</span>
        <span>This is helpful</span>
      </button>
      <button
        onClick={() => handleFeedback('not_helpful')}
        disabled={isSubmitting}
        className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <span className="text-2xl">👎</span>
        <span>Not quite right</span>
      </button>
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/FeedbackButtons.tsx
git commit -m "feat: add feedback buttons component"
```

---

## Task 15: Create Main Chat Page

**Goal:** Orchestrate conversation flow on main page.

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace page.tsx with chat orchestration**

Replace `src/app/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import ExtractionConfirm from '@/components/ExtractionConfirm';
import StrategyDisplay from '@/components/StrategyDisplay';
import FeedbackButtons from '@/components/FeedbackButtons';
import { Message, ExtractedContext, StrategyStatements } from '@/lib/types';

type FlowStep = 'chat' | 'extraction' | 'strategy';

export default function Home() {
  const [userId] = useState(() => `user_${Date.now()}`); // Temp user ID until auth
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('chat');
  const [extractedContext, setExtractedContext] = useState<ExtractedContext | null>(null);
  const [strategy, setStrategy] = useState<StrategyStatements | null>(null);
  const [thoughts, setThoughts] = useState<string>('');
  const [traceId, setTraceId] = useState<string>('');

  // Start conversation on mount
  useEffect(() => {
    startConversation();
  }, []);

  const startConversation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      setConversationId(data.conversationId);
      setMessages([{
        id: `msg_${Date.now()}`,
        conversationId: data.conversationId,
        role: 'assistant',
        content: data.message,
        stepNumber: 1,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('Failed to start conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserResponse = async (response: string) => {
    if (!conversationId) return;

    // Add user message optimistically
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId,
      role: 'user',
      content: response,
      stepNumber: messages.length + 1,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);
    try {
      const continueResponse = await fetch('/api/conversation/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userResponse: response }),
      });

      const data = await continueResponse.json();

      if (data.complete) {
        // Move to extraction step
        extractContext();
      } else {
        // Add assistant's next question
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}`,
          conversationId,
          role: 'assistant',
          content: data.message,
          stepNumber: data.stepNumber,
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      console.error('Failed to continue conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const extractContext = async () => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });

      const data = await response.json();
      setExtractedContext(data.extractedContext);
      setFlowStep('extraction');
    } catch (error) {
      console.error('Failed to extract context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmContext = async (context: ExtractedContext) => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, extractedContext: context }),
      });

      const data = await response.json();
      setStrategy(data.statements);
      setThoughts(data.thoughts);
      setTraceId(data.traceId);
      setFlowStep('strategy');
    } catch (error) {
      console.error('Failed to generate strategy:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Decision Stack</h1>

        {flowStep === 'chat' && (
          <div className="h-[600px]">
            <ChatInterface
              conversationId={conversationId}
              messages={messages}
              onUserResponse={handleUserResponse}
              isLoading={isLoading}
              isComplete={false}
            />
          </div>
        )}

        {flowStep === 'extraction' && extractedContext && (
          <ExtractionConfirm
            extractedContext={extractedContext}
            onConfirm={handleConfirmContext}
            onEdit={() => {}} // TODO: implement edit flow
          />
        )}

        {flowStep === 'strategy' && strategy && (
          <>
            <StrategyDisplay strategy={strategy} thoughts={thoughts} />
            <FeedbackButtons traceId={traceId} />
          </>
        )}
      </div>
    </main>
  );
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Test dev server**

Run: `npm run dev`
Expected: Server starts, page loads (will show errors until database configured)

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: implement main chat page with conversation flow orchestration"
```

---

## Task 16: Update .gitignore

**Goal:** Ensure proper files are ignored.

**Files:**
- Modify: `.gitignore`

**Step 1: Add database and environment files to .gitignore**

Verify `.gitignore` includes:

```
# dependencies
/node_modules

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# prisma
prisma/migrations
```

**Step 2: Commit if modified**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for Prisma and env files"
```

---

## Deployment Prerequisites (Not in Plan - Manual Steps)

**These steps must be done manually before full testing:**

1. **Provision Vercel Postgres:**
   - Go to Vercel dashboard
   - Create new Postgres database
   - Copy DATABASE_URL

2. **Set Environment Variables:**
   - Create `.env.local`
   - Add ANTHROPIC_API_KEY
   - Add DATABASE_URL
   - Add NEXTAUTH_SECRET (generate: `openssl rand -base64 32`)
   - Add NEXTAUTH_URL=http://localhost:3000

3. **Initialize Database:**
   ```bash
   npm run prisma:push
   ```

4. **Test Full Flow:**
   ```bash
   npm run dev
   # Visit http://localhost:3000
   # Complete conversation
   # Verify strategy generation
   # Check database in Prisma Studio: npm run prisma:studio
   ```

---

## Phase 0 Completion Checklist

From `readme/PROJECT_STATUS.md > Phase 0: Foundation > Acceptance Criteria Progress`:

### Functionality
- [ ] Users can start a conversation ✅ (Task 6)
- [ ] 3 sequential questions are asked naturally ✅ (Tasks 6-7)
- [ ] Free-form text responses accepted ✅ (Task 11)
- [ ] Context extraction shows to user ✅ (Tasks 8, 12)
- [ ] User can edit extracted context ✅ (Task 12)
- [ ] Strategy generation works ✅ (Task 9)
- [ ] ReactFlow visualization displays ✅ (Tasks 1, 13)
- [ ] Feedback buttons present ✅ (Task 14)

### Technical
- [ ] All conversations saved to database ✅ (Task 3, 6)
- [ ] All messages logged with timestamps ✅ (Task 3, 7)
- [ ] Traces include full conversation history ✅ (Task 9)
- [ ] Claude calls logged with tokens/latency ✅ (Task 9)
- [ ] Works on mobile (responsive) - Need to test
- [ ] Deployed to Vercel - Not in plan
- [ ] Environment variables configured - Manual step

### Data Quality
- [ ] Can export traces to CSV easily - Future task
- [ ] CSV includes all necessary fields - Future task
- [ ] Trace IDs are unique and trackable ✅ (Prisma CUID)
- [ ] Timestamps are accurate ✅ (Task 3)

### User Experience
- [ ] Flow feels conversational ✅ (Tasks 6-7, 11)
- [ ] No obvious bugs - Need testing
- [ ] Load times acceptable - Need testing
- [ ] Instructions clear - Need copy/polish

---

## What's NOT in This Plan

**Deferred to Future Sessions:**
- NextAuth implementation (magic link authentication)
- User dashboard / conversation history
- CSV export functionality
- Mobile responsive testing/fixes
- Error handling polish
- Loading states polish
- Copy/messaging refinement
- Vercel deployment configuration
- Production environment setup
- Analytics integration

**Why Deferred:**
- Phase 0 goal is "working foundation" not "production polish"
- Can test core flow without auth (temp user IDs)
- Export can be done via Prisma Studio initially
- Deployment after basic testing confirms flow works

---

## Execution Notes

**Estimated Time:** 4-6 hours for all tasks (assuming no major issues)

**Key Risks:**
- Database connection issues (mitigated: clear error messages)
- Claude API rate limits (mitigated: generous timeouts, retries)
- Type mismatches (mitigated: explicit types throughout)

**Testing Strategy:**
- Type-check after each task
- Manual testing after Task 15
- Full flow test after database initialization

**Commit Discipline:**
- Commit after every task (16 commits total)
- Clear, descriptive commit messages
- Small, focused changes per commit
