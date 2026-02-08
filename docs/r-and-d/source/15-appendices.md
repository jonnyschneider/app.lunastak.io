# 15. Appendices

## Changelog Analysis

Map each release to R&D activities and research purposes.

## R&D Log

```
> Append-only record of technical decisions and open questions. Supports R&D tax documentation by capturing the "why" behind development work.
```

## Experiment Register

> Track all experiments systematically to improve strategy generation quality.

## Example Experiment One-Pager: *'E01 Emergent Extraction'*

> Defines the learning goals, hypotheses, testing approach, implementation, success criteria, and outcome for planned experiments.

## Example Planning Document: *Evaluation Infrastructure Design*

> Demonstrates a rigorous approach to solution design and implementation approach.

## Lunastak Technical Architecture

> Documents the technical stack, design principles (flexibility, simplicity, validated learning), and known compromises. Demonstrates systematic architectural decision-making aligned with experimental goals.

# 15.1 Changlog Analysis

```
**Purpose:** Map each release to R&D activities and research purpose. **Instructions:** Fill in the empty columns with your notes. Use [?] for uncertain, - for not applicable.
```

## Column Guide

## Release Analysis

## Emerging Patterns

### Activity Mapping

**Observations:**

- **A4 dominates recent work** (8 primary releases) - reflects the importance of interaction design as a research prerequisite

- **A1 and A2 cluster early** (v1.0-v1.4) - foundational work on judgement engine and measurement

- **A5 emerges later** (v1.5+) - performance issues only visible once core functionality existed

- **A3 concentrated** (v1.4.0, v1.4.4) - major architectural decisions made early, then stable

### Category Tally

### Key Insight

```
The category distribution shows **A4 (Interaction Design) is not "UX polish"** - it\'s the most active research area because user engagement directly gates whether the core A1 hypothesis can be tested at all.
```

## Questions to Consider

As you review each release:

1.  **What problem was this solving?** (Not what shipped, but *why*)

2.  **Was there genuine uncertainty?** (Or was it known solution to known problem?)

3.  **Did this enable other R&D?** (Supporting activity)

4.  **Did this directly test a hypothesis?** (Core activity)

5.  **Would this have been built anyway for a non-R&D product?** (Potentially not eligible)

## Status

**Completed 2026-02-03:**

- ✅ All 22 releases mapped to activities (A1-A5)

- ✅ Categories tallied

- ✅ Activity definitions revised (see activities/A1-A5\*.md)

- ✅ Executive summary updated (see executive-summary-v2.md)

**This document informs:**

- Activity definitions and expenditure allocation

- Evidence that each activity has substantive work

- Narrative that CHANGELOG is primary evidence (not one-pagers)

# 15.2 R&D Log

```
Append-only record of technical decisions and open questions. Supports R&D tax documentation by capturing the "why" behind development work.
```

**Format:** Decisions newest-first. Questions can be opened/closed as understanding evolves.

**Related journals:** Detailed synthesis and observations in docs/journal/:

- 2025-12-12-extraction-generation-learnings.md - Foundational learnings on extraction/generation

- UX_OBSERVATIONS.md - Early testing observations and tradeoffs

- 2026-01-04-v1.4.0-dogfooding.md - Real usage learnings

## Foundational Learnings & Trade-offs

*Distilled from early exploration (Dec 2025). These insights drove the experimental direction.*

```bash
### The "Wooden Output" Problem

**Observation (2025-12-07):** 3-question conversations produced technically accurate but lifeless strategies. "It\'s reasonable given the inputs, but it\'s not going to \'wow\' anyone."
```

**Root cause identified (2025-12-12):** The problem wasn\'t question count - it was the prescriptive extraction schema. Fixed categories (industry, target_market, unique_value) forced diverse strategic thinking into a one-size-fits-all mold.

```
**Insight:** "By prescribing fixed categories, we\'re treating this like a data extraction problem rather than a strategic thinking problem."
```

**Resolution:** Led to E1a (emergent extraction) - let themes emerge from conversation rather than prescribing fields.

### Quality vs Efficiency Tension

**The tradeoff:**

- Shorter conversations = lower barrier to completion (good for data collection)

- Longer conversations = better quality outputs (good for user value)

- 3-question approach optimized for completion, not value

**Decision:** Accept lower completion rates for better quality. Adaptive conversation (3-10 questions based on confidence) balances both.

**Ongoing tension:** Still navigating this - skip confirmation screen (2026-01-31) leans toward efficiency; dimensional coverage (E2/E3) leans toward quality.

### Framework Rigor vs Flexibility

**The puzzle:** Need flexibility in extraction/questioning to avoid wooden outputs, but must maintain rigor in output structure (Vision/Strategy/Objectives have specific requirements).

```
**Resolution:** "Output structure: maintain specific formats. Input/questioning: be flexible."
```

**Implication:** The formulaic extraction caused wooden results, but the Decision Stack framework itself is valuable and should be protected.

### Realistic vs Aspirational Altitude

```
**Observation (2026-01-04 dogfooding):** Outputs were technically correct and realistic for stage, but didn\'t feel aspirational enough. "Too much ops doc, not enough inspiration."
```

**The tension:**

- Realistic enough to be credible and actionable

- Stretch/aspirational enough to energize and inspire

```
- "If it reads like a task list, we\'ve failed"
```

**Status:** Unresolved. Design challenge: how to help users calibrate altitude?

### Technical Debt Philosophy

**Explicit tradeoffs made:**

```
- Document upload as "cold-start workaround" not genuine document management (known limitation)
```

- Single-session completion vs true iterative development (future: multi-session, multi-contributor)

- Simulated inputs for testing vs real user data (bootstrap problem)

**Accepted for MVP:** These limitations are documented and accepted. Addressing them requires real user feedback first.

## Open Questions

Active uncertainties we\'re exploring through the product.

### Extraction & Generation

- Does dimensional tagging improve strategy quality, or just feel structured? (opened 2026-01-03)

- What\'s the right extraction granularity - themes vs structured fields vs something else? (opened 2025-12-17)

- How much conversation context does generation actually need? Is reflective_summary necessary? (opened 2026-01-31)

- What\'s the optimal question count before diminishing returns? (opened 2025-12-12)

- Does quality scale linearly with conversation depth? (opened 2025-12-12)

### Output Quality

- How do we help users calibrate altitude (realistic vs aspirational)? (opened 2026-01-04)

```
- What makes a strategy feel like a "manifesto" vs a "planning document"? (opened 2026-01-04)
```

- Can we produce outputs that feel energetic without sacrificing accuracy? (opened 2025-12-12)

### Evaluation & Learning

- Can we do meaningful A/B comparison without production traffic scale? (opened 2026-01-31)

```
- How do we measure "wooden" vs "energetic" output quality systematically? (opened 2025-12-12)
```

### Product Direction

```
- Is "longitudinal strategy companion" the right positioning vs one-off strategy generator? (opened 2026-01-15)
```

- Should document upload become first-class entity vs cold-start workaround? (opened 2026-01-04)

## Decision Record

### 2026-02-02: Eval infrastructure over formal backtesting

**Context:** Needed to compare prompt versions, but DB gets wiped regularly, traces are ephemeral, and we don\'t have production traffic volume for statistical significance.

**Uncertainty:** How to do meaningful comparison of extraction/generation approaches without stable production data?

**Decision:** Build lightweight eval infrastructure - export traces to JSON, store evaluations in JSON files, side-by-side comparison UI. Time-based comparisons rather than controlled experiments.

**Outcome:** Infrastructure complete. First eval comparing old (v1-with-summary, 41.5s) vs new (themes-only, \~18s) extraction approaches. Qualitative comparison possible, but proper backtesting needs versioned API archival (future work).

**Refs:** docs/plans/2026-01-31-eval-infrastructure-design.md, evals/

### 2026-02-01: Fire-and-forget generation with polling

**Context:** Generation takes 15-30s. Users stare at loading spinner, can\'t navigate, feels slow even though wall-clock time unchanged.

```
**Uncertainty:** Would users tolerate async UX? Would they understand the "generating in background" pattern?

**Decision:** Fire-and-forget with waitUntil() + client polling. Generate button returns immediately with generationId, client polls /api/generation-status/[id] every 2s, toast notification when ready.
```

**Outcome:** Perceived performance dramatically improved. Users navigate freely during generation. No complaints about async pattern - toast notification provides clear feedback.

### 2026-01-31: Skip extraction confirmation screen

```
**Context:** After extraction, users saw "Here\'s what I understood" interstitial before generation. Added friction, broke flow.
```

**Uncertainty:** Do users need to review/edit extraction before generation? Is the confirmation step adding value?

**Decision:** Remove interstitial. Extraction → immediately trigger generation. Trust the extraction quality rather than asking users to validate.

**Outcome:** Reduced clicks, smoother flow. No user complaints about losing the confirmation step. Combined with background generation, the full flow feels much faster.

**Refs:** CHANGELOG 1.7.5

### 2026-01-31: Themes-only extraction (drop reflective_summary blocking call)

**Context:** Extraction had two Claude calls: (1) extract themes, (2) generate reflective_summary. The summary was used in generation prompt but added \~20s.

**Uncertainty:** Does reflective_summary actually improve generation quality? Is it worth the latency?

**Decision:** Remove reflective_summary from extraction. Pass themes directly to generation. Measure quality difference via eval infrastructure.

**Outcome:** \~30% extraction speed improvement (41s → 18s). Quality comparison TBD via eval. Hypothesis: themes contain the signal, summary was mostly redundant.

### 2026-01-24: Dashboard progressive disclosure

**Context:** Dashboard was overwhelming. Too much information visible at once - dimensions, gaps, provocations, conversations, documents all competing.

**Uncertainty:** What information hierarchy do users actually need? What can be hidden without losing value?

```
**Decision:** Collapsible "Luna\'s Memory" header with stats. Show 3 provocations with "show more". Deep dives moved up. Focus on actions (Docs/Chats/Strategies) over system analysis.

**Outcome:** Cleaner first impression. Users can drill down when needed. Matches "progressive disclosure" pattern from design systems.
```

### 2026-01-14: Guest user isolation with real records

**Context:** Guest users had no database records - couldn\'t track fragments, extraction runs, or enable evaluation. Data was ephemeral.

**Uncertainty:** Can we track guest user journeys without requiring authentication upfront?

**Decision:** Create real User + Project records for guests (guest_\<id\>@guest.lunastak.io). Full data tracking. Transfer to real account on authentication.

**Outcome:** Enables fragment tracking, extraction runs, and evaluation for all users including guests. Session transfer works cleanly. No authentication friction.

**Refs:** CHANGELOG 1.4.0 (HUM-49)

### 2026-01-06: Data contracts at pipeline boundaries

**Context:** Extraction → Persistence → Generation pipeline had implicit contracts. Type changes could silently break downstream stages.

**Uncertainty:** How to catch breaking changes early without excessive testing overhead?

**Decision:** Explicit TypeScript contracts at each boundary (EmergentExtractionContract, FragmentContract, GenerationInputContract, etc.). Contract tests verify shape. Smoke test verifies full flow.

**Outcome:** Pre-push hook runs npm run verify. Catches contract violations before they hit production. Schema changes require explicit contract updates.

**Refs:** CHANGELOG 1.4.4, src/lib/contracts/

### 2026-01-04: Fragment extraction with dimensional synthesis

```
**Context:** Extraction produced themes but they weren\'t persisted or analyzed systematically. No way to track what Luna "knows" about a business.
```

**Uncertainty:** What\'s the right data model for accumulating strategic understanding over time?

**Decision:** Extract themes → create Fragment records → tag with Tier 1 dimensions → synthesize into DimensionalSynthesis per dimension. Synthesis can be incremental (new fragments only) or full (all fragments).

```
**Outcome:** Luna now has persistent "memory". Dimensional coverage visible in UI. Foundation for "refresh strategy with new knowledge" feature.
```

### 2026-01-04: Dimension-guided questioning (E3)

**Context:** E1a (emergent extraction) lets themes emerge naturally. But conversations might miss important strategic dimensions.

**Uncertainty:** Would explicitly guiding questions toward uncovered dimensions improve coverage without feeling forced?

**Decision:** E3 variant includes 11 Tier 1 strategic dimensions in the conversation prompt. Claude explicitly guided to explore gaps.

**Outcome:** Running parallel with E1a. Coverage metrics being tracked via Statsig. Early signal: coverage improves but need more data.

### 2026-01-03: Dimensional coverage tracking (E2)

**Context:** E1a produces emergent themes. Need to validate they cover strategic dimensions vs prescribed fields.

**Uncertainty:** Do emergent themes map to the same strategic dimensions as prescriptive extraction?

```
**Decision:** Post-extraction analysis maps themes to 10 Tier 1 dimensions. Coverage percentage calculated. Gaps identified for "worth exploring" prompts.
```

**Outcome:** Coverage generally high (80%+ typical). Gaps visible in UI. Enables comparison between extraction approaches.

### 2025-12-17: Emergent extraction (E1a) vs prescriptive baseline

```
**Context:** Baseline (E0) used prescribed fields: industry, target_market, unique_value, etc. Outputs felt "wooden" and templated.
```

**Uncertainty:** Would completely freeform extraction produce more natural, tailored strategies?

**Decision:** E1a: Extract 3-7 themes that emerge naturally from conversation. No prescribed fields. Theme names generated by Claude based on actual content.

**Outcome:** Qualitatively better outputs - more tailored, less templated. Running as A/B test via Statsig. Emergent became default approach after positive early results.

### 2025-12-22: Multiple entry points for cold start

**Context:** Single entry point (guided conversation) limited who could use the product. Some users have documents, some want visual tools.

**Uncertainty:** Which entry points actually drive adoption? What\'s the minimum viable set?

**Decision:** Four entry points: Guided Conversation (live), Upload Document (live), Start from Canvas (fake door), Fast Track (fake door). Fake doors validate demand before building.

**Outcome:** Document upload sees real usage. Canvas and Fast Track got minimal clicks - deprioritized. Validated conversation + documents as primary paths.

### 2025-12-13: Baseline-v1 (E0) foundation

**Context:** Starting strategic AI assistant from scratch. Needed a control condition for all future experiments.

**Uncertainty:** What\'s the minimum viable flow that produces useful strategy outputs?

**Decision:** Adaptive conversation (3-10 questions based on confidence), prescriptive extraction, reflective summary, confidence-gated generation. Full Decision Stack output (Vision, Strategy, Objectives).

```
**Outcome:** Working foundation. Outputs useful but "wooden". Established baseline for E1a and subsequent experiments.
```

#  

# 15.3 Experiment Register

**Purpose:** Track all experiments systematically to improve strategy generation quality.

**Status Key:**

- 🟢 Complete

- 🟡 In Progress / Awaiting Evals

- ⚪ Planned

- 🔴 Failed / Abandoned

## Experiment Priority

**Foundation (Complete):**

1.  ✅ E0 (baseline-v1) - Infrastructure baseline

2.  ✅ E1 (emergent extraction) - Loosened extraction, validated via dogfooding

3.  ✅ E2 (dimensional coverage) - Post-hoc coverage tracking, \~75% emergent coverage

**Current (Alpha Testing):** 4. 🟡 E2 + E3 running in parallel behind feature flags

- E2: Emergent questioning (control) - emergent-extraction-e1a

- E3: Dimension-guided questioning (variant) - dimension-guided-e3

**Near-term Planned:** 5. E8 (energetic prompts) - Reduce corporate speak in outputs 6. E9 (lens inference) - Improve conversation flow 7. E10 (optimal depth) - Optimize conversation length

**Future Research (Dimensional Taxonomy Evolution):**

- E4 (real-time coverage display) - Increase user transparency

- E5 (multi-session accumulation) - Support evolving strategic context

- E6 (LLM-as-judge training) - Automate quality assessment

- E7 (sub-dimension emergence) - Discover sub-dimensional patterns

**Note:** E3-E7 originated from the strategic taxonomy design session (see docs/plans/strategic/2026-01-03-taxonomy-design-session.md). These experiments build on dimensional coverage tracking to evolve the taxonomy framework.

## Decision Framework

**For each experiment:**

1.  Run planned participant sessions

2.  Collect quantitative metrics (quality ratings, user feedback)

3.  Conduct qualitative analysis (review outputs, code patterns)

4.  Compare against baseline-v1

5.  Decide: Pass → Merge to main \| Fail → Document learnings

**Pass criteria:**

```
- Higher % of "good" quality ratings than baseline-v1
```

- Equal or better user feedback (helpful %)

- No critical gaps in strategic dimensions

- No increase in conversation abandonment

**If experiment passes:**

- Merge variant to development

- Run UAT

- Merge to main (becomes new baseline)

- Tag version

- Update experiment register

**If experiment fails:**

- Keep branch for reference

- Document why it failed

- Extract learnings for future experiments

- Do NOT merge to main

## Related Documentation

- **Session Notes:** docs/session-notes/ - Implementation details

- **Journal:** docs/journal/2025-12-12-extraction-generation-learnings.md - Research synthesis

```
- **Quality Criteria:** docs/archive/framework-reference/QUALITY_CRITERIA.md - What "good" looks like
```

- **Analysis Tools:** notebooks/trace_analysis_starter.ipynb - Data analysis

## Experiment Lineage

**Taxonomy-Driven Experiments:**

- E2 → E3 → E4 → E5 → E6 → E7

- These experiments evolved from the strategic taxonomy design session

- Build progressively on dimensional coverage infrastructure

- Cross-reference: docs/plans/strategic/2026-01-03-taxonomy-design-session.md

**Generation Quality Experiments:**

- E8 (energetic prompts)

- E9 (lens inference)

- E10 (optimal depth)

**Last Updated:** 2026-01-03

#  

# 15.4 Example Experiment One-Pager: 'E01 Emergent Extraction'

**Status:** 🟢 Complete (Validated via Dogfooding) **Variant ID:** emergent-extraction**Date:** 2025-12-17 **Completed:** 2026-01-03

## What We\'re Learning

```
Can completely freeform extraction (no prescribed fields) produce less "wooden" outputs than baseline-v1\'s prescriptive schema, while still capturing the strategic dimensions needed for complete Decision Stack framework?
```

## Hypothesis

```
Emergent theme extraction will produce less "wooden" outputs than prescriptive fields because it accommodates the user\'s natural perspective rather than forcing diverse strategic thinking into a one-size-fits-all mold.
```

**Key assumption:** Users will provide enough signal through natural conversation that Claude can identify meaningful themes without being told what fields to extract.

## What Changed from Baseline-v1

### Extraction

**Before:** Fixed core (industry, target_market, unique_value) + prescribed enrichment **After:** Emergent themes (3-7 themes) named by Claude based on what actually emerged

### Confidence Assessment

```
**Before:** "Do I have enough for industry/target_market/unique_value?" **After:** "Do I understand this business strategically?"
```

### Generation

**Before:** Standard prompts using prescribed fields **After:** Adaptive prompts using emergent themes

### What Stayed the Same

- 3-10 question adaptive flow

- Reflective summary structure

- Three-option extraction UI

- Vision/Mission/Objectives output format

## Implementation Details

**Feature Flag:** emergent_extraction_e1a (Statsig) **Variant Assignment:** Dynamic per user via Statsig SDK **Code Changes:**

- src/lib/statsig.ts - Feature flag integration

- src/lib/types.ts - Emergent schema types

- src/app/api/extract/route.ts - Dual extraction logic

- src/app/api/generate/route.ts - Adaptive generation

- src/components/ExtractionConfirm.tsx - Dynamic UI

## Success Criteria

**Pass:**

```
- Higher % "good" quality ratings (researcher) than baseline-v1
```

- No critical dimensional gaps (\>80% coverage)

**Fail:**

- Lower or equal quality ratings

- Systematic gaps in dimensional coverage

**Learn:**

- If quality improves but coverage drops → E1b/E1c (hybrid approaches)

## Measurement

**Primary Metrics:**

- Quality rating distribution (% good vs bad)

- User feedback (% helpful vs not_helpful)

- Conversation completion rate

**Secondary Analysis:**

- Dimensional coverage coding (retrospective)

- Theme diversity across conversations

- Coverage gaps analysis

**Sample Size:** Dogfooding (internal testing)

## Outcome

**Status:** ✅ Pass

**Key Findings:**

- Emergent themes produced richer, more contextual outputs than prescriptive fields

- Themes naturally captured user\'s strategic perspective without forced categorization

- Reflective summary effectively surfaced gaps and opportunities

- Dogfooding revealed need for dimensional coverage tracking (led to Experiment 2)

**Next Evolution:**

- Experiment 2 adds dimensional coverage tracking to validate theme→dimension mapping

- See docs/experiments/one-pagers/E2-dimensional-coverage.md

## Related Artifacts

- **Design:** docs/plans/2025-12-17-e1a-emergent-extraction-design.md

- **Implementation:** docs/plans/2025-12-17-e1a-emergent-extraction-implementation.md

- **Taxonomy Context:** docs/plans/strategic/2026-01-03-taxonomy-design-session.md

- **Next Experiment:** docs/experiments/one-pagers/E2-dimensional-coverage.md

**Implementation Status:** ✅ Complete **Outcome:** ✅ Pass - Validated approach, revealed dimensional tracking opportunity

#  

# 15.5 Example Planning Document: Evaluation Infrastructure Design

**Date:** 2026-01-31 **Status:** Approved **Purpose:** Enable systematic evaluation of prompt versions and generation quality

## Overview

Build lightweight eval infrastructure to support prompt iteration through expert review. Replace stale Jupyter notebooks with purpose-built tooling that fits the project\'s iteration speed.

## Goals

1.  Export trace data from DB to portable JSON format

2.  Compare outputs from same input across different prompt versions

3.  Capture component-level evaluation notes and tags

4.  Track findings to inform prompt improvements

## Non-Goals (for now)

- Cohort/aggregate comparison across trace groups

- Database sync for querying eval data

- Automated LLM-as-judge scoring

- More than 2 variants per eval

## Data Model

### Trace JSON

Location: evals/traces/{traceId}.json

```json
{
"id": "abc123",
"exportedAt": "2026-01-31T12:00:00Z",
"promptVersions": {
"extraction": "v1-emergent",
"generation": "v2-themes-only"
},
"components": {
"conversation": {
"messages": [...],
"questionCount": 5
},
"extraction": {
"themes": [...],
"dimensionalCoverage": {...},
"reflectiveSummary": {...}
},
"generation": {
"vision": "...",
"strategy": "...",
"objectives": [...]
}
},
"timing": {
"extractionMs": 12000,
"generationMs": 29000
}
```
}

### Eval JSON

Location: evals/{name}.eval.json

```json
{
"name": "Summary vs Themes-Only",
"date": "2026-01-31",
"purpose": "Compare generation quality with/without reflective summary",
"traces": ["abc123", "def456"],
"baseline": "abc123",
"evaluation": {
"abc123": {
"conversation": { "notes": "", "tags": [] },
"extraction": { "notes": "", "tags": [] },
"generation": { "notes": "", "tags": [] }
},
"def456": {
"conversation": { "notes": "", "tags": [] },
"extraction": { "notes": "", "tags": [] },
"generation": { "notes": "", "tags": [] }
}
},
"summary": "",
"outcome": ""
```
}

### Tags JSON

Location: evals/tags.json

```json
{
"conversation": [],
"extraction": [],
"generation": []
```
}

Tags are component-scoped and evolve organically as patterns emerge during review.

## Export Scripts

### export-trace.ts

Extracts trace data from DB, transforms to JSON.

```bash
# Export single trace
npx tsx scripts/export-trace.ts --traceId abc123

# Export multiple traces
npx tsx scripts/export-trace.ts --traceId abc123 --traceId def456

# Export by project (all traces for a project)
npx tsx scripts/export-trace.ts --projectId xyz789
```

Behavior:

- Fetches trace with related conversation, messages, extraction data

- Transforms to trace JSON structure

- Writes to evals/traces/{traceId}.json

```
- Skips existing files (use --force to overwrite)
```

### create-eval.ts

Scaffolds a new eval file.

```bash
npx tsx scripts/create-eval.ts --name "summary-vs-themes" --traces abc123,def456 --baseline abc123
```

Creates evals/2026-01-31-summary-vs-themes.eval.json with empty evaluation structure.

## Admin UI

```
Route: /admin/eval/[evalId]
```

Example: /admin/eval/2026-01-31-summary-vs-themes

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Eval: Summary vs Themes-Only [Save] [Export] │
├─────────────────────────────────────────────────────────┤
│ Purpose: Compare generation quality with/without... │
├───────────────────────┬─────────────────────────────────┤
│ BASELINE (abc123) │ VARIANT (def456) │
├───────────────────────┼─────────────────────────────────┤
│ ▼ Conversation │ ▼ Conversation │
│ [messages...] │ [messages...] │
│ Notes: [________] │ Notes: [________] │
│ Tags: [+] │ Tags: [+] │
├───────────────────────┼─────────────────────────────────┤
│ ▼ Extraction │ ▼ Extraction │
│ [themes, dims...] │ [themes, dims...] │
│ Notes: [________] │ Notes: [________] │
│ Tags: [+] │ Tags: [+] │
├───────────────────────┼─────────────────────────────────┤
│ ▼ Generation │ ▼ Generation │
│ Vision: ... │ Vision: ... │
│ Strategy: ... │ Strategy: ... │
│ Objectives: ... │ Objectives: ... │
│ Notes: [________] │ Notes: [________] │
│ Tags: [+] │ Tags: [+] │
├───────────────────────┴─────────────────────────────────┤
│ Summary: [___________________________________________] │
│ Outcome: [___________________________________________] │
└─────────────────────────────────────────────────────────┘
```

### Features

- Side-by-side comparison with collapsible sections

- Inline editing for notes (auto-saves to JSON)

- Tag picker with typeahead (shows existing tags + create new)

- New tags auto-added to tags.json

- Summary/outcome fields for overall conclusions

### File Operations

- **Save**: Writes evaluation data back to .eval.json file

- **Export**: Downloads the eval JSON (for sharing/archiving)

No tag management UI - edit tags.json directly to rename, merge, or delete tags.

## Directory Structure

```
evals/
tags.json # Component-scoped tag definitions
traces/
cml1lvd1b000fcz9eyd6t7sh0.json # Exported trace
cml1m1idua6msfq4l.json # Another trace
2026-01-31-summary-vs-themes.eval.json # Eval comparing two traces
2026-01-31-extraction-optimisation.json # Existing eval (migrate format)
```

## Notebook Archival

Move existing notebooks to docs/notebooks/ (gitignored):

- notebooks/trace_analysis_starter.ipynb

- notebooks/dimensional_coverage_analysis.ipynb

Preserved for reference but removed from repo.

## Implementation Approach

1.  Create TypeScript types for trace/eval JSON structures

2.  Build export-trace.ts script

3.  Build create-eval.ts script

4.  Create admin eval viewer UI

5.  Add auto-save and tag management

6.  Archive notebooks

7.  Migrate existing eval to new format

#  

# 15.6 Lunastak Technical Architecture

**Last Updated:** 2025-12-07 **Phase:** Phase 0 - Foundation

## Project Overview

**Decision Stack v4** is an AI-powered strategy consultant that helps users articulate their business strategy through conversational interaction.

**Primary Goals:**

1.  Learn evals methodology (Hamel Husain & Shreya Shankar approach)

2.  Ship closed beta with 100 users

3.  Build systematic improvement using error analysis

4.  Marketing vehicle for Humble Ventures

## Tech Stack

### Frontend

- **Framework:** Next.js 14.1.0 with App Router

- **Language:** TypeScript (strict mode)

- **Styling:** Tailwind CSS

- **Visualization:** ReactFlow 11.11.4 (Decision Stack diagram)

- **State Management:** React hooks (no Redux/Zustand for Phase 0)

### Backend

- **Runtime:** Next.js Edge Runtime (API routes)

- **Database:** Vercel Postgres

- **ORM:** Prisma

- **Auth:** NextAuth.js with Email Provider (magic links)

### AI & APIs

```
- **LLM:** Claude API via @anthropic-ai/sdk
```

- **Model:** Claude 3.5 Sonnet (or latest at time of implementation)

- **Pattern:** XML-based prompt/response format

### Infrastructure

- **Hosting:** Vercel

- **Analytics:** Vercel Analytics

- **Email:** Email provider integration (via NextAuth)

- **Feature Flags:** Statsig (Phase 1+)

### Development Tools

- **Package Manager:** npm (or pnpm)

- **Linting:** ESLint with Next.js config

- **Type Checking:** TypeScript compiler

- **Testing:** Jest + React Testing Library (Phase 1+)

## Architecture Principles

### Design for Future Flexibility

**Problem:** Strategic analysis will evolve beyond initial 3 fields (industry, target_market, unique_value)

**Solution:**

- Use flexible JSON schemas in database (jsonb columns)

- Avoid rigid table structures that require migrations

- Keep prompt engineering modular (separate prompts per dimension)

- Design for iteration without premature commitments

**Future expansion may include:**

- Competitive analysis

- Product experience evaluation

- Technical advantages

- Economies of scale

```
- Strategic "powers" (Hamilton Helmer framework)
```

- Porter\'s 5 Forces analysis

**Current scope (Phase 0):** Vision → Mission → Objectives (top half of Decision Stack)

### Simplicity First (YAGNI)

**Principles:**

- Build only what\'s needed for current phase

- No over-engineering or premature abstractions

```
- "Good enough for beta" is the target
```

- Iterate based on real user data (not assumptions)

**What we\'re NOT building yet:**

- Refinement/iteration flow (Phase 1)

- Initiatives layer (Phase 2+)

- Advanced strategy frameworks (Phase 2+)

- Voice input, document upload (backlog, validate first)

### Validated Learning

**Philosophy:**

- Data over opinions

- Use fake door tests before building features

- Build what users actually want (not what we think they want)

- Error analysis drives improvement (Phase 2+)

**Tools:**

- Feature backlog with validation methods

- User feedback (thumbs up/down)

- Trace analysis (manual review → LLM judges)

## System Architecture (v4)

### High-Level Flow

```
User → Chat Interface → Conversation API → Claude (3 questions)
↓
Extract Context (Claude)
↓
User Confirms/Edits
↓
Generate Strategy (Claude)
↓
ReactFlow Visualization + Feedback UI
↓
```
All logged to DB

### Database Schema (Prisma)

**Designed for comprehensive trace logging**

#### Conversations Table

```prisma
model Conversation {
id String @id @default(uuid())
userId String
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
status Status @default(IN_PROGRESS)

messages Message[]
traces Trace[]
}

enum Status {
IN_PROGRESS
COMPLETED
ABANDONED
```
}

#### Messages Table

```prisma
model Message {
id String @id @default(uuid())
conversationId String
conversation Conversation @relation(fields: [conversationId], references: [id])
role Role
content String @db.Text
stepNumber Int
timestamp DateTime @default(now())
}

enum Role {
ASSISTANT
USER
```
}

#### Traces Table

```prisma
model Trace {
id String @id @default(uuid())
conversationId String
conversation Conversation @relation(fields: [conversationId], references: [id])
userId String
timestamp DateTime @default(now())

// Extracted Context (flexible JSON)
extractedContext Json // { industry, target_market, unique_value, extraction_confidence, raw_conversation }

// Generated Output (flexible JSON)
output Json // { vision, mission, objectives }
claudeThoughts String? @db.Text

// Metadata
modelUsed String
totalTokens Int
promptTokens Int
completionTokens Int
latencyMs Int

// User Feedback (added later)
userFeedback Feedback?
feedbackTimestamp DateTime?
refinementRequested Boolean @default(false)
}

enum Feedback {
HELPFUL
NOT_HELPFUL
```
}

**Key Design Decisions:**

- extractedContext and output are Json (flexible, avoids migrations)

- Full conversation history stored in messages

- Token usage and latency tracked for cost analysis

- User feedback schema ready (Phase 1)

## v3 Code Reuse Strategy

### What We\'re Reusing (\~80%)

**Location:** /Users/Jonny/Desktop/decision-stack-v3/web

#### 1. StrategyFlow.tsx (Visualization)

**Path:** src/components/StrategyFlow.tsx

**What it does:**

- ReactFlow-based visualization of Vision → Mission → Objectives

- Handles layout, styling, connections

- Production-ready component

**Changes needed:**

- Minimal (maybe styling tweaks)

- Keep as-is for Phase 0

#### 2. Types (TypeScript Interfaces)

**Path:** src/lib/types.ts

**Existing types:** \`\`\`typescript interface BusinessContext { industry: string; targetMarket: string; uniqueValue: string; }

```typescript
interface StrategyStatements { vision: string; mission: string; objectives: string[]; }
```

interface GenerationResponse { thoughts: string; statements: StrategyStatements; } \`\`\`

**Changes needed:**

- Extend with new types:

- Conversation, Message, Trace

- ConversationMessage, ExtractionResult

- Keep existing types for compatibility

#### 3. Utils (Helper Functions)

**Path:** src/lib/utils.ts

**Existing utils:** \`\`\`typescript extractXML(text: string, tag: string): string // Parses Claude\'s XML responses // Pattern: /(.\*?)\<\\/tag\>/ // Keep this - still using XML format

buildPrompt(prompt: string, context: BusinessContext, feedback?: string): string // Builds prompt from context // Refactor for conversational flow // New version will handle conversation history \`\`\`

**Changes needed:**

- Keep extractXML as-is

- Refactor buildPrompt for chat-based interaction

- Add new utils for conversation management

#### 4. Claude API Integration Pattern

**Path:** src/app/api/generate/route.ts

**What we\'re keeping:**

- Edge runtime configuration

- Error handling pattern

- Anthropic SDK usage

- XML response parsing

**What we\'re changing:**

- Endpoint structure (new: /api/conversation, /api/extract, /api/generate)

- Prompts (conversational vs. form-based)

- Model version (upgrade to Sonnet 4.5)

- Add comprehensive logging

#### 5. Configuration Files

**Keep as-is:**

- tailwind.config.ts ✅

- tsconfig.json ✅

- next.config.js ✅

- .env.local structure (add new vars)

### What We\'re NOT Reusing (\~20%)

#### 1. InputForm.tsx

**Why:** Replacing static 3-field form with chat interface

#### 2. page.tsx (Home)

**Why:** Redesigning for conversational UX (not two-column form/viz layout)

#### 3. Any v3-specific business logic

**Why:** Conversation flow is fundamentally different

## Application Structure (v4)

### Directory Structure (Planned)

```
dc-agent-v4-with-evals/
├── .claude/ # Claude Code instructions
│ ├── README.md # Session startup checklist
│ ├── workflow.md # Git/commit workflows
│ └── architecture.md # This file
│
├── docs/
│ ├── session-notes/ # Archived session logs
│ │ └── YYYY-MM-DD_*.md
│ └── rd-tracking/ # R&D tax claim docs
│ ├── time-log.md
│ └── costs.csv
│
├── readme/
│ ├── V4_DEVELOPMENT_PLAN.md # Overall plan
│ ├── PROJECT_STATUS.md # Phase tracking
│ └── FEATURE_BACKLOG.md # Feature ideas
│
├── prisma/
│ └── schema.prisma # Database schema
│
├── src/
│ ├── app/
│ │ ├── api/
│ │ │ ├── conversation/
│ │ │ │ └── route.ts # Chat API (ask questions)
│ │ │ ├── extract/
│ │ │ │ └── route.ts # Context extraction
│ │ │ └── generate/
│ │ │ └── route.ts # Strategy generation
│ │ ├── chat/
│ │ │ └── [id]/
│ │ │ └── page.tsx # Conversation view
│ │ ├── layout.tsx
│ │ └── page.tsx # Landing page
│ │
│ ├── components/
│ │ ├── ChatInterface.tsx # Chat UI
│ │ ├── ChatMessage.tsx # Message bubble
│ │ ├── ExtractionConfirm.tsx # Context confirmation
│ │ ├── StrategyFlow.tsx # ReactFlow viz (from v3)
│ │ └── FeedbackButtons.tsx # Thumbs up/down
│ │
│ ├── lib/
│ │ ├── claude.ts # Claude API wrapper
│ │ ├── db.ts # Prisma client
│ │ ├── types.ts # TypeScript types (extended from v3)
│ │ └── utils.ts # Helpers (from v3, refactored)
│ │
│ └── styles/
│ └── globals.css # Tailwind imports
│
├── COMMIT_NOTES.md # Working session notes
├── .env.local # Environment variables
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md # Project overview
```

## API Endpoints Design

### POST /api/conversation

**Purpose:** Handle conversational Q&A

**Request:** typescript { conversationId: string; message: string; }

**Response:** typescript { conversationId: string; question: string; // Next question from Claude stepNumber: number; // 1, 2, 3 isComplete: boolean; // True after 3 questions }

**Flow:**

1.  Save user message to DB

2.  Send conversation history to Claude

3.  Claude generates next question (context-aware)

4.  Save assistant message to DB

5.  Return question to frontend

### POST /api/extract

**Purpose:** Extract structured context from conversation

**Request:** typescript { conversationId: string; }

**Response:** typescript { extractedContext: { industry: string; target_market: string; unique_value: string; extraction_confidence: \'HIGH\' \| \'MEDIUM\' \| \'LOW\'; }; clarifyingQuestion?: string; // If confidence \< HIGH }

**Flow:**

1.  Fetch all messages for conversation

2.  Send to Claude for extraction

3.  Claude returns structured context + confidence

4.  If confidence \< HIGH, generate clarifying question

5.  Save extraction to trace

### POST /api/generate

**Purpose:** Generate strategy from extracted context

**Request:** typescript { conversationId: string; extractedContext: ExtractedContext; }

```
**Response:** typescript { traceId: string; statements: { vision: string; mission: string; objectives: string[]; }; thoughts: string; metadata: { tokens: number; latency: number; }; }
```

**Flow:**

1.  Build strategy generation prompt from context

2.  Send to Claude

3.  Parse XML response

4.  Save complete trace to DB (conversation + context + output + metadata)

5.  Return strategy to frontend

## Conversation Flow Design

### The 3 Core Questions

```
**Question 1: Business Challenge** ``` Prompt to Claude: "You are a strategy consultant. Ask them to describe their business challenge or opportunity in their own words. Keep it warm, conversational, and open-ended."

Example output: "What business challenge or opportunity are you working on right now?" ```

**Question 2: Target Market** ``` Prompt to Claude: "Based on their description, ask a natural follow-up about who they\'re serving. Reference something specific from their answer."

Example output: "Got it! When you say small restaurants, who specifically are you targeting? Is there a particular type or size?" ```

**Question 3: Differentiation** ``` Prompt to Claude: "Ask what makes their approach unique. Make it feel like curiosity, not an interrogation."

Example output: "What makes your approach different from other solutions in this space?" ```
```

### Context Extraction

**After 3 questions, extract:** xml \<context\> \<industry\>Specific industry identified\</industry\> \<target_market\>Specific customer segment\</target_market\> \<unique_value\>Key differentiator\</unique_value\> \<confidence\>HIGH\|MEDIUM\|LOW\</confidence\> \</context\>

**If confidence \< HIGH:** xml \<missing\> What information is still unclear or missing \</missing\> \<clarifying_question\> One focused question to fill the gap \</clarifying_question\>

### Strategy Generation

**Input:** Extracted context **Output:** Vision → Mission → Objectives

**Prompt structure (XML-based):** \`\`\`xml {extracted} \<target_market\>{extracted}\</target_market\> \<unique_value\>{extracted}\</unique_value\>

Generate compelling strategy statements:

- Vision: Aspirational, future-focused, memorable

- Mission: Clear, actionable, current purpose

- Objectives: SMART (Specific, Measurable, Achievable, Relevant, Time-bound)

```
Your reasoning ... ... 1. First objective 2. Second objective 3. Third objective ```
```

## Environment Variables

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgres://...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000 # or production URL
NEXTAUTH_EMAIL_FROM=noreply@humventures.com.au

# Email Provider (for magic links)
EMAIL_SERVER=smtp://...
EMAIL_FROM=noreply@humventures.com.au

# Vercel (auto-populated in production)
VERCEL_URL=...
```

## Performance Considerations

### Token Usage

- **Question generation:** \~500-1000 tokens per question

- **Context extraction:** \~1000-1500 tokens

- **Strategy generation:** \~1000-2000 tokens

- **Total per user:** \~4000-5000 tokens

**Optimization:**

- Cache prompts where possible

- Use shorter system prompts

- Track token usage in traces for cost analysis

### Latency

- **Target:** \<3s per response

- **Claude API:** Usually 1-2s

- **Database:** \<100ms per query

- **Frontend:** Optimistic UI updates

### Database

- **Index:** conversationId, userId, timestamp

- **Retention:** Keep all traces (data is the product)

- **Export:** CSV export for error analysis (Phase 2)

## Security Considerations

### Authentication

- Magic link email (no passwords to leak)

- NextAuth handles session management

- Secure HTTP-only cookies

### Input Validation

- Sanitize user messages (XSS prevention)

- Rate limiting on API routes (Phase 1)

- Length limits on free-text inputs

### API Keys

- Never expose ANTHROPIC_API_KEY to frontend

- Server-side only API calls

- Environment variables properly configured

### Data Privacy

- User conversations are private

- No sharing between users

- GDPR compliance (Phase 1: add data export/deletion)

## Deployment Strategy

### Vercel Configuration

**Branches:**

- development → Preview deployments (not linked to production)

- main → Production deployment (auto-deploy on push)

**Environment Variables:**

- Set in Vercel dashboard

- Separate values for preview vs. production if needed

```json
**Build Settings:** json { "buildCommand": "npm run build", "outputDirectory": ".next", "installCommand": "npm install" }
```

### Database Migrations

**Using Prisma:** \`\`\`bash

## Development

```bash
npx prisma migrate dev
```

## Production (via Vercel)

```bash
npx prisma migrate deploy ```
```

**Strategy:**

- Use flexible JSON schemas to avoid frequent migrations

- Plan schema changes carefully

- Test migrations in preview deployments first

## Future Architecture Considerations

### Phase 1: Iteration & Refinement

- Add refinement endpoints

- Version tracking for strategies

- Conversation forking

### Phase 2: Error Analysis & Evals

- CSV export functionality

- Jupyter notebook integration

- LLM-as-judge implementation

- Eval result storage

### Phase 3: Advanced Features

- Voice input integration

- Document upload and parsing

- Multi-session support

- Collaborative editing

### Scaling Considerations (If Needed)

- Currently: Serverless (Vercel Edge)

- Future: Could add Redis for caching

- Database: Vercel Postgres scales automatically

- Claude API: Monitor rate limits

## Database Schema V1 (2026-01-03)

### Core Entities

- **Project**: Boundary for strategic understanding. One user can have multiple projects.

- **Conversation**: Interactive questioning sessions (belongs to Project)

- **Fragment**: Extracted themes/insights from conversations (belongs to Project)

- **FragmentDimensionTag**: Tags fragments to Tier 1 dimensions

- **DimensionalSynthesis**: Compressed understanding per dimension per project (11 per project)

- **GeneratedOutput**: Decision Stack artifacts

- **ExtractionRun**: Evaluation traces for A/B testing

### Tier 1 Dimensions

The 11 strategic dimensions for fragment tagging and synthesis:

1.  CUSTOMER_MARKET

2.  PROBLEM_OPPORTUNITY

3.  VALUE_PROPOSITION

4.  DIFFERENTIATION_ADVANTAGE

5.  COMPETITIVE_LANDSCAPE

6.  BUSINESS_MODEL_ECONOMICS

7.  GO_TO_MARKET

8.  PRODUCT_EXPERIENCE

9.  CAPABILITIES_ASSETS

10. RISKS_CONSTRAINTS

11. STRATEGIC_INTENT

### Legacy

- **Trace**: Deprecated, kept for historical data. New extractions use Fragment/ExtractionRun.

See: docs/plans/strategic/schema-design-summary.md for full design docs.

### Extraction → Fragment → Synthesis Flow

1.  **Extraction** (/api/extract) extracts emergent themes from conversation

2.  **Fragment Creation** creates Fragment records with dimension tags

3.  **Synthesis Update** runs full or incremental synthesis per dimension

4.  **Generation** (/api/generate) creates GeneratedOutput + ExtractionRun

### Key Files

- src/lib/fragments.ts - Fragment creation service

- src/lib/synthesis/ - Synthesis algorithm implementation

- src/lib/extraction-runs.ts - ExtractionRun tracking

- src/lib/dimensional-analysis.ts - Maps themes to dimensions

## Data Contracts (2026-01-06)

### Purpose

Contracts define the expected data shapes at key boundaries in the pipeline. They catch breaking changes before deployment.

### Contract Locations

- src/lib/contracts/ - TypeScript contract types

- src/lib/__tests__/contracts/ - Contract validation tests

- src/lib/__tests__/smoke.test.ts - End-to-end smoke test

### Key Boundaries

1.  **Extraction Output** (/api/extract → frontend/generate)

2.  EmergentExtractionContract: themes + reflective_summary

3.  PrescriptiveExtractionContract: core + enrichment + reflective_summary

4.  **Fragment Persistence** (extraction → database)

5.  FragmentContract: id, projectId, conversationId, content, contentType, status

6.  FragmentDimensionTagContract: fragmentId, dimension, confidence

7.  **Generation Input** (frontend → /api/generate)

8.  conversationId + extractedContext

9.  **Generation Output** (/api/generate → frontend)

10. traceId + thoughts + statements (vision, strategy, objectives)

### Verification Commands

- npm run smoke - Run smoke tests only

- npm run verify - Run type-check + all tests + smoke

### Adding New Boundaries

When adding a new API or data flow:

1.  Define contract types in src/lib/contracts/

2.  Add validation tests in src/lib/__tests__/contracts/

3.  Update smoke test if it affects the critical path

## Schema Change Policy

**The Prisma schema (prisma/schema.prisma) is a protected boundary.**

Changes to the schema affect:

- Data contracts and their tests

- Fragment/synthesis creation

- API input/output shapes

- Database migrations in production

**Before modifying the schema:**

1.  Consider if the change can be made in application code instead

2.  Update relevant contracts in src/lib/contracts/

3.  Run npm run verify to catch breaking changes

4.  Test migration on preview deployment before production

Schema changes should be intentional and well-considered, not casual.

## Claude API Usage

### IMPORTANT: Use createMessage() Wrapper

**All Claude API calls MUST go through the createMessage() wrapper in src/lib/claude.ts.**

```typescript
// ✅ CORRECT - Use the wrapper
import { createMessage, CLAUDE_MODEL } from \'@/lib/claude\';

const response = await createMessage({
model: CLAUDE_MODEL,
max_tokens: 1000,
messages: [{ role: \'user\', content: prompt }],
temperature: 0.7
}, \'your_context_label\');

// ❌ WRONG - Direct anthropic.messages.create
const response = await anthropic.messages.create({ ... });
```

### Why This Matters

The wrapper provides:

1.  **Automatic truncation detection** - Logs warning when stop_reason === \'max_tokens\'

2.  **Consistent logging** - Context labels help debug which call was truncated

3.  **Single point of control** - Easy to add retry logic, metrics, etc.

### Context Labels

Each call should include a descriptive context label for debugging:

- extraction - Theme extraction from conversation

- reflective_summary_emergent / reflective_summary_prescriptive - Summary generation

- strategy_generation - Vision/Strategy/Objectives generation

- conversation_start - First question generation

- continue_questioning - Follow-up questions

- confidence_assessment - Readiness evaluation

### Enforcement

A test in src/lib/__tests__/claude-wrapper.test.ts scans the codebase to ensure:

- Only src/lib/claude.ts contains anthropic.messages.create

- All other files use createMessage() instead

## Known Compromises

Learnings from runtime discoveries. Each notes whether the fix is **durable** (keep as-is) or **okay for now** (revisit when trigger condition met).

### Platform: Vercel Serverless

### Platform: Claude API

### Platform: NextAuth

### Application Logic

## Decision Log

Intentional trade-offs made during development. Not tech debt (tracked in Linear), but conscious design choices with documented rationale.

### 2026-01-14: Chat Flow Extraction

### 2026-01-14: Conversation Lifecycle

### 2026-01-14: Guest Flow Simplification

### 2026-01-13: Auth Routing & Demo Projects

## Notes

- This architecture is designed for Phase 0

- Will evolve based on real user data

- Prioritize learning and iteration over perfect design

- Update this document as architecture changes

**Last major update:** v1.7.0 Beta Launch (2026-01-15)

## v1.7.0 Beta Launch Updates

### Deep Dives Feature

Deep Dives are focused research areas within a project. They can originate from:

- Manual creation by user

- Automatic suggestion from gaps in dimensional coverage

- Extraction from conversation themes

**Key relationships:**

- Conversation.deepDiveId - links conversations to deep dives

- Document.deepDiveId - links uploaded documents to deep dives

- Deep Dive sheet shows filtered artifacts (only items with matching deepDiveId)

### Refresh Strategy

Strategy can be refreshed after accumulating more knowledge:

- Compare existing fragments vs new (using knowledgeUpdatedAt timestamp)

- Generate change summary highlighting what\'s new

- Version chain via GeneratedOutput.previousOutputId

### Guest Flow

Unauthenticated users get:

- Auto-created guest user (cookie-based guestUserId)

- Demo project with pre-seeded data (hydrated from fixtures)

- Full feature access except: create new project, restore demo

**Fixture bundling:** outputFileTracingIncludes in next.config.js ensures fixture JSON files are included in Vercel\'s standalone build.

### View-Only Conversations

Initial conversations (the original strategy-generating conversation) are view-only to prevent overwriting the original decision stack. Identified by:

- deepDiveId = null

- status = \'extracted\'

- Oldest by createdAt
