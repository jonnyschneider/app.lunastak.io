# Conversation Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable explicit conversation ending (extraction trigger), resumption of in-progress conversations, and visibility into conversation/fragment state from "What Luna Knows" panel.

**Architecture:** ChatInterface gains "End" button that triggers extraction. ChatSheet accepts resumption prop for reopening in-progress conversations. Conversation status field tracks lifecycle state. Project page displays in-progress counts and fragment totals.

**Tech Stack:** Existing ChatSheet, ChatInterface, conversation API, extraction pipeline. Uses existing Prisma schema (`status` field is String, accepts any value).

---

## Context

### Current State
- ChatSheet starts new conversations via `/api/conversation/start`
- Extraction happens automatically when `data.complete` is returned from `/api/conversation/continue`
- Conversations have `status` field: `'in_progress'`, `'completed'`, `'abandoned'`
- Extract API (`/api/extract`) creates fragments but does NOT update conversation status
- No way to resume a conversation - closing sheet resets all state

### Target State
- User clicks "End" → calls extraction API → status becomes `'extracted'`
- User closes sheet without "End" → conversation stays `'in_progress'`
- User can reopen in-progress conversation from conversations list
- "What Luna Knows" panel shows in-progress count and fragment count

### Schema Note
Conversation `status` is a String field (not enum), so adding `'extracted'` value requires NO migration.

---

## Task 1: Add "End" Button to ChatInterface

**Files:**
- Modify: `src/components/ChatInterface.tsx`

**Step 1: Add onEndConversation prop**

In the interface definition at line 26:
```typescript
interface ChatInterfaceProps {
  conversationId: string | null;
  messages: Message[];
  onUserResponse: (response: string) => void;
  onEntryPointSelect?: (option: EntryPoint) => void;
  onGenerateStrategy?: () => void;
  onDeferToDeepDive?: (messageContent: string, messageId: string) => void;
  onEndConversation?: () => void;  // NEW
  isLoading: boolean;
  isComplete: boolean;
  currentPhase: ConversationPhase;
  traceId?: string;
  earlyExitOffered?: boolean;
  suggestedQuestion?: string | null;
}
```

**Step 2: Add prop to component function**

```typescript
export default function ChatInterface({
  conversationId,
  messages,
  onUserResponse,
  onEntryPointSelect,
  onGenerateStrategy,
  onDeferToDeepDive,
  onEndConversation,  // NEW
  isLoading,
  isComplete,
  currentPhase,
  traceId,
  earlyExitOffered,
  suggestedQuestion,
}: ChatInterfaceProps) {
```

**Step 3: Add "End" button next to Send button**

In the form's button area (around line 200-224), add End button before Send:
```typescript
<div className="flex items-center gap-2">
  {onDeferToDeepDive && hasUserResponded && (
    <button type="button" ...>
      <Crosshair className="h-3 w-3" />
      Defer to Deep Dive
    </button>
  )}
  {onEndConversation && hasUserResponded && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onEndConversation}
      disabled={isLoading}
    >
      End
    </Button>
  )}
  <button
    type="submit"
    disabled={isLoading || !userInput.trim()}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
  >
    Send
  </button>
</div>
```

**Step 4: Verify build passes**

Run: `npm run type-check`

**Step 5: Commit**

```bash
git add src/components/ChatInterface.tsx
git commit -m "feat(chat): add End button to ChatInterface"
```

---

## Task 2: Wire "End" Button in ChatSheet

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Step 1: Create handleEndConversation function**

After the existing handler functions (around line 340), add:
```typescript
// End conversation explicitly - trigger extraction
const handleEndConversation = async () => {
  if (!conversationId) return;

  // Trigger extraction (same as automatic extraction)
  extractContext();
};
```

**Step 2: Modify extractContext to show toast on success**

We need to add toast notification. First, import toast at the top:
```typescript
import { toast } from 'sonner';
```

Then modify the extraction completion handler. In `extractContext` function, after setting `setFlowStep('extraction')` on success (around line 254), we need to change behavior to close sheet instead.

Actually, looking at the design: when user clicks "End", extraction happens and then sheet closes with toast. The current flow shows an extraction confirmation screen. We need a flag to differentiate.

**Step 2a: Add state to track explicit end**

```typescript
const [isExplicitEnd, setIsExplicitEnd] = useState(false);
```

**Step 2b: Update handleEndConversation**

```typescript
const handleEndConversation = async () => {
  if (!conversationId) return;
  setIsExplicitEnd(true);
  extractContext();
};
```

**Step 2c: Modify extractContext completion to check flag**

After `setFlowStep('extraction')` in the stream handler (around line 254):
```typescript
if (update.step === 'complete') {
  const { extractedContext: ctx, dimensionalCoverage: coverage } = update.data;
  setExtractedContext(ctx);
  setDimensionalCoverage(coverage);

  if (isExplicitEnd) {
    // User clicked End - close sheet with toast
    toast.success('Added to your knowledge base');
    onOpenChange(false);
  } else {
    // Automatic extraction - show confirmation
    setFlowStep('extraction');
  }
}
```

**Step 3: Pass handler to ChatInterface**

In the ChatInterface render (around line 368):
```typescript
<ChatInterface
  conversationId={conversationId}
  messages={messages}
  onUserResponse={handleUserResponse}
  onGenerateStrategy={extractContext}
  onEndConversation={handleEndConversation}  // NEW
  isLoading={isLoading}
  isComplete={false}
  currentPhase={currentPhase}
  traceId={traceId}
  earlyExitOffered={earlyExitOffered}
  suggestedQuestion={suggestedQuestion}
/>
```

**Step 4: Verify build passes**

Run: `npm run type-check`

**Step 5: Commit**

```bash
git add src/components/chat-sheet.tsx
git commit -m "feat(chat): wire End button to trigger extraction and close sheet"
```

---

## Task 3: Update Conversation Status After Extraction

**Files:**
- Modify: `src/app/api/extract/route.ts`

**Step 1: Add status update after successful extraction**

After the fragment creation and synthesis update (around line 460), add:
```typescript
// Update conversation status to 'extracted'
await prisma.conversation.update({
  where: { id: conversationId },
  data: { status: 'extracted' },
});
console.log(`[Extract] Updated conversation status to 'extracted'`);
```

**Step 2: Verify build passes**

Run: `npm run type-check`

**Step 3: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat(extract): update conversation status to 'extracted' after extraction"
```

---

## Task 4: Add Resumption Support to ChatSheet

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Step 1: Add resumeConversationId prop**

Update interface (around line 48):
```typescript
interface ChatSheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuestion?: string
  deepDiveId?: string
  gapExploration?: GapExploration
  resumeConversationId?: string  // NEW
}
```

And function signature:
```typescript
export function ChatSheet({
  projectId,
  open,
  onOpenChange,
  initialQuestion,
  deepDiveId,
  gapExploration,
  resumeConversationId,  // NEW
}: ChatSheetProps) {
```

**Step 2: Create resumeConversation function**

```typescript
// Resume an existing conversation
const resumeConversation = async (convId: string) => {
  setIsLoading(true);
  try {
    // Fetch conversation with messages
    const response = await fetch(`/api/conversation/${convId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch conversation');
    }

    const data = await response.json();
    setConversationId(convId);
    setMessages(data.messages.map((m: any) => ({
      id: m.id,
      conversationId: convId,
      role: m.role,
      content: m.content,
      stepNumber: m.stepNumber,
      timestamp: new Date(m.timestamp),
    })));
    setCurrentPhase(data.currentPhase || 'QUESTIONING');
    setExperimentVariant(data.experimentVariant || 'baseline-v1');
  } catch (error) {
    console.error('Failed to resume conversation:', error);
    toast.error('Failed to load conversation');
    onOpenChange(false);
  } finally {
    setIsLoading(false);
  }
};
```

**Step 3: Modify auto-start effect**

Update the effect at line 91:
```typescript
useEffect(() => {
  if (open && !conversationId) {
    if (resumeConversationId) {
      resumeConversation(resumeConversationId);
    } else {
      startConversationWithQuestion(initialQuestion);
    }
  }
}, [open]);
```

**Step 4: Create conversation fetch API endpoint**

**Files:**
- Create: `src/app/api/conversation/[id]/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
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

  return NextResponse.json({
    id: conversation.id,
    status: conversation.status,
    currentPhase: conversation.currentPhase,
    experimentVariant: conversation.experimentVariant,
    messages: conversation.messages,
  });
}
```

**Step 5: Verify build passes**

Run: `npm run type-check`

**Step 6: Commit**

```bash
git add src/components/chat-sheet.tsx src/app/api/conversation/[id]/route.ts
git commit -m "feat(chat): add conversation resumption support"
```

---

## Task 5: Make Conversations List Items Clickable for Resumption

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Add state for resume conversation**

Add near other ChatSheet state (search for `chatSheetOpen`):
```typescript
const [chatResumeConversationId, setChatResumeConversationId] = useState<string | null>(null);
```

**Step 2: Add click handler to conversation items**

Find the conversations list rendering (search for "Conversations" or "discussions"). Make in-progress items clickable:

```typescript
{/* In the conversation list item */}
<div
  className={`cursor-pointer hover:bg-muted/50 rounded-lg p-2 ${conv.status === 'in_progress' ? 'cursor-pointer' : ''}`}
  onClick={() => {
    if (conv.status === 'in_progress') {
      setChatResumeConversationId(conv.id);
      setChatSheetOpen(true);
    }
  }}
>
  {/* ... existing content ... */}
  <Badge variant={conv.status === 'in_progress' ? 'secondary' : 'outline'}>
    {conv.status === 'in_progress' ? 'In progress' : 'Analysed'}
  </Badge>
</div>
```

**Step 3: Pass resumeConversationId to ChatSheet**

Find the ChatSheet component and add the prop:
```typescript
<ChatSheet
  projectId={projectId}
  open={chatSheetOpen}
  onOpenChange={(open) => {
    setChatSheetOpen(open);
    if (!open) {
      setChatResumeConversationId(null);  // Reset on close
    }
  }}
  initialQuestion={chatInitialQuestion}
  deepDiveId={chatDeepDiveId}
  gapExploration={chatGapExploration}
  resumeConversationId={chatResumeConversationId || undefined}  // NEW
/>
```

**Step 4: Verify build passes**

Run: `npm run type-check`

**Step 5: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(project): make in-progress conversations clickable for resumption"
```

---

## Task 6: Add Status Badges to Conversations List

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Add visual distinction for conversation status**

Update the conversations list to show status badges. Find the conversation rendering and update:

```typescript
{conversations.map((conv) => (
  <div
    key={conv.id}
    className={`flex items-center justify-between p-2 rounded-lg ${
      conv.status === 'in_progress'
        ? 'cursor-pointer hover:bg-muted/50'
        : 'opacity-75'
    }`}
    onClick={() => {
      if (conv.status === 'in_progress') {
        setChatResumeConversationId(conv.id);
        setChatSheetOpen(true);
      }
    }}
  >
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">
        {conv.title || 'Untitled conversation'}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatDate(conv.createdAt)}
      </p>
    </div>
    <Badge
      variant={conv.status === 'in_progress' ? 'secondary' : 'outline'}
      className={conv.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'text-green-700 border-green-300'}
    >
      {conv.status === 'in_progress' ? 'In progress' : 'Analysed'}
    </Badge>
  </div>
))}
```

**Step 2: Verify build passes**

Run: `npm run type-check`

**Step 3: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(project): add status badges to conversations list"
```

---

## Task 7: Add "In Progress" Count to What Luna Knows Panel

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Count in-progress conversations**

In the server component data fetching section, add:
```typescript
const inProgressCount = conversations.filter(c => c.status === 'in_progress').length;
```

Or if conversations aren't already fetched, add to the project query or as separate query.

**Step 2: Display count in What Luna Knows panel**

Find the "What Luna Knows" panel and add the count display:

```typescript
{/* What Luna Knows panel content */}
<div className="space-y-2">
  {project.knowledgeSummary && (
    <p className="text-sm text-muted-foreground">
      {project.knowledgeSummary}
    </p>
  )}

  {/* NEW: In-progress count */}
  {inProgressCount > 0 && (
    <button
      onClick={() => {
        // Scroll to conversations list or filter
        const conversationsSection = document.getElementById('conversations-section');
        conversationsSection?.scrollIntoView({ behavior: 'smooth' });
      }}
      className="text-sm text-amber-600 hover:text-amber-700 hover:underline"
    >
      {inProgressCount} conversation{inProgressCount !== 1 ? 's' : ''} in progress
    </button>
  )}
</div>
```

**Step 3: Verify build passes**

Run: `npm run type-check`

**Step 4: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(project): add in-progress count to What Luna Knows panel"
```

---

## Task 8: Add Fragment Count to What Luna Knows Panel

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Fetch fragment count**

Add fragment count query to the server component:
```typescript
const fragmentCount = await prisma.fragment.count({
  where: {
    projectId: params.id,
    status: 'active',
  },
});
```

**Step 2: Display fragment count in panel**

```typescript
{/* In What Luna Knows panel */}
{fragmentCount > 0 && (
  <p className="text-sm text-muted-foreground">
    Based on {fragmentCount} insight{fragmentCount !== 1 ? 's' : ''}
  </p>
)}
```

**Step 3: Verify build passes**

Run: `npm run type-check`

**Step 4: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(project): add fragment count to What Luna Knows panel"
```

---

## Verification

After completing all tasks:

1. **Type check:** `npm run type-check`
2. **Run tests:** `npm run test`
3. **Manual test flow:**
   - Start a conversation
   - Send a few messages
   - Click "End" → verify toast "Added to your knowledge base" appears and sheet closes
   - Open conversations list → verify "Analysed" badge on that conversation
   - Start another conversation
   - Close sheet without clicking "End"
   - Open conversations list → verify "In progress" badge
   - Click in-progress conversation → verify it reopens with existing messages
   - Check What Luna Knows panel → verify in-progress count is displayed
   - Check What Luna Knows panel → verify fragment count is displayed

---

## Out of Scope (Per Design Document)

- Fragment editing
- Guidance collection for strategy regeneration
- Batch extraction of abandoned conversations
- Conversation deletion from UI
- Gap Close "resolved" tracking

---

**Document Version:** 1.0
**Created:** 2026-01-14
**Status:** Ready for implementation
