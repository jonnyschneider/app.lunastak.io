# Activity A2: Evaluation Framework Development

**Activity Code:** A2
**Type:** Core R&D Activity
**Period:** December 2025 - Ongoing

---

## Unknown Outcome

Whether reliable evaluation methods can be developed to assess LLM-generated strategic recommendations against expert human judgement, enabling systematic quality improvement.

**Specific unknowns:**
1. Can output quality be reliably measured through binary good/bad ratings?
2. Does dimensional coverage correlate with perceived output quality?
3. Can LLM-as-judge match human expert evaluation consistency?
4. What metrics predict whether outputs will be actionable by teams?

**[Review]** #1 is/was true momentarily, but it certainly isn't a primary research question. More like one avenue of implementation, and it's not validated with any real data yet (only sim). #4 feels practically impossible to answer without more scale than we have. 2-3 are good. 

How much does the quality of these questions matter?

---

## Why Existing Knowledge is Insufficient

1. **No strategic quality benchmarks:** Existing LLM evaluation focuses on factual accuracy, fluency, or task completion—not strategic quality or expert correspondence.

2. **Subjectivity challenge:** "Good strategy" is inherently subjective; different experts may evaluate the same output differently based on context and experience.

3. **Multi-dimensional quality:** Strategic outputs must be evaluated on multiple axes (coherence, specificity, actionability, authenticity) with unknown weightings.

4. **LLM self-evaluation unproven:** Whether LLMs can reliably evaluate their own strategic outputs (LLM-as-judge) has not been demonstrated.

---

## Systematic Experiments Conducted

| Experiment | Hypothesis | Approach | Outcome |
|------------|------------|----------|---------|
| **E0: Quality Infrastructure** | Binary good/bad ratings can establish baseline quality distribution | Implement quality rating system; researcher assessment | ✅ Infrastructure validated |
| **E2: Coverage Metrics** | Dimensional coverage can be automatically calculated from emergent themes | Post-hoc Claude analysis mapping themes to dimensions | ✅ Automated coverage working |
| **E6: LLM-as-Judge** | LLM can assess dimensional coverage and tagging accuracy with expert-level consistency | Compare LLM ratings to human expert ratings | ⚪ Planned |

**[Review]** This is one of those examples where I'm not that happy with what's here. This is what was documented at a point in time, but there are far better bits of experiementation that have been implemened in the course of creative solution design (in code). We need to excavate it from Changelog and elaborate. 

---

## Evaluation Methods Developed

### 1. Quality Rating System

**Implementation:** Binary good/bad assessment by researcher (separate from user feedback)

**Purpose:** Establish baseline quality distribution for A/B comparisons

**Evidence:** `CHANGELOG.md` v1.0.0, quality rating events in Statsig

### 2. Dimensional Coverage Scoring

**Implementation:** Automated mapping of emergent themes to 11 Tier 1 strategic dimensions

**Metrics captured:**
- Coverage percentage (dimensions covered / 11)
- Gap identification (which dimensions systematically missed)
- Confidence distribution (high/medium/low per dimension)

**Evidence:** `src/lib/dimensional-analysis.ts`, E2 experiment

### 3. User Feedback Loop

**Implementation:** Helpful/not_helpful binary feedback from end users

**Purpose:** Validate researcher quality ratings against user perception

**Evidence:** Feedback API, Statsig events

### 4. ExtractionRun Tracking

**Implementation:** Capture synthesis state before/after generation for A/B analysis

**Purpose:** Enable retrospective analysis of what inputs produce quality outputs

**Evidence:** `src/lib/extraction-runs.ts`, Prisma schema

---

## New Knowledge Generated

### Validated Findings

1. **Binary ratings work:** Simple good/bad quality ratings provide sufficient signal to detect meaningful differences between extraction approaches.

2. **Coverage is measurable:** Dimensional coverage can be reliably calculated through post-hoc LLM analysis without contaminating extraction quality.

3. **~75% baseline established:** Emergent extraction achieves ~75% dimensional coverage, providing a benchmark for improvement experiments.

### Pending Validation

- Whether coverage improvements correlate with quality improvements (E3)
- LLM-as-judge reliability vs human experts (E6)
- Predictive metrics for actionability

---

## Evidence References

| Evidence Type | Location | Description |
|---------------|----------|-------------|
| Experiment Register | `docs/experiments/EXPERIMENT_REGISTER.md` | E0, E2, E6 entries |
| Dimensional Analysis | `src/lib/dimensional-analysis.ts` | Coverage calculation logic |
| Coverage Analysis Tools | `scripts/dimensional_coverage_analysis.py` | Python analysis functions |
| Contract Tests | `src/lib/__tests__/contracts/` | Validation test suites |
| Quality Criteria | `docs/archive/framework-reference/QUALITY_CRITERIA.md` | Quality definitions |

---

## Expenditure Allocation

Estimated **20%** of total R&D time allocated to A2 activities:
- Quality rating system implementation
- Dimensional coverage algorithm development
- Analysis tooling (Python scripts, Jupyter notebooks)
- Contract validation tests
- Metrics correlation analysis

**[Review]** Revisit this with actuals. After narrative adjustments and new `activity` inclusions. 

---

## Relationship to Other Activities

- **A1 (Judgement Engine):** A2 measures the quality of A1 outputs
- **A3 (Experimentation Infrastructure):** A2 provides the metrics that A3 experiments optimise for
