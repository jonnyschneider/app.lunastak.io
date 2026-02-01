# Chat Sheet Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract chat flow from HomePage into a universal ChatSheet component that can be invoked from anywhere.

**Architecture:** Create a self-contained ChatSheet component (following DocumentUploadDialog pattern) that manages the full conversation flow (chat → extraction → strategy). Remove HomePage as the chat host - project page becomes the hub, ChatSheet is the overlay.

**Tech Stack:** React, shadcn Sheet component, existing ChatInterface/ExtractionConfirm/StrategyDisplay components

---

## Task 1: Create ChatSheet Component Skeleton

**Files:**
- Create: `src/components/chat-sheet.tsx`

**Step 1: Create the basic ChatSheet component structure**

```typescript
'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type FlowStep = 'chat' | 'extracting' | 'extraction' | 'strategy'

interface ChatSheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuestion?: string
  deepDiveId?: string
}

export function ChatSheet({
  projectId,
  open,
  onOpenChange,
  initialQuestion,
  deepDiveId,
}: ChatSheetProps) {
  const [flowStep, setFlowStep] = useState<FlowStep>('chat')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {flowStep === 'chat' && 'Strategy Conversation'}
            {flowStep === 'extracting' && 'Analyzing...'}
            {flowStep === 'extraction' && 'Review Insights'}
            {flowStep === 'strategy' && 'Your Strategy'}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {/* Flow content will go here */}
          <p className="text-muted-foreground">Chat flow placeholder</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

**Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/chat-sheet.tsx
git commit -m "feat(chat): add ChatSheet component skeleton"
```

---

## Task 2: Migrate State Management from HomePage

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Step 1: Add all state variables from HomePage**

Add after the `useState<FlowStep>` line:

```typescript
import { Message, ExtractedContextVariant, StrategyStatements, ConversationPhase } from '@/lib/types'
import { ExtractionStep } from '@/components/ExtractionProgress'

// Inside the component, add all state:
const [conversationId, setConversationId] = useState<string | null>(null)
const [messages, setMessages] = useState<Message[]>([])
const [isLoading, setIsLoading] = useState(false)
const [extractedContext, setExtractedContext] = useState<ExtractedContextVariant | null>(null)
const [dimensionalCoverage, setDimensionalCoverage] = useState<any>(null)
const [strategy, setStrategy] = useState<StrategyStatements | null>(null)
const [thoughts, setThoughts] = useState<string>('')
const [traceId, setTraceId] = useState<string>('')
const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL')
const [experimentVariant, setExperimentVariant] = useState<string>('baseline-v1')
const [extractionStep, setExtractionStep] = useState<ExtractionStep>('starting')
const [extractionError, setExtractionError] = useState<string | undefined>()
const [earlyExitOffered, setEarlyExitOffered] = useState(false)
const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null)
```

**Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/chat-sheet.tsx
git commit -m "feat(chat): add state management to ChatSheet"
```

---

## Task 3: Migrate Core Functions from HomePage

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Step 1: Add conversation start functions**

Copy `startConversationWithQuestion` and `startConversationWithDeepDive` from HomePage, adapting for sheet context:

```typescript
const startConversationWithQuestion = async (question?: string) => {
  setIsLoading(true)
  try {
    const response = await fetch('/api/conversation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        ...(question && { suggestedQuestion: question }),
        ...(deepDiveId && { deepDiveId }),
      }),
    })

    const data = await response.json()
    setConversationId(data.conversationId)
    setExperimentVariant(data.experimentVariant || 'baseline-v1')

    setMessages([{
      id: `msg_${Date.now()}`,
      conversationId: data.conversationId,
      role: 'assistant',
      content: data.message,
      stepNumber: 1,
      timestamp: new Date(),
    }])

    return data.conversationId
  } catch (error) {
    console.error('Failed to start conversation:', error)
    return null
  } finally {
    setIsLoading(false)
  }
}
```

**Step 2: Add handleUserResponse function**

```typescript
const handleUserResponse = async (response: string) => {
  if (!conversationId) return

  const userMessage: Message = {
    id: `msg_${Date.now()}`,
    conversationId,
    role: 'user',
    content: response,
    stepNumber: messages.length + 1,
    timestamp: new Date(),
  }
  setMessages(prev => [...prev, userMessage])

  setIsLoading(true)
  try {
    const continueResponse = await fetch('/api/conversation/continue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        userResponse: response,
        currentPhase,
      }),
    })

    const data = await continueResponse.json()

    if (data.nextPhase) {
      setCurrentPhase(data.nextPhase)
    }

    if (data.complete) {
      extractContext()
    } else {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        conversationId,
        role: 'assistant',
        content: data.message,
        stepNumber: data.stepNumber,
        timestamp: new Date(),
      }])

      if (data.earlyExitOffered) {
        setEarlyExitOffered(true)
        setSuggestedQuestion(data.suggestedQuestion || null)
      } else {
        setEarlyExitOffered(false)
        setSuggestedQuestion(null)
      }
    }
  } catch (error) {
    console.error('Failed to continue conversation:', error)
  } finally {
    setIsLoading(false)
  }
}
```

**Step 3: Verify it compiles**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/chat-sheet.tsx
git commit -m "feat(chat): add conversation functions to ChatSheet"
```

---

## Task 4: Migrate Extraction and Generation Functions

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Step 1: Add extractContext function**

Copy from HomePage with streaming support:

```typescript
const extractContext = async () => {
  if (!conversationId) return

  setFlowStep('extracting')
  setIsLoading(true)
  setExtractionStep('starting')
  setExtractionError(undefined)

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    })

    if (!response.ok) {
      throw new Error(`Extraction failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

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

          if (update.step === 'complete') {
            const { extractedContext: ctx, dimensionalCoverage: coverage } = update.data
            setExtractedContext(ctx)
            setDimensionalCoverage(coverage)
            setFlowStep('extraction')
          } else if (update.step === 'error') {
            throw new Error(update.error || 'Extraction failed')
          } else {
            setExtractionStep(update.step)
          }
        } catch (parseError) {
          console.error('Failed to parse progress update:', line, parseError)
        }
      }
    }
  } catch (error) {
    console.error('Failed to extract context:', error)
    setExtractionStep('error')
    setExtractionError(error instanceof Error ? error.message : 'Something went wrong')
    setTimeout(() => {
      setFlowStep('chat')
      setCurrentPhase('QUESTIONING')
    }, 2000)
  } finally {
    setIsLoading(false)
  }
}
```

**Step 2: Add handleGenerate function**

```typescript
const handleGenerate = async () => {
  if (!conversationId || !extractedContext) return

  setIsLoading(true)
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        extractedContext,
        dimensionalCoverage,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Generation failed: ${response.status} - ${errorData.error || response.statusText}`)
    }

    const data = await response.json()
    setStrategy(data.statements)
    setThoughts(data.thoughts)
    setTraceId(data.traceId)
    setFlowStep('strategy')

    // Notify listeners
    window.dispatchEvent(new Event('strategySaved'))
  } catch (error) {
    console.error('Failed to generate strategy:', error)
    alert(`Failed to generate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    setIsLoading(false)
  }
}
```

**Step 3: Add handleContinue function**

```typescript
const handleContinue = async () => {
  if (conversationId) {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        eventType: 'extraction_choice',
        eventData: { choice: 'continue' },
      }),
    }).catch(err => console.error('Failed to log event:', err))
  }

  setCurrentPhase('QUESTIONING')
  setFlowStep('chat')

  if (extractedContext?.reflective_summary.thought_prompt) {
    const thoughtMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId: conversationId!,
      role: 'assistant',
      content: extractedContext.reflective_summary.thought_prompt,
      stepNumber: messages.length + 1,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, thoughtMessage])
  }
}
```

**Step 4: Verify it compiles**

Run: `npm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/chat-sheet.tsx
git commit -m "feat(chat): add extraction and generation functions to ChatSheet"
```

---

## Task 5: Add Auto-Start Effect and Render Flow

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Step 1: Add useEffect for auto-starting conversation when sheet opens**

```typescript
import { useEffect } from 'react'

// Add after state declarations:
useEffect(() => {
  if (open && !conversationId) {
    startConversationWithQuestion(initialQuestion)
  }
}, [open])

// Reset state when sheet closes
useEffect(() => {
  if (!open) {
    // Reset for next open
    setConversationId(null)
    setMessages([])
    setFlowStep('chat')
    setExtractedContext(null)
    setStrategy(null)
    setCurrentPhase('INITIAL')
  }
}, [open])
```

**Step 2: Add the render logic for each flow step**

Replace the placeholder content:

```typescript
import ChatInterface from '@/components/ChatInterface'
import ExtractionConfirm from '@/components/ExtractionConfirm'
import StrategyDisplay from '@/components/StrategyDisplay'
import FeedbackButtons from '@/components/FeedbackButtons'
import { ExtractionProgress } from '@/components/ExtractionProgress'

// In the return JSX, replace the placeholder:
<div className="mt-6 flex flex-col h-[calc(100vh-8rem)]">
  {flowStep === 'chat' && (
    <ChatInterface
      conversationId={conversationId}
      messages={messages}
      onUserResponse={handleUserResponse}
      onGenerateStrategy={extractContext}
      isLoading={isLoading}
      isComplete={false}
      currentPhase={currentPhase}
      traceId={traceId}
      earlyExitOffered={earlyExitOffered}
      suggestedQuestion={suggestedQuestion}
    />
  )}

  {flowStep === 'extracting' && (
    <ExtractionProgress
      currentStep={extractionStep}
      error={extractionError}
    />
  )}

  {flowStep === 'extraction' && extractedContext && (
    <ExtractionConfirm
      extractedContext={extractedContext}
      onGenerate={handleGenerate}
      onContinue={handleContinue}
      isGenerating={isLoading}
    />
  )}

  {flowStep === 'strategy' && strategy && conversationId && (
    <div className="space-y-4">
      <StrategyDisplay
        strategy={strategy}
        thoughts={thoughts}
        conversationId={conversationId}
        traceId={traceId}
      />
      <FeedbackButtons traceId={traceId} />
    </div>
  )}
</div>
```

**Step 3: Verify it compiles**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/chat-sheet.tsx
git commit -m "feat(chat): add auto-start and flow rendering to ChatSheet"
```

---

## Task 6: Integrate ChatSheet into Sidebar

**Files:**
- Modify: `src/components/layout/app-layout.tsx`

**Step 1: Import ChatSheet and add state**

```typescript
import { ChatSheet } from '@/components/chat-sheet'

// In AppSidebar component, add state:
const [chatSheetOpen, setChatSheetOpen] = useState(false)
```

**Step 2: Update "New Chat" sidebar button to open ChatSheet**

Find the "New Chat" SidebarMenuItem and change from Link to button:

```typescript
<SidebarMenuItem>
  <SidebarMenuButton onClick={() => setChatSheetOpen(true)}>
    <MessageSquare className="h-4 w-4" />
    <span>New Chat</span>
  </SidebarMenuButton>
</SidebarMenuItem>
```

**Step 3: Add ChatSheet to sidebar render**

Add before the closing `</Sidebar>` tag:

```typescript
{/* Chat Sheet */}
{selectedProject && (
  <ChatSheet
    projectId={selectedProject.id}
    open={chatSheetOpen}
    onOpenChange={setChatSheetOpen}
  />
)}
```

**Step 4: Verify it compiles**

Run: `npm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "feat(sidebar): integrate ChatSheet for New Chat action"
```

---

## Task 7: Update Project Page to Use ChatSheet

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Import ChatSheet and add state**

```typescript
import { ChatSheet } from '@/components/chat-sheet'

// Add state in the component:
const [chatSheetOpen, setChatSheetOpen] = useState(false)
const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>()
```

**Step 2: Update "New Chat" button in conversations card**

Find the Button that links to `/?projectId=...` and change it:

```typescript
<Button
  size="sm"
  className="w-full mt-3"
  onClick={() => {
    setChatInitialQuestion(undefined)
    setChatSheetOpen(true)
  }}
>
  <Plus className="h-3 w-3 mr-1" />
  New Chat
</Button>
```

**Step 3: Update suggested questions to use ChatSheet**

Find any suggested question click handlers and update them to:

```typescript
onClick={() => {
  setChatInitialQuestion(question)
  setChatSheetOpen(true)
}}
```

**Step 4: Add ChatSheet to project page render**

Add before the closing `</AppLayout>`:

```typescript
<ChatSheet
  projectId={projectId}
  open={chatSheetOpen}
  onOpenChange={setChatSheetOpen}
  initialQuestion={chatInitialQuestion}
/>
```

**Step 5: Verify it compiles**

Run: `npm run type-check`
Expected: No errors

**Step 6: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(project): integrate ChatSheet for conversations"
```

---

## Task 8: Update Root Page to Always Redirect

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Remove HomePage import and simplify to redirect-only**

The root page should never render content - always redirect:

```typescript
import { getServerSession } from 'next-auth/next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGuestUser } from '@/lib/projects';

const GUEST_COOKIE_NAME = 'guestUserId';

/**
 * Root page - always redirects to a project page
 * Nobody sees a "homepage" - all users land on their project
 */
export default async function Page() {
  const session = await getServerSession(authOptions);

  // Authenticated user - redirect to their first project
  if (session?.user?.id) {
    const project = await prisma.project.findFirst({
      where: { userId: session.user.id, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (project) {
      redirect(`/project/${project.id}`);
    }
    // No projects - redirect to new project creation
    redirect('/projects/new');
  }

  // Guest user flow
  const cookieStore = await cookies();
  const guestUserIdCookie = cookieStore.get(GUEST_COOKIE_NAME);

  if (guestUserIdCookie?.value) {
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserIdCookie.value },
      select: { email: true },
    });

    if (guestUser && isGuestUser(guestUser.email)) {
      const project = await prisma.project.findFirst({
        where: { userId: guestUserIdCookie.value, status: 'active' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (project) {
        redirect(`/project/${project.id}`);
      }
    }
  }

  // Create new guest
  redirect('/api/guest/init');
}
```

**Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor(routing): root page always redirects, no HomePage render"
```

---

## Task 9: Update Architecture Documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Add entry to Decision Log**

Add under "### 2026-01-14: Guest Flow Simplification":

```markdown
### 2026-01-14: Chat Flow Extraction

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| **ChatSheet as universal component** | Duplicates some HomePage logic initially | Follows DocumentUploadDialog pattern. Self-contained, reusable from anywhere (sidebar, project page). Enables future inline rendering. |
| **Remove HomePage as chat host** | Breaking change for any direct HomePage usage | HomePage was legacy - conflated routing with UI. Project page is now the hub; ChatSheet is the overlay. Cleaner separation. |
| **Sheet opens from RHS** | Takes significant screen space | Chat needs room for messages. Sheet dismissible. Can render inline later if needed for deep pages with breadcrumbs. |
```

**Step 2: Update Known Compromises if needed**

If there are any compromises from this refactor, document them.

**Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs(arch): add ChatSheet extraction to decision log"
```

---

## Task 10: Manual Testing & Cleanup

**Files:**
- Various

**Step 1: Run full verification**

Run: `npm run verify`
Expected: All tests pass

**Step 2: Manual test on localhost**

1. Start dev server: `npm run dev`
2. Test guest flow: Open incognito → lands on project page → click "New Chat" in sidebar → ChatSheet opens
3. Test auth flow: Sign in → project page → click "New Chat" → ChatSheet opens
4. Test suggested questions: Click a suggested question → ChatSheet opens with question
5. Test full flow: Chat → Extraction → Strategy generation

**Step 3: Fix any issues found**

Address issues as separate commits.

**Step 4: Final commit**

```bash
git add -A
git commit -m "test(chat): verify ChatSheet integration works end-to-end"
```

---

## Task 11: Deprecate HomePage (Optional - Future Cleanup)

**Files:**
- `src/components/HomePage.tsx`

**Note:** Don't delete HomePage immediately. Mark as deprecated with a comment:

```typescript
/**
 * @deprecated Use ChatSheet component instead.
 * This file is kept for reference during migration but should be removed
 * once ChatSheet is fully validated in production.
 *
 * Removal target: After 1 week in production with no issues.
 */
```

This can be done in a future cleanup PR.

---

## Summary

After completing all tasks:
- ✅ ChatSheet is a universal component for chat flow
- ✅ Sidebar "New Chat" opens ChatSheet
- ✅ Project page "New Chat" opens ChatSheet
- ✅ Suggested questions open ChatSheet with pre-filled question
- ✅ Root page always redirects (no HomePage render)
- ✅ Architecture documented with rationale
- ✅ HomePage deprecated (not deleted yet)
