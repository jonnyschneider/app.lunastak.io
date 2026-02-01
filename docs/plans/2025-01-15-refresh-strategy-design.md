# Refresh Strategy - Incremental Update Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan from this design.

**Goal:** Enable users to refresh their strategy by incrementally incorporating new fragments, rather than regenerating from scratch.

**Key principle:** Use dimensional syntheses as compressed context. Be conservative - only change what new information warrants.

---

## Data Flow

```
User clicks "Refresh Strategy"
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. LOAD CONTEXT                                             │
│    • Latest GeneratedOutput for project (previous strategy) │
│    • All DimensionalSynthesis records                       │
│    • Delta: fragments where createdAt > lastStrategy        │
│    • Removed: fragments archived/deleted since lastStrategy │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. GENERATE UPDATED STRATEGY (streaming)                    │
│    Prompt includes:                                         │
│    • Current vision/strategy/objectives                     │
│    • Dimensional synthesis summaries                        │
│    • "What's new" section (new fragment contents)           │
│    • "What's removed" section (archived fragment contents)  │
│    Output: Updated strategy JSON                            │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. GENERATE CHANGE SUMMARY (lightweight, daisy-chained)     │
│    Prompt: Old strategy vs new strategy                     │
│    Output: Plain English "what changed and why"             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. PERSIST                                                  │
│    • New GeneratedOutput (version++)                        │
│    • New Trace (for /strategy/[traceId] view)               │
│    • changeSummary stored on GeneratedOutput                │
└─────────────────────────────────────────────────────────────┘
         ↓
Redirect to /strategy/[traceId]
```

---

## Schema Changes

Add to `GeneratedOutput` model:

```prisma
// Version linking
previousOutputId String?
previousOutput   GeneratedOutput?  @relation("VersionChain", fields: [previousOutputId], references: [id])
nextOutputs      GeneratedOutput[] @relation("VersionChain")

// Change tracking
changeSummary    String?  @db.Text  // Plain English "what changed and why"
```

Existing `version` field handles version numbering. Existing `generatedFrom` stores "incremental_refresh" vs "conversation".

---

## API Endpoint

`POST /api/project/[id]/refresh-strategy`

Streaming response:
```json
{ "step": "loading_context" }
{ "step": "generating_strategy" }
{ "step": "summarizing_changes" }
{ "step": "complete", "traceId": "xxx", "changeSummary": "..." }
```

Error cases:
- No previous strategy → 400 "No strategy to refresh"
- No new fragments → Proceed anyway
- API limit reached → 429

---

## Prompts

### Strategy Update Prompt

```
You are Luna, refining a business strategy based on new insights.

## Current Strategy
Vision: {current_vision}
Strategy: {current_strategy}
Objectives:
{current_objectives}

## Strategic Context (Dimensional Syntheses)
{dimensional_summaries}

## What's New (since last strategy)
{new_fragments_content}

## What's Been Removed
{archived_fragments_content}

---

Update the strategy to incorporate the new insights. Be conservative - only change what the new information warrants. If an objective is still valid, keep it. If the vision still holds, preserve it.

Output format:
<statements>
  <vision>...</vision>
  <strategy>...</strategy>
  <objectives>1. ... 2. ... 3. ...</objectives>
</statements>
```

### Change Summary Prompt

```
Compare these two versions of a business strategy and summarize what changed and why.

## Previous Strategy
{old_strategy}

## Updated Strategy
{new_strategy}

## New Insights That Informed Changes
{new_fragments_summary}

Write 2-4 sentences explaining what changed and why. Be specific.
```

---

## UI Component

New `RefreshStrategyDialog` component based on `SynthesisDialog` pattern:

```typescript
type RefreshStep =
  | 'loading_context'
  | 'generating_strategy'
  | 'summarizing_changes'
  | 'complete'
  | 'error'

interface RefreshStrategyDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (traceId: string) => void
}
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| No previous strategy | 400 "No strategy to refresh" |
| No new fragments | Proceed anyway |
| Generation fails | Show error, allow retry, don't persist |
| Change summary fails | Persist strategy with null summary, log warning |
| Guest API limit | 429 with signup prompt |

**Key principle:** Generation is critical path. Change summary is best-effort.

---

## Files to Modify

1. `prisma/schema.prisma` - add fields to GeneratedOutput
2. `src/app/api/project/[id]/refresh-strategy/route.ts` - new endpoint
3. `src/components/RefreshStrategyDialog.tsx` - new component
4. `src/app/project/[id]/page.tsx` - wire up new dialog

---

## Out of Scope

- First-time generation (separate flow via conversations)
- User editing of strategy (separate feature, different job-to-be-done)
- "Full reset" regeneration (future feature if drift becomes problematic)
- Preview before confirming (YAGNI)
- Undo capability (historical lookup only)
