# R&D Documentation Audit Trail

**Date:** 2026-02-03
**Purpose:** Record of work done to prepare FY24-25 R&D Tax Incentive documentation

---

## Summary

Comprehensive R&D documentation package prepared across two sessions (2026-02-02 and 2026-02-03). Work included expanding from 3 activities to 5, mapping all 22 releases to activities, analyzing timesheets, and creating an executive summary aligned with AusIndustry requirements.

---

## Documents Created/Updated

### New Activity Definitions

| File | Description |
|------|-------------|
| `docs/r-and-d/activities/A4-interaction-design.md` | NEW - Cold start, input modalities, information architecture |
| `docs/r-and-d/activities/A5-performance-reliability.md` | NEW - Response times, serverless patterns, background processing |
| `docs/r-and-d/activities/A2-evaluation-observability.md` | REVISED - Expanded to include Statsig, eval UI, traces, backtesting |
| `docs/r-and-d/activities/A3-data-architecture.md` | REVISED - Narrowed to contracts, fragments, synthesis, multi-session |

### Preserved Originals (with review notes)

| File | Status |
|------|--------|
| `docs/r-and-d/activities/A1-llm-judgement-engine.md` | Unchanged, contains [REVIEW] notes |
| `docs/r-and-d/activities/A2-evaluation-framework.md` | Original preserved |
| `docs/r-and-d/activities/A3-experimentation-infrastructure.md` | Original preserved |

### Narrative Documents

| File | Description |
|------|-------------|
| `docs/r-and-d/narrative/executive-summary-v2.md` | NEW - 5-activity structure, R&DTI alignment section |
| `docs/r-and-d/narrative/executive-summary.md` | Original with [REVIEW] notes preserved |
| `docs/r-and-d/narrative/changelog-analysis.md` | UPDATED - All 22 releases mapped to activities, category tallies |

### Timesheet Data

| File | Description |
|------|-------------|
| `docs/r-and-d/timesheets/TogglTrack_Report_*.pdf` | Toggl export Nov 2025 - Jan 2026 |

---

## Activity Structure Evolution

### Original (A1-A3)
```
A1: LLM Judgement Engine (core reasoning)
A2: Evaluation Framework (metrics)
A3: Experimentation Infrastructure (all supporting work)
```

### Revised (A1-A5)
```
A1: LLM Judgement Engine (extraction, generation, prompts)
A2: Evaluation & Observability (metrics, Statsig, eval UI, traces)
A3: Data Architecture (contracts, fragments, schema, multi-session)
A4: Interaction Design (cold start, input modalities, IA)
A5: Performance & Reliability (response times, serverless, background)
```

**Rationale:** A3 was too broad. A4 and A5 represent genuine research prerequisites - if users can't engage (A4) or sessions timeout (A5), the core A1 hypothesis is untestable.

---

## Release-to-Activity Mapping

| Activity | Primary Releases | Count |
|----------|-----------------|-------|
| A1 | v1.0.0, v1.4.3, v1.7.0, v1.7.1 | 4 |
| A2 | v1.1.0, v1.3.0, v1.4.2, v1.7.7 | 4 |
| A3 | v1.4.0, v1.4.4 | 2 |
| A4 | v1.2.0, v1.4.1, v1.5.0-v1.6.1, v1.7.2, v1.7.4 | 8 |
| A5 | v1.2.2, v1.5.1, v1.7.3, v1.7.6 | 4 |

**Key finding:** A4 dominates recent work (8 releases). This isn't "UX polish" - it's active research into whether digital interaction can elicit strategic input at all.

---

## Timesheet Analysis

| Metric | Value |
|--------|-------|
| Period | Nov 1, 2025 - Jan 31, 2026 |
| Total tracked | 169h 52m |
| % of FTE (3 months) | 32.7% |
| Original estimate | 40% |
| Status | Under estimate (conservative, good for compliance) |

**Note:** January alone was ~109 hours (~63% FTE) - intensity ramping up. The 40% annual claim is defensible.

---

## Alignment with R&DTI Requirements

Executive summary v2 includes explicit mapping to the "four ingredients":

1. **Experimental nature** - Systematic progression: hypothesis → A/B experiment → measurement → iteration
2. **Technical uncertainty** - Outcome cannot be known in advance (can LLMs match expert judgement?)
3. **New knowledge generation** - Novel eval frameworks, fragment architecture, coverage metrics
4. **Systematic approach** - Documented experiments, Statsig instrumentation, decision records

Also includes references to AusIndustry software sector guidance and ML case studies.

---

## External References Used

Source documents from earlier research:
- `Australian R&D Tax Incentive and Innovation Grants.md` (Perplexity research)
- `R&D Time, Cost, and Evidence Methodology.md` (template)

Key external links incorporated:
- [ATO R&D Tax Incentive Overview](https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/incentives-and-concessions/research-and-development-tax-incentive-and-concessions/research-and-development-tax-incentive)
- [AusIndustry Software Sector Guidance](https://www.intellectlabs.com.au/blogdatabase/navigating-ausindustrys-software-sector-guidance-1)
- [Swanson Reed ML Case Study](https://www.swansonreed.com.au/ausindustry-software-sector-guidance-and-hypothetical-machine-learning-case-study-february-2025/)
- [PwC AI R&D Guidance](https://www.pwc.com.au/pwc-private/r-and-d-gov-incentives/tax-incentives/ais-two-key-r-and-d-tax-incentives-guidance.html)

---

## Remaining Tasks

| Task | Status |
|------|--------|
| Add R&D protocol to CLAUDE.md | Deferred |
| Assemble into single document for final review | Pending |
| Send to advisor for review | Pending |

---

## File Locations

All documentation in repo: `app.lunastak.io/docs/r-and-d/`

```
docs/r-and-d/
├── activities/
│   ├── A1-llm-judgement-engine.md
│   ├── A2-evaluation-framework.md (original)
│   ├── A2-evaluation-observability.md (revised)
│   ├── A3-experimentation-infrastructure.md (original)
│   ├── A3-data-architecture.md (revised)
│   ├── A4-interaction-design.md (new)
│   └── A5-performance-reliability.md (new)
├── narrative/
│   ├── executive-summary.md (original)
│   ├── executive-summary-v2.md (revised)
│   └── changelog-analysis.md
├── timesheets/
│   └── TogglTrack_Report_*.pdf
└── 2026-02-02-review-notes.md
```

---

## Session Notes

**2026-02-02:**
- Initial eval infrastructure work
- Released v1.7.7 (eval UI enhancements)
- Started R&D documentation review

**2026-02-03:**
- Expanded to 5 activities (A1-A5)
- Mapped all 22 releases to activities
- Created executive-summary-v2.md
- Analyzed Toggl timesheets (170h, 33% FTE)
- Filled emerging patterns in changelog-analysis.md

---

*This audit trail created 2026-02-03 to document the R&D documentation preparation process.*
