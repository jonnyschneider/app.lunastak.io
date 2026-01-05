# Experiment Register

**Purpose:** Track all experiments systematically to improve strategy generation quality.

**Status Key:**
- 🟢 Complete
- 🟡 In Progress / Awaiting Evals
- ⚪ Planned
- 🔴 Failed / Abandoned

---

| ID | Variant | Hypothesis | Status | Participants | Key Metrics | Outcome | One-Pager |
|---|---|---|---|---|---|---|---|
| **E0** | `baseline-v1` c018f2c | Establishes normalized control for all future experiments | 🟢 Complete | Dogfooding | Event logging, quality ratings, user feedback | ✅ Pass - Infrastructure ready | [View](./one-pagers/E0-baseline-v1.md) |
| **E1** | `emergent-extraction-e1a` | Loosened extraction (emergent themes vs rigid 3-fields) produces less "wooden" outputs | 🟢 Complete | Dogfooding | Quality rating (good/bad %), user feedback (helpful %), theme richness | ✅ Pass - Dogfooding validated approach | [View](./one-pagers/E1-emergent-extraction.md) |
| **E2** | `emergent-extraction-e1a` | Emergent questioning with post-hoc dimensional coverage tracking validates natural theme coverage (~75%) | 🟢 Complete | Dogfooding | Coverage % per dimension, gap patterns, mapping accuracy | ✅ Pass - ~75% coverage emergently; ready for comparison | [View](./one-pagers/E2-dimensional-coverage.md) |
| **E3** | `dimension-guided-e3` | Dimension-guided questioning achieves higher coverage than emergent, but trade-off with quality/authenticity is unknown | 🟡 In Progress | Alpha cohort | Coverage %, quality ratings, authenticity assessment | TBD | [View](./one-pagers/E3-dimension-guided.md) |
| **E4** | `real-time-coverage-display` | Showing dimensional coverage during conversation increases user trust and engagement | ⚪ Future | Target: 10-15 | User engagement, trust ratings, completion rates | TBD | TBD |
| **E5** | `multi-session-accumulation` | Accumulating strategic context across sessions produces richer outputs over time | ⚪ Future | Target: 5-10 multi-session users | Coverage growth over sessions, output quality improvement | TBD | TBD |
| **E6** | `llm-as-judge-training` | LLM-as-judge can assess dimensional coverage and tagging accuracy with expert-level consistency | ⚪ Future | Retrospective analysis | Agreement with expert ratings, false positive/negative rates | TBD | TBD |
| **E7** | `sub-dimension-emergence` | Patterns within dimensional themes can be clustered into coherent sub-dimensions post-hoc | ⚪ Future | Retrospective analysis | Sub-dimension stability, coverage granularity improvement | TBD | TBD |
| **E8** | `energetic-prompts` | Energetic generation prompts will reduce generic corporate speak | ⚪ Planned | Target: 10-15 | Quality rating (good/bad %), specificity assessment | TBD | TBD |
| **E9** | `lens-inference` | Inferring strategic focus from conversation beats explicit selection | ⚪ Planned | Target: 10-15 | Dimensional coverage, quality ratings | TBD | TBD |
| **E10** | `optimal-depth` | There's an optimal question count where quality plateaus | ⚪ Planned | Controlled tests | Quality vs. question count curve | TBD | TBD |

---

## Experiment Priority

**Foundation (Complete):**
1. ✅ E0 (baseline-v1) - Infrastructure baseline
2. ✅ E1 (emergent extraction) - Loosened extraction, validated via dogfooding
3. ✅ E2 (dimensional coverage) - Post-hoc coverage tracking, ~75% emergent coverage

**Current (Alpha Testing):**
4. 🟡 E2 + E3 running in parallel behind feature flags
   - E2: Emergent questioning (control) - `emergent-extraction-e1a`
   - E3: Dimension-guided questioning (variant) - `dimension-guided-e3`

**Near-term Planned:**
5. E8 (energetic prompts) - Reduce corporate speak in outputs
6. E9 (lens inference) - Improve conversation flow
7. E10 (optimal depth) - Optimize conversation length

**Future Research (Dimensional Taxonomy Evolution):**
- E4 (real-time coverage display) - Increase user transparency
- E5 (multi-session accumulation) - Support evolving strategic context
- E6 (LLM-as-judge training) - Automate quality assessment
- E7 (sub-dimension emergence) - Discover sub-dimensional patterns

**Note:** E3-E7 originated from the strategic taxonomy design session (see `docs/plans/strategic/2026-01-03-taxonomy-design-session.md`). These experiments build on dimensional coverage tracking to evolve the taxonomy framework.

---

## Decision Framework

**For each experiment:**
1. Run planned participant sessions
2. Collect quantitative metrics (quality ratings, user feedback)
3. Conduct qualitative analysis (review outputs, code patterns)
4. Compare against baseline-v1
5. Decide: Pass → Merge to main | Fail → Document learnings

**Pass criteria:**
- Higher % of "good" quality ratings than baseline-v1
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

---

## Related Documentation

- **Session Notes:** `docs/session-notes/` - Implementation details
- **Journal:** `docs/journal/2025-12-12-extraction-generation-learnings.md` - Research synthesis
- **Quality Criteria:** `docs/archive/framework-reference/QUALITY_CRITERIA.md` - What "good" looks like
- **Analysis Tools:** `notebooks/trace_analysis_starter.ipynb` - Data analysis

---

## Experiment Lineage

**Taxonomy-Driven Experiments:**
- E2 → E3 → E4 → E5 → E6 → E7
- These experiments evolved from the strategic taxonomy design session
- Build progressively on dimensional coverage infrastructure
- Cross-reference: `docs/plans/strategic/2026-01-03-taxonomy-design-session.md`

**Generation Quality Experiments:**
- E8 (energetic prompts)
- E9 (lens inference)
- E10 (optimal depth)

---

**Last Updated:** 2026-01-03
