# R&D Log

Append-only record of technical decisions and open questions. Supports R&D tax documentation by capturing the "why" behind development work.

**Format:** Decisions newest-first. Questions can be opened/closed as understanding evolves.

---

## Open Questions

Active uncertainties we're exploring through the product.

- Does dimensional tagging improve strategy quality, or just feel structured? (opened 2026-01-03)
- What's the right extraction granularity - themes vs structured fields vs something else? (opened 2025-12-17)
- How much conversation context does generation actually need? Is reflective_summary necessary? (opened 2026-01-31)
- Can we do meaningful A/B comparison without production traffic scale? (opened 2026-01-31)
- Is "longitudinal strategy companion" the right positioning vs one-off strategy generator? (opened 2026-01-15)

---

## Decision Record

### 2026-02-02: Eval infrastructure over formal backtesting

**Context:** Needed to compare prompt versions, but DB gets wiped regularly, traces are ephemeral, and we don't have production traffic volume for statistical significance.

**Uncertainty:** How to do meaningful comparison of extraction/generation approaches without stable production data?

**Decision:** Build lightweight eval infrastructure - export traces to JSON, store evaluations in JSON files, side-by-side comparison UI. Time-based comparisons rather than controlled experiments.

**Outcome:** Infrastructure complete. First eval comparing old (v1-with-summary, 41.5s) vs new (themes-only, ~18s) extraction approaches. Qualitative comparison possible, but proper backtesting needs versioned API archival (future work).

**Refs:** docs/plans/2026-01-31-eval-infrastructure-design.md, evals/

---

### 2026-02-01: Fire-and-forget generation with polling

**Context:** Generation takes 15-30s. Users stare at loading spinner, can't navigate, feels slow even though wall-clock time unchanged.

**Uncertainty:** Would users tolerate async UX? Would they understand the "generating in background" pattern?

**Decision:** Fire-and-forget with `waitUntil()` + client polling. Generate button returns immediately with `generationId`, client polls `/api/generation-status/[id]` every 2s, toast notification when ready.

**Outcome:** Perceived performance dramatically improved. Users navigate freely during generation. No complaints about async pattern - toast notification provides clear feedback.

**Refs:** CHANGELOG 1.8.0, docs/plans/2026-01-31-background-generation-design.md

---

### 2026-01-31: Skip extraction confirmation screen

**Context:** After extraction, users saw "Here's what I understood" interstitial before generation. Added friction, broke flow.

**Uncertainty:** Do users need to review/edit extraction before generation? Is the confirmation step adding value?

**Decision:** Remove interstitial. Extraction → immediately trigger generation. Trust the extraction quality rather than asking users to validate.

**Outcome:** Reduced clicks, smoother flow. No user complaints about losing the confirmation step. Combined with background generation, the full flow feels much faster.

**Refs:** CHANGELOG 1.7.5

---

### 2026-01-31: Themes-only extraction (drop reflective_summary blocking call)

**Context:** Extraction had two Claude calls: (1) extract themes, (2) generate reflective_summary. The summary was used in generation prompt but added ~20s.

**Uncertainty:** Does reflective_summary actually improve generation quality? Is it worth the latency?

**Decision:** Remove reflective_summary from extraction. Pass themes directly to generation. Measure quality difference via eval infrastructure.

**Outcome:** ~30% extraction speed improvement (41s → 18s). Quality comparison TBD via eval. Hypothesis: themes contain the signal, summary was mostly redundant.

**Refs:** docs/plans/2026-01-31-extraction-flow-analysis.md, docs/plans/2026-01-31-extraction-api-optimisation.md

---

### 2026-01-24: Dashboard progressive disclosure

**Context:** Dashboard was overwhelming. Too much information visible at once - dimensions, gaps, provocations, conversations, documents all competing.

**Uncertainty:** What information hierarchy do users actually need? What can be hidden without losing value?

**Decision:** Collapsible "Luna's Memory" header with stats. Show 3 provocations with "show more". Deep dives moved up. Focus on actions (Docs/Chats/Strategies) over system analysis.

**Outcome:** Cleaner first impression. Users can drill down when needed. Matches "progressive disclosure" pattern from design systems.

**Refs:** CHANGELOG 1.7.2, docs/plans/2025-01-24-dashboard-progressive-disclosure-design.md

---

### 2026-01-14: Guest user isolation with real records

**Context:** Guest users had no database records - couldn't track fragments, extraction runs, or enable evaluation. Data was ephemeral.

**Uncertainty:** Can we track guest user journeys without requiring authentication upfront?

**Decision:** Create real User + Project records for guests (`guest_<id>@guest.lunastak.io`). Full data tracking. Transfer to real account on authentication.

**Outcome:** Enables fragment tracking, extraction runs, and evaluation for all users including guests. Session transfer works cleanly. No authentication friction.

**Refs:** CHANGELOG 1.4.0 (HUM-49)

---

### 2026-01-06: Data contracts at pipeline boundaries

**Context:** Extraction → Persistence → Generation pipeline had implicit contracts. Type changes could silently break downstream stages.

**Uncertainty:** How to catch breaking changes early without excessive testing overhead?

**Decision:** Explicit TypeScript contracts at each boundary (EmergentExtractionContract, FragmentContract, GenerationInputContract, etc.). Contract tests verify shape. Smoke test verifies full flow.

**Outcome:** Pre-push hook runs `npm run verify`. Catches contract violations before they hit production. Schema changes require explicit contract updates.

**Refs:** CHANGELOG 1.4.4, src/lib/contracts/

---

### 2026-01-04: Fragment extraction with dimensional synthesis

**Context:** Extraction produced themes but they weren't persisted or analyzed systematically. No way to track what Luna "knows" about a business.

**Uncertainty:** What's the right data model for accumulating strategic understanding over time?

**Decision:** Extract themes → create Fragment records → tag with Tier 1 dimensions → synthesize into DimensionalSynthesis per dimension. Synthesis can be incremental (new fragments only) or full (all fragments).

**Outcome:** Luna now has persistent "memory". Dimensional coverage visible in UI. Foundation for "refresh strategy with new knowledge" feature.

**Refs:** CHANGELOG 1.4.0, docs/plans/2026-01-04-fragment-extraction-synthesis.md

---

### 2026-01-04: Dimension-guided questioning (E3)

**Context:** E1a (emergent extraction) lets themes emerge naturally. But conversations might miss important strategic dimensions.

**Uncertainty:** Would explicitly guiding questions toward uncovered dimensions improve coverage without feeling forced?

**Decision:** E3 variant includes 11 Tier 1 strategic dimensions in the conversation prompt. Claude explicitly guided to explore gaps.

**Outcome:** Running parallel with E1a. Coverage metrics being tracked via Statsig. Early signal: coverage improves but need more data.

**Refs:** CHANGELOG 1.4.2, docs/experiments/one-pagers/E3-dimension-guided.md

---

### 2026-01-03: Dimensional coverage tracking (E2)

**Context:** E1a produces emergent themes. Need to validate they cover strategic dimensions vs prescribed fields.

**Uncertainty:** Do emergent themes map to the same strategic dimensions as prescriptive extraction?

**Decision:** Post-extraction analysis maps themes to 10 Tier 1 dimensions. Coverage percentage calculated. Gaps identified for "worth exploring" prompts.

**Outcome:** Coverage generally high (80%+ typical). Gaps visible in UI. Enables comparison between extraction approaches.

**Refs:** CHANGELOG 1.3.0, docs/experiments/one-pagers/E2-dimensional-coverage.md

---

### 2025-12-17: Emergent extraction (E1a) vs prescriptive baseline

**Context:** Baseline (E0) used prescribed fields: industry, target_market, unique_value, etc. Outputs felt "wooden" and templated.

**Uncertainty:** Would completely freeform extraction produce more natural, tailored strategies?

**Decision:** E1a: Extract 3-7 themes that emerge naturally from conversation. No prescribed fields. Theme names generated by Claude based on actual content.

**Outcome:** Qualitatively better outputs - more tailored, less templated. Running as A/B test via Statsig. Emergent became default approach after positive early results.

**Refs:** CHANGELOG 1.1.0, docs/experiments/one-pagers/E1-emergent-extraction.md

---

### 2025-12-22: Multiple entry points for cold start

**Context:** Single entry point (guided conversation) limited who could use the product. Some users have documents, some want visual tools.

**Uncertainty:** Which entry points actually drive adoption? What's the minimum viable set?

**Decision:** Four entry points: Guided Conversation (live), Upload Document (live), Start from Canvas (fake door), Fast Track (fake door). Fake doors validate demand before building.

**Outcome:** Document upload sees real usage. Canvas and Fast Track got minimal clicks - deprioritized. Validated conversation + documents as primary paths.

**Refs:** CHANGELOG 1.2.0, docs/plans/2025-12-21-cold-start-entry-points-design.md

---

### 2025-12-13: Baseline-v1 (E0) foundation

**Context:** Starting strategic AI assistant from scratch. Needed a control condition for all future experiments.

**Uncertainty:** What's the minimum viable flow that produces useful strategy outputs?

**Decision:** Adaptive conversation (3-10 questions based on confidence), prescriptive extraction, reflective summary, confidence-gated generation. Full Decision Stack output (Vision, Strategy, Objectives).

**Outcome:** Working foundation. Outputs useful but "wooden". Established baseline for E1a and subsequent experiments.

**Refs:** CHANGELOG 1.0.0, docs/experiments/one-pagers/E0-baseline-v1.md
