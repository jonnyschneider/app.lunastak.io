# Pull Request: Baseline-v1 Release

**Branch:** `development` → `main`
**Type:** Feature Release
**Version:** baseline-v1
**Status:** Ready for Review

## Summary

Establishes baseline-v1 as the normalized control variant for experimentation. This release simplifies the UX, removes prescriptive elements that led to "wooden" outputs, and implements comprehensive instrumentation to measure experiment outcomes.

## Background

After 4-5 simulated industry tests revealed consistently "wooden" strategy outputs across diverse industries and thinking styles, we conducted a systematic review and identified the root cause: **overly prescriptive extraction forcing diverse strategic thinking into a one-size-fits-all mold**.

Key insights documented in [`docs/journal/2025-12-12-extraction-generation-learnings.md`](../journal/2025-12-12-extraction-generation-learnings.md):

1. **The Formulaic Problem** - Extraction schema (industry/target_market/unique_value) was too rigid
2. **Doing Too Much Too Early** - Lens-specific approaches were premature
3. **Framework Rigor vs Flexibility** - Need rigor in output formats but flexibility in extraction
4. **LLM-as-Judge Gaps** - Binary human evaluation needed, not just LLM assessment
5. **Quality Gap** - Large distance between "good enough for eval" and real strategy development

Before running parallel experiments (emergent extraction, energetic prompts, lens inference), we needed a clean, well-instrumented baseline for comparison.

## Changes

### UX Simplifications (10 Changes)

#### 1. ✅ Remove Lens Selection Phase
**Files:** `src/app/api/conversation/continue/route.ts`

- Eliminated LENS_SELECTION phase entirely
- Flow now: `INITIAL → QUESTIONING` (was `INITIAL → LENS_SELECTION → QUESTIONING`)
- Less prescriptive, allows strategic focus to emerge naturally

**Impact:** Reduces friction, eliminates forced categorization

#### 2. ✅ Three-Option Extraction UI
**Files:** `src/components/ExtractionConfirm.tsx`, `src/app/page.tsx`

- Changed from 2 buttons to 3: **Continue** / **Flag for Later** / **Dismiss**
- Renamed `unexplored` → `opportunities_for_enrichment` (more positive framing)
- Logs user choice as event for analysis

**Impact:** Supports multi-session vision, gives users explicit control

#### 3. ✅ Simplified Objectives Display
**Files:** `src/components/StrategyDisplay.tsx`

- Removed flip card interaction
- Simple card: pithy statement + metric badge + category
- Removed filter toggle icons (eye/closed-eye)

**Impact:** Cleaner UI, reduced cognitive load

#### 4. ✅ Blank Initiatives with Fake Door
**Files:** `src/components/StrategyDisplay.tsx`

- Replaced placeholder data with honest empty state
- CTA button: "Create Initiatives" (logs clicks)
- Measures demand for feature before building

**Impact:** Honest about capabilities, measures feature demand

#### 5. ✅ Blank Principles with Fake Door
**Files:** `src/components/StrategyDisplay.tsx`

- Replaced placeholder data with honest empty state
- CTA button: "Define Principles" (logs clicks)
- Measures demand for feature before building

**Impact:** Honest about capabilities, measures feature demand

#### 6. ✅ Info Icons with Education
**Files:** `src/components/StrategyDisplay.tsx`

- Added info icons to all Decision Stack elements
- Shows educational content with "Good" vs "Wooden" examples
- Logs views to measure which elements need help

Educational content examples:
- Vision: "Customer-centric, specific, inspiring but grounded"
- Mission: "Coherent choices for achieving vision, not tactical"
- Objectives: "SMART, outcome-focused with clear metrics"

**Impact:** Framework education in context, measures engagement

#### 7. ✅ Edit Buttons as Fake Doors
**Files:** `src/components/StrategyDisplay.tsx`

- Edit icons on Vision, Mission, each Objective
- Appear on hover, show "coming soon" on click
- Logs clicks to measure demand for refinement features

**Impact:** Measures demand for in-place editing

#### 8. ✅ Strategic Thinking → Accordion
**Files:** `src/components/StrategyDisplay.tsx`

- Moved Claude's thoughts to collapsible accordion
- Title: "How to talk to this strategy"
- Collapsed by default

**Impact:** Reduces visual clutter, makes guidance optional

#### 9. ✅ Multi-line Input Field
**Files:** `src/components/ChatInterface.tsx`

- Changed from single-line `<input>` to 8-row `<textarea>`
- Added Cmd/Ctrl+Enter keyboard shortcut to submit
- Help text explains keyboard shortcut

**Impact:** Better for long strategic responses (common in this app)

#### 10. ✅ Full-Height Chat Window
**Files:** `src/app/page.tsx`

- Changed from fixed 600px to responsive full-height
- Uses `h-screen flex flex-col` layout
- Works on desktop and mobile

**Impact:** Maximizes conversation visibility, better use of screen space

### Instrumentation Infrastructure

#### Event Tracking System
**Files:** `prisma/schema.prisma`, `src/lib/events.ts`, `src/app/api/events/route.ts`

New `Event` table tracks all user interactions:

```prisma
model Event {
  id             String   @id @default(cuid())
  conversationId String
  traceId        String?  // Nullable - some events before generation
  timestamp      DateTime @default(now())
  eventType      String   // 'fake_door_click', 'info_icon_view', 'extraction_choice'
  eventData      Json     // Flexible storage
}
```

**Event Types:**
- `fake_door_click` - Which features users want (Edit Vision, Create Initiatives, etc.)
- `info_icon_view` - Which elements need education (Vision, Mission, Objectives, etc.)
- `extraction_choice` - User choices at extraction (continue/flag/dismiss)

**Why Database vs Web Analytics:**
- Tied to conversation context (can correlate with quality)
- Better for R&D than product analytics
- No external dependencies or cost
- More flexible for custom analysis

#### Quality Rating System (Reviewer-Only)
**Files:** `prisma/schema.prisma`, `src/app/api/quality-rating/route.ts`, `src/components/QualityRating.tsx`

Added to `Trace` table:
```prisma
qualityRating          String?  // 'good' | 'bad'
qualityRatingTimestamp DateTime?
```

**Critical Design Decision:**
- Quality ratings are for REVIEWERS doing evals, NOT for end users
- Binary choice (good/bad) forces decisive feedback
- API and component exist but NOT shown in user flow
- Reviewers rate via notebook or admin interface

**Why Binary:**
- Forces clear decision (can't hide in middle)
- Simpler analysis
- Faster rating process
- User preference: "I like it more binary"

#### Experiment Variant Tracking
**Files:** `prisma/schema.prisma`, `src/app/api/conversation/start/route.ts`

Added to `Conversation` table:
```prisma
experimentVariant String?  // 'baseline-v1', 'emergent-extraction', etc.
```

All new conversations tagged with `experimentVariant: 'baseline-v1'`

**Enables:**
- A/B comparison between baseline and future variants
- Aggregate metrics by variant
- Statistical comparison of quality ratings

### Analysis Infrastructure

#### Updated Trace Analysis Notebook
**File:** `notebooks/trace_analysis_starter.ipynb`

Added 6 new cells for event analysis:

1. **Cell 9:** Load all events, show distribution by type
2. **Cell 10:** Fake door analysis - which features are most wanted
3. **Cell 11:** Info icon analysis - which elements need education
4. **Cell 12:** Extraction choice analysis - continue vs flag vs dismiss
5. **Cell 13:** Event-quality correlation - do engaged users rate better?
6. **Cell 14:** Variant comparison - compare metrics across experiments

**Updated Cell 4:** Now displays events alongside trace review

#### Enhanced TraceAnalyzer
**File:** `scripts/trace_analysis.py`

New capabilities:
- `load_events(limit, trace_id, conversation_id)` - Query events by various filters
- Updated `load_traces()` - Includes `qualityRating` and `experimentVariant` columns
- Updated `display_trace()` - Shows variant and quality rating in metadata

### User Feedback Simplification

**Removed Quality Rating from User UI**
**Files:** `src/app/page.tsx`

- Removed `QualityRating` component from user flow
- Users only see helpful/not-helpful feedback
- Quality assessment is for researchers, not users

**Why:**
- Confusing to have two feedback mechanisms
- Quality judgment should be researcher's role
- Cleaner user experience

## Database Migrations

### New Tables
- `Event` - User interaction tracking

### Modified Tables
- `Trace` - Added `qualityRating`, `qualityRatingTimestamp`
- `Conversation` - Added `experimentVariant`

### Indexes Added
- `Event.eventType` - For event type queries
- `Event.traceId` - For trace-event joins
- `Trace.qualityRating` - For quality aggregations
- `Conversation.experimentVariant` - For variant comparisons

## API Changes

### New Endpoints
- `POST /api/events` - Log user interaction events
- `POST /api/quality-rating` - Submit quality ratings (reviewer-only)

### Modified Endpoints
- `POST /api/conversation/start` - Now sets `experimentVariant: 'baseline-v1'`
- `POST /api/extract` - Updated field names (unexplored → opportunities_for_enrichment)

### Breaking Changes
None - backward compatible with existing data

## Testing

### UAT Completed ✅
- Full conversation flow tested on localhost:3004
- All 10 UX changes verified
- Event logging confirmed in database
- Notebook analysis cells tested
- Multi-line input and full-height chat verified

### Database Testing ✅
- `npx prisma db push` - Schema updated successfully
- `npx prisma generate` - Client regenerated
- Event logging working correctly
- Quality rating API working
- Variant tracking working

### Analysis Testing ✅
- Loaded events by type
- Fake door click aggregation
- Info icon view aggregation
- Extraction choice distribution
- Event-quality correlation queries
- Variant comparison queries

## Documentation

### Session Notes
[`docs/session-notes/2025-12-13_baseline-v1-normalization-and-instrumentation.md`](../session-notes/2025-12-13_baseline-v1-normalization-and-instrumentation.md)
- Comprehensive documentation of all changes
- Technical decisions and rationale
- Issues encountered and resolved
- Next steps for experimentation

### Journal Entry
[`docs/journal/2025-12-12-extraction-generation-learnings.md`](../journal/2025-12-12-extraction-generation-learnings.md)
- Synthesis of testing insights
- 5 key problems identified
- Hypotheses for experiments
- Framework rigor vs flexibility balance

### Framework Reference
[`docs/archive/framework-reference/QUALITY_CRITERIA.md`](../archive/framework-reference/QUALITY_CRITERIA.md)
- Quality criteria from real Decision Stack
- "Good" vs "Wooden" examples
- Energetic characteristics to aim for

## Performance Impact

- No significant performance changes
- Database queries are simple and indexed
- Event logging is asynchronous (non-blocking)
- Analysis happens in notebooks (offline)

## Security Considerations

- No new authentication changes
- Event data is non-sensitive interaction metadata
- Quality ratings are internal only (not exposed to users)
- No PII in event data

## Deployment Notes

### Prerequisites
1. Database migration: `npx prisma db push`
2. Prisma client regeneration: `npx prisma generate`

### Environment Variables
No new environment variables required

### Rollback Plan
If needed, can revert to previous commit. No data loss (events are additive only).

## Next Steps

### Immediate (Post-Merge)
1. Monitor event logging in production
2. Review fake door click patterns after first 10 users
3. Check quality rating distribution from reviewers

### Priority 1 Experiment: Emergent Themes
**Branch:** `experiment/emergent-extraction`
**Goal:** Test if emergent theme extraction generates better quality

**Approach:**
- Remove prescriptive fields (industry, target_market, unique_value)
- Let themes emerge from conversation naturally
- Set `experimentVariant: 'emergent-extraction'`
- Run 10-15 conversations
- Compare quality ratings vs baseline-v1

**Success Criteria:**
- Higher % of "good" quality ratings
- Equal or better user feedback (helpful %)
- More specific objectives (less wooden)

### Priority 2 Experiment: Energetic Prompts
**Branch:** `experiment/energetic-prompts`
**Goal:** Test if energetic generation prompts reduce "wooden" outputs

**Approach:**
- Update generation prompt with energy guidance
- Add examples of authentic voice vs wooden
- Set `experimentVariant: 'energetic-prompts'`
- Run 10-15 conversations
- Compare quality ratings vs baseline-v1

### Priority 3 Experiment: Lens Inference
**Branch:** `experiment/lens-inference`
**Goal:** Infer strategic focus from conversation instead of asking

**Approach:**
- Remove explicit lens selection
- Infer dominant lens from conversation content
- Adjust final extraction based on inferred lens
- Set `experimentVariant: 'lens-inference'`

## Checklist

- [x] Code changes implemented
- [x] Database schema updated
- [x] Prisma client regenerated
- [x] UAT testing completed
- [x] Session notes documented
- [x] API endpoints tested
- [x] Event logging verified
- [x] Notebook analysis tested
- [x] No TypeScript errors
- [x] No build errors
- [x] Breaking changes: None
- [x] Documentation complete

## Related Issues

Addresses insights from session `2025-12-12`:
- Formulaic extraction causing wooden outputs
- Need for experimentation infrastructure
- Separation of user feedback vs researcher evaluation

## Screenshots

### Before: Fixed Height (600px)
Chat window occupied ~2/3 viewport, wasted space

### After: Full Height Responsive
Chat window uses full viewport, better space utilization

### Before: Single-line Input
Users had to type long responses in cramped single line

### After: Multi-line Input (8 rows)
Comfortable typing area for strategic responses

### Fake Doors
- "Create Initiatives" CTA on blank initiatives section
- "Define Principles" CTA on blank principles section
- Edit icons on Vision, Mission, Objectives (appear on hover)

### Info Icons
Info icons on all Decision Stack elements showing educational content

### Three-Option Extraction UI
Continue now / Flag for next session / Dismiss

---

**Ready for Review and Merge to Production** ✅

cc: @jonathan (for review and merge decision)
