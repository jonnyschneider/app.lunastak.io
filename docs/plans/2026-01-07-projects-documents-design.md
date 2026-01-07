# Projects, Documents & Multi-Session Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable persistent project context across multiple conversations with document upload capability.

**Architecture:** Single implicit project per user (no multi-project UI until paying customers). Documents processed at upload then discarded - only metadata and extracted fragments retained. Luna remembers context via system prompt injection.

**Tech Stack:** Next.js, Prisma, Unstructured API, Anthropic Claude

**Linear Issues:** HUM-28, HUM-32, HUM-33, HUM-34

**UI Constraint:** Use shadcn/ui components everywhere possible. No custom UI unless absolutely necessary. All components must be standard, interchangeable, and straightforward. UX polish comes in future rounds.

---

## 1. Overview & Mental Model

### Core Concept
Every user has a single implicit Project that serves as their strategy container. The project accumulates knowledge through:
- **Conversations** - Chat sessions with Luna that extract fragments
- **Documents** - Uploaded files that get processed into fragments

### Mental Model: Inputs → Conversations → Outputs

```
┌─────────────────────────────────────────────────────────┐
│                      PROJECT VIEW                        │
├─────────────────────────────────────────────────────────┤
│  INPUTS              CONVERSATIONS        OUTPUTS        │
│  ──────              ─────────────        ───────        │
│  📄 Doc 1            💬 Chat 1            📊 Synthesis   │
│  📄 Doc 2            💬 Chat 2            📋 Fragments   │
│  📄 Doc 3            💬 Chat 3 (active)   🎯 Exports     │
│                                                          │
│  [+ Upload]          [+ New Chat]                        │
└─────────────────────────────────────────────────────────┘
```

Users feed inputs (documents), have conversations with Luna, and outputs emerge (synthesis, fragments, future exports).

### Navigation Model
- Project view is the **main content area**
- Sidebar provides quick navigation to recent chats
- Clicking a chat opens it in the main area
- "Back to Project" returns to dashboard

---

## 2. Project View UI

### Layout
Three horizontal sections (always visible, even when empty):

**Header Area:**
- Project name/title
- Stats cards (fragment counts, dimension coverage)
- Dimensional coverage heatmap

**Main Content (3 columns):**
1. **Inputs** - Document list with upload button
2. **Conversations** - Chat list with "New Chat" button
3. **Outputs** - Synthesis, fragments, future exports

### Stats & Visualizations

**Stats Cards:**
- Total fragments extracted
- Conversations count
- Documents processed
- Coverage percentage

**Dimensional Heatmap:**
- 10 strategic dimensions as cells
- Color intensity = fragment count for that dimension
- Provides at-a-glance coverage view
- Clicking a dimension could filter/explore (future)

### "What Luna Knows" Section
- `knowledgeSummary` field on Project (updated at extraction time)
- Human-readable summary of accumulated knowledge
- Helps users understand what context Luna has

### Suggested Questions
- `suggestedQuestions: String[]` on Project
- Updated whenever extraction runs
- Displayed as clickable chips/cards
- Clicking starts new chat with that question pre-filled

---

## 3. Schema Changes

### Project Model (additions)
```prisma
model Project {
  // Existing fields...

  // NEW fields
  knowledgeSummary    String?   @db.Text    // "What Luna Knows"
  knowledgeUpdatedAt  DateTime?             // Last summary update
  suggestedQuestions  String[]  @default([]) // Jumping-off points
  documents           Document[]            // Relation to documents
}
```

### Document Model (new)
```prisma
model Document {
  id            String    @id @default(cuid())
  projectId     String
  fileName      String                    // Original filename
  fileType      String                    // MIME type or extension
  fileSizeBytes Int?                      // For display
  uploadContext String?   @db.Text        // User-provided context
  status        String    @default("pending") // pending|processing|complete|failed
  processedAt   DateTime?                 // When extraction finished
  errorMessage  String?                   // If status=failed
  createdAt     DateTime  @default(now())

  project       Project   @relation(fields: [projectId], references: [id])
  fragments     Fragment[]                // Fragments extracted from this doc
}
```

### Fragment Model (addition)
```prisma
model Fragment {
  // Existing fields...

  // NEW field for lineage
  documentId    String?                   // NULL = from conversation
  document      Document? @relation(fields: [documentId], references: [id])
}
```

### Key Design Decisions

1. **No document content storage** - Process and discard for security/privacy/SOC2
2. **Metadata retained** - Filename, type, context for provenance tracking
3. **Fragment lineage** - `documentId` or `conversationId` shows where knowledge came from
4. **Status tracking** - Async processing with clear state machine

---

## 4. Document Upload Flow

### User Experience

1. User clicks "Upload Document" in Inputs section
2. File picker opens (PDF, DOC, TXT, etc.)
3. After selection, context prompt appears:
   - "Tell Luna about this document"
   - Free text field for user to explain relevance
   - Examples: "This is our competitor analysis from Q3"
4. Upload begins with progress indicator
5. Document appears in list with "Processing..." status
6. On completion, status updates to "Complete"

### Processing Pipeline

```
Upload → Store Temp → Extract Text → Send to Claude → Create Fragments → Delete File
                         ↓
                   Unstructured API
```

1. **Receive file** - Validate type/size, store temporarily
2. **Extract text** - Use Unstructured API for parsing
3. **Send to Claude** - Include user's context in prompt
4. **Extract themes** - Same emergent extraction as conversations
5. **Create fragments** - Store with `documentId` for lineage
6. **Update project** - Refresh knowledgeSummary, suggestedQuestions
7. **Delete file** - Remove from storage (keep only metadata)

### Context Prompt Design

The user's upload context is critical for meaningful extraction. Prompt structure:

```
The user has uploaded a document and provided this context:
"{uploadContext}"

Document content:
{extractedText}

Extract strategic themes from this document, considering the user's context...
```

---

## 5. Luna Remembers

### How It Works

When starting any conversation, Luna receives accumulated project knowledge via system prompt injection:

```
You are Luna, helping {user} develop their strategy.

## What You Know About Their Project

{knowledgeSummary}

## Key Fragments (summarized)

- {fragment1.theme}: {fragment1.summary}
- {fragment2.theme}: {fragment2.summary}
...

## Suggested Areas to Explore

Based on gaps in coverage:
- {gap1}
- {gap2}
```

### Knowledge Summary Generation

Updated whenever extraction runs (conversation complete or document processed):

1. Gather all fragments for project
2. Send to Claude with synthesis prompt
3. Generate human-readable summary
4. Update `project.knowledgeSummary`
5. Generate new `suggestedQuestions` based on gaps

### Token Budget Management

- Knowledge summary: ~500-1000 tokens
- Fragment summaries: ~50 tokens each, cap at 20 most relevant
- Suggested explorations: ~100 tokens
- Total injection: ~2000 tokens max

Selection priority:
1. Recent fragments (last 30 days)
2. High-confidence fragments
3. Diverse dimension coverage

---

## 6. Implementation Phases

### Phase 1: Project View Foundation
**Goal:** Basic project dashboard as container

- Create `/project` page route
- Implement three-section layout (empty states)
- Add stats cards with real fragment data
- Build dimensional heatmap from existing fragments
- Update navigation to use project view as home

**Dependencies:** None (uses existing data)

### Phase 2: Luna Remembers
**Goal:** Conversations have project context

- Add `knowledgeSummary`, `suggestedQuestions` to Project schema
- Create knowledge summary generation function
- Implement system prompt injection in chat
- Add "What Luna Knows" display
- Show suggested questions as chat starters

**Dependencies:** Phase 1

### Phase 3: Document Upload
**Goal:** Users can upload documents

- Add Document model to schema
- Build upload UI with context prompt
- Implement Unstructured API integration
- Create document extraction pipeline
- Add fragment lineage (`documentId`)
- Trigger knowledge summary refresh on completion

**Dependencies:** Phase 2

### Phase 4: Polish & Iteration
**Goal:** Refine based on usage

- Improve heatmap interactivity
- Better fragment browsing/filtering
- Document preview/details view
- Export functionality
- Performance optimization

**Dependencies:** Phase 3

---

## Data Contracts

### Project Knowledge Contract
```typescript
interface ProjectKnowledge {
  knowledgeSummary: string;        // Human-readable summary
  suggestedQuestions: string[];    // 3-5 questions
  fragmentCount: number;           // Total fragments
  dimensionalCoverage: {           // Per-dimension stats
    [dimension: string]: {
      fragmentCount: number;
      averageConfidence: number;
    };
  };
}
```

### Document Contract
```typescript
interface Document {
  id: string;
  fileName: string;
  fileType: string;
  uploadContext: string | null;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  errorMessage: string | null;
  createdAt: Date;
  processedAt: Date | null;
}
```

### Fragment Lineage Contract
```typescript
interface FragmentLineage {
  fragmentId: string;
  source:
    | { type: 'conversation'; conversationId: string }
    | { type: 'document'; documentId: string };
}
```

---

## Open Questions for Future Iteration

1. **Document re-processing** - Should users be able to re-extract from a document with different context?
2. **Fragment editing** - Can users correct/refine extracted fragments?
3. **Knowledge decay** - Should older fragments have less weight?
4. **Multi-project** - When/how to introduce project switching?
5. **Collaboration** - Sharing projects with team members?

These are deliberately deferred until we have real usage data.
