# R&D Application Plan

**Date:** 2026-02-02
**Purpose:** Plan the R&D Tax Incentive application process for FY24-25

---

## Executive Summary

Lunastak has extensive R&D evidence already captured through disciplined engineering practices. The challenge is not evidence collection—it's **assembly, integration, and narrative tightening**.

**Three phases:**
1. **Retroactive assembly** - Map existing 2-month development history to R&D activity definitions
2. **Forward workflow** - Integrate R&D context capture into ongoing development
3. **Narrative cohesion** - Distill verbose material into tight, audit-ready documentation

---

## Phase 1: Retroactive Evidence Assembly

### What Already Exists

| Evidence Type | Location | R&D Value |
|--------------|----------|-----------|
| Experiment Register | `docs/experiments/EXPERIMENT_REGISTER.md` | **High** - Explicit hypothesis/outcome tracking for E0-E10 |
| CHANGELOG | `/CHANGELOG.md` | **High** - 845 lines of versioned technical decisions |
| Design Docs | `docs/plans/*.md` | **High** - 30+ dated design documents with rationale |
| Session Notes | `docs/session-notes/*.md` | **Medium** - Implementation logs |
| Git History | 462 commits (Dec-Jan) | **High** - Timestamped code evolution |
| Journal/Synthesis | `docs/journal/*.md` | **High** - Post-implementation learnings |
| Architecture Docs | `docs/ARCHITECTURE.md`, `CLAUDE.md` | **Medium** - Technical context |

### Mapping Work Required

**Task 1.1: Create R&D Activity Definitions**

Map the work to AusIndustry's "core activity" structure:

| Activity | Description | Key Evidence |
|----------|-------------|--------------|
| **A1: LLM-based Judgement Engine** | Building systems to extract structured strategic insight from unstructured conversations | E0-E3 experiments, extraction contracts, dimensional analysis |
| **A2: Evaluation Framework Development** | Creating evals and metrics to test reliability against expert judgement | EXPERIMENT_REGISTER, quality rating system, ExtractionRun tracking |
| **A3: Systematic Experimentation Infrastructure** | Engineering tooling to conduct rigorous A/B experiments | Statsig integration, contract-driven quality, smoke tests |

**Task 1.2: Create Evidence Timeline**

Generate a chronological mapping:

```
docs/r-and-d/EVIDENCE_TIMELINE.md

## December 2025

### Week 1 (Dec 1-7)
- E0 baseline-v1 established [EXPERIMENT_REGISTER]
- v1.0.0 released [CHANGELOG]
- Commits: [list relevant commit hashes]

### Week 2 (Dec 8-14)
- E1a emergent extraction implemented [E1-emergent-extraction.md]
- v1.1.0 released [CHANGELOG]
- Technical uncertainty documented: "Do emergent themes produce less wooden outputs?"
...
```

**Task 1.3: Extract Technical Uncertainty Documentation**

Scan existing docs for statements of uncertainty. These are gold for R&D claims:

From EXPERIMENT_REGISTER:
- "E3: trade-off with quality/authenticity is unknown"
- "E6: LLM-as-judge can assess... with expert-level consistency"
- "E7: Patterns... can be clustered into coherent sub-dimensions"

From design docs:
- Search for "hypothesis", "unknown", "whether", "if", "might"

**Task 1.4: Timesheet Reconstruction**

Use git commit timestamps + Toggl (if available) to reconstruct R&D time allocation:

```bash
# Generate commit activity by week
git log --format='%ai' --since="2025-12-01" | cut -d' ' -f1 | uniq -c
```

Cross-reference with existing timesheet data from Toggl.

---

## Phase 2: Forward Workflow Integration

### Current State

The `r-and-d-brainstorm` skill exists but isn't integrated into daily workflow:
- Captures research purpose upfront
- Appends R&D context block to design docs
- Offers to update R&D-LOG.md

### Required Changes

**Task 2.1: Create R&D-LOG.md**

```markdown
# R&D Decision Log

## Decision Records

### 2026-02-02: R&D Application Planning

**Context:** Need to structure 2 months of development evidence for R&DTI claim

**Uncertainty:** Whether existing documentation practices capture sufficient audit-ready evidence

**Decision:** Create formal R&D evidence assembly process and integrate forward workflow

**Outcome:** TBD

**Refs:** docs/plans/2026-02-02-r-and-d-application-plan-design.md
```

**Task 2.2: Update CLAUDE.md with R&D Protocol**

Add to existing CLAUDE.md:

```markdown
## R&D Documentation Protocol

When starting significant work:
1. Use `/r-and-d-brainstorm` skill (or explicitly note research purpose)
2. Capture technical uncertainty in design doc
3. Link to relevant experiments in EXPERIMENT_REGISTER

After completing work:
1. Update EXPERIMENT_REGISTER if experiment-related
2. Add decision record to R&D-LOG.md
3. Ensure CHANGELOG captures the "why" not just "what"
```

**Task 2.3: Timesheet Integration**

Current: Toggl tracks time, but R&D/non-R&D tagging may be inconsistent.

Required:
- Tag Toggl entries with R&D activity codes (A1/A2/A3)
- Weekly summary export to `docs/r-and-d/timesheets/`
- Or: use git commit activity as proxy with documented methodology

---

## Phase 3: Narrative Cohesion

### The Problem

The R&D-Documentation folder contains two long Perplexity research documents (~1000 lines total):
- Comprehensive but verbose
- Q&A format rather than assertion format
- Not structured for submission

The Methodology document is good but generic (needs project-specific details filled in).

### Required Deliverables

**Task 3.1: Core R&D Activity Descriptions (for AusIndustry form)**

One page per activity, structured as:

```markdown
# Activity A1: LLM-based Judgement Engine

## Unknown Outcome
Whether an LLM-based system can consistently extract and structure strategic signals from free-form conversations and generate recommendations that match or exceed expert consultant judgement.

## Systematic Experiments Conducted
1. E0: Established baseline prescriptive extraction approach
2. E1a: Tested emergent theme extraction vs rigid field structure
3. E2: Validated dimensional coverage from emergent approach (~75%)
4. E3: Comparing dimension-guided vs emergent questioning (in progress)

## New Knowledge Generated
- Emergent extraction produces richer thematic content without sacrificing coverage
- Post-hoc dimensional mapping achieves ~75% coverage from natural conversation
- [Additional learnings from E3 when complete]

## Evidence References
- EXPERIMENT_REGISTER.md (hypothesis and outcome tracking)
- CHANGELOG v1.0.0-v1.7.4 (implementation history)
- Git repository: app.lunastak.io (462 commits Dec-Jan)
```

**Task 3.2: Tighten the Methodology Document**

Current: Generic template with placeholders
Required: Fill in specifics:
- Entity name
- Actual salary and allocation percentages
- Specific experiment IDs as supporting artefacts
- Actual file locations

**Task 3.3: Create Executive Summary**

One-page document for accountant/R&D advisor:

```markdown
# Lunastak R&D Tax Incentive Summary - FY24-25

## The Project
AI-powered strategic planning tool that replaces human strategy consultants

## The Uncertainty
Can LLMs generate expert-quality strategic advice from unstructured conversations?

## The Approach
Systematic A/B experimentation (10 registered experiments)
Contract-driven quality gates
Expert panel benchmarking

## The Evidence
- 462 commits (Dec-Jan)
- 30+ design documents
- 10 experiment one-pagers
- Continuous deployment (v1.0.0 → v1.7.4)
- Toggl timesheets

## Estimated Eligible Expenditure
- Director salary (40% R&D): ~$72k
- Cloud/tooling: ~$8k
- Total: ~$80k
- Expected refund (43.5%): ~$35k
```

---

## File Structure Proposal

```
docs/r-and-d/
├── README.md                           # Overview of R&D documentation
├── EVIDENCE_TIMELINE.md                # Chronological evidence mapping
├── R&D-LOG.md                          # Ongoing decision records
├── activities/
│   ├── A1-llm-judgement-engine.md      # Core activity description
│   ├── A2-evaluation-framework.md      # Core activity description
│   └── A3-experimentation-infrastructure.md
├── methodology/
│   └── time-cost-evidence.md           # Completed methodology doc
├── narrative/
│   ├── executive-summary.md            # One-pager for advisors
│   └── technical-uncertainty.md        # Compiled uncertainty statements
└── timesheets/
    └── YYYY-MM-weekly-summary.md       # Weekly time allocations
```

---

## Implementation Order

### Week 1: Foundation
1. [ ] Create `docs/r-and-d/` folder structure
2. [ ] Create R&D-LOG.md with this planning decision
3. [ ] Complete the Methodology document with project specifics
4. [ ] Add R&D protocol to CLAUDE.md

### Week 2: Retroactive Assembly
5. [ ] Generate EVIDENCE_TIMELINE.md from git history + CHANGELOG
6. [ ] Extract technical uncertainty statements from existing docs
7. [ ] Reconstruct timesheet allocation from available sources
8. [ ] Write Activity A1 description (LLM Judgement Engine)

### Week 3: Complete Activities
9. [ ] Write Activity A2 description (Evaluation Framework)
10. [ ] Write Activity A3 description (Experimentation Infrastructure)
11. [ ] Create Executive Summary

### Week 4: Review & Tighten
12. [ ] Review all narrative for cohesion and tightness
13. [ ] Cross-reference evidence to activities
14. [ ] Prepare package for accountant/R&D advisor review

---

## R&D Context

**Research purpose:** Experimentation infrastructure + Retroactive evidence assembly + Narrative cohesion

**Uncertainty being addressed:** Whether existing development documentation practices capture sufficient evidence for a defensible R&DTI claim, and how to structure ongoing work for continuous R&D capture.

**How this enables learning:** This meta-work establishes whether the hypothesis-driven, experiment-registered development approach generates audit-ready evidence as a byproduct, or whether additional ceremony is required.
