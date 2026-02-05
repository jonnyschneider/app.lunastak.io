# Lunastak R&D Tax Incentive Summary

**Entity:** Humventures Pty Ltd
**ABN:** [ABN]
**Financial Year:** FY24-25
**Prepared:** February 2026

---

## The Project

**Lunastak** is an AI-powered strategic planning tool that aims to replace human strategy consultants by extracting strategic insight from unstructured conversations and generating expert-quality recommendations.

---

## The Core Uncertainty

> Can Large Language Models generate strategic advice that matches or exceeds expert human consultant judgement?

This question cannot be answered by applying existing knowledge. It requires systematic experimentation because:

1. **No prior methodology exists** for evaluating LLM strategic output quality against expert judgement
2. **"Good strategy" is subjective** and domain-specific—no objective metrics exist
3. **Trade-offs between approaches are unknown**—extraction methods, dimensional coverage, and output quality relationships are unexplored
4. **LLM self-evaluation is unproven** in strategy domains (LLM-as-judge)
5. **User interaction patterns are novel**—digital elicitation of strategic thinking has no established patterns

---

## The R&D Approach

**Five core activities addressing distinct technical uncertainties:**

| Code | Activity | Technical Uncertainty |
|------|----------|----------------------|
| A1 | LLM Judgement Engine | Can LLMs extract strategic signals and generate expert-quality recommendations? |
| A2 | Evaluation & Observability | How do we reliably measure strategic output quality? |
| A3 | Data Architecture | Can knowledge accumulate across sessions while maintaining coherence? |
| A4 | Interaction Design | Can users provide sufficient quality input through digital interaction? |
| A5 | Performance & Reliability | Can acceptable response times be achieved without degrading quality? |

**Why five activities?** The original conception (A1-A3) proved insufficient as development revealed that:
- A4 (Interaction Design) directly gates whether A1 can be tested—if users can't engage, the core hypothesis is untestable
- A5 (Performance) affects whether users complete sessions—slow responses cause abandonment before data is collected
- These are not "nice to have" UX polish—they are research prerequisites

---

## Systematic Experimentation

| Experiment | Question | Approach | Status |
|------------|----------|----------|--------|
| E0: Baseline | Can we measure strategic output quality? | Adaptive conversation, prescriptive extraction, quality ratings | ✅ Infrastructure validated |
| E1: Emergent Extraction | Does freeform extraction beat prescriptive fields? | A/B test via Statsig; emergent themes vs fixed fields | ✅ Pass - richer outputs |
| E2: Dimensional Coverage | What coverage do we achieve without guidance? | Post-hoc mapping of themes to 11 strategic dimensions | ✅ ~75% baseline |
| E3: Dimension-Guided | Does guiding questions improve coverage? Trade-off with quality? | Parallel A/B with E2; compare guided vs emergent | 🟡 In progress |
| E6-E10 | LLM-as-judge, optimal depth, multi-session accumulation | Planned | ⚪ Planned |

**Experimentation infrastructure evolution:**
1. **Phase 1** (Dec 2025): Statsig A/B testing + binary ratings
2. **Phase 2** (Jan 2026): Jupyter notebooks for coverage analysis
3. **Phase 3** (Feb 2026): Custom eval UI for deep trace comparison, versioned API backtesting

Each phase addressed limitations discovered in the previous—demonstrating systematic iteration on methods.

---

## New Knowledge Generated

### Validated Findings

1. **Emergent extraction outperforms prescriptive:** Letting themes emerge naturally produces richer, more contextual strategic insights than forcing extraction into pre-defined fields.

2. **~75% dimensional coverage achievable organically:** Natural strategic conversation covers ~75% of strategic dimensions without explicit guidance—higher than expected.

3. **Fragment-based architecture enables accumulation:** Breaking strategic insight into discrete fragments allows knowledge to accumulate across sessions.

4. **Progressive disclosure reduces overwhelm:** Hiding complexity behind expandable sections increases engagement depth.

5. **Background processing preserves UX:** Users accept "generating..." indicators if they can continue working.

### Pending Validation

- Coverage/quality trade-off curve (E3)
- LLM-as-judge reliability vs human experts (E6)
- Multi-session accumulation impact on quality (E5)
- Optimal question depth before diminishing returns (E10)

---

## The Evidence

| Type | Quantity | Location |
|------|----------|----------|
| Git commits | 460+ | Private GitHub repository |
| Version releases | 20 (v1.0.0 → v1.7.7) | CHANGELOG.md |
| Experiment one-pagers | 4 (E0-E3) | docs/experiments/one-pagers/ |
| Design documents | 30+ | docs/plans/ |
| Decision records | 15+ | docs/R&D-LOG.md |
| Activity descriptions | 5 (A1-A5) | docs/r-and-d/activities/ |
| Timesheets | Weekly | Toggl |

All evidence is **contemporaneous** (created during R&D, not reconstructed).

**Key evidence characteristics:**
- Git repository with detailed commit messages documenting technical decisions
- CHANGELOG as timestamped record of what shipped and why
- R&D-LOG capturing uncertainty framing and pivot rationale
- Statsig experiment configuration and event logging

---

## Estimated Eligible Expenditure

| Category | Amount | Basis |
|----------|--------|-------|
| Director salary (40% R&D) | $72,000 | Toggl timesheets, git activity |
| Superannuation | $8,280 | 11.5% of salary allocation |
| Cloud/API costs | $8,000 | Vercel, Anthropic, Statsig invoices |
| **Total eligible** | **$88,000** | |

*Note: Amounts to be confirmed against actuals from Toggl and invoices.*

---

## Expected Benefit

| Calculation | Amount |
|-------------|--------|
| Eligible R&D expenditure | $88,000 |
| Refundable offset rate | 43.5% |
| **Expected refund** | **~$38,000** |

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `docs/r-and-d/activities/A1-*.md` | Activity descriptions (5 activities) |
| `docs/r-and-d/narrative/changelog-analysis.md` | Release-by-release R&D mapping |
| `docs/R&D-LOG.md` | Decision records with uncertainty framing |
| `docs/experiments/EXPERIMENT_REGISTER.md` | Experiment hypotheses and outcomes |
| `CHANGELOG.md` | Timestamped release history |

---

## Registration Timeline

| Milestone | Date |
|-----------|------|
| FY24-25 ends | 30 June 2025 |
| Registration deadline | 30 April 2026 |
| Tax return lodgement | With FY24-25 company return |

---

## Alignment with R&DTI Requirements

### Four "Ingredients" Satisfied

| Requirement | How Lunastak Satisfies |
|-------------|----------------------|
| **Experimental nature** | Systematic progression: hypothesis → A/B experiment → measurement → iteration. Each experiment (E0-E3) follows this pattern. |
| **Technical uncertainty** | Outcome cannot be known in advance: Can LLMs match expert strategic judgement? No existing methodology to determine this. |
| **New knowledge generation** | Novel: evaluation frameworks for strategic LLM output, fragment-based knowledge architecture, dimensional coverage metrics. |
| **Systematic approach** | Documented experiments with clear hypotheses, Statsig instrumentation, version-controlled iterations, decision records. |

### Software Sector Guidance Compliance

Per AusIndustry's software sector guidance and ML case studies:
- Technical uncertainty is about **capability**, not implementation
- Experiments involve **measurable hypotheses** with defined success criteria
- Failed approaches are documented as evidence of genuine experimentation
- Production code changes are tagged to specific R&D activities

---

## External References

- [ATO R&D Tax Incentive Overview](https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/incentives-and-concessions/research-and-development-tax-incentive-and-concessions/research-and-development-tax-incentive)
- [AusIndustry Software Sector Guidance](https://www.intellectlabs.com.au/blogdatabase/navigating-ausindustrys-software-sector-guidance-1)
- [ML Case Study (Swanson Reed)](https://www.swansonreed.com.au/ausindustry-software-sector-guidance-and-hypothetical-machine-learning-case-study-february-2025/)
- [PwC AI R&D Guidance](https://www.pwc.com.au/pwc-private/r-and-d-gov-incentives/tax-incentives/ais-two-key-r-and-d-tax-incentives-guidance.html)

---

## Contact

**Director:** Jonny
**Email:** [email]
**Accountant:** [accountant details]

---

*This summary is intended for R&D tax advisors and accountants. Full documentation is available in the project repository.*
