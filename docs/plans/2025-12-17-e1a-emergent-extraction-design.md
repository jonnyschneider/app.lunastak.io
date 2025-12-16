# E1a: Emergent Extraction Design

**Date:** 2025-12-17
**Experiment ID:** E1a
**Variant:** `emergent-extraction-e1a`
**Status:** Design Complete, Ready for Implementation

---

## Core Hypothesis

Completely freeform extraction (no prescribed fields) will produce less "wooden" outputs than baseline-v1's prescriptive schema, while still capturing necessary strategic dimensions.

**Context:** Baseline-v1 testing revealed that prescriptive extraction (industry, target_market, unique_value + prescribed enrichment fields) forces diverse strategic thinking into a one-size-fits-all mold, producing technically coherent but lifeless outputs. This experiment tests the most radical departure - letting themes emerge completely from conversation without any prescribed structure.

---

## What Changes from Baseline-v1

### Extraction Schema

**Before (Baseline-v1):**
```json
{
  "core": {
    "industry": "...",
    "target_market": "...",
    "unique_value": "..."
  },
  "enrichment": {
    "competitive_context": "...",
    "customer_segments": [...],
    "operational_capabilities": "...",
    "technical_advantages": "..."
  },
  "reflective_summary": { ... }
}
```

**After (E1a):**
```json
{
  "themes": [
    {
      "theme_name": "Customer Pain Points",
      "content": "..."
    },
    {
      "theme_name": "Market Positioning",
      "content": "..."
    },
    {
      "theme_name": "Technical Differentiation",
      "content": "..."
    }
  ],
  "reflective_summary": { ... },
  "extraction_approach": "emergent"
}
```

Claude identifies 3-7 key themes from conversation and names them based on what actually mattered, not prescribed categories.

### Confidence Assessment

**Before:** "Do I have enough information to fill industry/target_market/unique_value?"

**After:** "Do I understand enough about this business strategically to generate meaningful Vision/Mission/Objectives?"

Still uses 3-10 question adaptive mechanism, but confidence is about strategic understanding, not field completion.

### Generation Approach

**Before:** Standard prompts using prescribed fields

**After:** Adaptive prompts using whatever emergent themes were extracted - fully flexible generation that works with whatever structure emerged

---

## What Stays the Same

- 3-10 question adaptive conversation flow
- Reflective summary structure (strengths, emerging, opportunities_for_enrichment, thought_prompt)
- Three-option extraction UI (continue/flag/dismiss)
- Quality rating and user feedback collection
- Vision/Mission/Objectives output format (framework rigor maintained)

**Rationale:** Keep proven mechanisms and measurement infrastructure constant to isolate impact of emergent extraction.

---

## Implementation Architecture

### Statsig Integration

**Feature Flag:** `emergent_extraction_e1a` (boolean)
- Variant assignment: Check flag when conversation starts
- Auto-capture: Statsig automatically captures events
- Experiment tagging: Conversations tagged `emergent-extraction-e1a` vs `baseline-v1`

### Code Changes

**`/api/extract` endpoint:**
```
├─ Check Statsig feature flag for conversation
├─ If emergent_extraction_e1a = true:
│   └─ Use emergent extraction prompt (no prescribed fields)
├─ If emergent_extraction_e1a = false:
│   └─ Use baseline-v1 extraction prompt (prescribed fields)
└─ Return appropriate schema to frontend
```

**`/api/generate` endpoint:**
```
├─ Detect extraction schema type from input
├─ Use adaptive generation prompts
└─ Maintain Vision/Mission/Objectives output format
```

**`/api/conversation/assess-confidence` endpoint:**
```
├─ Check variant from conversation record
├─ Use appropriate confidence assessment criteria
```

### Type System

```typescript
interface EmergentTheme {
  theme_name: string;
  content: string;
}

interface EmergentExtractedContext {
  themes: EmergentTheme[];
  reflective_summary: ReflectiveSummary;
  extraction_approach: 'emergent' | 'prescriptive';
}
```

### UI Adaptation

**ExtractionConfirm component:**
- Detects schema type (`extraction_approach` field)
- Renders dynamic cards based on emergent theme names
- Falls back to baseline structure for prescriptive extraction
- Maintains card-based layout for visual consistency

---

## Measurement & Success Criteria

### Primary Metrics (vs Baseline-v1)

- **Researcher quality ratings:** % "good" vs "bad" (researcher assessment of output quality)
- **User feedback:** % "helpful" vs "not_helpful" (user assessment of usefulness)
- **Conversation completion rate:** % users who complete full flow

### Secondary Analysis (Dimensional Coverage)

Retrospective coding of emergent themes to strategic dimensions:
- Customer/market understanding
- Value proposition/differentiation
- Capabilities/advantages
- Competitive context
- Growth model
- Other dimensions that emerge

**Metrics:**
- Coverage %: How many critical dimensions captured per conversation
- Gaps analysis: Which dimensions consistently missed

### Success Criteria

**Pass:** Higher % "good" quality ratings (researcher) than baseline-v1 AND no critical dimension gaps (>80% coverage)

**Fail:** Lower or equal quality ratings, OR systematic gaps in dimensional coverage

**Learn:** If quality improves but coverage drops, informs E1b/E1c variants (hybrid approaches with soft structure or minimal core)

### Sample Size

- Target: 10-15 participants for E1a
- Target: 10-15 participants for baseline-v1 (concurrent or use existing baseline data)
- Statistical note: Small sample, focus on qualitative patterns + directional signals

---

## Implementation Tasks (High-Level)

1. Set up Statsig integration (SDK, feature flag configuration)
2. Implement emergent extraction prompt and schema
3. Adapt confidence assessment for emergent approach
4. Update generation prompts for emergent themes
5. Modify ExtractionConfirm UI for dynamic theme display
6. Add dimensional coverage tracking capability (for retrospective analysis)
7. Testing with simulated inputs across variants
8. Deploy with feature flag (off by default)

---

## Post-Implementation Workflow

1. Enable flag for test users
2. Collect 10-15 E1a conversations
3. Ensure concurrent baseline-v1 data collection
4. Run dimensional coverage analysis (code themes to dimensions)
5. Compare quality ratings and user feedback
6. Document findings and decision (pass/fail/iterate)

---

## Related Experiments

**E1b (Potential):** Soft structure - still aim for 3-5 themes but let Claude name them

**E1c (Potential):** Hybrid - minimal core (1-2 fields) + emergent enrichment

**Rationale for E1a first:** Testing the most radical departure shows us the boundaries of what's possible. If fully emergent works, we've solved the problem. If it fails in specific ways, we learn what structure is actually needed.

---

## Cross-References

- **Hypothesis source:** `docs/journal/2025-12-12-extraction-generation-learnings.md` - Priority 1 experiment
- **Baseline control:** `docs/experiments/one-pagers/E0-baseline-v1.md`
- **Experiment register:** `docs/experiments/EXPERIMENT_REGISTER.md`
- **Quality criteria:** `docs/framework-reference/QUALITY_CRITERIA.md`

---

**Design validated:** 2025-12-17
**Next step:** Implementation planning
