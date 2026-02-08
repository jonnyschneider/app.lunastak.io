# 11. Area of Focus: Evaluation & Observability Infrastructure

  -----------------------------------------------------------------------
  **Activity Code**      A2
  ---------------------- ------------------------------------------------
  **Type**               Core R&D Activity

  **Period**             December 2025 - Ongoing
  -----------------------------------------------------------------------

## Unknown Outcome

Whether reliable methods can be developed to evaluate LLM-generated strategic recommendations, enabling systematic quality improvement through instrumentation, experimentation, and comparative analysis.

**Specific unknowns:**

+--------------------------------------------------------------------------------------------+
| > *What metrics meaningfully predict strategic output quality?*                            |
+--------------------------------------------------------------------------------------------+
| > *Can A/B testing infrastructure work reliably in serverless environments?*               |
+--------------------------------------------------------------------------------------------+
| > *Does dimensional coverage correlate with perceived output quality?*                     |
+--------------------------------------------------------------------------------------------+
| > *Can LLM-as-judge match human expert evaluation consistency?*                            |
+--------------------------------------------------------------------------------------------+
| > *What tooling enables rapid hypothesis testing across extraction/generation approaches?* |
+============================================================================================+

## Why Existing Knowledge is Insufficient

1.  **No strategic quality benchmarks:** Existing LLM evaluation focuses on factual accuracy or task completion---not strategic quality or expert correspondence.

2.  **Subjectivity challenge:** \"Good strategy\" is inherently subjective. Evaluation methods must account for legitimate disagreement.

3.  **Observability gaps:** Standard analytics (page views, clicks) don\'t capture strategic output quality. Custom instrumentation is required.

4.  **Rapid iteration needs:** Testing hypotheses about extraction/generation requires infrastructure to compare approaches systematically---not just ship and hope.

## Systematic Work Conducted

### 1. A/B Testing Infrastructure - Statsig (v1.1.0, v1.4.2)

**Challenge:** Compare extraction approaches (emergent vs. prescriptive) with statistical rigour

**Solutions developed:**

- Statsig SDK integration for feature flags and experiments

- Migration from feature gates to proper experiments (variant assignment)

- Custom event logging: dimensional_coverage, quality_rating, strategy_generated

- Variant tagging on all conversations for retrospective analysis

- Environment-aware configuration (production/preview/development)

### 2. Coverage Analysis Tooling (v1.3.0)

**Challenge:** Measure whether emergent extraction covers required strategic dimensions

**Outcome:** Established \~75% baseline coverage from natural conversation. Python analysis functions, Jupyter notebooks, backfill scripts, and automated coverage percentage calculation.

### 3. Custom Eval UI (v1.7.7)

**Challenge:** Jupyter notebooks and Statsig dashboards insufficient for deep trace comparison

**Solution:** Admin eval interface for side-by-side trace comparison, pipeline metadata display, full objective details, tag persistence and notes for evaluation workflow.

## New Knowledge Generated

1.  **Binary ratings work for detection:** Simple good/bad quality ratings provide sufficient signal to detect meaningful differences between approaches.

2.  **Coverage is automatically measurable:** Dimensional coverage can be reliably calculated through post-hoc LLM analysis.

3.  **\~75% baseline established:** Emergent extraction achieves \~75% dimensional coverage, providing a benchmark for improvement.

4.  **Custom tooling required:** Generic analytics platforms provide foundation but domain-specific eval UI needed for deep analysis.

5.  **Traces enable backtesting:** Capturing full pipeline state allows comparison across code versions without re-running user conversations.

## Expenditure Allocation

Estimated **20%** of total R&D time allocated to A2 activities.

## Evolution of Approach

The evaluation approach evolved significantly through three phases.

- **Phase 1 (Dec 2025)**: Statsig for A/B testing + binary ratings.

- **Phase 2 (Jan 2026)**: Jupyter notebooks for coverage analysis.

- **Phase 3 (Feb 2026)**: Custom eval UI for deep trace comparison. Each phase addressed limitations of the previous, demonstrating systematic R&D iteration on methods.
