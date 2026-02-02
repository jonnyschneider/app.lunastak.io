# Opportunity Editor with Coaching

**Date:** 2026-01-26
**Status:** Design approved

## Problem

The Decision Stack is incomplete. Vision, Strategy, and Objectives are generated via conversation, but Opportunities and Principles are stubbed with placeholder CTAs. Users cannot create a complete stack.

## Solution

A "rich edit with coaching" interaction pattern for Opportunities. Instead of forcing users into a conversation flow, they write directly in an inline editor with real-time coaching feedback.

### Key Principles

- **User in control** - Coaching is advisory, not gatekeeping
- **Non-blocking** - Users can save regardless of warnings
- **Inline, not modal** - Avoids "bounded" feeling for longer tasks
- **Draft-friendly** - Incomplete work saves as draft, visible as card

## Interaction Flow

### 1. Creating an Opportunity

User clicks "Create Opportunities" → dashed placeholder transforms into inline editor:

```
┌─────────────────────────────────────────────────────────────┐
│ [textarea - focused, placeholder: "Describe your           │
│  opportunity..."]                                           │
└─────────────────────────────────────────────────────────────┘
                    [Save]  [Cancel]
```

### 2. Coaching Appears

On blur or 2-second pause, coaching panel appears below textarea:

```
┌─────────────────────────────────────────────────────────────┐
│ Launch knowledge graph indexing in Q2                       │
└─────────────────────────────────────────────────────────────┘

┌─ Coaching ──────────────────────────────────────────────────┐
│ ✓ Has a timeframe                                           │
│ ⚠ Add clear deliverables (what will you deliver?)          │
│ ⚠ Consider linking to an objective                         │
│                                              [Rewrite ✨]   │
└─────────────────────────────────────────────────────────────┘
                    [Save]  [Cancel]
```

"Rewrite" button is a fake door - logs interest, shows coming soon dialog.

### 3. After Save

Saved opportunity becomes a card. Editor stays inline below for the next one:

```
┌─────────────────────────────────────────────────────────────┐
│ [Q2]  Launch knowledge graph indexing                    ✎ │
│       → Index 500M entities, integrate with search         │
│                                              ⚠ Could improve│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ [textarea - placeholder: "Add another opportunity..."]      │
└─────────────────────────────────────────────────────────────┘
                    [Save]  [Done adding]
```

### 4. Card States

| State | Appearance |
|-------|------------|
| Complete | All criteria met, no badge |
| Could improve | Has warnings, subtle "⚠ Could improve" badge |
| Draft | User saved incomplete, muted styling + "Draft" badge |

### 5. Editing Existing

Click ✎ on card → card transforms into inline editor with existing content.

### 6. Done Adding

"Done adding" collapses editor, shows smaller "+ Add opportunity" button below cards.

## Coaching Criteria

Evaluated via client-side heuristics (no API call):

| Criteria | Heuristic |
|----------|-----------|
| Has timeframe | `/Q[1-4]\|20\d{2}\|\d+\s*(month\|week)/i` |
| Specific action | Contains verb + noun, not just "Improve X" |
| Has deliverables | Contains `→` or bullets or semicolons |
| Not too vague | Doesn't match `/^(improve\|enhance\|better\|optimize)\s+\w+$/i` |

Returns: `{ criteria: CriteriaResult[], overallStrength: 'weak' | 'okay' | 'strong' }`

## Data Model

New table for user-authored content (separate from AI-generated):

```prisma
model UserContent {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  type      String   // 'opportunity' | 'principle' (later)
  content   String   // Raw user input
  status    String   @default("draft")  // 'draft' | 'complete'
  metadata  Json?    // objectiveIds, coachingDismissed, parsed fields

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**API:** `POST/PUT/DELETE /api/project/[id]/content`

## Components

```
src/components/
├── OpportunityEditor.tsx      # Textarea + save/cancel
├── OpportunityCoaching.tsx    # Criteria checklist + rewrite button
├── OpportunityCard.tsx        # Display card with edit/status
└── OpportunitySection.tsx     # Orchestrates the section

src/lib/
└── opportunity-coaching.ts    # Heuristics for evaluation
```

`OpportunitySection` replaces the current dashed placeholder in `StrategyDisplay.tsx`.

## Scope

### In Scope
- Opportunity creation with inline editor
- Client-side coaching heuristics
- Draft/complete states
- Cards with edit capability
- Fake door for "Rewrite with suggestions"

### Out of Scope (Future)
- AI-powered rewrite
- AI-powered coaching evaluation
- Principles (same pattern, later)
- Linking opportunities to objectives (UI exists, wiring later)
- Simple edit for Vision/Strategy/Objectives

## Success Criteria

- Users can create a complete Decision Stack
- Coaching helps users write better opportunities (qualitative)
- Fake door validates interest in AI rewrite feature
