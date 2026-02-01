# Incremental Fragment Extraction During Conversation

**Status:** Ready for implementation
**Created:** 2026-01-31
**Context:** Currently extraction happens as a batch at conversation end (~5-10s). This delays the generate step significantly.

## The Idea

Extract fragments incrementally during conversation (as background tasks) rather than batch extraction at the end. By the time user clicks "Generate", most extraction work is already done.

## Key Insight

**Don't extract after every turn** (10 API calls) — **extract every 3 turns** as a batch background task while user reads next question. Gets 80% of the benefit at 30% of the cost.

## Time Budget

- User types response: ~10-30 seconds
- Save message + generate next question: ~4-6 seconds
- **Available window for background extraction: 10-30 seconds** (while user types)
- Single-message lightweight extraction: ~1-2 seconds ✅

## What Would Change

### New Files
1. `/src/app/api/conversation/extract-message/route.ts` - Per-turn lightweight extraction
2. `/src/lib/extraction/incremental-message-extraction.ts` - Core extraction logic
3. `/src/lib/prompts/extraction/incremental-message.ts` - Lightweight extraction prompt

### Modified Files
1. `/src/app/api/conversation/continue/route.ts` (lines 74-114)
   - Add background task call after message save (every 3rd message)
2. `/src/lib/fragments.ts`
   - Add upsert logic instead of just create
   - Handle `incrementalExtraction` flag
3. `/src/app/api/extract/route.ts`
   - Detect already-extracted messages
   - Skip re-extraction for incrementally extracted messages (becomes "catch up")

## Existing Infrastructure to Leverage

**Background tasks already work:**
```typescript
// /src/lib/background-tasks.ts
runBackgroundTasks({
  projectId,
  tasks: [{
    name: 'incrementalMessageExtraction',
    fn: async () => { /* extraction here */ }
  }]
})
```

**Recent proof:** Commit `5b9707e` moved reflective summary to background — same pattern, ~30% speedup.

## Risks to Handle

| Risk | Mitigation |
|------|------------|
| Duplicate fragments | Upsert logic + `extractedBy: 'incremental'` flag |
| Partial context misses themes | Mark with lower confidence, re-extract at end |
| Synthesis race conditions | Queue synthesis updates, don't run concurrently |
| 10x API costs | Batch every 3 questions (3x instead of 10x) |

## Implementation Phases

### Phase 1: Low-Risk POC (1-2 days)
1. Create `/api/conversation/extract-message` endpoint
2. Lightweight extraction prompt (just themes, not full dimensional analysis)
3. Fragment creation only (no synthesis updates)
4. Add toggle: `enableIncrementalExtraction` to experiment config
5. A/B test: measure fragment quality vs batch extraction

### Phase 2: Incremental Synthesis (2-3 days)
1. Add incremental synthesis per batch
2. Use existing `incrementalSynthesis()` function
3. Add database conflict handling

### Phase 3: Optimization (1-2 days)
1. Tune batching frequency
2. Add caching for repeated themes
3. Measure end-to-end timing impact

## Decision Log

- **Why every 3 turns?** Balances freshness vs API costs. Single-turn would be 10x calls.
- **Why lightweight prompt?** Full extraction needs ~5-10s, doesn't fit in time budget.
- **Why still do full extraction at end?** Catches themes that only emerge with full context.

## Future: Fragments-First Architecture

Current flow is **themes-first**: Big extraction → Themes → Fragments → Strategy

A more fundamental refactor would invert this to **fragments-first**:

```
Current:  Conversation → [Big extraction] → Themes → Fragments → Strategy
                              ↑ bottleneck

Future:   Messages → Fragments (incremental) → [at generate time] → Themes + Strategy
                         ↑ distributed                  ↑ lighter, uses structured data
```

**Why this matters:**
- Fragments become source of truth (structured, dimension-aligned)
- Themes become a synthesized view, not a prerequisite
- Incremental extraction is natural (each turn → fragments)
- Generation pulls from structured fragment data, not raw conversation

**This is a bigger refactor** than incremental extraction alone. Incremental extraction (Phase 1-3 above) is a stepping stone that proves the pattern before inverting the data model.

## Observation: Question-Answer Relationship Not Programmatic

Currently there's no explicit relationship between questions and answers in extraction. The conversation is passed as a blob:

```
Conversation:
{conversation}  ← both sides, but no structure
```

The extraction prompt says "extract themes that emerged" - which comes from user content. Questions provide implicit context but:
- No tagging of which question prompted which response
- No weighting based on question's target dimension
- The intent behind dimension-guided questions is lost by extraction time

**Why this matters for experiments:**
- Testing `dimension-guided-e3` vs `emergent-extraction-e1a`
- Dimension-guided questions intentionally target gaps
- But extraction treats all answers equally regardless of what prompted them

**Potential optimization:**
- Tag Q→A pairs with the question's target dimension
- Weight extraction toward that dimension for the answer
- Apply this to dimension-guided variant (not emergent baseline)
- Likely to have measurable impact on dimensional coverage

**Implementation notes:**
- Would need to store question metadata (target dimension, intent)
- Pass structured Q→A pairs to extraction, not flat conversation
- Different extraction prompts per experiment variant

## Related: Background Generation with Notification

**Problem:** Current flow holds browser hostage during extraction + generation (~30-60s). Removing the confirmation screen (2026-01-31) just removed one click - user still waits.

**Real fix:** Fire-and-forget generation with notification on completion.

**What this would look like:**
1. User finishes conversation → "We're generating your strategy..."
2. API kicks off generation via `waitUntil()` (non-blocking)
3. User can browse, start another conversation, close tab
4. On completion: toast notification, email, or badge on nav
5. Click notification → lands on strategy page

**Implementation needs:**
- Background job that saves result to DB (GeneratedOutput already exists)
- Polling endpoint or webhook to detect completion
- Notification UI component
- "Generation in progress" indicator somewhere in nav/project

**Why this matters:**
Without this, incremental extraction only helps partially - we still block on generation. With both:
- Extraction: distributed during conversation (user doesn't notice)
- Generation: background task (user doesn't wait)
- Total perceived wait time: near zero

**Priority:** HIGH - this is the other half of the UX win. Incremental extraction without background generation is a half-measure.

## Getting Started

```bash
# Review the continue route to understand current flow
cat src/app/api/conversation/continue/route.ts | head -150

# Review background task pattern
cat src/lib/background-tasks.ts

# Review recent extraction optimization
git show 5b9707e --stat
```
