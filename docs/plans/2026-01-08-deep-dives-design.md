# Deep Dives Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable user-initiated priority topics that organize future input sessions, serving as a capture mechanism for "important but not now" topics.

**Related Issues:** HUM-69 (Question Deep Dives), HUM-70 (Systematic Intent Detection)

**UI Constraint:** Use shadcn/ui components. Match existing patterns (Areas of Focus card style, button groups).

---

## 1. Overview & Mental Model

**Deep Dives** are user-initiated priority topics that organize future input sessions. They serve as a capture mechanism for "important but not now" topics.

**Key characteristics:**
- User-controlled (not Luna-suggested, unlike suggested questions)
- Temporary containers - once explored, knowledge flows to project
- Group related conversations and documents
- Fragments roll up to project level (no separate deep dive fragments)

**Lifecycle:** `pending` → `active` → `resolved`
- `pending`: Created from future document extraction (accept/dismiss)
- `active`: User is working on it
- `resolved`: Exploration complete, fragments captured

**Creation paths:**
1. Manual: User clicks "Add Deep Dive" and enters topic
2. Message deferral: Context menu on Luna's message → "Defer to Deep Dive"
3. Future: Document extraction suggests deep dive topics (pending state)

**Design principle:** Deep dives predominantly serve as a mechanism to surface good input data. Once conversations/documents have contributed their fragments, the deep dive has served its purpose and likely won't be revisited.

**Not in scope (deferred):**
- AI intent detection in conversation flow (see HUM-70)
- Fragment summaries per deep dive (comes with dimensional themes)
- Full detail page (sheet is sufficient for now)

---

## 2. Schema Changes

### Data Contracts (implement first)

```typescript
// src/lib/contracts/deep-dive.ts

export const DEEP_DIVE_STATUSES = ['pending', 'active', 'resolved'] as const;
export type DeepDiveStatus = typeof DEEP_DIVE_STATUSES[number];

export const DEEP_DIVE_ORIGINS = ['manual', 'message', 'document'] as const;
export type DeepDiveOrigin = typeof DEEP_DIVE_ORIGINS[number];

export interface DeepDiveContract {
  id: string;
  projectId: string;
  topic: string;
  notes?: string;
  status: DeepDiveStatus;
  origin: DeepDiveOrigin;
  sourceMessageId?: string;
  sourceDocumentId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeepDiveCreateInput {
  projectId: string;
  topic: string;
  notes?: string;
  origin?: DeepDiveOrigin;
  sourceMessageId?: string;
  sourceDocumentId?: string;
}

export interface DeepDiveWithCounts extends DeepDiveContract {
  conversationCount: number;
  documentCount: number;
  lastActivityAt?: string;
}
```

### Prisma Schema

**New DeepDive model:**

```prisma
model DeepDive {
  id        String   @id @default(cuid())
  projectId String

  // Content
  topic     String               // The topic/question to explore
  notes     String?  @db.Text    // Optional user notes

  // Lifecycle
  status    String   @default("active")  // pending | active | resolved
  resolvedAt DateTime?

  // Origin tracking
  origin    String   @default("manual")  // manual | message | document
  sourceMessageId  String?       // If created from message deferral
  sourceDocumentId String?       // If created from document extraction

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  project       Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  conversations Conversation[]
  documents     Document[]

  @@index([projectId])
  @@index([status])
  @@index([createdAt])
}
```

**Additions to existing models:**

```prisma
model Conversation {
  // ... existing fields
  deepDiveId String?
  deepDive   DeepDive? @relation(fields: [deepDiveId], references: [id], onDelete: SetNull)

  @@index([deepDiveId])
}

model Document {
  // ... existing fields
  deepDiveId String?
  deepDive   DeepDive? @relation(fields: [deepDiveId], references: [id], onDelete: SetNull)

  @@index([deepDiveId])
}

model Project {
  // ... existing fields
  deepDives DeepDive[]
}
```

**Key decisions:**
- `onDelete: SetNull` - if deep dive deleted, conversations/documents remain (not deleted)
- `sourceMessageId` tracks which message triggered deferral (for context)
- No `deepDiveId` on Fragment - fragments stay project-level

---

## 3. UI Components

### Project View - Deep Dives Section

New card in bottom section (alongside "Areas of Focus"):

```
┌─────────────────────────────────────────────────────┐
│ 🎯 Deep Dives                                       │
│ Topics you want to explore in depth                 │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ Pricing strategy for enterprise     [active]   X│ │
│ │ 2 days ago                     💬 📤 ⋯         │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Competitor analysis - Series B     [active]    X│ │
│ │ 5 days ago                     💬 📤 ⋯         │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [+ Add Deep Dive]                    Show 2 more    │
└─────────────────────────────────────────────────────┘
```

**Card elements:**
- Topic title
- Status badge (active/pending)
- Last activity timestamp
- Button group: chat | upload | ⋯ (resolve, dismiss)
- Full-height X dismiss button (same pattern as Areas of Focus)

**Limit:** 3 visible, "Show more" expands

### Sheet Detail View (slides from right)

- Header: topic, status badge, created date, origin indicator
- Conversations list (filtered to this deep dive)
- Documents list (filtered to this deep dive)
- Actions: "New Chat", "Upload Document", "Mark Resolved"

### Message Context Menu

- Add ⋯ menu to Luna's messages in conversation view
- Option: "Defer to Deep Dive"
- Opens creation modal with topic pre-filled from message content

### Add Deep Dive Modal

- Simple form: topic input (required), notes textarea (optional)
- "Create" button
- Used for both manual creation and message deferral

---

## 4. Interaction Flows

### Flow 1: Manual Creation
1. User clicks "+ Add Deep Dive" in Deep Dives section
2. Modal opens with topic input field
3. User enters topic, clicks "Create"
4. Deep dive created with `status: active`, `origin: manual`
5. Appears in list, user can start chat or upload doc

### Flow 2: Message Deferral
1. User is in conversation, Luna asks a question
2. User clicks ⋯ on Luna's message → "Defer to Deep Dive"
3. Modal opens with topic pre-filled from message content
4. User can edit topic, clicks "Create"
5. New deep dive created with `status: active`, `origin: message`, `sourceMessageId` set
6. Toast confirms: "Created deep dive: {topic}"
7. Conversation continues normally (not redirected)

### Flow 3: Start Chat within Deep Dive
1. User clicks 💬 on deep dive card (or "New Chat" in sheet)
2. New conversation created with `deepDiveId` set
3. Opens conversation view
4. Luna has context: "This conversation is part of your deep dive: {topic}"

### Flow 4: Upload Document to Deep Dive
1. User clicks 📤 on deep dive card (or "Upload" in sheet)
2. Document upload dialog opens (existing component)
3. Document created with `deepDiveId` set
4. Processing proceeds as normal, fragments go to project

### Flow 5: Resolve Deep Dive
1. User clicks ⋯ → "Resolve" (or in sheet)
2. Confirmation: "Mark as resolved? Conversations and documents remain accessible."
3. Status changes to `resolved`, `resolvedAt` set
4. Card moves to collapsed "Resolved" section (or hidden with "Show resolved" toggle)

### Flow 6: View Deep Dive Detail
1. User clicks anywhere on deep dive card (except action buttons)
2. Sheet slides in from right
3. Shows filtered conversations and documents
4. User can take actions or close sheet

---

## 5. API Endpoints

### POST /api/deep-dive
Create a new deep dive.

**Request:**
```typescript
{
  projectId: string;
  topic: string;
  notes?: string;
  origin?: 'manual' | 'message' | 'document';
  sourceMessageId?: string;
}
```

**Response:** `DeepDiveContract`

### GET /api/deep-dive
List deep dives for a project.

**Query params:**
- `projectId` (required)
- `status` (optional): filter by status
- `includeResolved` (optional): include resolved deep dives

**Response:** `{ deepDives: DeepDiveWithCounts[] }`

### GET /api/deep-dive/[id]
Get single deep dive with related conversations and documents.

**Response:**
```typescript
{
  deepDive: DeepDiveContract;
  conversations: ConversationSummary[];
  documents: DocumentSummary[];
}
```

### PATCH /api/deep-dive/[id]
Update deep dive (topic, notes, status).

**Request:**
```typescript
{
  topic?: string;
  notes?: string;
  status?: 'active' | 'resolved';
}
```

### DELETE /api/deep-dive/[id]
Delete/dismiss a deep dive. Conversations and documents remain (deepDiveId set to null).

---

## 6. Implementation Phases

### Phase 1: Foundation (schema + contracts)
- Add DeepDive data contracts to `src/lib/contracts/deep-dive.ts`
- Add contract validation functions and tests
- Update Prisma schema (DeepDive model, relations on Conversation/Document)
- Run migration
- Update existing contracts to export from index

### Phase 2: API Layer
- `POST /api/deep-dive` - Create deep dive
- `GET /api/deep-dive?projectId=` - List deep dives for project
- `GET /api/deep-dive/[id]` - Get deep dive with conversations/documents
- `PATCH /api/deep-dive/[id]` - Update status (resolve)
- `DELETE /api/deep-dive/[id]` - Delete/dismiss
- Add API tests

### Phase 3: Project View UI
- Add Deep Dives section to project page
- Deep dive card component (matching Areas of Focus pattern)
- "Add Deep Dive" button and modal
- Limit 3 + "Show more" (use existing pattern)
- Wire up to API

### Phase 4: Sheet Detail View
- Sheet component for deep dive detail
- Filtered conversations list
- Filtered documents list
- Actions: New Chat, Upload, Resolve
- Wire up navigation (chat → conversation, upload → dialog)

### Phase 5: Message Deferral
- Add context menu to conversation messages (Luna's messages)
- "Defer to Deep Dive" option
- Creation modal with pre-filled topic from message
- Set `sourceMessageId` for context tracking
- Toast confirmation

### Phase 6: Deep Dive Context in Conversations
- When creating conversation within deep dive, set `deepDiveId`
- Inject deep dive context into Luna's system prompt
- "This conversation is part of your deep dive: {topic}"

---

## 7. Future Considerations (not in scope)

1. **Document extraction detection** - Luna identifies "this seems like a deep dive topic" from uploaded docs, creates as pending for user to accept/dismiss

2. **Intent detection in conversation** - See HUM-70. User says "let's defer this" and Luna detects intent without needing context menu

3. **Full detail page** - When sheet becomes too cramped, migrate to `/project/[id]/deep-dive/[deepDiveId]`

4. **Fragment summaries** - Show knowledge extracted from this deep dive's conversations/documents. Deferred to dimensional themes design.

5. **Resolved archive** - Dedicated view for reviewing past deep dives and their outcomes
