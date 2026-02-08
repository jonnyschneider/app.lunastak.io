# First-Time Experience Fix - Phase 1 & 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix first-time conversation flow so users who leave and return resume in InlineChat, not ChatSheet.

**Architecture:** Add `isInitialConversation` flag to Conversation model. Set flag based on whether project has existing strategy. Detect incomplete initial conversations and route to FirstTimeEmptyState with resume capability.

**Tech Stack:** Prisma, Next.js, React

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma:12-43`
- Create: Migration file (auto-generated)

**Step 1: Add field to schema**

In `prisma/schema.prisma`, add to the Conversation model after line 21 (`questionCount`):

```prisma
  // First-time experience: marks the conversation leading to first strategy
  isInitialConversation Boolean @default(false)
```

**Step 2: Generate migration**

Run:
```bash
npx prisma migrate dev --name add_is_initial_conversation
```

Expected: Migration created successfully, database updated.

**Step 3: Verify schema**

Run:
```bash
npx prisma studio
```

Open Conversation table, verify `isInitialConversation` column exists with default `false`.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add isInitialConversation flag to Conversation"
```

---

## Task 2: Set Flag on Conversation Start

**Files:**
- Modify: `src/app/api/conversation/start/route.ts:153-162`

**Step 1: Add strategy check before conversation creation**

After line 151 (after deep dive lookup, before conversation creation), add:

```typescript
    // Check if project has any existing strategy (completed trace)
    const hasExistingStrategy = await prisma.trace.findFirst({
      where: {
        conversation: { projectId: targetProjectId },
        output: { not: {} },  // Has generated output
      },
      select: { id: true },
    });
```

**Step 2: Set flag in conversation creation**

Modify the `prisma.conversation.create` call (lines 154-162) to include the flag:

```typescript
    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        projectId: targetProjectId,
        deepDiveId: deepDive?.id || null,
        status: 'in_progress',
        experimentVariant,
        isInitialConversation: !hasExistingStrategy,  // True if no strategy exists yet
      },
    });
```

**Step 3: Test manually**

1. Create new project (no strategy)
2. Start conversation
3. Check database: `isInitialConversation` should be `true`

4. Create strategy for that project
5. Start new conversation
6. Check database: `isInitialConversation` should be `false`

**Step 4: Commit**

```bash
git add src/app/api/conversation/start/route.ts
git commit -m "feat(api): set isInitialConversation flag based on existing strategy"
```

---

## Task 3: Include Flag in Conversation API Response

**Files:**
- Modify: `src/app/api/conversation/[id]/route.ts:29-37`

**Step 1: Add flag to GET response**

Modify the response (lines 29-37) to include `isInitialConversation`:

```typescript
  return NextResponse.json({
    id: conversation.id,
    status: conversation.status,
    currentPhase: conversation.currentPhase,
    experimentVariant: conversation.experimentVariant,
    messages: conversation.messages,
    deepDiveId: conversation.deepDiveId,
    deepDive: conversation.deepDive,
    isInitialConversation: conversation.isInitialConversation,  // ADD
  });
```

**Step 2: Commit**

```bash
git add src/app/api/conversation/[id]/route.ts
git commit -m "feat(api): include isInitialConversation in conversation response"
```

---

## Task 4: Include Flag in Project Conversations List

**Files:**
- Modify: `src/app/api/project/[id]/route.ts` (conversation select)

**Step 1: Find and update conversation select**

Search for where conversations are selected in the project API. Add `isInitialConversation` to the select:

```typescript
conversations: {
  select: {
    id: true,
    title: true,
    status: true,
    createdAt: true,
    deepDiveId: true,
    isInitialConversation: true,  // ADD
    // ... existing fields
  },
  // ...
}
```

**Step 2: Commit**

```bash
git add src/app/api/project/[id]/route.ts
git commit -m "feat(api): include isInitialConversation in project conversations list"
```

---

## Task 5: Detect Incomplete Initial Conversation in Project Page

**Files:**
- Modify: `src/app/project/[id]/page.tsx:399-413`

**Step 1: Add detection logic**

Replace the isEmpty check and conditional (lines 399-413) with:

```typescript
  // Show empty state when project has no content
  const isEmpty =
    (projectData?.stats?.fragmentCount ?? 0) === 0 &&
    (projectData?.conversations?.length ?? 0) === 0

  // Check for incomplete initial conversation (started first-time flow but didn't finish)
  const incompleteInitialConvo = projectData?.conversations?.find(
    (c: any) => c.isInitialConversation && c.status === 'in_progress'
  )

  if ((isEmpty || incompleteInitialConvo) && projectData) {
    return (
      <AppLayout>
        <FirstTimeEmptyState
          projectId={projectId}
          resumeConversationId={incompleteInitialConvo?.id}
          onUploadComplete={() => fetchProjectData()}
        />
      </AppLayout>
    )
  }
```

**Step 2: Update FirstTimeEmptyState props type** (will be done in Task 6)

**Step 3: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(ui): detect incomplete initial conversation and route to FirstTimeEmptyState"
```

---

## Task 6: Add Resume Support to FirstTimeEmptyState

**Files:**
- Modify: `src/components/FirstTimeEmptyState.tsx:10-20, 71-79`

**Step 1: Update props interface**

Modify the interface (lines 10-13):

```typescript
interface FirstTimeEmptyStateProps {
  projectId: string
  resumeConversationId?: string  // ADD
  onUploadComplete?: () => void
}
```

**Step 2: Update component signature**

Modify the function signature (line 15):

```typescript
export function FirstTimeEmptyState({ projectId, resumeConversationId, onUploadComplete }: FirstTimeEmptyStateProps) {
```

**Step 3: Pass resume ID to InlineChat**

Modify the InlineChat usage (lines 71-79):

```typescript
        {/* Inline Chat */}
        <div className={chatStarted || resumeConversationId ? 'flex-1 min-h-0' : ''}>
          <InlineChat
            key={resumeConversationId || uploadedFileName || 'default'}
            projectId={projectId}
            resumeConversationId={resumeConversationId}
            initialMessage={uploadedFileName ? `I've uploaded ${uploadedFileName}. Let's discuss it.` : undefined}
            autoStart={!!uploadedFileName}
            onConversationStart={() => setChatStarted(true)}
          />
        </div>
```

**Step 4: Auto-expand if resuming**

Add useEffect after the state declarations (around line 21):

```typescript
  // Auto-expand chat if resuming a conversation
  useEffect(() => {
    if (resumeConversationId) {
      setChatStarted(true)
    }
  }, [resumeConversationId])
```

Add `useEffect` to the imports at the top:

```typescript
import { useState, useEffect } from 'react'
```

**Step 5: Commit**

```bash
git add src/components/FirstTimeEmptyState.tsx
git commit -m "feat(ui): add resume support to FirstTimeEmptyState"
```

---

## Task 7: Add Resume Support to InlineChat

**Files:**
- Modify: `src/components/InlineChat.tsx:20-26, 56-66`

**Step 1: Update props interface**

Modify the interface (lines 20-26):

```typescript
interface InlineChatProps {
  projectId: string
  resumeConversationId?: string  // ADD
  initialMessage?: string
  autoStart?: boolean
  onConversationStart?: (conversationId: string) => void
}
```

**Step 2: Update component signature**

Modify the destructuring (line 27):

```typescript
export function InlineChat({ projectId, resumeConversationId, initialMessage, autoStart, onConversationStart }: InlineChatProps) {
```

**Step 3: Add resume function**

After the `startConversation` function (after line 119), add:

```typescript
  // Resume an existing conversation
  const resumeConversation = async (convId: string) => {
    setIsLoading(true)
    setIsExpanded(true)
    setError(null)

    try {
      const response = await fetch(`/api/conversation/${convId}`)
      if (!response.ok) {
        throw new Error('Failed to load conversation')
      }

      const data = await response.json()

      setConversationId(convId)
      setMessages(data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })))
      setCurrentPhase(data.currentPhase || 'QUESTIONING')

      // Check if conversation was at early exit point
      // Look for assistant messages that indicate readiness to generate
      const lastAssistantMessage = data.messages
        .filter((m: any) => m.role === 'assistant')
        .pop()

      if (data.currentPhase === 'EXTRACTION' ||
          lastAssistantMessage?.content?.includes('have enough') ||
          lastAssistantMessage?.content?.includes('ready to')) {
        setReadyToGenerate(true)
      }

      onConversationStart?.(convId)
    } catch (err) {
      console.error('Failed to resume conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setIsLoading(false)
    }
  }
```

**Step 4: Add useEffect to trigger resume**

After the autoStart useEffect (after line 66), add:

```typescript
  // Resume conversation if resumeConversationId provided
  useEffect(() => {
    if (resumeConversationId && !conversationId) {
      resumeConversation(resumeConversationId)
    }
  }, [resumeConversationId])
```

**Step 5: Commit**

```bash
git add src/components/InlineChat.tsx
git commit -m "feat(ui): add resume conversation support to InlineChat"
```

---

## Task 8: Type Check and Test

**Step 1: Run type check**

```bash
npm run type-check
```

Expected: No errors

**Step 2: Run tests**

```bash
npm run test
```

Expected: All pass (may need to update test fixtures if any test conversations)

**Step 3: Manual E2E test**

1. Create new project
2. Start conversation (type a message or two)
3. Navigate away (to dashboard or close tab)
4. Return to project
5. **Verify:** FirstTimeEmptyState shows with resumed conversation
6. **Verify:** Chat history is visible
7. Continue conversation to extraction/generation
8. **Verify:** Strategy is created successfully

**Step 4: Verify delete scenario**

1. Start first-time conversation
2. Delete the conversation (if UI exists) or via Prisma Studio
3. Return to project
4. **Verify:** Shows empty FirstTimeEmptyState (not broken)
5. Start new conversation
6. **Verify:** New conversation has `isInitialConversation = true`

**Step 5: Final commit if any cleanup needed**

```bash
npm run verify
git push
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Schema migration | prisma/schema.prisma |
| 2 | Set flag on start | api/conversation/start/route.ts |
| 3 | Include in conversation API | api/conversation/[id]/route.ts |
| 4 | Include in project API | api/project/[id]/route.ts |
| 5 | Detect in project page | app/project/[id]/page.tsx |
| 6 | FirstTimeEmptyState resume | components/FirstTimeEmptyState.tsx |
| 7 | InlineChat resume | components/InlineChat.tsx |
| 8 | Test & verify | - |
