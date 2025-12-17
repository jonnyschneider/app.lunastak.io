# Release Notes - v1.1.0: E1a Emergent Extraction

**Release Date:** 2025-12-17
**Experiment:** E1a - Emergent Extraction
**Status:** Implementation Complete, Ready for Data Collection

---

## Overview

This release implements **Experiment E1a: Emergent Extraction**, testing the hypothesis that completely freeform extraction (no prescribed fields) will produce less "wooden" outputs while maintaining dimensional coverage.

### Key Changes

✅ **Statsig Feature Flag System** - Dynamic A/B testing infrastructure
✅ **Emergent Extraction Logic** - 3-7 themes that emerge naturally from conversation
✅ **Dual Schema Support** - Type-safe handling of both prescriptive and emergent contexts
✅ **Adaptive Generation** - Strategy generation adapts to extraction approach
✅ **Dynamic UI** - ExtractionConfirm component displays appropriate schema
✅ **Testing Tools** - Variant override, dimensional coverage analyzer, test plan
✅ **Complete Documentation** - One-pager, deployment guide, experiment register updated

---

## What's New

### Core Features

#### 1. Statsig SDK Integration
- Feature flagging via `statsig-node` server SDK
- Dynamic variant assignment per user
- Feature gate: `emergent_extraction_e1a`
- Graceful fallback to baseline when unavailable
- Debug logging for troubleshooting

#### 2. Emergent Extraction
**Variant ID:** `emergent-extraction-e1a`

Instead of prescriptive fields (industry, target_market, unique_value), the system now:
- Identifies 3-7 key themes that **actually emerged** in conversation
- Names themes based on **what was discussed** (e.g., "Customer Pain Points", "Market Positioning")
- Adapts to the user's natural perspective rather than forcing a predefined structure

#### 3. Type System Updates
New types in `src/lib/types.ts`:
- `EmergentTheme` - Individual theme with name and content
- `EmergentExtractedContext` - Themes-based extraction
- `PrescriptiveExtractedContext` - Field-based extraction (baseline)
- `ExtractedContextVariant` - Union type for both approaches
- Type guards: `isEmergentContext()`, `isPrescriptiveContext()`

#### 4. Adaptive Confidence Assessment
Different evaluation criteria per variant:
- **Emergent:** "Do I understand this business strategically?"
- **Prescriptive:** "Do I have enough for prescribed fields?"

#### 5. Adaptive Generation
Strategy generation (Vision/Mission/Objectives) now uses:
- **Emergent:** Generates from emergent themes
- **Prescriptive:** Generates from core fields + enrichment

#### 6. Dynamic UI
`ExtractionConfirm` component adapts based on extraction approach:
- **Emergent:** Displays themes in bordered cards with theme name + content
- **Prescriptive:** Displays labeled fields (industry, target_market, etc.)
- **Shared:** Reflective summary section remains the same

### Testing & Analysis Tools

#### Variant Display
- Shows active variant in sidebar (bottom, small grey text)
- Makes it easy to verify which variant is active during testing

#### Variant Override
Force a specific variant via URL query parameter:
```
http://localhost:3000?variant=baseline-v1
http://localhost:3000?variant=emergent-extraction-e1a
```

Perfect for giving participants links to both variants for controlled testing.

#### Dimensional Coverage Analyzer
Python script (`scripts/dimensional_coverage.py`) for retrospective analysis:
- Loads emergent extraction traces
- Helps researchers code themes to strategic dimensions
- Validates E1a captures critical dimensions (>80% coverage target)
- Identifies systematic gaps

#### Test Plan
Complete manual testing checklist (`tests/e1a-test-plan.md`):
- Local development testing
- Database verification
- API contract testing
- Edge cases
- Pre-deployment checklist

### Documentation

- **CHANGELOG.md** - Detailed release notes (new)
- **VERSION_MAPPING.md** - Maps release versions to experiments (new)
- **One-Pager** - `docs/experiments/one-pagers/E1a-emergent-extraction.md`
- **Deployment Guide** - `docs/deployment/E1A_DEPLOYMENT_GUIDE.md` (updated with v1.1.0)
- **Experiment Register** - Updated with E1a status

---

## Technical Details

### Modified Files

**Core Logic:**
- `src/lib/statsig.ts` (new) - Feature flag utilities
- `src/lib/types.ts` - Added emergent schema types
- `src/app/api/conversation/start/route.ts` - Dynamic variant assignment
- `src/app/api/extract/route.ts` - Dual extraction logic
- `src/app/api/conversation/assess-confidence/route.ts` - Adaptive confidence
- `src/app/api/generate/route.ts` - Adaptive generation
- `src/components/ExtractionConfirm.tsx` - Dynamic UI
- `src/app/page.tsx` - Variant state management

**Testing & Analysis:**
- `scripts/dimensional_coverage.py` (new)
- `tests/e1a-test-plan.md` (new)

**Documentation:**
- `CHANGELOG.md` (new)
- `VERSION_MAPPING.md` (new)
- `RELEASE_NOTES_v1.1.0.md` (new)
- `docs/experiments/one-pagers/E1a-emergent-extraction.md` (new)
- `docs/deployment/E1A_DEPLOYMENT_GUIDE.md` (new)
- `docs/experiments/EXPERIMENT_REGISTER.md` (updated)

**Configuration:**
- `package.json` - Version bumped to 1.1.0
- `.env.local` - Added `STATSIG_SERVER_SECRET_KEY` (placeholder)
- `package-lock.json` - Added statsig-node dependency

### Database Schema

No schema changes required - uses existing `experimentVariant` field:
```prisma
model Conversation {
  experimentVariant String @default("baseline-v1")
  // New value: "emergent-extraction-e1a"
}
```

### Backwards Compatibility

✅ **Fully backward compatible**
- Baseline-v1 logic unchanged
- Both variants run in parallel
- Existing conversations/traces unaffected
- No breaking API changes

---

## Deployment

### Prerequisites

1. **Statsig Account**
   - Create account at https://statsig.com
   - Create project for Decision Stack
   - Get Server Secret Key

2. **Feature Gate Configuration**
   - Create feature gate: `emergent_extraction_e1a`
   - Set initial rollout: 0%

3. **Environment Variables**
   ```bash
   STATSIG_SERVER_SECRET_KEY=secret-your-actual-key
   ```

### Deployment Steps

1. **Merge to main** (manual approval)
2. **Deploy to production** (Vercel auto-deploy)
3. **Add Statsig secret** to Vercel environment
4. **Verify gate at 0%** - all users get baseline-v1
5. **Test with override** - `?variant=emergent-extraction-e1a`
6. **Enable for test users** via Statsig targeting
7. **Gradual rollout** - 10% → 25% → 50%

### Rollout Strategy

- **Initial:** 0% rollout (safety check)
- **Test Users:** Enable for 2-3 specific users via Statsig
- **Gradual:** 10% → 25% → 50% until target reached
- **Target:** 10-15 participants per variant
- **Analysis:** Review results before full rollout

### Rollback Plan

**Instant rollback** (no code deployment needed):
- Set Statsig gate to 0% in dashboard
- All users automatically revert to baseline-v1
- No data loss, no service disruption

See `docs/deployment/E1A_DEPLOYMENT_GUIDE.md` for complete details.

---

## Testing Performed

✅ Type check passes
✅ Build succeeds (no errors)
✅ Manual UAT complete:
  - Baseline-v1 flow verified
  - Emergent-e1a flow verified
  - Both schemas display correctly in UI
  - Variant override tested
  - Sidebar variant display verified
  - Statsig initialization tested (local DNS issue resolved)

---

## Success Criteria

**Pass:**
- Higher % "good" quality ratings than baseline-v1
- No critical dimensional gaps (>80% coverage)

**Fail:**
- Lower or equal quality ratings
- Systematic gaps in dimensional coverage

**Learn:**
- If quality improves but coverage drops → E1b/E1c (hybrid approaches)

---

## Metrics to Track

**Primary:**
- Quality rating distribution (% good vs bad)
- User feedback (% helpful vs not_helpful)
- Conversation completion rate

**Secondary:**
- Dimensional coverage coding (retrospective)
- Theme diversity across conversations
- Coverage gaps analysis

**Target Sample:** 10-15 complete traces per variant

---

## What's Next

1. **Deploy to production** with gate at 0%
2. **Enable for test participants** via Statsig
3. **Collect 10-15 traces** per variant
4. **Analyze results** using dimensional coverage tool
5. **Decide:** Pass → Merge becomes new baseline | Fail → Document learnings
6. **Iterate:** If promising but flawed → E1b/E1c variants

---

## Notes

- **Version Scheme:** We now use semantic versioning (v1.1.0) for releases
- **Variant IDs:** Experiment IDs (`emergent-extraction-e1a`) stay in DB/code
- **Mapping:** See `VERSION_MAPPING.md` for version-to-experiment mapping
- **Git Tag:** `v1.1.0` will be created after merge to main

For questions or issues, see:
- **Deployment Guide:** `docs/deployment/E1A_DEPLOYMENT_GUIDE.md`
- **Experiment Register:** `docs/experiments/EXPERIMENT_REGISTER.md`
- **Test Plan:** `tests/e1a-test-plan.md`
