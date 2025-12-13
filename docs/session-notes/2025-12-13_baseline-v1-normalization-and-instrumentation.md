# Session Notes: Baseline-v1 Normalization and Instrumentation
**Date:** 2025-12-13
**Branch:** development
**Status:** ✅ Complete - Ready for UAT and commit

## Overview

Established baseline-v1 as the normalized control variant for experimentation. This session focused on simplifying the UX, removing prescriptive elements, and implementing comprehensive instrumentation to measure experiment outcomes.

### Strategic Context

After 4-5 simulated industry tests revealed "wooden" strategy outputs, we synthesized learnings (documented in `docs/journal/2025-12-12-extraction-generation-learnings.md`) and identified the need for:

1. **Less prescriptive extraction** - Remove formulaic industry/target_market fields
2. **Emergent theme extraction** - Let strategic content emerge from conversation
3. **Experimentation infrastructure** - Proper controls, variant tracking, and measurement

Before running parallel experiments, we needed a clean baseline with:
- Simplified UX (remove lens selection, filter toggles, etc.)
- Comprehensive instrumentation (events, quality ratings, variant tracking)
- Clear separation between user feedback and reviewer evaluation

## What Was Built

### 1. Baseline UX Simplification (8 Changes)

#### Change 1: Removed Lens Selection Phase
**Files:** `src/app/api/conversation/continue/route.ts`

Eliminated the LENS_SELECTION phase entirely:
- Removed phase handler for lens selection
- Changed flow: `INITIAL → QUESTIONING` (previously `INITIAL → LENS_SELECTION → QUESTIONING`)
- Updated first question prompt to be lens-agnostic
- Conversation now goes directly into strategic questioning

**Rationale:** Lens selection was prescriptive and forced thinking into predetermined categories before natural conversation could reveal strategic focus areas.

#### Change 2: Three-Option Extraction UI
**Files:**
- `src/components/ExtractionConfirm.tsx`
- `src/app/page.tsx`

Changed extraction confirmation from 2 buttons to 3:
1. **Continue now** - Return to chat to explore opportunities
2. **Flag for next session** - Save opportunities for later (fake door)
3. **Dismiss** - Proceed to generation without exploring

Updated field name: `unexplored` → `opportunities_for_enrichment`

**Rationale:** Gives users explicit choice about whether to explore opportunities, with option to defer for future sessions (supports multi-session vision).

#### Change 3: Updated Extraction Field Names
**Files:**
- `src/lib/types.ts`
- `src/app/api/extract/route.ts`

Renamed `unexplored` to `opportunities_for_enrichment` in `ReflectiveSummary`:
```typescript
export interface ReflectiveSummary {
  strengths: string[];
  emerging: string[];
  opportunities_for_enrichment: string[];  // Changed from unexplored
  thought_prompt?: string;
}
```

**Rationale:** More positive framing - these are opportunities to enrich the strategy, not gaps or deficiencies.

#### Change 4: Simplified Objectives Display
**Files:** `src/components/StrategyDisplay.tsx`

Removed flip card interaction from objectives:
- Before: Front (pithy + metric badge) → Back (full SMART + explanation)
- After: Simple card with pithy statement + metric + category badge
- Removed filter toggle icons (eye/closed-eye)
- Removed hover state for flip

**Rationale:** Simplified interaction reduces cognitive load. Focus on clear presentation over interactive complexity.

#### Change 5: Blank Initiatives with Fake Door CTA
**Files:** `src/components/StrategyDisplay.tsx`

Replaced placeholder initiatives with empty state:
- Shows dashed border box
- Message: "Define initiatives that support your objectives"
- CTA button: "Create Initiatives" (fake door)
- Logs click event to database

**Rationale:** Honest about what the system can generate now. Fake door measures demand for initiative generation feature.

#### Change 6: Blank Principles with Fake Door CTA
**Files:** `src/components/StrategyDisplay.tsx`

Replaced placeholder principles with empty state:
- Shows dashed border box
- Message: "Define principles that guide your decision-making"
- CTA button: "Define Principles" (fake door)
- Logs click event to database

**Rationale:** Same as initiatives - honest about current capabilities, measure feature demand.

#### Change 7: Info Icons with Educational Content
**Files:** `src/components/StrategyDisplay.tsx`

Added info icons (ℹ️) to all Decision Stack elements:
- Vision, Mission, Objectives, Initiatives, Principles
- Each shows modal with educational content on what makes a good statement
- Educational content includes examples of "Good" vs "Wooden" statements
- Logs view events to database

Example content:
```
Vision: "A Vision statement describes your aspirational future state (3+ years).
It should be customer-centric, specific, and inspiring but grounded in reality.

Good: 'To be the trusted platform that empowers 1M creators to build sustainable businesses'
Wooden: 'To be the best-in-class solution provider'"
```

**Rationale:** Framework education directly in context. Measures which elements users need help understanding.

#### Change 8: Edit Capability as Fake Door
**Files:** `src/components/StrategyDisplay.tsx`

Added edit icons (pencil) to all elements:
- Appears on hover for Vision, Mission, each Objective
- Shows "coming soon" alert on click
- Logs fake door click to database

**Rationale:** Measures demand for in-place editing feature. Critical for understanding if users want refinement capabilities.

#### Change 9: Strategic Thinking → Accordion
**Files:** `src/components/StrategyDisplay.tsx`

Moved "Claude's Thoughts" into collapsible accordion:
- Uses shadcn Accordion component
- Title: "How to talk to this strategy"
- Collapsed by default
- User can expand to read strategic guidance

**Rationale:** Reduces visual clutter. Thoughts are helpful but secondary to the strategy itself.

### 2. Comprehensive Instrumentation

#### Event Tracking System
**Files:**
- `prisma/schema.prisma` - Added Event model
- `src/lib/events.ts` - Event logging helpers
- `src/app/api/events/route.ts` - Event logging API

Added Event table with:
```prisma
model Event {
  id             String   @id @default(cuid())
  conversationId String
  traceId        String?  // Nullable - some events before generation
  timestamp      DateTime @default(now())
  eventType      String   // 'fake_door_click', 'info_icon_view', 'extraction_choice'
  eventData      Json     // Flexible storage for event-specific data
}
```

Event types tracked:
1. **fake_door_click** - Which features users want (Edit Vision, Create Initiatives, etc.)
2. **info_icon_view** - Which elements need education (Vision, Mission, Objectives, etc.)
3. **extraction_choice** - User choices at extraction confirmation (continue/flag/dismiss)

**Rationale:** Trace-based analytics tied to conversation context. Better for R&D than web analytics (Mixpanel/Amplitude) because we can correlate engagement with quality outcomes.

#### Quality Rating System (Reviewer-Only)
**Files:**
- `prisma/schema.prisma` - Added quality rating fields to Trace
- `src/app/api/quality-rating/route.ts` - Quality rating API
- `src/components/QualityRating.tsx` - Rating UI component (NOT shown to users)

Added to Trace table:
```prisma
model Trace {
  qualityRating          String?  // 'good' | 'bad'
  qualityRatingTimestamp DateTime?
}
```

**Critical Design Decision:** Quality ratings are for REVIEWERS doing evals, NOT for end users.
- Binary choice (good/bad) forces decisive feedback
- Simpler than 5-point scale
- API and component exist but NOT shown in user flow
- Reviewers can rate via notebook or admin interface

**Rationale:** Separate user feedback (helpful/not helpful) from researcher evaluation (good/bad). Users shouldn't have to rate quality - they judge helpfulness. Researchers judge quality for experiments.

#### Experiment Variant Tracking
**Files:**
- `prisma/schema.prisma` - Added experimentVariant to Conversation
- `src/app/api/conversation/start/route.ts` - Set baseline-v1 variant

Added to Conversation table:
```prisma
model Conversation {
  experimentVariant String?  // 'baseline-v1', 'emergent-extraction', etc.
}
```

All new conversations tagged with `experimentVariant: 'baseline-v1'`:
```typescript
const conversation = await prisma.conversation.create({
  data: {
    userId,
    status: 'in_progress',
    experimentVariant: 'baseline-v1', // Track experiment variant
  },
});
```

**Rationale:** Enables A/B comparison between baseline and future variants. Essential for measuring impact of extraction changes, prompt changes, etc.

### 3. Analysis Infrastructure Updates

#### Updated Trace Analysis Notebook
**File:** `notebooks/trace_analysis_starter.ipynb`

Added 6 new cells for event analysis:

**Cell 9: Load All Events**
```python
all_events = analyzer.load_events(limit=1000)
print(f"Total events recorded: {len(all_events)}")
print(all_events['eventType'].value_counts())
```

**Cell 10: Fake Door Analysis**
```python
fake_door_clicks = all_events[all_events['eventType'] == 'fake_door_click']
features = fake_door_clicks['eventData'].apply(lambda x: x.get('feature'))
feature_counts = features.value_counts()
```

**Cell 11: Info Icon Analysis**
```python
info_views = all_events[all_events['eventType'] == 'info_icon_view']
elements = info_views['eventData'].apply(lambda x: x.get('element'))
element_counts = elements.value_counts()
```

**Cell 12: Extraction Choice Analysis**
```python
extraction_choices = all_events[all_events['eventType'] == 'extraction_choice']
choices = extraction_choices['eventData'].apply(lambda x: x.get('choice'))
choice_distribution = choices.value_counts()
```

**Cell 13: Event-Quality Correlation**
```python
# Compare engagement patterns between good vs bad rated strategies
for rating in ['good', 'bad']:
    rating_traces = rated_traces[rated_traces['qualityRating'] == rating]
    rating_events = all_events[all_events['traceId'].isin(rating_traces['id'])]
    print(f"Average events per trace: {len(rating_events) / len(rating_traces):.1f}")
```

**Cell 14: Variant Comparison**
```python
# Compare quality and engagement across experiment variants
for variant in variants:
    variant_data = traces[traces['experimentVariant'] == variant]
    print(f"Quality ratings: {variant_data['qualityRating'].value_counts()}")
    print(f"Event engagement: {variant_events['eventType'].value_counts()}")
```

**Updated Cell 4: Show Events with Trace**
```python
events = analyzer.load_events(trace_id=trace_id)
for _, event in events.iterrows():
    print(f"[{event['timestamp']}] {event['eventType']}")
    print(f"  Data: {event['eventData']}")
```

**Rationale:** Enables comprehensive analysis of user engagement, feature demand, and correlation between engagement and quality.

#### Updated TraceAnalyzer
**File:** `scripts/trace_analysis.py`

Added new method:
```python
def load_events(self, limit=1000, trace_id=None, conversation_id=None):
    """Load user interaction events."""
    # Query Event table with optional filters
```

Updated `load_traces()`:
- Added `qualityRating`, `qualityRatingTimestamp` columns
- Added `experimentVariant` column

Updated `display_trace()`:
- Shows experiment variant in metadata
- Shows quality rating in metadata
- Displays events for the trace

**Rationale:** Seamless integration of event data into existing analysis workflow.

### 4. User Feedback Simplification

**Change:** Removed quality rating from user-facing UI, kept helpful/not-helpful feedback only.

**Files Modified:**
- `src/app/page.tsx` - Removed QualityRating component import and usage

**Before:**
```tsx
<StrategyDisplay ... />
<QualityRating traceId={traceId} />  // REMOVED
<FeedbackButtons traceId={traceId} />
```

**After:**
```tsx
<StrategyDisplay ... />
<FeedbackButtons traceId={traceId} />  // Only user feedback
```

**Rationale:**
- Confusing to have two feedback mechanisms (helpful/not-helpful AND good/not-good)
- Quality assessment is for researchers, not users
- QualityRating API and component still exist for reviewer use via notebook/admin
- Cleaner user experience with single feedback mechanism

## Technical Decisions

### Instrumentation Strategy: Database vs Web Analytics

**Decision:** Use database (trace-based) event tracking instead of Mixpanel/Amplitude.

**Reasoning:**
1. **Conversation Context** - Events tied to specific conversations and traces
2. **Quality Correlation** - Can correlate engagement with quality ratings
3. **R&D Focus** - Better for experimentation than product analytics
4. **Simplicity** - No external service dependencies
5. **Cost** - Free vs paid service

**Trade-offs:**
- No funnel visualization (acceptable - we can query ourselves)
- No real-time dashboards (acceptable - batch analysis in notebooks)
- Manual queries vs UI (acceptable - more flexible)

### Binary Quality Ratings

**Decision:** Use binary (good/bad) instead of 5-point scale.

**Reasoning:**
1. **Forces Decision** - Can't hide in middle (3 out of 5)
2. **Simpler Analysis** - Clear threshold for success
3. **Faster Rating** - Less cognitive load for reviewers
4. **User Feedback** - From user preference ("I like it more binary")

### Event Data Structure

**Decision:** Store event-specific data in JSON field instead of separate tables.

**Reasoning:**
1. **Flexibility** - Can add new event types without schema changes
2. **Simplicity** - Single Event table vs many event-specific tables
3. **Performance** - Acceptable for R&D use case (not high-volume product analytics)

Example:
```json
{
  "eventType": "fake_door_click",
  "eventData": {"feature": "Edit Vision"}
}

{
  "eventType": "info_icon_view",
  "eventData": {"element": "Mission"}
}

{
  "eventType": "extraction_choice",
  "eventData": {"choice": "continue"}
}
```

## Files Created

1. `src/lib/events.ts` - Event logging helper functions
2. `src/app/api/events/route.ts` - Event logging API endpoint
3. `src/app/api/quality-rating/route.ts` - Quality rating API (reviewer-only)
4. `docs/journal/2025-12-12-extraction-generation-learnings.md` - Synthesis of testing insights
5. `docs/archive/framework-reference/QUALITY_CRITERIA.md` - Framework quality reference
6. `docs/session-notes/2025-12-13_baseline-v1-normalization-and-instrumentation.md` - This document

## Files Modified

1. `prisma/schema.prisma` - Added Event model, quality rating fields, experimentVariant
2. `src/lib/types.ts` - Renamed unexplored → opportunities_for_enrichment
3. `src/app/api/conversation/start/route.ts` - Set experimentVariant to baseline-v1
4. `src/app/api/conversation/continue/route.ts` - Removed LENS_SELECTION phase
5. `src/app/api/extract/route.ts` - Updated field names in extraction
6. `src/components/ExtractionConfirm.tsx` - Three-option UI with event logging
7. `src/components/StrategyDisplay.tsx` - Complete rewrite with all baseline features
8. `src/app/page.tsx` - Updated extraction handlers, removed QualityRating from UI
9. `notebooks/trace_analysis_starter.ipynb` - Added 6 event analysis cells
10. `scripts/trace_analysis.py` - Added load_events() method, updated queries
11. `docs/future-improvements.md` - Added lens inference and multi-session vision notes

## Issues Encountered and Resolved

### Issue 1: Prisma Client Validation Error
**Problem:** After updating schema and running `npx prisma db push`, the server failed with:
```
Unknown argument `experimentVariant`. Available options are marked with ?.
```

**Root Cause:**
- Added `experimentVariant` field to schema
- Pushed to database successfully
- But didn't regenerate TypeScript Prisma client
- Next.js was using cached client that didn't know about new field

**Solution:**
1. Killed dev server
2. Ran `npx prisma generate` to regenerate client
3. Cleared Next.js cache: `rm -rf .next`
4. Restarted dev server

**Verification:** Server started successfully, no more validation errors.

**Lesson:** Always regenerate Prisma client after schema changes, not just db push.

### Issue 2: React Warnings (Non-Critical)
**Warnings Observed:**
```
Warning: Function components cannot be given refs.
Check the render method of `ot`. (SidebarSection)

Warning: Extra attributes from the server: data-np-*
```

**Analysis:**
1. **Ref warning** - From shadcn/ui sidebar components, harmless
2. **Extra attributes** - From NordPass browser extension, cosmetic only

**Decision:** Noted but not fixed. Neither affects functionality or baseline experiment.

### Issue 3: Notebook Module Reload
**Problem:** Updated `trace_analysis.py` but notebook showed:
```
AttributeError: 'TraceAnalyzer' object has no attribute 'load_events'
```

**Root Cause:** Python caches imported modules. Notebook was using old cached version.

**Solution:** Added reload instructions:
```python
import importlib
import scripts.trace_analysis
importlib.reload(scripts.trace_analysis)
from scripts.trace_analysis import TraceAnalyzer
```

**Alternative:** Restart kernel (Kernel → Restart)

## Testing and Verification

### Development Server
✅ Running on http://localhost:3004
- No errors on startup
- All routes compiled successfully
- Hot reload working

### Database Schema
✅ `npx prisma db push` - Successful
- Event table created
- Trace.qualityRating added
- Trace.qualityRatingTimestamp added
- Conversation.experimentVariant added
- All indexes created

### Prisma Client
✅ `npx prisma generate` - Successful
- TypeScript types updated
- All new fields recognized
- Client version: 5.22.0

### UAT Testing
✅ Complete conversation flow tested:
1. Start conversation → First question appears
2. Answer questions → Confidence assessment working
3. Early exit offered → Extraction phase triggered
4. Extraction confirmation → Three options displayed
5. Generate strategy → All elements displayed correctly
6. Info icons → Educational content shown, events logged
7. Edit buttons → Fake door alerts, events logged
8. Create Initiatives/Principles CTAs → Fake door alerts, events logged
9. Helpful/Not Helpful feedback → Logged to database

### Event Logging
✅ Verified in database:
- Fake door clicks logged correctly
- Info icon views logged correctly
- Extraction choices logged correctly
- All events linked to correct conversationId/traceId

### Notebook Analysis
✅ All new cells working:
- Cell 9: Load events ✓
- Cell 10: Fake door analysis ✓
- Cell 11: Info icon analysis ✓
- Cell 12: Extraction choice analysis ✓
- Cell 13: Event-quality correlation ✓
- Cell 14: Variant comparison ✓

## Baseline-v1 Characteristics

### What Baseline-v1 Represents

**Simplified UX:**
- No lens selection (direct to questioning)
- No flip cards on objectives
- No filtering UI for initiatives
- Blank initiatives and principles with CTAs
- Accordion for strategic thinking
- Info icons for education
- Edit buttons as fake doors

**Honest Capabilities:**
- Shows what system can generate (vision, mission, objectives)
- Shows what it can't generate yet (initiatives, principles)
- Measures demand for missing features

**Comprehensive Tracking:**
- All user interactions logged as events
- Experiment variant tagged on all conversations
- Quality ratings available for reviewers (not users)
- User feedback (helpful/not helpful) captured

### What to Measure Against Baseline-v1

When running experimental variants, compare:

**Quality Metrics:**
- Quality rating distribution (good vs bad)
- User feedback (helpful vs not helpful)
- Strategy completeness (objectives generated)

**Engagement Metrics:**
- Info icon view patterns (which elements need help?)
- Fake door click patterns (which features are wanted?)
- Extraction choice patterns (continue vs flag vs dismiss)
- Average events per trace

**Conversation Metrics:**
- Question count to completion
- Confidence assessment scores
- Time to completion

**Variant-Specific:**
- baseline-v1 vs emergent-extraction
- baseline-v1 vs energetic-prompts
- baseline-v1 vs lens-inference

## Next Steps

### Immediate
1. ✅ UAT testing complete
2. ✅ Remove quality rating from user UI
3. ⏳ Commit all changes to development branch
4. ⏳ Tag as baseline-v1
5. ⏳ Document branching strategy for experiments

### Priority 1 Experiment: Emergent Themes
**Goal:** Test if emergent theme extraction generates better quality than baseline.

**Approach:**
1. Create branch `experiment/emergent-extraction`
2. Update extraction prompt to identify emergent themes
3. Remove prescriptive fields (industry, target_market, unique_value)
4. Use theme-based extraction instead
5. Set `experimentVariant: 'emergent-extraction'`
6. Run 10-15 conversations
7. Compare quality ratings vs baseline-v1

**Success Criteria:**
- Higher % of "good" quality ratings
- Equal or better user feedback (helpful %)
- Richer objectives (more specific, less wooden)

### Priority 2 Experiment: Energetic Prompts
**Goal:** Test if energetic generation prompts reduce "wooden" outputs.

**Approach:**
1. Create branch `experiment/energetic-prompts`
2. Update generation prompt with energy guidance
3. Add examples of authentic voice vs wooden statements
4. Set `experimentVariant: 'energetic-prompts'`
5. Run 10-15 conversations
6. Compare quality ratings vs baseline-v1

### Future Experiments (Lower Priority)
3. **Lens Inference** - Infer strategic focus from conversation
4. **Multi-turn Refinement** - Allow users to refine generated strategy
5. **Objective-Initiative Generation** - Generate initiatives from objectives

## Design Patterns and Principles

### Event-Driven Analytics
- All user interactions logged as discrete events
- Events linked to conversation context
- Flexible JSON schema for event data
- Enables correlation analysis (engagement × quality)

### Fake Door Testing
- Measure feature demand before building
- Log clicks, show "coming soon" message
- Prioritize based on demand signals

### Separation of Concerns
- User feedback (helpful/not helpful) - for product value
- Quality rating (good/bad) - for research evaluation
- Event tracking - for engagement patterns

### Experiment Infrastructure
- Variant tagging at conversation start
- Consistent baseline for comparison
- Comprehensive instrumentation
- Notebook-based analysis workflow

### Progressive Disclosure
- Strategic thinking in accordion (optional)
- Info icons for education (on-demand)
- Blank states for missing capabilities (honest)

## Strategic Insights from Testing

From `docs/journal/2025-12-12-extraction-generation-learnings.md`:

### The Formulaic Problem
Even with rich simulation inputs across diverse industries, outputs felt "wooden" - lacking drive and energy of real leaders. The extraction schema (industry/target_market/unique_value) forced diverse strategic thinking into a one-size-fits-all mold.

### Doing Too Much Too Early
Trying to create lens-specific approaches upfront was premature. Better to keep extraction flexible and let strategic focus emerge from conversation.

### Framework Rigor vs Flexibility
**Rigor belongs in output formats** (Vision structure, SMART metrics, "even/over" principles)
**Flexibility belongs in extraction** (emergent themes, open-ended questions, adaptive paths)

### Multi-Session Vision
Target domain: Digital strategy for SaaS (pre-seed → Fortune 500)
Same user develops Decision Stack across multiple sessions, each focusing on different strategic dimensions.

## Related Documents

- **Synthesis**: `docs/journal/2025-12-12-extraction-generation-learnings.md`
- **Quality Criteria**: `docs/archive/framework-reference/QUALITY_CRITERIA.md`
- **Future Improvements**: `docs/future-improvements.md`
- **Previous Session**: `docs/session-notes/2025-12-10_enhanced-strategy-display-implementation.md`

---

**Session Outcome:** ✅ Successfully established baseline-v1 with simplified UX, comprehensive instrumentation, and proper separation of user feedback vs reviewer evaluation. Ready for UAT, commit, and parallel experimentation.
