# Experiment 2: Dimensional Coverage Tracking

**Status:** 🟢 Complete (Implementation)
**Variant ID:** `emergent-extraction-e1a` (enhancement, not new variant)
**Date:** 2026-01-03
**Completed:** 2026-01-03

---

## What We're Learning

Can we automatically map emergent themes to strategic dimensions to validate coverage, identify gaps, and build training data for LLM-as-judge evaluation?

---

## Hypothesis

Post-extraction dimensional analysis can map emergent themes to Tier 1 strategic dimensions without degrading theme quality, enabling:
- Coverage validation (are emergent themes covering strategic dimensions?)
- Gap identification (which dimensions are systematically missed?)
- Training data for LLM-as-judge evaluation
- Future proactive questioning based on gaps

**Key assumption:** Dimensional tagging can be separated from extraction (post-hoc analysis) without contaminating emergent theme quality.

---

## What Changed from E1 (Emergent Extraction)

### Dimensional Analysis
**Before:** No dimensional tracking - emergent themes only
**After:** Post-extraction mapping of themes to 10 Tier 1 strategic dimensions

### Data Collection
**Before:** Trace stored extractedContext only
**After:** Trace stores extractedContext + dimensionalCoverage (for emergent extraction only)

### Coverage Metrics
**Before:** No coverage metrics
**After:** Automated coverage %, gaps, primary dimensions (high confidence)

### Jupyter Analysis
**Before:** Manual theme review
**After:** Programmatic coverage analysis via Python scripts

### What Stayed the Same
- Emergent extraction approach (unchanged)
- User experience (no visible changes)
- Theme quality (extraction happens first, analysis happens after)
- Generation prompts (no dimensional influence)

---

## Implementation Details

**Approach:** Post-extraction analysis (Option A from briefing)
**Architecture:**
```
User completes conversation
    ↓
Emergent extraction runs (existing)
    ↓
[NEW] Dimensional analysis triggered (blocking during extraction phase)
    ↓
[NEW] Dimensional coverage stored in Trace.dimensionalCoverage
    ↓
[NEW] Available for Jupyter analysis
```

**Code Changes:**
- `src/lib/types.ts` - Dimensional coverage types (DimensionalCoverage interface)
- `src/lib/dimensional-analysis.ts` - Core dimensional tagging logic (NEW)
- `prisma/schema.prisma` - Add dimensionalCoverage Json? field to Trace
- `src/app/api/extract/route.ts` - Trigger dimensional analysis for emergent extraction
- `src/app/api/generate/route.ts` - Store dimensionalCoverage in Trace
- `src/app/page.tsx` - Pass dimensionalCoverage through frontend
- `src/app/api/trace/[traceId]/route.ts` - Return dimensionalCoverage in queries
- `scripts/dimensional_coverage_analysis.py` - Jupyter analysis tools (NEW)

**10 Strategic Dimensions:**
1. Customer & Market
2. Problem & Opportunity
3. Value Proposition
4. Differentiation & Advantage
5. Competitive Landscape
6. Business Model & Economics
7. Go-to-Market
8. Product Experience
9. Capabilities & Assets
10. Risks & Constraints

---

## Success Criteria

**Pass:**
- Dimensional coverage captured for all E1a conversations
- Coverage data queryable via Jupyter notebooks
- No degradation in emergent theme quality (spot check)
- Latency impact <2 seconds during extraction phase

**Fail:**
- Dimensional analysis errors/crashes
- Theme quality degraded by analysis
- Data not queryable or incomplete

**Learn:**
- Which dimensions are systematically well-covered vs sparse
- How many themes typically map to each dimension
- Whether coverage gaps correlate with quality ratings

---

## Measurement

**Primary Metrics:**
- Coverage rate per dimension (% of traces where dimension is covered)
- Average dimensions covered per trace
- Average coverage percentage (out of 10 dimensions)
- Gap frequency (which dimensions are most often missed)

**Secondary Analysis:**
- Theme-to-dimension mapping patterns
- Confidence distribution (high/medium/low per dimension)
- Coverage correlation with quality ratings
- Comparison across experiment variants (if baseline gets dimensional tracking)

**Analysis Tools:**
- `scripts/dimensional_coverage_analysis.py` - Python functions for loading and analyzing coverage data
- `scripts/backfill-dimensional-coverage.ts` - Retroactively apply dimensional coverage to existing traces
- `notebooks/dimensional_coverage_analysis.ipynb` - Dedicated Jupyter notebook for dimensional coverage analysis
- Jupyter notebooks - Interactive exploration and reporting

**Backfill Script Usage:**
```bash
# Dry run (preview without updating)
npx tsx scripts/backfill-dimensional-coverage.ts --dry-run

# Process all traces without coverage
npx tsx scripts/backfill-dimensional-coverage.ts

# Process only first N traces
npx tsx scripts/backfill-dimensional-coverage.ts --limit 10

# Process specific trace
npx tsx scripts/backfill-dimensional-coverage.ts --trace-id <trace-id>
```

**Sample Size:** All E1a conversations going forward

---

## Outcome

**Status:** ⏸️ Implementation Complete - Measurement Pending

**Implementation Validation:**
- ✅ Dimensional analysis function created and integrated
- ✅ Database schema updated with dimensionalCoverage field
- ✅ Data flow complete (extract → analyze → store → query)
- ✅ Jupyter analysis scripts ready
- ⏸️ Awaiting real conversation data for coverage analysis

**Next Steps:**
1. Run E1a conversations with dimensional tracking enabled
2. Analyze coverage patterns using Jupyter scripts
3. Identify systematic gaps
4. Validate no theme quality degradation
5. Determine if proactive questioning (E3) is warranted

**Next Evolution:**
- Experiment 3 (potential): Proactive Gap-Based Questioning - use coverage gaps to guide conversation toward under-covered dimensions
- Experiment 4 (potential): LLM-as-Judge Training - use coverage data to train quality evaluation models

---

## Related Artifacts

- **Context:** `docs/plans/strategic/2026-01-03-e1a-enhancement-briefing.md`
- **Implementation:** `docs/plans/2026-01-03-e1a-dimensional-coverage-implementation.md`
- **Deployment:** `docs/plans/2026-01-03-e2-deployment-strategy.md`
- **Taxonomy:** `docs/plans/strategic/TAXONOMY_REFERENCE.md`
- **Previous Experiment:** `docs/experiments/one-pagers/E1-emergent-extraction.md`
- **Analysis Script:** `scripts/dimensional_coverage_analysis.py`
- **Backfill Script:** `scripts/backfill-dimensional-coverage.ts`
- **Analysis Notebook:** `notebooks/dimensional_coverage_analysis.ipynb`
- **Notebook README:** `notebooks/README-analysis.md`

---

**Implementation Status:** ✅ Complete
**Outcome:** ⏸️ Pending - Awaiting real conversation data for coverage analysis
