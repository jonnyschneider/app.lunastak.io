# Adaptive Conversation Flow - Design Document

**Date:** 2025-12-08
**Status:** Approved
**Phase:** Phase 1 Enhancement

---

## Overview

Enhance the Decision Stack conversational flow to improve user experience and strategy quality by:
1. Adding user-led framing through lens selection
2. Implementing adaptive questioning (3-10 questions based on quality)
3. Adding reflective summarization to support strategy development
4. Capturing enrichment data beyond core 3 fields

**Key Goals:**
- Preserve conversational warmth (Observation 1 strength)
- Address quality issues from fixed 3-question approach (Observation 3)
- Position tool as strategy development aid, not just capture mechanism
- Collect rich data for Phase 2 evals

---

## User Experience Flow

### Complete Journey

1. **First Open Question** (existing warm opener)
2. **User responds** with initial context
3. **AI acknowledges** response warmly and presents lens selection
4. **Lens Selection:** "What do you know the most about?"
   - A) Your customers
   - B) Your domain/operations
   - C) Your industry/market
   - D) Your product/technology
   - E) Let AI guide me
5. **User types letter** (A/B/C/D/E)
6. **Dynamic Questioning** begins (framed through chosen lens)
7. **After each response:**
   - Confidence assessment (coverage + specificity)
   - Decision: continue / offer early exit / proceed to extraction
   - Min 3 questions, max 10 questions
8. **Extraction Phase:**
   - Show structured context (core 3 + enrichment fields)
   - Show reflective summary (strengths / emerging / unexplored)
   - Thought-provoking question for further development
9. **User chooses:**
   - "Generate my strategy" → proceed to generation
   - "Explore further" → return to questioning
10. **Strategy Generation** (existing ReactFlow visualization)

---

## State Machine

### Conversation Phases

```
INITIAL → (user responds) → LENS_SELECTION
LENS_SELECTION → (user picks A-E) → QUESTIONING
QUESTIONING → (each response) → Confidence Check:
  - If question_count < 3: Continue QUESTIONING
  - If question_count >= 3 AND confidence HIGH: Offer early exit
    - User accepts: → EXTRACTION
    - User continues: → QUESTIONING
  - If question_count >= 10: → EXTRACTION (max reached)
  - Else: Continue QUESTIONING
EXTRACTION → (user confirms) → GENERATION
EXTRACTION → (user explores further) → QUESTIONING
```

### State Storage

Store in `Conversation` model:
- `currentPhase`: INITIAL | LENS_SELECTION | QUESTIONING | EXTRACTION | GENERATION
- `selectedLens`: A | B | C | D | E
- `questionCount`: integer (0-10)

---

## The 5 Strategic Lenses

### Lens Definitions

**A) Your customers**
- Jobs-to-be-done language (without jargon)
- Customer pain points, segments, personas
- Value from customer perspective
- Example opening: "What problem do you solve, or opportunity do you create for customers?"

**B) Your domain/operations**
- Capabilities, expertise, processes
- Operational advantages, know-how
- Delivery model
- Example opening: "What operational capabilities give you an edge?"

**C) Your industry/market**
- Competitive positioning, differentiation
- Market forces, trends
- Strategic advantages
- Example opening: "What makes your product different and better than others?"

**D) Your product/technology**
- Technical capabilities, features
- Product roadmap, innovation
- Technology advantages
- Example opening: "What makes your product technically distinctive?"

**E) Let AI guide me**
- AI analyzes first response and chooses most natural framing
- Blends approaches based on what user emphasized
- Adaptive path

### How Lenses Work

**Lenses are framing devices, not coverage filters.**

All conversations eventually cover the same strategic territory:
- Customer/market understanding
- Value proposition
- Context and differentiation

Lenses change the **vocabulary and mental model** used in questions:
- Customer lens → problem/opportunity language
- Industry lens → competitive positioning language
- Domain lens → capabilities/expertise language
- Product lens → features/technology language

This respects users' natural thinking styles while ensuring comprehensive coverage.

---

## Confidence Assessment System

### Purpose

Determine after each user response whether we have enough quality information to generate strong strategy output.

### Two-Dimension Scoring

**1. Coverage** - Has the conversation touched key strategic dimensions?

Required dimensions:
- Customer/market understanding (who, what problem)
- Value proposition (why you, differentiation)
- Context (industry, competitive landscape)

**2. Specificity** - Are responses concrete enough to work with?

Quality signals (softened for development context):
- Enough concrete detail to anchor strategy
- Clear enough to identify what's uncertain/unexplored
- Sufficient for generating strategy + highlighting development opportunities

**Note:** We're not expecting users to know everything. Decision Stack is a development tool, not just a capture tool. Confidence reflects "readiness to generate useful output" not "completeness of knowledge."

### Confidence Levels

- `HIGH`: Coverage complete + responses specific enough to generate strong strategy
- `MEDIUM`: Coverage incomplete OR responses need more detail
- `LOW`: Coverage gaps AND responses too vague

### Implementation

After each user response in QUESTIONING phase:

**Separate API call for confidence assessment:**
```
POST /api/conversation/assess-confidence
{
  conversationId: string,
  messageHistory: Message[]
}

Returns:
{
  confidenceScore: 'HIGH' | 'MEDIUM' | 'LOW',
  confidenceReasoning: string
}
```

**Prompt structure:**
```
Evaluate conversation quality for strategy generation.

Coverage: Do we understand customer/market, value proposition, and context?
Specificity: Are responses concrete enough to generate useful strategy and identify development opportunities?

Remember: This is a development tool. We need enough to work with, not perfect knowledge.

Return: HIGH / MEDIUM / LOW with brief reasoning.
```

**Storage:**
- Add `confidenceScore` and `confidenceReasoning` fields to Message model
- Store with each user message for evals analysis

### Decision Logic

```javascript
if (questionCount < 3) {
  // Must ask minimum 3 questions
  continue questioning
}
else if (questionCount >= 10) {
  // Max reached
  move to EXTRACTION
}
else if (confidenceScore === 'HIGH') {
  // Offer early exit
  present choice: continue or generate
}
else {
  // Need more coverage/specificity
  continue questioning
}
```

---

## Extraction Phase with Reflective Summary

### Structured Context

**Core Fields (required):**
```json
{
  "core": {
    "industry": "string",
    "target_market": "string",
    "unique_value": "string"
  }
}
```

**Enrichment Fields (variable/emergent):**
```json
{
  "enrichment": {
    "competitive_context": "string (optional)",
    "customer_segments": "string[] (optional)",
    "operational_capabilities": "string (optional)",
    "technical_advantages": "string (optional)",
    // ... other dimensions that emerged
  }
}
```

### Reflective Summary (NEW)

AI generates development-focused summary:

```json
{
  "reflective_summary": {
    "strengths": [
      "2-3 strongest anchors from conversation",
      "What's clearly articulated and solid"
    ],
    "emerging": [
      "1-2 areas with some clarity but room to develop",
      "Themes that started to surface"
    ],
    "unexplored": [
      "1-2 gaps or questions worth considering",
      "Opportunities for deeper thinking"
    ],
    "thought_prompt": "Optional open-ended question to spark reflection"
  }
}
```

**Purpose:**
- Highlight what's strong (validation)
- Surface what's developing (awareness)
- Identify productive gaps (development opportunity)
- Provide thought-provoking prompt for continued exploration

### User Options from Extraction

1. **"Generate my strategy"**
   - Proceed to GENERATION phase
   - Use extracted context (core + enrichment)

2. **"Explore further"**
   - Return to QUESTIONING phase
   - AI uses thought_prompt to continue conversation
   - Build on existing context

This supports both:
- Users ready to see output now
- Users who want to develop thinking further (without multi-session complexity yet)

---

## Database Schema Changes

### Conversation Model

```prisma
model Conversation {
  id            String   @id @default(cuid())
  userId        String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  status        String   // 'in_progress' | 'completed' | 'abandoned'

  // NEW FIELDS
  currentPhase  String   @default("INITIAL") // INITIAL | LENS_SELECTION | QUESTIONING | EXTRACTION | GENERATION
  selectedLens  String?  // A | B | C | D | E
  questionCount Int      @default(0)

  messages      Message[]
  traces        Trace[]
}
```

### Message Model

```prisma
model Message {
  id              String   @id @default(cuid())
  conversationId  String
  role            String   // 'assistant' | 'user'
  content         String
  stepNumber      Int
  timestamp       DateTime @default(now())

  // NEW FIELDS
  confidenceScore     String?  // 'HIGH' | 'MEDIUM' | 'LOW'
  confidenceReasoning String?  // Brief explanation

  conversation    Conversation @relation(fields: [conversationId], references: [id])
}
```

### Trace Model (enhanced extractedContext)

```prisma
model Trace {
  id                  String   @id @default(cuid())
  conversationId      String
  userId              String
  timestamp           DateTime @default(now())

  extractedContext    Json     // Enhanced structure (see below)
  output              Json
  claudeThoughts      String?

  modelUsed           String
  totalTokens         Int
  promptTokens        Int
  completionTokens    Int
  latencyMs           Int

  userFeedback        String?
  feedbackTimestamp   DateTime?
  refinementRequested Boolean  @default(false)

  conversation        Conversation @relation(fields: [conversationId], references: [id])
}
```

**Enhanced extractedContext structure:**
```json
{
  "core": {
    "industry": "string",
    "target_market": "string",
    "unique_value": "string"
  },
  "enrichment": {
    "competitive_context": "string (optional)",
    "customer_segments": "array (optional)",
    "operational_capabilities": "string (optional)",
    "technical_advantages": "string (optional)"
    // ... flexible JSON for emergent fields
  },
  "reflective_summary": {
    "strengths": ["string", "string"],
    "emerging": ["string"],
    "unexplored": ["string"],
    "thought_prompt": "string (optional)"
  }
}
```

---

## API Architecture

### Endpoint Changes

**1. POST /api/conversation/start** (minimal changes)
- Generate first open question
- Create conversation record with `currentPhase: "INITIAL"`
- Return conversationId + question

**2. POST /api/conversation/continue** (major changes)

**Request:**
```json
{
  "conversationId": "string",
  "userResponse": "string",
  "currentPhase": "string"
}
```

**Phase Routing Logic:**

```javascript
switch (currentPhase) {
  case 'INITIAL':
    // User responded to first question
    // 1. Acknowledge their response warmly
    // 2. Present lens selection: "What do you know the most about?" + A-E options
    // 3. Update phase to 'LENS_SELECTION'
    return { message, nextPhase: 'LENS_SELECTION' }

  case 'LENS_SELECTION':
    // User chose lens (A/B/C/D/E)
    // 1. Validate choice
    // 2. Store selectedLens
    // 3. Generate first lens-framed question
    // 4. Update phase to 'QUESTIONING', questionCount = 1
    return { message, nextPhase: 'QUESTIONING' }

  case 'QUESTIONING':
    // User answered a question
    // 1. Call confidence assessment API
    // 2. Store confidence with message
    // 3. Increment questionCount
    // 4. Apply decision logic (continue/exit/max)
    // 5. Generate appropriate response
    return { message, nextPhase, shouldExit, metadata }

  case 'EXPLORATION_RESUME':
    // User chose "explore further" from extraction
    // Same as QUESTIONING but with thought prompt context
    return { message, nextPhase: 'QUESTIONING' }
}
```

**3. POST /api/conversation/assess-confidence** (NEW)

**Request:**
```json
{
  "conversationId": "string",
  "messageHistory": [/* Message objects */]
}
```

**Process:**
1. Call Claude to evaluate coverage + specificity
2. Parse confidence level + reasoning
3. Store with latest user message
4. Return to continue endpoint

**Response:**
```json
{
  "confidenceScore": "HIGH" | "MEDIUM" | "LOW",
  "confidenceReasoning": "string"
}
```

**4. POST /api/conversation/extract** (enhanced)

**Process:**
1. Extract core 3 fields (existing)
2. Extract enrichment fields from conversation (NEW)
3. Generate reflective summary (NEW)
4. Return structured context

**Response:**
```json
{
  "extractedContext": {
    "core": { /* 3 fields */ },
    "enrichment": { /* variable fields */ },
    "reflective_summary": { /* strengths/emerging/unexplored */ }
  }
}
```

**5. POST /api/generate** (no changes)
- Existing strategy generation
- Uses extractedContext (now richer with enrichment data)

---

## Prompting Strategy

### Lens-Based Question Generation

Each lens has a framing prompt that guides question style:

**Lens A (Customers):**
```
You're exploring their business through a customer lens.

Frame questions around:
- Customer problems and opportunities
- Customer segments and needs
- Customer value and experience

First question: "What problem do you solve, or opportunity do you create for customers?"

Then build naturally from their responses using customer-centric language.
Stay warm and conversational.
```

**Lens B (Domain/Operations):**
```
You're exploring their business through operational expertise.

Frame questions around:
- Capabilities and domain knowledge
- Processes and delivery model
- Operational advantages
- What they do uniquely well

Build questions that explore their expertise and how they work.
Stay warm and conversational.
```

**Lens C (Industry/Market):**
```
You're exploring their business through market positioning.

Frame questions around:
- Competitive landscape and differentiation
- Market dynamics and trends
- Strategic positioning

First question: "What makes your product different and better than others?"

Then explore competitive context and market positioning.
Stay warm and conversational.
```

**Lens D (Product/Technology):**
```
You're exploring their business through product/technology.

Frame questions around:
- Product capabilities and features
- Technical approach and innovation
- Technology advantages
- Product roadmap

Explore what makes the product technically distinctive.
Stay warm and conversational.
```

**Lens E (AI-guided):**
```
Based on their initial response, choose the most natural framing.

Blend approaches as needed. Adapt to their language and mental model.
Use whichever lens (customer/domain/industry/product) feels most natural
given how they described their business.

Stay warm and conversational.
```

### Question Generation Process

**Context passed to Claude:**
- Full conversation history
- Selected lens framing
- Current question count
- Latest confidence assessment

**AI generates:**
- Next question using lens vocabulary
- Maintains conversational warmth (Observation 1 strength)
- Builds naturally on previous responses
- Covers strategic territory through chosen lens

---

## Frontend Component Changes

### 1. ChatInterface.tsx (enhanced)

**New responsibilities:**
- Handle phase-based rendering
- Display lens selection (text options A-E)
- Display early exit choice (A/B when offered)
- Show exploration resume option from extraction
- Route input based on phase (text vs option selection)

**Phase-specific UI:**
- `LENS_SELECTION`: Show "Type A, B, C, D, or E" prompt
- `QUESTIONING`: Standard text input
- Early exit: Show "Type A or B" prompt

### 2. ExtractionConfirm.tsx (major enhancement)

**Current:** Shows core 3 fields with edit/confirm

**Enhanced:**
1. **Core Fields Section**
   - Industry, Target Market, Unique Value
   - Editable

2. **Enrichment Fields Section (NEW)**
   - Display any enrichment fields that emerged
   - Dynamic rendering based on what's present
   - Editable

3. **Reflective Summary Section (NEW)**
   - **What's Clear:** Strengths list
   - **What's Emerging:** Development areas list
   - **What's Unexplored:** Gaps/opportunities list
   - **Thought Prompt:** Open-ended question (if present)

4. **Action Buttons**
   - "Generate my strategy" → proceed to generation
   - "Explore further" → return to questioning with thought prompt

**Visual Design:**
- Reflective summary feels supportive, not critical
- Clear visual separation between sections
- Thought prompt stands out as invitation to develop thinking

### 3. Main Chat Page (orchestration updates)

**State management:**
- Track `currentPhase`
- Track `selectedLens`
- Track `questionCount`

**API routing:**
- Call appropriate endpoint based on phase
- Handle phase transitions
- Pass phase context to continue API

**Flow control:**
- Route between questioning and extraction
- Handle exploration resume loop
- Manage final transition to generation

---

## Implementation Sequence

### Phase 1: Foundation
1. Update Prisma schema (add new fields to Conversation and Message models)
2. Run database migration: `npm run prisma:push`
3. Update TypeScript types for new fields and phases

### Phase 2: Backend Logic
4. Create confidence assessment endpoint (`/api/conversation/assess-confidence`)
5. Update conversation/continue endpoint with phase routing
6. Implement lens-based question generation (5 lens prompts)
7. Enhance extraction endpoint (enrichment fields + reflective summary)
8. Add decision logic (early exit offer, max questions)

### Phase 3: Frontend
9. Update ChatInterface for phase handling and lens selection
10. Enhance ExtractionConfirm with enrichment display and reflective summary
11. Update main page orchestration (phase state, routing)

### Phase 4: Testing & Refinement
12. Test each lens pathway end-to-end (A, B, C, D, E)
13. Verify confidence scoring behaves reasonably
14. Test early exit flows (offer + both choices)
15. Test exploration resume from extraction
16. Validate data storage (confidence scores, enrichment fields, reflective summary)
17. Check conversation min/max bounds (3-10 questions)

---

## Success Criteria

**Functional:**
- [ ] User can complete flow with any lens choice (A-E)
- [ ] Conversations adapt between 3-10 questions based on confidence
- [ ] Early exit offers appear when confidence is HIGH (after min 3 questions)
- [ ] Reflective summary provides useful development prompts
- [ ] Exploration resume returns to questioning with context

**Data Quality:**
- [ ] Confidence scores stored with each message for evals
- [ ] Enrichment fields capture context beyond core 3
- [ ] All conversation data logged for Phase 2 error analysis
- [ ] Lens choice tracked for analyzing pathway effectiveness

**User Experience:**
- [ ] Flow maintains conversational warmth (preserves Observation 1 strength)
- [ ] Lens selection feels natural, not like a form
- [ ] Reflective summary feels supportive, not critical
- [ ] Tool positions as development aid, not just capture mechanism

---

## Future Enhancements (Deferred)

These were identified during design but deferred to keep MVP focused:

1. **Multi-session persistence** - Save progress, return later
2. **Strategy versioning** - Track evolution as thinking develops
3. **Clickable buttons for lens selection** - Instead of typing A-E
4. **Smart lens recommendation** - AI suggests best lens based on first response
5. **Adaptive confidence thresholds by lens** - Different quality criteria per pathway
6. **Rich text input** - Better support for structured data (tables, lists)

---

## Key Design Decisions

### Why separate confidence assessment API call?
- Separation of concerns: confidence logic independent from question generation
- Easier to tune through evals (can modify confidence prompts without touching generation)
- Can optimize later by combining calls if latency becomes issue

### Why text options (A-E) instead of buttons?
- Simpler to implement
- Maintains conversational feel (typing in chat)
- Can enhance to buttons later if user testing shows benefit

### Why reflective summary in extraction phase?
- Natural pause point in flow
- Supports tool positioning as development aid
- Enables exploration loop without multi-session complexity
- Immediate value-add without architectural changes

### Why store confidence with each message?
- Critical data for Phase 2 evals
- Analyze "when did we have enough quality?"
- Tune confidence threshold based on actual outcomes
- Track confidence progression patterns

### Why flexible enrichment JSON?
- Architectural principle: design for future expansion
- Different conversations surface different strategic dimensions
- Avoids database migrations as we learn what matters
- Supports narrative generation with rich context

---

**End of Design Document**
