# Conversation Lifecycle Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable continuous strategic development through conversation management, extraction control, and resumption.

**Architecture:** Conversations are persistent inputs that produce durable fragments. Users control when extraction happens ("End") and when synthesis/strategy generation happens (from "What Luna Knows" panel). Unfinished conversations can be resumed.

**Tech Stack:** Existing ChatSheet, conversation API, extraction pipeline. Minor DB schema awareness (conversation status).

---

## Context

The current flow assumes strategy development is a one-shot process: conversation → threshold → generate strategy. This doesn't match reality for time-poor executives who:
- Have half-formed thoughts they need to dump and return to later
- Engage in continuous strategic refinement, not one-time generation
- Need control over when insights are processed vs. when strategy is regenerated

## Design Decisions

### 1. Conversation States

| State | Meaning |
|-------|---------|
| `in_progress` | Active or paused, not yet extracted |
| `extracted` | User clicked "End", fragments created |

### 2. Ending a Conversation

- **Trigger:** User clicks "End" button (next to Send)
- **Action:** Immediate extraction (decompose into fragments, tag by dimension)
- **Result:** Sheet closes, toast confirms "Added to your knowledge base"
- **No confirmation dialog** — extraction is low-stakes, cumulative, consequence-free

### 3. Closing Without Ending

- **Trigger:** User closes sheet (X, click outside, navigate away) without clicking "End"
- **Action:** Conversation auto-saves as `in_progress`
- **Result:** Can be resumed later from conversations list

### 4. Resumption

- Conversations list shows status badges ("In progress" / "Analysed")
- Clicking "In progress" conversation reopens ChatSheet with existing messages
- User can continue conversation or click "End" to extract

### 5. Nudges for Forgotten Conversations

- "What Luna Knows" panel shows: "X conversations in progress" (if any)
- Clicking opens conversations list filtered to in-progress items
- Gentle reminder without blocking user flow

### 6. Synthesis & Strategy Generation

Controlled from "What Luna Knows" panel:
- Shows fragment count since last synthesis
- "Generate Strategy" button (or "Regenerate" if exists)
- Future: guidance collection dialog ("what to keep/remove")

Extraction and synthesis are decoupled:
- **Extraction:** Happens per-conversation when user clicks "End"
- **Synthesis/Strategy:** Happens when user explicitly requests from panel

### 7. First Strategy Messaging

For initial conversation (no strategy yet), when threshold is reached:
- Luna says: "I have enough to generate the **first expression** of your strategy"
- Sets expectation: iterative, not perfect
- Button: "Generate Strategy"

### 8. Fragment Management

Via "10 Strategic Dimensions" panel:
- Shows coverage score per dimension
- Click dimension → opens sheet with fragments for that dimension
- Delete action available per fragment
- Edit is future scope

### 9. Gap Close Behavior

- Organic updates only — as fragments are added, coverage improves
- Gap Close list re-sorts automatically based on coverage scores
- No special "resolved" tracking for beta
- Experimental/beta-within-beta feature

### 10. Data Retention

- Conversations kept in DB (useful for backtesting extraction improvements)
- Fragments are the durable, structured output
- Raw transcripts retained but not prominently surfaced in UI

---

## UI Components

### ChatInterface Changes

```
┌─────────────────────────────────────────┐
│ [Textarea - full width]                 │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ ⌘+Enter to send          [End] [Send]  │
└─────────────────────────────────────────┘
```

- "End" button: secondary/outline style
- "Send" button: primary style
- Both in action bar below textarea

### ChatSheet Changes

- Dynamic title (already implemented):
  - "Discussion" (general)
  - "Deep Dive" (deep dive context)
  - Dimension name e.g. "Customer & Market" (gap exploration)
- Accept `resumeConversationId` prop for resumption
- On close without "End": conversation stays `in_progress`

### What Luna Knows Panel

```
┌─────────────────────────────────────────┐
│ What Luna Knows                         │
│ Key themes behind your strategy         │
├─────────────────────────────────────────┤
│ [Summary text...]                       │
│                                         │
│ ─────────────────────────────────────── │
│ 12 fragments since last update          │
│ 3 conversations in progress             │
│                                         │
│ [Generate Strategy]                     │
└─────────────────────────────────────────┘
```

### Conversations List

- Status badges: "In progress" (amber) / "Analysed" (green)
- Click "In progress" → opens ChatSheet with resumption
- Click "Analysed" → opens read-only view (or same sheet, just can't continue)

---

## API Changes

### ChatSheet Props

```typescript
interface ChatSheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuestion?: string
  deepDiveId?: string
  gapExploration?: GapExploration
  resumeConversationId?: string  // NEW: for resumption
}
```

### Extraction Endpoint

Existing `/api/extract` endpoint, called when:
- User clicks "End" button
- (Future: batch extraction of old in_progress conversations)

Updates conversation status to `extracted` after successful extraction.

---

## Implementation Tasks

### Task 1: Add "End" Button to ChatInterface

**Files:**
- Modify: `src/components/ChatInterface.tsx`

**Steps:**
1. Add `onEndConversation` prop to ChatInterface
2. Add "End" button (outline variant) next to "Send" in action bar
3. Button calls `onEndConversation` when clicked

### Task 2: Wire "End" Button in ChatSheet

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Steps:**
1. Create `handleEndConversation` function
2. Call extraction API
3. Close sheet on success
4. Show toast "Added to your knowledge base"
5. Pass handler to ChatInterface as `onEndConversation`

### Task 3: Update Conversation Status After Extraction

**Files:**
- Modify: `src/app/api/extract/route.ts`

**Steps:**
1. After successful extraction, update conversation status to `extracted`
2. Add status field update in Prisma call

### Task 4: Add "First Expression" Messaging

**Files:**
- Modify: `src/app/api/conversation/continue/route.ts` (or wherever threshold message is generated)

**Steps:**
1. Find where "Generate Strategy" offer is triggered
2. Update Luna's message to include "first expression" language
3. Ensure this only appears for projects without existing strategy

### Task 5: Add Resumption Support to ChatSheet

**Files:**
- Modify: `src/components/chat-sheet.tsx`

**Steps:**
1. Add `resumeConversationId` prop
2. If provided, fetch existing conversation and messages on mount
3. Populate state with existing messages
4. Continue conversation flow from where it left off

### Task 6: Make Conversations List Items Clickable for Resumption

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Steps:**
1. Find conversations list rendering
2. For "in_progress" conversations, add click handler
3. Click opens ChatSheet with `resumeConversationId`

### Task 7: Add "In Progress" Count to What Luna Knows

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Steps:**
1. Count conversations with status `in_progress`
2. Display "X conversations in progress" in What Luna Knows panel
3. Make it clickable (scrolls to or filters conversations list)

### Task 8: Add Fragment Count to What Luna Knows

**Files:**
- Modify: `src/app/project/[id]/page.tsx`
- May need: API to get fragment count since last synthesis

**Steps:**
1. Track or calculate fragments added since last strategy generation
2. Display count in What Luna Knows panel
3. Show "Generate Strategy" button

---

## Out of Scope for Beta

- Fragment editing
- Guidance collection for strategy regeneration ("what to keep/remove")
- Batch/background extraction of abandoned conversations
- Conversation deletion from UI
- Gap Close "resolved" tracking

---

## Success Criteria

1. User can end conversation explicitly → fragments extracted → toast confirms
2. User can close sheet without ending → conversation saved as in_progress
3. User can reopen in_progress conversation and continue
4. What Luna Knows shows in-progress count and fragment count
5. "First expression" language appears for initial strategy generation
6. Dimensional coverage updates organically as fragments are added

---

**Document Version:** 1.0
**Created:** 2026-01-14
**Status:** Ready for implementation
