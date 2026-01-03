# Briefing: E1a Enhancement for Dimensional Coverage Tracking

**Date:** 2026-01-03  
**Author:** Jonny Schneider (via taxonomy design session with Claude)  
**For:** Planning Agent (obra/superpowers)  
**Type:** Implementation Briefing

---

## Context

We've completed a strategic planning session to design a taxonomy of strategic dimensions for Lunastak. The taxonomy will eventually serve as the foundation for:
- Multi-session strategic context accumulation
- LLM-as-judge training for quality assessment
- Gap identification and proactive questioning
- Quality generation of Decision Stack outputs

**Key insight:** We don't want to prescribe sub-dimensions upfront. The E1a experiment (emergent extraction) is already generating themes from conversations. We want to *also* track how those emergent themes map to our Tier 1 dimensions, so we can observe what patterns emerge.

---

## Relevant Documentation

**Read these first:**

1. **`docs/plans/strategic/TAXONOMY_REFERENCE.md`**
   - The taxonomy itself: 10 Tier 1 dimensions + Strategic Intent
   - Dimension definitions and what we're understanding in each
   - Dimension → Decision Stack output mapping

2. **`docs/plans/strategic/2026-01-03-taxonomy-design-session.md`**
   - Full context from the design session
   - Problem framing and design decisions
   - Why we're taking an "emergence" approach to sub-dimensions

3. **`docs/experiments/one-pagers/E1a-emergent-extraction.md`**
   - Current E1a experiment design
   - What emergent extraction currently does

4. **`src/lib/types.ts`**
   - Current type definitions including `EmergentExtractedContext`

---

## The Enhancement

### Goal

Add dimensional coverage tracking to E1a without changing the user experience. This gives us data to:
1. Validate whether emergent themes naturally cover the strategic dimensions
2. Identify which dimensions are typically well-covered vs. sparse
3. Inform whether/how to guide questioning toward gaps
4. Build training data for LLM-as-judge evaluation

### What Changes

**1. Add dimensional tagging to extraction**

After emergent themes are extracted, run a second analysis pass that:
- Maps each emergent theme to one or more Tier 1 dimensions
- Assigns a confidence score to each mapping
- Captures which dimensions have no coverage

**2. Store dimensional coverage in Traces**

Add a `dimensionalCoverage` field to the Trace model that captures:
- Which dimensions were covered
- Coverage depth/confidence per dimension
- Which dimensions are gaps

**3. Enable evaluation analysis**

The dimensional coverage data should be accessible via:
- Jupyter notebook queries (for researcher analysis)
- Quality rating context (so researchers can assess mapping accuracy)

### What Doesn't Change

- User experience (they still see emergent themes, not dimensions)
- Emergent extraction prompt (themes still emerge naturally)
- Generation prompts (still use emergent themes)
- Statsig experiment setup

---

## Technical Approach

### Tier 1 Dimensions (for reference)

```typescript
const STRATEGIC_DIMENSIONS = [
  'customer_and_market',
  'problem_and_opportunity', 
  'value_proposition',
  'differentiation_and_advantage',
  'competitive_landscape',
  'business_model_and_economics',
  'go_to_market',
  'product_experience',
  'capabilities_and_assets',
  'risks_and_constraints',
] as const;

// Special category (not assessed for coverage)
const STRATEGIC_INTENT = 'strategic_intent';
```

### Suggested Data Structure

```typescript
interface DimensionalCoverage {
  // Coverage by dimension
  dimensions: {
    [dimension: string]: {
      covered: boolean;
      confidence: 'high' | 'medium' | 'low';
      themes: string[];  // Which emergent themes mapped here
    };
  };
  
  // Summary metrics
  summary: {
    dimensionsCovered: number;  // out of 10
    gaps: string[];  // dimensions with no coverage
    primaryDimensions: string[];  // dimensions with high confidence coverage
  };
}
```

### Implementation Options

**Option A: Post-extraction analysis (recommended)**
- After extraction completes, make a separate Claude call to map themes → dimensions
- Store result in Trace alongside existing `extractedContext`
- Pro: Doesn't complicate extraction prompt; clean separation
- Con: Additional API call and latency (but user doesn't wait for this)

**Option B: Combined extraction**
- Modify extraction prompt to also output dimensional mapping
- Pro: Single API call
- Con: Complicates the extraction prompt; may affect theme quality

**Recommendation:** Start with Option A. Keep it simple and separate. We can optimise later if needed.

---

## Scope Boundaries

### In Scope
- Add dimensional tagging (post-extraction analysis)
- Store dimensional coverage in Traces
- Make data queryable for research analysis
- Update types and schema as needed

### Out of Scope (for this enhancement)
- Changing user-facing UI
- Modifying extraction prompts
- Using dimensional coverage to guide questioning (future)
- Building LLM-as-judge evaluation rubrics (future)
- Multi-session state (future)

---

## Success Criteria

1. **Data collection works:** Dimensional coverage is captured for all E1a conversations
2. **Data is queryable:** Researchers can analyse coverage patterns via Jupyter
3. **No UX impact:** Users don't see or experience any change
4. **No quality impact:** Emergent theme extraction quality is unaffected

---

## Questions for Planning

1. Should dimensional analysis run synchronously (blocking) or asynchronously (background)?
   - Recommendation: Asynchronous if possible, since user doesn't need to wait

2. Where should the dimensional analysis prompt live?
   - Recommendation: New file in prompts or inline in a new API route

3. Should we add a new API route or extend existing `/api/extract`?
   - Recommendation: Extend existing flow but keep analysis as separate function

4. Do we need schema migration for Trace model?
   - Check if `dimensionalCoverage` can fit in existing JSON fields or needs new column

---

## Starting Points

1. Review `src/app/api/extract/route.ts` — current extraction flow
2. Review `src/lib/types.ts` — current type definitions
3. Review `prisma/schema.prisma` — Trace model structure
4. Review `TAXONOMY_REFERENCE.md` — dimension definitions for prompt

---

## Notes from Design Session

> "My hunch is that the top-level dimensions will be enough for now. We could see how the model tags fragments, and perhaps some sub-dimensions will naturally emerge. Post hoc."

> "The critical challenge is getting to a baseline taxonomy, from which these engagement opportunities can be tested."

> "It's not just a feature backlog—we need to be thinking about how to engage first users, so we can get actual data to inform next decisions."

The goal is to instrument, collect data, and learn — not to build a perfect system upfront.

---

**Ready for planning session.**
