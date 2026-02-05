# Activity A2: Evaluation & Observability Infrastructure

**Activity Code:** A2
**Type:** Core R&D Activity
**Period:** December 2025 - Ongoing

---

## Unknown Outcome

Whether reliable methods can be developed to evaluate LLM-generated strategic recommendations, enabling systematic quality improvement through instrumentation, experimentation, and comparative analysis.

**Specific unknowns:**
1. What metrics meaningfully predict strategic output quality?
2. Can A/B testing infrastructure work reliably in serverless environments?
3. Does dimensional coverage correlate with perceived output quality?
4. Can LLM-as-judge match human expert evaluation consistency?
5. What tooling enables rapid hypothesis testing across extraction/generation approaches?

---

## Why Existing Knowledge is Insufficient

1. **No strategic quality benchmarks:** Existing LLM evaluation focuses on factual accuracy or task completion—not strategic quality or expert correspondence.

2. **Subjectivity challenge:** "Good strategy" is inherently subjective. Evaluation methods must account for legitimate disagreement.

3. **Observability gaps:** Standard analytics (page views, clicks) don't capture strategic output quality. Custom instrumentation is required.

4. **Rapid iteration needs:** Testing hypotheses about extraction/generation requires infrastructure to compare approaches systematically—not just ship and hope.

---

## Systematic Work Conducted

### 1. A/B Testing Infrastructure - Statsig (v1.1.0, v1.4.2)

**Challenge:** Compare extraction approaches (emergent vs. prescriptive) with statistical rigour

**Solutions developed:**
- Statsig SDK integration for feature flags and experiments
- Migration from feature gates to proper experiments (variant assignment)
- Custom event logging: `dimensional_coverage`, `quality_rating`, `strategy_generated`
- Variant tagging on all conversations for retrospective analysis
- Environment-aware configuration (production/preview/development)

**Evidence:** v1.1.0, v1.4.2 CHANGELOG; `src/lib/statsig.ts`

### 2. Coverage Analysis Tooling (v1.3.0)

**Challenge:** Measure whether emergent extraction covers required strategic dimensions

**Solutions developed:**
- Python analysis functions (`scripts/dimensional_coverage_analysis.py`)
- Jupyter notebooks for interactive exploration
- Backfill script for historical trace analysis
- Automated coverage percentage calculation

**Outcome:** Established ~75% baseline coverage from natural conversation

**Evidence:** v1.3.0 CHANGELOG; `notebooks/dimensional_coverage_analysis.ipynb`

### 3. Quality Rating System (v1.0.0)

**Challenge:** Establish baseline quality distribution for A/B comparisons

**Implementation:**
- Binary good/bad assessment by researcher (separate from user feedback)
- User helpful/not_helpful feedback loop
- Rating events logged to Statsig

**Learning:** Binary ratings provide sufficient signal for detecting meaningful differences, but more nuanced evaluation needed for optimisation.

**Evidence:** v1.0.0 CHANGELOG; quality rating API

### 4. Custom Eval UI (v1.7.7)

**Challenge:** Jupyter notebooks and Statsig dashboards insufficient for deep trace comparison

**Solutions developed:**
- Admin eval interface for side-by-side trace comparison
- Pipeline metadata display (pipelineVersion, promptVersions, experimentVariant)
- Full objective details (metrics, targets, explanations, success criteria)
- Tag persistence and notes for evaluation workflow
- Flat file storage for eval definitions and traces

**Evidence:** v1.7.7 CHANGELOG; `src/app/admin/eval/`

### 5. Versioned Pipeline & Backtesting (v1.7.7)

**Challenge:** Compare current API behaviour against historical approaches

**Solutions developed:**
- Archived v1 pipeline modules for baseline comparison
- Trace export format capturing full pipeline state
- Fixture naming convention for test data management
- Versioned API runner for reproducible comparisons

**Evidence:** v1.7.7 CHANGELOG; `scripts/run-pipeline.ts`; `evals/traces/`

### 6. ExtractionRun Tracking (v1.4.0)

**Challenge:** Understand what inputs produce quality outputs

**Implementation:**
- Capture synthesis state before/after generation
- Link extraction runs to generated outputs
- Enable retrospective analysis of input→output relationships

**Evidence:** v1.4.0 CHANGELOG; `src/lib/extraction-runs.ts`

---

## New Knowledge Generated

### Validated Findings

1. **Binary ratings work for detection:** Simple good/bad quality ratings provide sufficient signal to detect meaningful differences between approaches.

2. **Coverage is automatically measurable:** Dimensional coverage can be reliably calculated through post-hoc LLM analysis.

3. **~75% baseline established:** Emergent extraction achieves ~75% dimensional coverage, providing a benchmark for improvement.

4. **Custom tooling required:** Generic analytics platforms (Statsig, Jupyter) provide foundation but domain-specific eval UI needed for deep analysis.

5. **Traces enable backtesting:** Capturing full pipeline state allows comparison across code versions without re-running user conversations.

### Pending Validation

- Whether coverage improvements correlate with quality improvements
- LLM-as-judge reliability vs human experts
- Predictive metrics for actionability
- Optimal evaluation granularity (output-level vs. component-level)

---

## Evidence References

| Evidence Type | Location | Description |
|---------------|----------|-------------|
| Statsig Implementation | v1.1.0, v1.4.2 CHANGELOG | A/B testing infrastructure |
| Coverage Analysis | v1.3.0 CHANGELOG | Python/Jupyter tooling |
| Eval UI | v1.7.7 CHANGELOG | Custom comparison interface |
| Versioned Pipeline | `scripts/run-pipeline.ts` | Backtesting infrastructure |
| Trace Storage | `evals/traces/` | Exported trace files |
| Dimensional Analysis | `src/lib/dimensional-analysis.ts` | Coverage calculation |

---

## Expenditure Allocation

Estimated **20%** of total R&D time allocated to A2 activities:
- Statsig SDK integration and experiment configuration
- Coverage analysis tooling (Python, Jupyter)
- Custom eval UI development
- Trace export and versioned pipeline
- Quality rating system implementation
- Metrics correlation analysis

---

## Relationship to Other Activities

- **A1 (Judgement Engine):** A2 measures the quality of A1 outputs
- **A3 (Data Architecture):** A2 relies on A3's trace/fragment structures for analysis
- **A4 (Interaction Design):** A2 instruments A4 decisions to measure their impact
- **A5 (Performance):** A2 detects performance issues through monitoring

---

## Evolution of Approach

The evaluation approach evolved significantly:

1. **Phase 1 (Dec 2025):** Statsig for A/B testing + binary ratings
2. **Phase 2 (Jan 2026):** Jupyter notebooks for coverage analysis
3. **Phase 3 (Feb 2026):** Custom eval UI for deep trace comparison

Each phase addressed limitations of the previous. Statsig provided experiment infrastructure but poor visibility into outputs. Jupyter enabled analysis but poor workflow. Custom UI provides the domain-specific tooling needed for rapid hypothesis testing.

This evolution itself demonstrates systematic R&D: iterating on methods as limitations are discovered.
