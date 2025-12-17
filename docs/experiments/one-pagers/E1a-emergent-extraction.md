# Experiment E1a: Emergent Extraction

**Status:** 🟡 Implementation Complete, Awaiting Data Collection
**Variant ID:** `emergent-extraction-e1a`
**Date:** 2025-12-17

---

## What We're Learning

Can completely freeform extraction (no prescribed fields) produce less "wooden" outputs than baseline-v1's prescriptive schema, while still capturing the strategic dimensions needed for complete Decision Stack framework?

---

## Hypothesis

Emergent theme extraction will produce less "wooden" outputs than prescriptive fields because it accommodates the user's natural perspective rather than forcing diverse strategic thinking into a one-size-fits-all mold.

**Key assumption:** Users will provide enough signal through natural conversation that Claude can identify meaningful themes without being told what fields to extract.

---

## What Changed from Baseline-v1

### Extraction
**Before:** Fixed core (industry, target_market, unique_value) + prescribed enrichment
**After:** Emergent themes (3-7 themes) named by Claude based on what actually emerged

### Confidence Assessment
**Before:** "Do I have enough for industry/target_market/unique_value?"
**After:** "Do I understand this business strategically?"

### Generation
**Before:** Standard prompts using prescribed fields
**After:** Adaptive prompts using emergent themes

### What Stayed the Same
- 3-10 question adaptive flow
- Reflective summary structure
- Three-option extraction UI
- Vision/Mission/Objectives output format

---

## Implementation Details

**Feature Flag:** `emergent_extraction_e1a` (Statsig)
**Variant Assignment:** Dynamic per user via Statsig SDK
**Code Changes:**
- `src/lib/statsig.ts` - Feature flag integration
- `src/lib/types.ts` - Emergent schema types
- `src/app/api/extract/route.ts` - Dual extraction logic
- `src/app/api/generate/route.ts` - Adaptive generation
- `src/components/ExtractionConfirm.tsx` - Dynamic UI

---

## Success Criteria

**Pass:**
- Higher % "good" quality ratings (researcher) than baseline-v1
- No critical dimensional gaps (>80% coverage)

**Fail:**
- Lower or equal quality ratings
- Systematic gaps in dimensional coverage

**Learn:**
- If quality improves but coverage drops → E1b/E1c (hybrid approaches)

---

## Measurement

**Primary Metrics:**
- Quality rating distribution (% good vs bad)
- User feedback (% helpful vs not_helpful)
- Conversation completion rate

**Secondary Analysis:**
- Dimensional coverage coding (retrospective)
- Theme diversity across conversations
- Coverage gaps analysis

**Sample Size:** 10-15 participants for E1a, 10-15 for baseline-v1

---

## Related Artifacts

- **Design:** `docs/plans/2025-12-17-e1a-emergent-extraction-design.md`
- **Implementation:** `docs/plans/2025-12-17-e1a-emergent-extraction-implementation.md`
- **Testing:** `tests/e1a-test-plan.md`
- **Analysis:** `scripts/dimensional_coverage.py`

---

**Implementation Status:** Complete
**Next Step:** UAT → Enable for test participants → Collect data
