# First-Time Experience & Conversation Flow Design

**Date:** 2026-02-08
**Status:** Draft
**Problem:** First-time conversation flow breaks when user leaves and returns

## Problems Identified

### Issue 1: First-time conversation resumed in wrong context
**Symptom:** User starts first-time chat in InlineChat, leaves, returns → resumes in ChatSheet with broken flow.

**Root cause:** `isEmpty` check is `fragmentCount === 0 && conversations.length === 0`. Once conversation exists, dashboard shows, and resume opens ChatSheet.

### Issue 2: No explicit "first strategy" conversation detection
**Symptom:** ChatSheet doesn't know this is the conversation that should lead to first strategy generation.

**Root cause:** Detection is implicit (`!hasExistingStrategy && !deepDiveId && !gapExploration`), not stored. When generation fails, fallback UI shows with empty data.

### Issue 3: Abandoned side-sheet chats never get extracted
**Symptom:** User closes ChatSheet without clicking "End" → no extraction runs → context lost.

**Root cause:** `extractContext()` only called from `handleEndConversation()`. Sheet close bypasses this.

### Issue 4: Re-extraction on resumed conversations unclear
**Symptom:** User resumes conversation, adds more context, ends → unclear what gets extracted.

**Root cause:** No tracking of extraction boundaries. No `lastExtractedMessageId` or similar marker.

---

## Solution Design

### Schema Changes

```prisma
model Conversation {
  // ... existing fields ...

  // Issue 1 & 2: Explicit first-time flag
  isInitialConversation Boolean @default(false)

  // Issue 4: Extraction boundary tracking
  lastExtractedMessageId String?
  lastExtractedAt        DateTime?
}
```

### Issue 1 Fix: Resume in correct context

**Setting the flag:**
```typescript
// In /api/conversation/start
const hasExistingStrategy = await prisma.trace.findFirst({
  where: {
    projectId,
    strategy: { not: null }  // Only count completed traces
  }
})

await prisma.conversation.create({
  data: {
    ...
    isInitialConversation: !hasExistingStrategy
  }
})
```

**Project page logic:**
```typescript
// Current
const isEmpty = fragmentCount === 0 && conversations.length === 0

// New
const isEmpty = fragmentCount === 0 && conversations.length === 0
const incompleteInitialConvo = conversations.find(
  c => c.isInitialConversation && c.status === 'in_progress'
)

if (isEmpty || incompleteInitialConvo) {
  return (
    <FirstTimeEmptyState
      projectId={projectId}
      resumeConversationId={incompleteInitialConvo?.id}
    />
  )
}
```

**InlineChat resume support:**
```typescript
interface InlineChatProps {
  projectId: string
  resumeConversationId?: string  // NEW
  initialMessage?: string
  autoStart?: boolean
  onConversationStart?: (conversationId: string) => void
}

// On mount, if resumeConversationId provided:
useEffect(() => {
  if (resumeConversationId) {
    resumeConversation(resumeConversationId)
  }
}, [resumeConversationId])

const resumeConversation = async (convId: string) => {
  const response = await fetch(`/api/conversation/${convId}`)
  const data = await response.json()

  setConversationId(convId)
  setMessages(data.messages.map(...))
  setCurrentPhase(data.currentPhase || 'QUESTIONING')
  setIsExpanded(true)

  // Restore readyToGenerate state if applicable
  if (data.currentPhase === 'EXTRACTION' || data.earlyExitOffered) {
    setReadyToGenerate(true)
  }
}
```

**Delete & restart scenario:**
- User deletes `isInitialConversation` conversation
- No trace exists yet → `hasExistingStrategy = false`
- Next new conversation gets `isInitialConversation = true` ✓

---

### Issue 2 Fix: Clear flag after strategy generation

**In /api/generate (background task completion):**
```typescript
// After successful strategy generation
if (conversation.isInitialConversation) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isInitialConversation: false }
  })
}
```

**ChatSheet generation prompt logic:**
```typescript
// isFirstStrategy prop already exists, but make it explicit
const isFirstStrategy = conversation?.isInitialConversation ?? false

<ChatInterface
  ...
  isFirstStrategy={isFirstStrategy}
/>
```

---

### Issue 3 Fix: Auto-extract on abandon

**Option A: Extract on sheet close (eager)**
```typescript
// In ChatSheet onOpenChange handler
const handleSheetClose = async () => {
  if (conversationId && conversationStatus === 'in_progress' && messages.length > 1) {
    // User is abandoning an active conversation
    // Trigger lightweight extraction in background
    fetch('/api/extract', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        lightweight: true,
        background: true  // Don't wait for response
      }),
    }).catch(() => {})  // Fire and forget
  }
  onOpenChange(false)
}
```

**Option B: Extract on next project load (lazy)**
```typescript
// In project page load or useEffect
const unextractedConvos = conversations.filter(
  c => c.status === 'in_progress' &&
       c.messages.length > 2 &&  // Has meaningful content
       !c.isInitialConversation   // Not the first-time flow
)

if (unextractedConvos.length > 0) {
  // Queue background extraction for abandoned convos
  for (const conv of unextractedConvos) {
    fetch('/api/extract', {
      method: 'POST',
      body: JSON.stringify({ conversationId: conv.id, lightweight: true }),
    }).catch(() => {})
  }
}
```

**Recommendation:** Option A (eager) is simpler and provides more immediate value capture.

---

### Issue 4 Fix: Extraction boundaries in resumed chats

**Tracking what's been extracted:**
```typescript
// After extraction completes, mark the boundary
await prisma.conversation.update({
  where: { id: conversationId },
  data: {
    lastExtractedMessageId: messages[messages.length - 1].id,
    lastExtractedAt: new Date()
  }
})
```

**On resume + new content + re-extraction:**
```typescript
// In /api/extract
const conversation = await prisma.conversation.findUnique({
  where: { id: conversationId },
  include: { messages: { orderBy: { stepNumber: 'asc' } } }
})

let messagesToExtract = conversation.messages

if (conversation.lastExtractedMessageId) {
  // Find messages after the last extraction
  const lastExtractedIndex = conversation.messages.findIndex(
    m => m.id === conversation.lastExtractedMessageId
  )

  if (lastExtractedIndex >= 0) {
    messagesToExtract = conversation.messages.slice(lastExtractedIndex + 1)
  }

  // If no new messages, skip extraction
  if (messagesToExtract.length === 0) {
    return { skipped: true, reason: 'No new messages since last extraction' }
  }
}

// Extract only the new messages
const extractedThemes = await extractThemes(messagesToExtract)
```

**Full re-extraction option:**
```typescript
// Allow forcing full re-extraction if needed
const { conversationId, forceFullExtraction = false } = body

if (forceFullExtraction) {
  // Clear the boundary and extract everything
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastExtractedMessageId: null, lastExtractedAt: null }
  })
}
```

**UI indicator for extraction boundary:**
```typescript
// In ChatInterface, show visual marker
{messages.map((msg, idx) => (
  <>
    {msg.id === lastExtractedMessageId && (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        <span>Extracted {formatRelative(lastExtractedAt)}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    )}
    <MessageBubble message={msg} />
  </>
))}
```

---

## Implementation Phases

### Phase 1: Schema + Foundation
- Add `isInitialConversation` field
- Add `lastExtractedMessageId` and `lastExtractedAt` fields
- Migration
- Deploy to preview

### Phase 2: Issue 1 - Resume in InlineChat
- Set `isInitialConversation` on conversation start
- Modify project page to detect incomplete initial conversation
- Extend InlineChat to support resume
- Extend FirstTimeEmptyState to pass resumeConversationId
- **Test gate:** Start → leave → return → resumes in InlineChat

### Phase 3: Issue 2 - Clear flag after generation
- Clear `isInitialConversation` after successful strategy generation
- Ensure ChatSheet uses flag for `isFirstStrategy` prop
- **Test gate:** Complete strategy → new chat → no generation prompt

### Phase 4: Issue 4 - Extraction boundaries
- Update extraction API to track `lastExtractedMessageId`
- Modify extraction to only process new messages on resume
- Add UI indicator for extraction boundary
- **Test gate:** Chat → extract → resume → add content → extract → only new content processed

### Phase 5: Issue 3 - Auto-extract abandoned chats
- Add sheet close handler to trigger background extraction
- Add `background` mode to extraction API
- **Test gate:** Chat in side sheet → close without End → verify extraction runs

---

## R&D Context

**Activity:** A4 - Interaction Design

**Uncertainty being addressed:** How do we handle interrupted first-time user journeys without losing context or breaking the experience?

**How this enables learning:** First-time experience is critical for activation. Understanding drop-off points and recovery patterns informs onboarding design. The extraction boundary tracking also provides data on conversation resumption patterns.
