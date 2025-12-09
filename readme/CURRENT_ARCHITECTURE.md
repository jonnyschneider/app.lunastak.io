# Current Architecture (As Built)

**Last Updated:** 2025-12-09

This document describes the system as actually implemented, not as originally planned.

---

## System Overview

Decision Stack v4 is a conversational AI system that helps users develop business strategy through adaptive questioning, context extraction, and AI-generated strategic statements.

### User Flow

1. **Conversation Start** - User lands on page, conversation initializes with opening question
2. **Initial Exploration** (1-2 questions) - Understand basic business context
3. **Lens Selection** - User chooses strategic lens to guide deeper exploration
4. **Adaptive Questioning** (3-10 questions total) - Lens-specific depth with confidence-based stopping
5. **Context Review** - Show extracted context, offer "Generate" or "Keep Exploring"
6. **Strategy Generation** - Generate vision, mission, objectives using enriched context
7. **Feedback** - User provides helpful/not helpful rating

---

## Database Schema

### Conversation Model

Tracks user conversations with phase management for multi-step flow.

```typescript
model Conversation {
  id            String   @id @default(cuid())
  userId        String
  status        String   // 'in_progress' | 'completed' | 'abandoned'
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  currentPhase  String   @default("INITIAL")  // Phase tracking
  selectedLens  String?  // Strategic lens chosen
  questionCount Int      @default(0)          // Adaptive stopping logic

  messages      Message[]
  traces        Trace[]
}
```

**Phases:**
- `INITIAL` - Starting state
- `EXPLORING` - Initial 1-2 questions before lens selection
- `LENS_SELECTION` - User choosing strategic lens
- `QUESTIONING` - Lens-specific deep dive
- `COMPLETE` - Ready for extraction

**Strategic Lenses:**
- `A` - Competitive Advantage
- `B` - Customer-Centric
- `C` - Innovation-Driven
- `D` - Operations Excellence
- `E` - Growth & Scale
- `F` - Resource Optimization

### Message Model

Stores conversation history with confidence assessment.

```typescript
model Message {
  id                  String   @id @default(cuid())
  conversationId      String
  role                String   // 'assistant' | 'user'
  content             String   @db.Text
  stepNumber          Int
  timestamp           DateTime @default(now())
  confidenceScore     String?  // 'HIGH' | 'MEDIUM' | 'LOW'
  confidenceReasoning String?  @db.Text

  // Phase 2: Error analysis
  annotations         String?  @db.Text

  conversation        Conversation @relation(...)
}
```

**Confidence Assessment:**
- Runs after each user response
- Evaluates coverage (key dimensions touched) and specificity (concrete details)
- Informs adaptive stopping logic

### Trace Model

Comprehensive logging for evals methodology.

```typescript
model Trace {
  id                  String   @id @default(cuid())
  conversationId      String
  userId              String
  timestamp           DateTime @default(now())

  // Context & Output (JSON)
  extractedContext    Json     // EnhancedExtractedContext
  output              Json     // StrategyStatements
  claudeThoughts      String?  @db.Text

  // Metrics
  modelUsed           String
  totalTokens         Int
  promptTokens        Int
  completionTokens    Int
  latencyMs           Int

  // Feedback
  userFeedback        String?   // 'helpful' | 'not_helpful'
  feedbackTimestamp   DateTime?
  refinementRequested Boolean   @default(false)

  // Phase 2: Error coding
  openCodingNotes     String?   @db.Text
  errorCategories     String[]  @default([])
  reviewedAt          DateTime?
  reviewedBy          String?

  conversation        Conversation @relation(...)
}
```

---

## API Routes

All routes use Next.js 14 App Router conventions (route handlers).

### POST /api/conversation/start

**Purpose:** Initialize conversation

**Input:**
```typescript
{ userId: string }
```

**Output:**
```typescript
{
  conversationId: string
  message: string  // Opening question
}
```

**Logic:**
1. Create Conversation record (status: in_progress, phase: INITIAL)
2. Generate opening question via Claude API
3. Save as assistant Message
4. Return conversationId and opening question

**Timeout:** 60 seconds (`maxDuration = 60`)

### POST /api/conversation/continue

**Purpose:** Multi-phase conversation flow with lens selection

**Input:**
```typescript
{
  conversationId: string
  userResponse: string
  currentPhase: ConversationPhase
  selectedLens?: string  // Only when user selects lens
}
```

**Output:**
```typescript
{
  message: string         // Next question or phase transition message
  complete: boolean       // True if ready for extraction
  nextPhase?: string      // Phase to transition to
  stepNumber: number
}
```

**Logic:**

Phase-specific behavior:

**INITIAL/EXPLORING:**
1. Save user message
2. Assess confidence
3. If <2 questions: continue exploring
4. If ≥2 questions: transition to LENS_SELECTION, return lens selection prompt

**LENS_SELECTION:**
1. Save user's lens choice to Conversation
2. Transition to QUESTIONING phase
3. Generate first lens-specific question

**QUESTIONING:**
1. Save user message
2. Assess confidence
3. Check stopping criteria:
   - If HIGH confidence AND ≥3 questions: mark complete
   - If MEDIUM/LOW AND <10 questions: continue
   - If ≥10 questions: force stop
4. Generate next lens-specific question OR mark complete

**Timeout:** 60 seconds

### POST /api/conversation/assess-confidence

**Purpose:** Real-time confidence assessment

**Input:**
```typescript
{ conversationId: string }
```

**Output:**
```typescript
{
  confidenceScore: 'HIGH' | 'MEDIUM' | 'LOW'
  confidenceReasoning: string
  latencyMs: number
}
```

**Logic:**
1. Load conversation with all messages
2. Build conversation history string
3. Call Claude API with confidence assessment prompt
4. Extract confidence level and reasoning from XML response
5. Update latest message with confidence data
6. Return assessment

**Assessment Criteria:**
- **Coverage:** Has conversation touched key dimensions? (customer/market, value prop, context)
- **Specificity:** Are responses concrete enough to work with?

**Timeout:** 60 seconds

### POST /api/extract

**Purpose:** Extract enhanced context from conversation

**Input:**
```typescript
{ conversationId: string }
```

**Output:**
```typescript
{
  extractedContext: EnhancedExtractedContext
  latencyMs: number
}
```

**EnhancedExtractedContext Structure:**
```typescript
{
  core: {
    industry: string
    target_market: string
    unique_value: string
  }
  enrichment: {
    competitive_context?: string[]
    customer_segments?: string[]
    operational_capabilities?: string[]
    technical_advantages?: string[]
  }
  reflective_summary: {
    strengths: string[]
    emerging: string[]
    unexplored: string[]
    thought_prompt: string
  }
}
```

**Logic:**
1. Load conversation with all messages
2. Build conversation history
3. Call Claude API with extraction prompt (includes core + enrichment + reflective summary)
4. Parse XML response into EnhancedExtractedContext structure
5. Return extracted context

**Timeout:** 60 seconds

### POST /api/generate

**Purpose:** Generate strategy statements from enriched context

**Input:**
```typescript
{
  conversationId: string
  extractedContext: EnhancedExtractedContext
}
```

**Output:**
```typescript
{
  traceId: string
  thoughts: string
  statements: StrategyStatements
}
```

**StrategyStatements Structure:**
```typescript
{
  vision: string
  mission: string
  objectives: string[]  // Array of 3 SMART objectives
}
```

**Logic:**
1. Load conversation
2. Format enriched context for prompt:
   - Core context (3 fields)
   - Enrichment details (dynamically formatted)
   - Reflective summary (strengths, emerging, unexplored)
3. Call Claude API with comprehensive generation prompt
4. Parse XML response (thoughts + statements)
5. Save Trace with all metadata
6. Update conversation status to 'completed'
7. Return trace ID, thoughts, statements

**Critical:** Uses `EnhancedExtractedContext`, not old `ExtractedContext` (3 fields only)

**Prompt Size:** ~300+ words depending on conversation depth (vs original ~50 words)

**Timeout:** 60 seconds

### POST /api/feedback

**Purpose:** Collect user feedback

**Input:**
```typescript
{
  traceId: string
  feedback: 'helpful' | 'not_helpful'
}
```

**Output:**
```typescript
{ success: boolean }
```

**Logic:**
1. Update Trace with user feedback
2. Set feedback timestamp
3. Return success

---

## Frontend Components

### src/app/page.tsx

**Purpose:** Main orchestration - routes user through flow steps

**State Management:**
- `flowStep`: 'chat' | 'extraction' | 'strategy'
- `conversationId`, `messages`, `extractedContext`, `strategy`, etc.
- `currentPhase`: Tracks conversation phase

**Flow:**
1. On mount: Call `/api/conversation/start`
2. Chat phase: `<ChatInterface>` handles conversation
3. When complete: Call `/api/extract`, show `<ExtractionConfirm>`
4. User confirms: Call `/api/generate`, show `<StrategyDisplay>` + `<FeedbackButtons>`
5. User explores more: Return to chat with thought prompt

**Key Functions:**
- `handleUserResponse()` - Calls `/api/conversation/continue`
- `extractContext()` - Calls `/api/extract`
- `handleConfirmContext()` - Calls `/api/generate` (has diagnostic logging)
- `handleExplore()` - Returns to chat with thought prompt

### src/components/ChatInterface.tsx

**Purpose:** Phase-aware conversation UI

**Props:**
```typescript
{
  conversationId: string
  messages: Message[]
  onUserResponse: (response: string) => void
  isLoading: boolean
  isComplete: boolean
  currentPhase: ConversationPhase
}
```

**Features:**
- Scrollable message history
- Text input with submit
- Loading state during API calls
- Phase indicator (optional visual)

### src/components/LensSelector.tsx

**Purpose:** Strategic lens selection interface

**Props:**
```typescript
{
  onSelectLens: (lens: string) => void
}
```

**Lenses:**
- A: Competitive Advantage
- B: Customer-Centric
- C: Innovation-Driven
- D: Operations Excellence
- E: Growth & Scale
- F: Resource Optimization

**UI:** Cards with title + description, click to select

### src/components/ExtractionConfirm.tsx

**Purpose:** Review extracted context, choose to generate or explore more

**Props:**
```typescript
{
  extractedContext: EnhancedExtractedContext
  onConfirm: () => void
  onExplore: () => void
}
```

**Display:**
- Core fields (industry, target market, unique value)
- Enrichment details (if present)
- Reflective summary (strengths, emerging themes, unexplored)
- Two buttons: "Generate my strategy" | "Keep exploring"

### src/components/StrategyDisplay.tsx

**Purpose:** Visualize generated strategy with ReactFlow

**Props:**
```typescript
{
  strategy: StrategyStatements
  thoughts: string
}
```

**Visualization:**
- Vision node at top
- Mission node below vision
- 3 objective nodes below mission
- Edges connecting vision → mission → objectives

**Libraries:** ReactFlow for diagram rendering

### src/components/FeedbackButtons.tsx

**Purpose:** Simple helpful/not helpful feedback

**Props:**
```typescript
{
  traceId: string
}
```

**UI:** Two buttons calling `/api/feedback`

---

## Type Definitions

### src/lib/types.ts

**Key Types:**

```typescript
// Legacy (3 fields only)
export interface ExtractedContext {
  industry: string
  targetMarket: string
  uniqueValue: string
}

// Current (comprehensive)
export interface EnhancedExtractedContext {
  core: {
    industry: string
    target_market: string
    unique_value: string
  }
  enrichment: {
    competitive_context?: string[]
    customer_segments?: string[]
    operational_capabilities?: string[]
    technical_advantages?: string[]
  }
  reflective_summary: {
    strengths: string[]
    emerging: string[]
    unexplored: string[]
    thought_prompt: string
  }
}

export interface StrategyStatements {
  vision: string
  mission: string
  objectives: string[]
}

export type ConversationPhase =
  | 'INITIAL'
  | 'EXPLORING'
  | 'LENS_SELECTION'
  | 'QUESTIONING'
  | 'COMPLETE'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'
```

---

## Prompts & AI Logic

### Conversation Prompts

**Opening Question:**
- Generic business exploration
- Open-ended to capture initial context

**Lens-Specific Questions:**
- Generated based on selected lens + conversation history
- Targeted to explore dimension deeply
- Adaptive based on what's already covered

### Confidence Assessment Prompt

**Criteria:**
1. **Coverage** - Has conversation touched key dimensions?
   - Customer/market understanding
   - Value proposition
   - Context (industry, competitive landscape)

2. **Specificity** - Are responses concrete enough?
   - Enough detail to anchor strategy
   - Clear what's uncertain/unexplored
   - Sufficient for generating strategy + highlighting development opportunities

**Philosophy:** "This is a development tool. We need enough to work with, not perfect knowledge."

### Extraction Prompt

**Sections:**
1. **Core Context** - 3 fundamental fields
2. **Enrichment** - 4 optional depth fields (lens-dependent)
3. **Reflective Summary** - Meta-analysis of conversation

**Output:** XML with nested structure

### Generation Prompt

**Input Sections:**
- Core context (3 fields)
- Enrichment details (formatted with labels)
- Insights from conversation (strengths, emerging themes, unexplored)

**Guidelines:**
- Use core as foundation
- Leverage enrichment for specificity and differentiation
- Incorporate strengths and emerging themes
- Vision: aspirational, future-focused, memorable
- Mission: clear, actionable, current purpose
- Objectives: SMART (Specific, Measurable, Achievable, Relevant, Time-bound)

**Output:** XML with thoughts + statements

---

## Phase 2: Trace Review System

Built but not yet actively used. Prepares for error analysis workflow.

### Python Helper Library

**Location:** `scripts/trace_analysis.py`

**TraceAnalyzer Class:**
```python
class TraceAnalyzer:
    def load_traces(limit=50, filters=None)
    def display_trace(trace_id)
    def annotate_trace(trace_id, notes)
    def categorize_trace(trace_id, categories)
    def get_coding_summary()
```

**Usage:** Import in Jupyter notebooks for interactive trace analysis

### Jupyter Workflow

**Location:** `notebooks/trace_analysis_starter.ipynb`

**Workflow:**
1. Load traces with filtering
2. Display trace with conversation + extraction + generation
3. Add open coding notes (emergent pattern discovery)
4. Synthesize themes across traces
5. Apply error categories (after theme synthesis)
6. View summary statistics

**Goal:** Support open coding methodology (emergent error discovery) for Phase 2 evals

---

## Deployment

### Vercel Configuration

**File:** `vercel.json`

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "development": false
    }
  }
}
```

**Strategy:**
- Work on `development` branch (WIP allowed)
- Merge to `main` when ready for beta users
- Vercel auto-deploys only from `main`

### Environment Variables

**Required:**
- `DATABASE_URL` - Vercel Postgres connection string
- `ANTHROPIC_API_KEY` - Claude API key

**Note:** Use `.env.local` for local development (Next.js convention)

---

## Known Limitations & Outstanding Issues

### Current Issues

1. **Generation Timeout** (In Progress)
   - Symptom: Hangs after clicking "Generate my strategy"
   - Status: Diagnostic logging added, awaiting UAT testing
   - See: `docs/issues-and-bugfixes.md`

2. **No Authentication**
   - Currently using temp user IDs (`user_${Date.now()}`)
   - Planned: NextAuth with magic link email

3. **No Deployment to Vercel Yet**
   - Configured but not deployed
   - Awaiting timeout fix + UAT completion

### Design Decisions

**Flexible JSON Schemas:**
- `extractedContext` and `output` stored as JSON in Trace
- Allows evolution without migrations
- Trade-off: Less type safety at DB level

**Phase Management:**
- Explicit phase field instead of implicit state
- Easier debugging and flow control
- Clear state transitions

**Confidence-Based Stopping:**
- Balances depth vs user patience
- Prevents both premature and excessive questioning
- 3-10 question range with confidence gates

**Lens-Driven Depth:**
- Avoids overwhelming user with all dimensions at once
- Targeted exploration based on user interest
- Improves question quality and relevance

---

## Future Considerations

### Potential Expansions

**Full Decision Stack:**
- Current: Vision → Mission → Objectives
- Future: Add Initiatives level (tactical actions)

**Multiple Frameworks:**
- Current: Generic strategic lenses
- Future: Hamilton Helmer's 7 Powers, Porter's 5 Forces, etc.

**Evals Infrastructure:**
- Current: Data collection + trace review prep
- Phase 2: Open coding → Axial coding → LLM-as-Judge
- Weekly continuous improvement cycles

**User Features:**
- Conversation history
- Strategy versioning
- Export/share functionality
- Collaboration features

---

_This document reflects the system as actually built on 2025-12-09._
