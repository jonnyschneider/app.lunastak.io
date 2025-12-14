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
| **E0** | `baseline-v1` | Establishes normalized control for all future experiments | 🟢 Complete | TBD | Event logging, quality ratings, user feedback | ✅ Pass - Infrastructure ready | [View](./one-pagers/E0-baseline-v1.md) |
| **E1** | `emergent-extraction` | Emergent theme extraction will produce less "wooden" outputs than prescriptive fields | ⚪ Planned | Target: 10-15 | Quality rating (good/bad %), user feedback (helpful %) | TBD | [View](./one-pagers/E1-emergent-extraction.md) |
| **E2** | `energetic-prompts` | Energetic generation prompts will reduce generic corporate speak | ⚪ Planned | Target: 10-15 | Quality rating (good/bad %), specificity assessment | TBD | [View](./one-pagers/E2-energetic-prompts.md) |
| **E3** | `lens-inference` | Inferring strategic focus from conversation beats explicit selection | ⚪ Planned | Target: 10-15 | Dimensional coverage, quality ratings | TBD | [View](./one-pagers/E3-lens-inference.md) |
| **E4** | `dimensional-coverage` | Emergent extraction still captures all strategic dimensions needed | ⚪ Planned | Retrospective analysis | Coverage %, gaps analysis | TBD | TBD |
| **E5** | `optimal-depth` | There's an optimal question count where quality plateaus | ⚪ Planned | Controlled tests | Quality vs. question count curve | TBD | TBD |

---

## Experiment Priority

**Critical Path:**
1. E0 (baseline-v1) - ✅ Complete
2. E1 (emergent extraction) - Next
3. E2 (energetic prompts) - After E1
4. E3 (lens inference) - After E1 or E2

**Supporting Research:**
- E4 (dimensional coverage) - Validates E1 doesn't miss critical dimensions
- E5 (optimal depth) - Informs UX decisions about conversation length

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

**Last Updated:** 2025-12-13
