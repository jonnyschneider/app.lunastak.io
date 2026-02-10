# Decision Stack Editing & Completion — Design

**Date:** 2026-02-09
**Status:** Design complete, ready for implementation planning

## Overview & Goals

**What we're building:** A complete, editable Decision Stack that users can engage with in multiple ways — as output from AI coaching, as a template to fill in themselves, or as a living document to refine over time.

**Goals:**
1. Make Vision/Strategy/Objectives directly editable by users
2. Add Principles as a first-class component with purpose-built UX
3. Enable "template-first" as a cold start alternative (user fills in Decision Stack, AI extracts knowledge post-hoc)
4. Capture version history silently for future features

**Design constraints:**
- Don't replicate main chat/docs/memos patterns
- Usable + extensible, not over-engineered
- Fragment/version linking kept simple (defer complexity)

**Three editing tiers:**

| Tier | Style | Components |
|------|-------|------------|
| Inline deterministic | Click to edit, optional AI polish | Vision, Strategy text, Opportunities |
| Inline unique UX | Trade-off selection chips | Principles |
| Deeper conversation | Side sheet Socratic chat | Objectives, Strategy coaching |

## Inline Editing & Silent Versioning

**User experience:**
- User clicks edit icon (or directly on text) for Vision, Strategy, or an Objective
- Text becomes editable inline — no modal, no page navigation
- On blur/save, new version is created silently in the background
- Optional "AI polish" button available while editing (refines wording, checks alignment)

**What gets versioned:**
- Each component (Vision, Strategy, individual Objectives) versioned independently
- Edit to Vision = new Vision version, doesn't affect Strategy version
- "Decision Stack version" is a composite: pointers to component versions at a point in time

**Data model approach:**

```
StrategyVersion {
  id
  projectId
  componentType: 'vision' | 'strategy' | 'objective'
  componentId: string (for objectives, which one)
  content: JSON
  version: int (auto-increment per component)
  createdAt
  createdBy: 'user' | 'ai' | 'system'
  sourceType: 'generation' | 'user_edit' | 'coaching'
  sourceId: string? (traceId, conversationId if relevant)
}
```

**What we defer:**
- Version history UI (just capture data for now)
- Diffing between versions
- Restore/rollback functionality
- Fragment linking to versions (acknowledge the complexity, don't solve it yet)

**AI polish option:**
- Small sparkle icon in edit mode
- Sends current text + surrounding context to LLM
- Returns refined version, user accepts/rejects
- Counts as user edit (they approved it)

## Principles — Trade-off UX

**Core concept:** Principles are "X even over Y" statements — choosing between two good things. The UX should make this feel like a meaningful choice, not a form fill.

**Data model evolution:**

```typescript
interface Principle {
  id: string;
  priority: string;      // "Strategic clients"
  deprioritized: string; // "any paying client"
  context?: string;      // Optional: why this matters (AI-generated or user-added)
}
```

Display renders as: **"{priority}** even over {deprioritized}"

**Two modes based on context:**

**Mode A: Context-aware (user has conversations/fragments)**
- AI analyzes existing knowledge for tensions/trade-offs
- Suggests 4-6 relevant principles as pre-filled trade-off pairs
- User can: accept, flip the priority, edit wording, dismiss, or add their own
- Example: "Based on your conversations, it seems you value **speed to market** — does that come even over **comprehensive testing**?"

**Mode B: Curated library (cold start)**
- Present ~20-30 common business trade-offs as selectable chips
- Organized by category: Growth, Culture, Product, Operations
- User picks which trade-offs matter to them
- Then chooses which side they prioritize
- Can also create custom trade-offs

**Interaction flow:**
1. Show suggested/curated trade-offs as cards or chips
2. User taps one → it expands to show both sides
3. User picks their priority (left or right)
4. Principle added to their stack
5. Repeat until 4-6 principles defined

**Keep it playful:** This is the one place we can add a bit of delight — the "this or that" framing makes it feel like a game, not homework.

## Template-First Cold Start

**The idea:** Instead of "talk to AI coach → get Decision Stack," some users may prefer "fill in Decision Stack → AI learns from it." This inverts the current flow and could help overcome cold start friction.

**Entry point:**
- New option on project empty state or onboarding: "I already have a strategy in mind"
- Takes user directly to an empty Decision Stack template
- Clear guidance: "Fill in what you know. Leave blank what you're unsure about."

**User journey:**

1. **Vision/Strategy:** Simple text areas with placeholder examples and "what makes a good vision/strategy" hints (already have this content in quality criteria)

2. **Objectives:** Add objective cards one at a time. Inline form: pithy statement + metric fields. Could offer "AI suggest metrics" if they describe the objective qualitatively.

3. **Principles:** The trade-off UX (Mode B: curated library since no context yet)

4. **Completion:** Once user has filled in components, prompt: "Want Luna to review and suggest refinements?"

**Post-hoc knowledge extraction (A1 territory):**
- User-entered Decision Stack becomes source material
- Run extraction to create fragments from their stated strategy
- These fragments seed Luna's knowledge for future conversations
- Essentially: user teaches Luna about their business via the template

**What this enables:**
- Faster time-to-value for users who've already done strategic thinking
- Validates whether "template-first" resonates (could A/B test vs. conversation-first)
- Creates knowledge base without requiring conversation

**What we defer:**
- Sophisticated extraction from user-entered text (start simple, iterate)
- Merging user-entered fragments with conversation-derived fragments

## Coaching Conversations (Side Sheet)

**When it's needed:** Some components benefit from Socratic questioning rather than direct editing. User clicks "Get coaching" on an Objective or Strategy and a focused conversation opens.

**UX pattern:**
- Reuse existing side sheet chat infrastructure
- Different prompts/system instructions per component type
- Conversation scoped to that specific component (not whole project)
- On completion, extracts refined component back to Decision Stack

**Component-specific coaching:**

| Component | Coaching focus |
|-----------|---------------|
| **Objectives** | "Is this measurable? What does success look like? Is the timeframe realistic?" |
| **Strategy** | "What are you choosing NOT to do? How does this differentiate you?" |
| **Vision** | Likely lighter-touch — inline AI polish may be sufficient |

**Backend handling:**
- New conversation type: `coaching` with metadata `{ targetComponent, targetId, strategyVersion }`
- On conversation completion, trigger extraction specific to that component
- Create new version of the component from coaching output
- Link: `StrategyVersion.sourceType = 'coaching'`, `sourceId = conversationId`

**What makes this different from main chat:**
- Single-component focus (not open-ended exploration)
- Shorter, more directed (3-5 turns typical)
- Clear exit: "Here's your refined objective — does this capture it?"
- Extracts directly to Decision Stack (not to general knowledge base)

**Fragment handling for coaching conversations:**
- Capture fragments from coaching conversations (don't prematurely exclude)
- Tag them with source: `coaching` and link to component
- By default, exclude from `/extract` and `/generate` calls (they're refinement, not new knowledge)
- But keep the option open — we may find they contain valuable signal
- Decide based on what we see in practice

## Implementation Phases

**Phase 1: Inline Editing + Silent Versioning**
- Editable Vision, Strategy, Objectives (inline text)
- StrategyVersion table with silent version capture
- AI polish option (sparkle button)
- No UI for version history yet

**Phase 2: Principles UX**
- New Principle data model (priority/deprioritized)
- Curated library of ~20-30 trade-offs
- Trade-off selection interaction (pick, choose side, add)
- Context-aware suggestions (when fragments exist)

**Phase 3: Template-First Entry**
- New cold start path: "I already have a strategy"
- Empty Decision Stack template with guidance
- Post-hoc extraction from user-entered content
- A/B testable against conversation-first

**Phase 4: Coaching Conversations**
- Side sheet chat for Objectives/Strategy coaching
- Component-scoped prompts and extraction
- Coaching fragments captured (tagged, excluded by default)
- Version linking from coaching to component

**Phase 5: OKR-Style Objectives**
- Migrate Objective type to support multiple Key Results (1-3)
- Update contracts and API
- Full-width expanded editor with sentence builder for KRs
- Migrate existing single-metric objectives to single KR
- Update /generate to output hypothesis-driven KRs

## OKR-Style Objectives with Hypothesis-Driven Key Results

**Design date:** 2026-02-10

### Rationale

The Decision Stack's power is the rationale chain: Vision → Strategy → Objectives → Key Results → Opportunities. Each layer carries *intent* down, so teams understand not just "what to hit" but "why this matters."

Traditional OKR Key Results are outcome-only ("Increase X from A to B by Q2"). They don't capture the *belief* behind the target, leading to:
- Disconnection from daily work
- End-of-quarter fiction writing
- Metrics gamed without understanding intent

Our approach: **hypothesis-driven Key Results** that connect the bet to the measure.

### Objective Structure

```typescript
interface Objective {
  id: string;
  title: string;              // Short name for lists/linking
  objective: string;          // The qualitative "O" - inspirational, memorable
  explanation: string;        // Why it matters - connects to Strategy
  keyResults: KeyResult[];    // 1-3 KRs (prefer 1-2)
}

interface KeyResult {
  id: string;
  belief: {
    action: string;           // "improving onboarding"
    outcome: string;          // "increase retention"
  };
  signal: string;             // "7-day active user rate"
  baseline: string;           // "40%"
  target: string;             // "55%"
  timeframe: '3M' | '6M' | '9M' | '12M' | '18M';
}
```

### Key Result Display

Renders as natural sentence:
```
We believe improving onboarding will increase retention,
and we'll know when 7-day active rate moves from 40% → 55% by Q1.
```

### Editing UX

**Full-width expanded editor:**
- Click objective card → expands to full container width, siblings wrap below
- Clear visual hierarchy: O section at top, KRs below

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ [Title field - short name]                          │
├─────────────────────────────────────────────────────┤
│ OBJECTIVE                                           │
│ [Textarea - the qualitative O]                      │
│                                                     │
│ WHY IT MATTERS                                      │
│ [Textarea - explanation]                            │
├─────────────────────────────────────────────────────┤
│ KEY RESULTS                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ We believe [action______] will [outcome______] │ │
│ │ and we'll know when [signal____]               │ │
│ │ moves from [baseline] → [target] by [time ▾]   │ │
│ │                                          [🗑️]  │ │
│ └─────────────────────────────────────────────────┘ │
│ [+ Add Key Result] (if <3)                          │
├─────────────────────────────────────────────────────┤
│                              [Cancel]  [Save]       │
└─────────────────────────────────────────────────────┘
```

**Sentence builder for KRs:**
- Inline fields with placeholders
- Dropdowns for timeframe
- Renders back to sentence on blur/save
- Maps to structured data underneath

**Constraints:**
- Maximum 3 Key Results per Objective
- AI coaching should push toward 1-2 crisp KRs, not "completing the set"
- Empty KRs not allowed (must have belief + signal + target)

### Migration from Current Structure

Current `metric` field maps to a single KR:
- `metric.full` → belief (may need parsing)
- `metric.summary` → target
- `metric.category` → signal (loosely)
- `metric.direction` → inferred from baseline/target
- `metric.timeframe` → timeframe

For existing objectives, migrate to single KR. New objectives can have 1-3.

### Future: /generate API Update

Update generation to output new structure:
- Generate 1-2 KRs per objective
- Each KR includes belief + signal + baseline + target + timeframe
- Coach toward hypothesis language in prompts

### Future: AI Refinement (Phase 4)

Socratic questioning for KR refinement:
- "What will you actually do to achieve this?"
- "How will you know it's working before the deadline?"
- "Is that target ambitious enough? Too ambitious?"

Fits naturally with sentence-based format.

## Future Polish (deferred)

**Principles trade-offs:**
- Review curated trade-offs for false dichotomies (some current options aren't true either/or choices)
- Config in `src/lib/curated-tradeoffs.ts`
- Consider adding more nuanced options or rephrasing existing ones

---

## R&D Context

**Activity:** A4 - Interaction Design (primary), A1 - LLM Judgement Engine (secondary)

**Uncertainty being addressed:**
- Can inline editing with silent versioning provide a satisfying user experience without version history UI?
- Will the "even over" trade-off UX make principle definition feel meaningful rather than like form-filling?
- Does template-first cold start reduce friction compared to conversation-first?
- Can component-scoped coaching conversations be effective in 3-5 turns?
- Does hypothesis-driven KR format ("We believe X will Y") improve goal recall and reduce end-of-period fiction?
- Can sentence-builder UX feel natural while capturing structured data?

**How this enables learning:**
- Phase 1 validates inline editing UX before adding complexity
- Phase 2 tests whether playful principles UX increases completion rates
- Phase 3 enables A/B testing of cold start approaches
- Phase 4 explores whether focused coaching outperforms open-ended conversation for refinement
- Phase 5 tests whether connecting belief to measure improves objective quality and team alignment
