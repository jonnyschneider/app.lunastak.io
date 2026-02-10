# 10. Area of Focus: LLM-based Judgement Engine

  ---------------------------------------------------------------------------
  **Activity Code**   A1
  ------------------- -------------------------------------------------------
  **Type**            Core R&D Activity

  **Period**          December 2025 - Ongoing
  ---------------------------------------------------------------------------

## Unknown Outcome

Whether an LLM-based system can consistently extract and structure strategic signals from free-form conversations and generate recommendations that match or exceed expert consultant judgement across defined scenarios.

**\
Specific unknowns:**

+-------------------------------------------------------------------------------------------------------------------------+
| > *Can LLMs identify strategically significant themes from unstructured dialogue?*                                      |
+-------------------------------------------------------------------------------------------------------------------------+
| > *Does emergent extraction (letting themes emerge naturally) outperform prescriptive extraction (pre-defined fields)?* |
+-------------------------------------------------------------------------------------------------------------------------+
| > *What level of dimensional coverage can be achieved from natural conversation without explicit guidance?*             |
+-------------------------------------------------------------------------------------------------------------------------+
| > *Is there a trade-off between coverage completeness and output authenticity?*                                         |
+=========================================================================================================================+

## Why Existing Knowledge is Insufficient

1.  **No established methodology:** Prior LLM applications focus on factual tasks (summarisation, Q&A), not qualitative expert judgement in strategy domains.

2.  **Domain complexity:** Strategy consulting requires synthesis of ambiguous signals into coherent recommendations---fundamentally different from information retrieval or content generation.

3.  **Quality is subjective:** \"Good strategy\" cannot be objectively measured using existing metrics; it requires expert benchmarking and iterative calibration.

4.  **Trade-offs unknown:** The relationship between extraction approach, dimensional coverage, and output quality has not been studied in the literature.

## Systematic Experiments Conducted

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Experiment**                 **Hypothesis**                                                                           **Approach**                                                              **Outcome**
  ------------------------------ ---------------------------------------------------------------------------------------- ------------------------------------------------------------------------- --------------------------
  **E0: Baseline-v1**            Adaptive conversation with prescriptive extraction can generate expert-quality outputs   Established measurement infrastructure, quality ratings, event tracking   ✅ Baseline established

  **E1: Emergent Extraction**    Freeform extraction produces less wooden outputs than prescriptive schema                A/B test via Statsig; extract 3-7 emergent themes vs fixed fields         ✅ Pass - Richer outputs

  **E2: Dimensional Coverage**   Post-hoc dimensional analysis can validate coverage without degrading theme quality      Map emergent themes to 11 strategic dimensions after extraction           ✅ Pass - \~75% coverage

  **E3: Dimension-Guided**       Guiding questions toward dimensions achieves higher coverage                             Parallel A/B with E2; compare guided vs emergent questioning              🟡 In progress
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Prompt Engineering Iterations

### OKR-Style Objectives (v3 prompt, 2026-02-10)

**Challenge:** Generated objectives were SMART but lacked hypothesis-driven structure. Users couldn't see the underlying assumptions or how to validate success.

**Approach:** Redesigned prompt to generate OKR-style objectives with explicit Key Results. Each KR follows: "We believe [action] will result in [outcome], and we'll know it's working when [signal] moves from [baseline] to [target] within [timeframe]."

**Status:** Deployed. Pending validation on whether structured KRs improve actionability.

**Evidence:** `src/lib/prompts/generation/v3-okr-objectives.ts`

## New Knowledge Generated

### Validated Findings

1.  **Emergent extraction outperforms prescriptive:** Letting themes emerge naturally from conversation produces richer, more contextual strategic insights than forcing extraction into pre-defined fields.

2.  **\~75% dimensional coverage achievable organically:** Natural strategic conversation covers approximately 75% of the 11 Tier 1 strategic dimensions without any explicit guidance---higher than expected.

3.  **Post-hoc analysis preserves quality:** Dimensional mapping can be separated from extraction (applied after) without contaminating theme quality.

4.  **Fragment-based architecture enables accumulation:** Breaking strategic insight into discrete fragments allows knowledge to accumulate across multiple sessions.

### Pending Validation

- The coverage/quality trade-off curve (E3)

- Whether multi-session accumulation improves output quality (E5, planned)

- Optimal question depth before quality plateaus (E10, planned)

## Evidence References

  ------------------------------------------------------------------------------------------------------
  **Evidence Type**     **Location**                              **Description**
  --------------------- ----------------------------------------- --------------------------------------
  Experiment Register   docs/experiments/EXPERIMENT_REGISTER.md   Hypothesis and outcome tracking

  E0-E3 One-Pagers      docs/experiments/one-pagers/              Experiment design documents

  CHANGELOG             /CHANGELOG.md                             v1.0.0-v1.7.4 implementation history

  Git Repository        462 commits                               Timestamped code evolution

  Design Documents      docs/plans/\*.md                          30+ design rationale docs
  ------------------------------------------------------------------------------------------------------

## Expenditure Allocation

Estimated **60%** of total R&D time allocated to A1 activities: extraction logic development, generation prompt engineering, dimensional taxonomy design, fragment architecture implementation, multi-session knowledge accumulation.

## Relationship to Other Activities

- **A2 (Evaluation Framework):** A1 generates outputs; A2 measures their quality

- **A3 (Data Architecture):** A3 provides the data structures A1 operates on
