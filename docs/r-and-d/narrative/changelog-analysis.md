# CHANGELOG Analysis for R&D Activity Mapping

**Purpose:** Map each release to R&D activities and research purpose.
**Instructions:** Fill in the empty columns with your notes. Use `[?]` for uncertain, `-` for not applicable.

---

## Column Guide

| Column | Description |
|--------|-------------|
| **Version** | Release version |
| **Date** | Release date |
| **Summary** | What shipped (from CHANGELOG) |
| **Category** | Suggested: `reasoning` / `eval` / `infra` / `ux` / `data` / `obs`(observability) |
| **Activity** | R&D activity code (A1, A2, A3, A4?, or new) |
| **Uncertainty Addressed** | What research question did this advance? |
| **Your Notes** | Rationale, context, corrections |

---

## Release Analysis

| Version | Date | Summary | Category | Activity | Uncertainty Addressed | Your Notes |
|---------|------|---------|----------|----------|----------------------|------------|
| **v1.7.7** | 2026-02-02 | Eval UI enhancements, fixture naming, pipeline simplification | `eval` `infra` | **A2** | How do we compare extraction/generation approaches systematically? | Custom eval UI for trace comparison, versioned pipeline for backtesting |
| **v1.7.6** | 2026-02-01 | Background strategy generation, polling status | `perf` `ux` | **A5** | Can background processing maintain UX while hiding latency? | Fire-and-forget with waitUntil(), client polling |
| **v1.7.4** | 2026-01-28 | Strategy history submenu, deep dive topic linking, guest session stability | `ux` | **A4** | Can vast amounts of generated insight be navigated meaningfully? | user easily overwhelmed. Is this mine? Do I trust it? How do I get back to the source? |
| **v1.7.3** | 2026-01-24 | Neon serverless adapter (cold start fix), demo seeding removed, timeouts | `infra` `perf` | **A5** | Can serverless constraints be overcome for acceptable UX? | App reliability for acceptable UX |
| **v1.7.2** | 2026-01-24 | Dashboard progressive disclosure, Decision Stack branding, streaming progress | `ux` | **A4** | Can vast amounts of generated insight be navigated meaningfully? | Nothing removed, just reorganised and restructured. Heavy use of progressive disclosure to reduce overwhelm |
| **v1.7.1** | 2026-01-15 | Refresh strategy feature, deep dive doc linking, view-only initial conversations | `reasoning` `data` | **A1**, A3 | How does LLM perform when adding to 'old' insight? Are conflicts meaningfully resolved? | |
| **v1.7.0** | 2026-01-14 | Structured provocations, Slack signup notifications, project page polish | `reasoning` `ux` | **A1**, A4 | Is 'rapport' or perception of being heard more important than accuracy? Can output build user trust? | |
| **v1.6.1** | 2026-01-14 | useProjectActions hook, syntheses in fixtures, project combobox reorg | `ux` `infra` | **A4** | - | Data fixtures and shell navigation. Session management. |
| **v1.6.0** | 2026-01-14 | Project navigation restructure, sidebar improvements, gap summaries | `ux` | **A4** | Which information belongs together? Is the path clear and intuitive? | |
| **v1.5.2** | 2026-01-07 | Project empty state, homepage cleanup, new chat navigation fix | `ux` | **A4** | How do 'collections' need to be organised differently to single-thread? | |
| **v1.5.1** | 2026-01-07 | Claude truncation detection, contextual gap questions, sign-in gate, fire-and-forget fix | `perf` `obs` `ux` | **A5**, A4 | Is sign-in a hurdle to value? Are users willing to wait? | |
| **v1.5.0** | 2026-01-07 | Project-centric navigation, conversation starring, deep dives polish | `ux` | **A4** | IA and user flow for 'Projects' (contain multiple related artefacts) | |
| **v1.4.4** | 2026-01-06 | Data contracts, contract tests, smoke tests, pre-push hook | `infra` `data` | **A3** | Can contracts catch breaking changes during rapid experimentation? | |
| **v1.4.3** | 2026-01-06 | Sonnet 4.5 migration, extraction viewer endpoint | `reasoning` | **A1** | Model quality impact on strategic output | Massive difference in quality. Motivated a flurry of activity. |
| **v1.4.2** | 2026-01-05 | E3 dimension-guided questioning, Statsig experiments, double opt-in auth | `obs` `reasoning` | **A2**, A1 | Do we get better coverage if we lead with gaps (E3) vs. emergent insights (E1a)? | Has experiment one-pager. Supersized Release! |
| **v1.4.1** | 2026-01-04 | Sidebar UX (new conversation button, width), loading indicator refinements | `ux` | **A4** | Minor improvements | |
| **v1.4.0** | 2026-01-04 | Fragment extraction & synthesis, guest user isolation, inline dimension tagging, streaming progress | `data` `reasoning` | **A3**, A1 | Can we achieve high-quality reasoning with destructive data storage (extract -> fragment -> synthesise)? | Very big release. Fundamental change in approach. |
| **v1.3.0** | 2026-01-03 | E2 dimensional coverage tracking, backfill script, analysis tools | `eval` `obs` | **A2** | Can we cover the required strategic dimensions from emergent themes? | Has one-pager |
| **v1.2.2** | 2025-12-30 | React hydration fix, FK constraint fix, defensive error handling | `infra` | **A5** | Minor technical improvements | |
| **v1.2.0** | 2025-12-22 | Cold start entry points (4 options), document upload (unstructured.io), objective cards redesign | `ux` `obs` | **A4** | What input modalities work for strategic elicitation? | |
| **v1.1.0** | 2025-12-17 | E1a emergent extraction, Statsig SDK, dual schema support, quality ratings | `eval` `obs` | **A2**, A1 | Does freeform extraction produce less "wooden" outputs? | Has one-pager. Large Release. |
| **v1.0.0** | 2025-12-13 | E0 baseline-v1, adaptive conversation, prescriptive extraction, event logging | `reasoning` `eval` | **A1**, A2 | Can we produce meaningful strategy from unstructured conversation? Can we measure quality? | Baseline established |

---

## Emerging Patterns

### Activity Mapping

| Code | Name | Primary Releases | Secondary |
|------|------|------------------|-----------|
| **A1** | LLM Judgement Engine | v1.0.0, v1.4.3, v1.7.0, v1.7.1 | v1.1.0, v1.4.0, v1.4.2 |
| **A2** | Evaluation & Observability | v1.1.0, v1.3.0, v1.4.2, v1.7.7 | v1.0.0 |
| **A3** | Data Architecture | v1.4.0, v1.4.4 | v1.7.1 |
| **A4** | Interaction Design | v1.2.0, v1.4.1, v1.5.0, v1.5.2, v1.6.0, v1.6.1, v1.7.2, v1.7.4 | v1.5.1, v1.7.0 |
| **A5** | Performance & Reliability | v1.2.2, v1.5.1, v1.7.3, v1.7.6 | - |

**Observations:**
- **A4 dominates recent work** (8 primary releases) - reflects the importance of interaction design as a research prerequisite
- **A1 and A2 cluster early** (v1.0-v1.4) - foundational work on judgement engine and measurement
- **A5 emerges later** (v1.5+) - performance issues only visible once core functionality existed
- **A3 concentrated** (v1.4.0, v1.4.4) - major architectural decisions made early, then stable

### Category Tally

| Category | Count | Notes |
|----------|-------|-------|
| `ux` | 12 | Interaction design work dominates |
| `reasoning` | 7 | Core LLM judgement work |
| `eval` / `obs` | 6 | Evaluation and observability |
| `infra` | 6 | Supporting infrastructure |
| `data` | 4 | Data architecture |
| `perf` | 4 | Performance & reliability |

### Key Insight

The category distribution shows **A4 (Interaction Design) is not "UX polish"** - it's the most active research area because user engagement directly gates whether the core A1 hypothesis can be tested at all.

---

## Questions to Consider

As you review each release:

1. **What problem was this solving?** (Not what shipped, but *why*)
2. **Was there genuine uncertainty?** (Or was it known solution to known problem?)
3. **Did this enable other R&D?** (Supporting activity)
4. **Did this directly test a hypothesis?** (Core activity)
5. **Would this have been built anyway for a non-R&D product?** (Potentially not eligible)

---

## Status

**Completed 2026-02-03:**
- ✅ All 22 releases mapped to activities (A1-A5)
- ✅ Categories tallied
- ✅ Activity definitions revised (see `activities/A1-A5*.md`)
- ✅ Executive summary updated (see `executive-summary-v2.md`)

**This document informs:**
- Activity definitions and expenditure allocation
- Evidence that each activity has substantive work
- Narrative that CHANGELOG is primary evidence (not one-pagers)
