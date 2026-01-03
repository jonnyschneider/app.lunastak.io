# Architecture Documentation

**Last Updated:** 2025-12-07
**Phase:** Phase 0 - Foundation

---

## Project Overview

**Decision Stack v4** is an AI-powered strategy consultant that helps users articulate their business strategy through conversational interaction.

**Primary Goals:**
1. Learn evals methodology (Hamel Husain & Shreya Shankar approach)
2. Ship closed beta with 100 users
3. Build systematic improvement using error analysis
4. Marketing vehicle for Humble Ventures

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14.1.0 with App Router
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Visualization:** ReactFlow 11.11.4 (Decision Stack diagram)
- **State Management:** React hooks (no Redux/Zustand for Phase 0)

### Backend
- **Runtime:** Next.js Edge Runtime (API routes)
- **Database:** Vercel Postgres
- **ORM:** Prisma
- **Auth:** NextAuth.js with Email Provider (magic links)

### AI & APIs
- **LLM:** Claude API via @anthropic-ai/sdk
- **Model:** Claude 3.5 Sonnet (or latest at time of implementation)
- **Pattern:** XML-based prompt/response format

### Infrastructure
- **Hosting:** Vercel
- **Analytics:** Vercel Analytics
- **Email:** Email provider integration (via NextAuth)
- **Feature Flags:** Statsig (Phase 1+)

### Development Tools
- **Package Manager:** npm (or pnpm)
- **Linting:** ESLint with Next.js config
- **Type Checking:** TypeScript compiler
- **Testing:** Jest + React Testing Library (Phase 1+)

---

## Architecture Principles

### Design for Future Flexibility

**Problem:** Strategic analysis will evolve beyond initial 3 fields (industry, target_market, unique_value)

**Solution:**
- Use flexible JSON schemas in database (`jsonb` columns)
- Avoid rigid table structures that require migrations
- Keep prompt engineering modular (separate prompts per dimension)
- Design for iteration without premature commitments

**Future expansion may include:**
- Competitive analysis
- Product experience evaluation
- Technical advantages
- Economies of scale
- Strategic "powers" (Hamilton Helmer framework)
- Porter's 5 Forces analysis

**Current scope (Phase 0):** Vision → Mission → Objectives (top half of Decision Stack)

### Simplicity First (YAGNI)

**Principles:**
- Build only what's needed for current phase
- No over-engineering or premature abstractions
- "Good enough for beta" is the target
- Iterate based on real user data (not assumptions)

**What we're NOT building yet:**
- Refinement/iteration flow (Phase 1)
- Initiatives layer (Phase 2+)
- Advanced strategy frameworks (Phase 2+)
- Voice input, document upload (backlog, validate first)

### Validated Learning

**Philosophy:**
- Data over opinions
- Use fake door tests before building features
- Build what users actually want (not what we think they want)
- Error analysis drives improvement (Phase 2+)

**Tools:**
- Feature backlog with validation methods
- User feedback (thumbs up/down)
- Trace analysis (manual review → LLM judges)

---

## System Architecture (v4)

### High-Level Flow

```
User → Chat Interface → Conversation API → Claude (3 questions)
                           ↓
                    Extract Context (Claude)
                           ↓
                    User Confirms/Edits
                           ↓
                    Generate Strategy (Claude)
                           ↓
              ReactFlow Visualization + Feedback UI
                           ↓
                      All logged to DB
```

### Database Schema (Prisma)

**Designed for comprehensive trace logging**

#### Conversations Table
```prisma
model Conversation {
  id         String   @id @default(uuid())
  userId     String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  status     Status   @default(IN_PROGRESS)

  messages   Message[]
  traces     Trace[]
}

enum Status {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}
```

#### Messages Table
```prisma
model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  role           Role
  content        String       @db.Text
  stepNumber     Int
  timestamp      DateTime     @default(now())
}

enum Role {
  ASSISTANT
  USER
}
```

#### Traces Table
```prisma
model Trace {
  id                  String       @id @default(uuid())
  conversationId      String
  conversation        Conversation @relation(fields: [conversationId], references: [id])
  userId              String
  timestamp           DateTime     @default(now())

  // Extracted Context (flexible JSON)
  extractedContext    Json         // { industry, target_market, unique_value, extraction_confidence, raw_conversation }

  // Generated Output (flexible JSON)
  output              Json         // { vision, mission, objectives }
  claudeThoughts      String?      @db.Text

  // Metadata
  modelUsed           String
  totalTokens         Int
  promptTokens        Int
  completionTokens    Int
  latencyMs           Int

  // User Feedback (added later)
  userFeedback        Feedback?
  feedbackTimestamp   DateTime?
  refinementRequested Boolean      @default(false)
}

enum Feedback {
  HELPFUL
  NOT_HELPFUL
}
```

**Key Design Decisions:**
- `extractedContext` and `output` are `Json` (flexible, avoids migrations)
- Full conversation history stored in `messages`
- Token usage and latency tracked for cost analysis
- User feedback schema ready (Phase 1)

---

## v3 Code Reuse Strategy

### What We're Reusing (~80%)

**Location:** `/Users/Jonny/Desktop/decision-stack-v3/web`

#### 1. StrategyFlow.tsx (Visualization)
**Path:** `src/components/StrategyFlow.tsx`

**What it does:**
- ReactFlow-based visualization of Vision → Mission → Objectives
- Handles layout, styling, connections
- Production-ready component

**Changes needed:**
- Minimal (maybe styling tweaks)
- Keep as-is for Phase 0

#### 2. Types (TypeScript Interfaces)
**Path:** `src/lib/types.ts`

**Existing types:**
```typescript
interface BusinessContext {
  industry: string;
  targetMarket: string;
  uniqueValue: string;
}

interface StrategyStatements {
  vision: string;
  mission: string;
  objectives: string[];
}

interface GenerationResponse {
  thoughts: string;
  statements: StrategyStatements;
}
```

**Changes needed:**
- Extend with new types:
  - `Conversation`, `Message`, `Trace`
  - `ConversationMessage`, `ExtractionResult`
- Keep existing types for compatibility

#### 3. Utils (Helper Functions)
**Path:** `src/lib/utils.ts`

**Existing utils:**
```typescript
extractXML(text: string, tag: string): string
  // Parses Claude's XML responses
  // Pattern: /<tag>(.*?)<\/tag>/
  // Keep this - still using XML format

buildPrompt(prompt: string, context: BusinessContext, feedback?: string): string
  // Builds prompt from context
  // Refactor for conversational flow
  // New version will handle conversation history
```

**Changes needed:**
- Keep `extractXML` as-is
- Refactor `buildPrompt` for chat-based interaction
- Add new utils for conversation management

#### 4. Claude API Integration Pattern
**Path:** `src/app/api/generate/route.ts`

**What we're keeping:**
- Edge runtime configuration
- Error handling pattern
- Anthropic SDK usage
- XML response parsing

**What we're changing:**
- Endpoint structure (new: `/api/conversation`, `/api/extract`, `/api/generate`)
- Prompts (conversational vs. form-based)
- Model version (upgrade to Sonnet 4.5)
- Add comprehensive logging

#### 5. Configuration Files
**Keep as-is:**
- `tailwind.config.ts` ✅
- `tsconfig.json` ✅
- `next.config.js` ✅
- `.env.local` structure (add new vars)

### What We're NOT Reusing (~20%)

#### 1. InputForm.tsx
**Why:** Replacing static 3-field form with chat interface

#### 2. page.tsx (Home)
**Why:** Redesigning for conversational UX (not two-column form/viz layout)

#### 3. Any v3-specific business logic
**Why:** Conversation flow is fundamentally different

---

## Application Structure (v4)

### Directory Structure (Planned)

```
dc-agent-v4-with-evals/
├── .claude/                    # Claude Code instructions
│   ├── README.md              # Session startup checklist
│   ├── workflow.md            # Git/commit workflows
│   └── architecture.md        # This file
│
├── docs/
│   ├── session-notes/         # Archived session logs
│   │   └── YYYY-MM-DD_*.md
│   └── rd-tracking/           # R&D tax claim docs
│       ├── time-log.md
│       └── costs.csv
│
├── readme/
│   ├── V4_DEVELOPMENT_PLAN.md # Overall plan
│   ├── PROJECT_STATUS.md      # Phase tracking
│   └── FEATURE_BACKLOG.md     # Feature ideas
│
├── prisma/
│   └── schema.prisma          # Database schema
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── conversation/
│   │   │   │   └── route.ts   # Chat API (ask questions)
│   │   │   ├── extract/
│   │   │   │   └── route.ts   # Context extraction
│   │   │   └── generate/
│   │   │       └── route.ts   # Strategy generation
│   │   ├── chat/
│   │   │   └── [id]/
│   │   │       └── page.tsx   # Conversation view
│   │   ├── layout.tsx
│   │   └── page.tsx           # Landing page
│   │
│   ├── components/
│   │   ├── ChatInterface.tsx     # Chat UI
│   │   ├── ChatMessage.tsx       # Message bubble
│   │   ├── ExtractionConfirm.tsx # Context confirmation
│   │   ├── StrategyFlow.tsx      # ReactFlow viz (from v3)
│   │   └── FeedbackButtons.tsx   # Thumbs up/down
│   │
│   ├── lib/
│   │   ├── claude.ts          # Claude API wrapper
│   │   ├── db.ts              # Prisma client
│   │   ├── types.ts           # TypeScript types (extended from v3)
│   │   └── utils.ts           # Helpers (from v3, refactored)
│   │
│   └── styles/
│       └── globals.css        # Tailwind imports
│
├── COMMIT_NOTES.md            # Working session notes
├── .env.local                 # Environment variables
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md                  # Project overview
```

---

## API Endpoints Design

### POST /api/conversation
**Purpose:** Handle conversational Q&A

**Request:**
```typescript
{
  conversationId: string;
  message: string;
}
```

**Response:**
```typescript
{
  conversationId: string;
  question: string;        // Next question from Claude
  stepNumber: number;      // 1, 2, 3
  isComplete: boolean;     // True after 3 questions
}
```

**Flow:**
1. Save user message to DB
2. Send conversation history to Claude
3. Claude generates next question (context-aware)
4. Save assistant message to DB
5. Return question to frontend

### POST /api/extract
**Purpose:** Extract structured context from conversation

**Request:**
```typescript
{
  conversationId: string;
}
```

**Response:**
```typescript
{
  extractedContext: {
    industry: string;
    target_market: string;
    unique_value: string;
    extraction_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  clarifyingQuestion?: string;  // If confidence < HIGH
}
```

**Flow:**
1. Fetch all messages for conversation
2. Send to Claude for extraction
3. Claude returns structured context + confidence
4. If confidence < HIGH, generate clarifying question
5. Save extraction to trace

### POST /api/generate
**Purpose:** Generate strategy from extracted context

**Request:**
```typescript
{
  conversationId: string;
  extractedContext: ExtractedContext;
}
```

**Response:**
```typescript
{
  traceId: string;
  statements: {
    vision: string;
    mission: string;
    objectives: string[];
  };
  thoughts: string;
  metadata: {
    tokens: number;
    latency: number;
  };
}
```

**Flow:**
1. Build strategy generation prompt from context
2. Send to Claude
3. Parse XML response
4. Save complete trace to DB (conversation + context + output + metadata)
5. Return strategy to frontend

---

## Conversation Flow Design

### The 3 Core Questions

**Question 1: Business Challenge**
```
Prompt to Claude:
"You are a strategy consultant. Ask them to describe their
business challenge or opportunity in their own words. Keep it
warm, conversational, and open-ended."

Example output:
"What business challenge or opportunity are you working on right now?"
```

**Question 2: Target Market**
```
Prompt to Claude:
"Based on their description, ask a natural follow-up about
who they're serving. Reference something specific from their answer."

Example output:
"Got it! When you say small restaurants, who specifically are you
targeting? Is there a particular type or size?"
```

**Question 3: Differentiation**
```
Prompt to Claude:
"Ask what makes their approach unique. Make it feel like
curiosity, not an interrogation."

Example output:
"What makes your approach different from other solutions in this space?"
```

### Context Extraction

**After 3 questions, extract:**
```xml
<context>
  <industry>Specific industry identified</industry>
  <target_market>Specific customer segment</target_market>
  <unique_value>Key differentiator</unique_value>
  <confidence>HIGH|MEDIUM|LOW</confidence>
</context>
```

**If confidence < HIGH:**
```xml
<missing>
  What information is still unclear or missing
</missing>
<clarifying_question>
  One focused question to fill the gap
</clarifying_question>
```

### Strategy Generation

**Input:** Extracted context
**Output:** Vision → Mission → Objectives

**Prompt structure (XML-based):**
```xml
<context>
  <industry>{extracted}</industry>
  <target_market>{extracted}</target_market>
  <unique_value>{extracted}</unique_value>
</context>

<task>
Generate compelling strategy statements:
- Vision: Aspirational, future-focused, memorable
- Mission: Clear, actionable, current purpose
- Objectives: SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
</task>

<format>
<thoughts>Your reasoning</thoughts>
<statements>
  <vision>...</vision>
  <mission>...</mission>
  <objectives>
    1. First objective
    2. Second objective
    3. Third objective
  </objectives>
</statements>
</format>
```

---

## Environment Variables

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgres://...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000  # or production URL
NEXTAUTH_EMAIL_FROM=noreply@humventures.com.au

# Email Provider (for magic links)
EMAIL_SERVER=smtp://...
EMAIL_FROM=noreply@humventures.com.au

# Vercel (auto-populated in production)
VERCEL_URL=...
```

---

## Performance Considerations

### Token Usage
- **Question generation:** ~500-1000 tokens per question
- **Context extraction:** ~1000-1500 tokens
- **Strategy generation:** ~1000-2000 tokens
- **Total per user:** ~4000-5000 tokens

**Optimization:**
- Cache prompts where possible
- Use shorter system prompts
- Track token usage in traces for cost analysis

### Latency
- **Target:** <3s per response
- **Claude API:** Usually 1-2s
- **Database:** <100ms per query
- **Frontend:** Optimistic UI updates

### Database
- **Index:** conversationId, userId, timestamp
- **Retention:** Keep all traces (data is the product)
- **Export:** CSV export for error analysis (Phase 2)

---

## Security Considerations

### Authentication
- Magic link email (no passwords to leak)
- NextAuth handles session management
- Secure HTTP-only cookies

### Input Validation
- Sanitize user messages (XSS prevention)
- Rate limiting on API routes (Phase 1)
- Length limits on free-text inputs

### API Keys
- Never expose ANTHROPIC_API_KEY to frontend
- Server-side only API calls
- Environment variables properly configured

### Data Privacy
- User conversations are private
- No sharing between users
- GDPR compliance (Phase 1: add data export/deletion)

---

## Deployment Strategy

### Vercel Configuration

**Branches:**
- `development` → Preview deployments (not linked to production)
- `main` → Production deployment (auto-deploy on push)

**Environment Variables:**
- Set in Vercel dashboard
- Separate values for preview vs. production if needed

**Build Settings:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

### Database Migrations

**Using Prisma:**
```bash
# Development
npx prisma migrate dev

# Production (via Vercel)
npx prisma migrate deploy
```

**Strategy:**
- Use flexible JSON schemas to avoid frequent migrations
- Plan schema changes carefully
- Test migrations in preview deployments first

---

## Future Architecture Considerations

### Phase 1: Iteration & Refinement
- Add refinement endpoints
- Version tracking for strategies
- Conversation forking

### Phase 2: Error Analysis & Evals
- CSV export functionality
- Jupyter notebook integration
- LLM-as-judge implementation
- Eval result storage

### Phase 3: Advanced Features
- Voice input integration
- Document upload and parsing
- Multi-session support
- Collaborative editing

### Scaling Considerations (If Needed)
- Currently: Serverless (Vercel Edge)
- Future: Could add Redis for caching
- Database: Vercel Postgres scales automatically
- Claude API: Monitor rate limits

---

## Database Schema V1 (2026-01-03)

### Core Entities

- **Project**: Boundary for strategic understanding. One user can have multiple projects.
- **Conversation**: Interactive questioning sessions (belongs to Project)
- **Fragment**: Extracted themes/insights from conversations (belongs to Project)
- **FragmentDimensionTag**: Tags fragments to Tier 1 dimensions
- **DimensionalSynthesis**: Compressed understanding per dimension per project (11 per project)
- **GeneratedOutput**: Decision Stack artifacts
- **ExtractionRun**: Evaluation traces for A/B testing

### Tier 1 Dimensions

The 11 strategic dimensions for fragment tagging and synthesis:
1. CUSTOMER_MARKET
2. PROBLEM_OPPORTUNITY
3. VALUE_PROPOSITION
4. DIFFERENTIATION_ADVANTAGE
5. COMPETITIVE_LANDSCAPE
6. BUSINESS_MODEL_ECONOMICS
7. GO_TO_MARKET
8. PRODUCT_EXPERIENCE
9. CAPABILITIES_ASSETS
10. RISKS_CONSTRAINTS
11. STRATEGIC_INTENT

### Legacy

- **Trace**: Deprecated, kept for historical data. New extractions use Fragment/ExtractionRun.

See: `docs/plans/strategic/schema-design-summary.md` for full design docs.

---

## Notes

- This architecture is designed for Phase 0
- Will evolve based on real user data
- Prioritize learning and iteration over perfect design
- Update this document as architecture changes

**Last major update:** Schema V1 migration (2026-01-03)
