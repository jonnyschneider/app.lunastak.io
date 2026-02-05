# Activity A1: LLM-based Judgement Engine

**Activity Code:** A1
**Type:** Core R&D Activity
**Period:** December 2025 - Ongoing

---

## Unknown Outcome

Whether an LLM-based system can consistently extract and structure strategic signals from free-form conversations and generate recommendations that match or exceed expert consultant judgement across defined scenarios.

**Specific unknowns:**
1. Can LLMs identify strategically significant themes from unstructured dialogue?
2. Does emergent extraction (letting themes emerge naturally) outperform prescriptive extraction (pre-defined fields)?
3. What level of dimensional coverage can be achieved from natural conversation without explicit guidance?
4. Is there a trade-off between coverage completeness and output authenticity?

---

## Why Existing Knowledge is Insufficient

1. **No established methodology:** Prior LLM applications focus on factual tasks (summarisation, Q&A), not qualitative expert judgement in strategy domains.

2. **Domain complexity:** Strategy consulting requires synthesis of ambiguous signals into coherent recommendations—fundamentally different from information retrieval or content generation.

3. **Quality is subjective:** "Good strategy" cannot be objectively measured using existing metrics; it requires expert benchmarking and iterative calibration.

4. **Trade-offs unknown:** The relationship between extraction approach, dimensional coverage, and output quality has not been studied in the literature.

---

## Systematic Experiments Conducted

| Experiment | Hypothesis | Approach | Outcome |
|------------|------------|----------|---------|
| **E0: Baseline-v1** | Adaptive conversation (3-10 questions) with prescriptive extraction can generate expert-quality outputs | Established measurement infrastructure, quality ratings, event tracking | ✅ Baseline established; identified "wooden output" as primary issue |
| **E1: Emergent Extraction** | Freeform extraction produces less wooden outputs than prescriptive schema | A/B test via Statsig; extract 3-7 emergent themes vs fixed fields | ✅ Pass - Richer, more contextual outputs |
| **E2: Dimensional Coverage** | Post-hoc dimensional analysis can validate coverage without degrading theme quality | Map emergent themes to 11 strategic dimensions after extraction | ✅ Pass - ~75% coverage from natural conversation |
| **E3: Dimension-Guided** | Guiding questions toward dimensions achieves higher coverage; trade-off with quality unknown | Parallel A/B with E2; compare guided vs emergent questioning | 🟡 In progress |

---

## New Knowledge Generated

### Validated Findings

1. **Emergent extraction outperforms prescriptive:** Letting themes emerge naturally from conversation produces richer, more contextual strategic insights than forcing extraction into pre-defined fields.

2. **~75% dimensional coverage achievable organically:** Natural strategic conversation covers approximately 75% of the 11 Tier 1 strategic dimensions without any explicit guidance—higher than expected.

3. **Post-hoc analysis preserves quality:** Dimensional mapping can be separated from extraction (applied after) without contaminating theme quality.

4. **Fragment-based architecture enables accumulation:** Breaking strategic insight into discrete fragments allows knowledge to accumulate across multiple sessions.

### Pending Validation

- The coverage/quality trade-off curve (E3)
- Whether multi-session accumulation improves output quality (E5, planned)
- Optimal question depth before quality plateaus (E10, planned)

---

## Evidence References

| Evidence Type | Location | Description |
|---------------|----------|-------------|
| Experiment Register | `docs/experiments/EXPERIMENT_REGISTER.md` | Hypothesis and outcome tracking |
| E0 One-Pager | `docs/experiments/one-pagers/E0-baseline-v1.md` | Baseline experiment design |
| E1 One-Pager | `docs/experiments/one-pagers/E1-emergent-extraction.md` | Emergent extraction experiment |
| E2 One-Pager | `docs/experiments/one-pagers/E2-dimensional-coverage.md` | Dimensional coverage validation |
| E3 One-Pager | `docs/experiments/one-pagers/E3-dimension-guided.md` | Dimension-guided questioning |
| CHANGELOG | `/CHANGELOG.md` | v1.0.0-v1.7.4 implementation history |
| Git Repository | 462 commits | Timestamped code evolution |
| Design Documents | `docs/plans/*.md` | 30+ design rationale docs |

---

## Expenditure Allocation

Estimated **60%** of total R&D time allocated to A1 activities:
- Extraction logic development
- Generation prompt engineering
- Dimensional taxonomy design
- Fragment architecture implementation
- Multi-session knowledge accumulation


**[REVIEW]** This feels pretty thin to me. Limited to just what's captured in one pagers, and treats the learning as "done and dusted". In some ways maybe that's true. I've dogfooded it, and it's immediately obvious where the challenges are. Hence fast focus that followed, on ironing out the UX wrinkles. Same for API approaches. I expect these learnings will be ongoing, perhaps right through the project. What do we do with that? Is there any requirement in the R&D guidelines that suggest you should/must actually solve these questions? Or, is it enough to identify them, and produce learning against the research qustions in a way that has some direction and momentum? I suspect it's the latter. Confirm. 

This sectino will become stronger once we've done a pass on narrative, and deconstructed the changelog into a component view of different 'activity' candidates. 

---

## Relationship to Other Activities

- **A2 (Evaluation Framework):** A1 generates outputs; A2 measures their quality
- **A3 (Experimentation Infrastructure):** A3 provides the tooling to run A1 experiments systematically
