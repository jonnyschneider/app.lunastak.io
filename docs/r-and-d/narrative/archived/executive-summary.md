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

1. No prior methodology exists for evaluating LLM strategic output quality
2. "Good strategy" is subjective and domain-specific
3. The trade-offs between different extraction approaches are unknown
4. LLM self-evaluation (LLM-as-judge) is unproven in strategy domains

---

## The R&D Approach

**Three core activities:**

| Code | Activity | Focus |
|------|----------|-------|
| A1 | LLM Judgement Engine | Extraction and generation of strategic insight |
| A2 | Evaluation Framework | Metrics to measure quality against expert judgement |
| A3 | Experimentation Infrastructure | A/B testing, contracts, reliability |

**[REVIEW]** I think there are more activities than this. Revisit after narrative brainstorm. 2 Feb 2026.

**Systematic experimentation:**

| Experiment | Question | Status |
|------------|----------|--------|
| E0 | Can we measure strategic output quality? | ✅ Complete |
| E1 | Does emergent extraction beat prescriptive? | ✅ Pass |
| E2 | What dimensional coverage do we achieve? | ✅ ~75% |
| E3 | What's the coverage/quality trade-off? | 🟡 In progress |
| E6-E10 | LLM-as-judge, optimal depth, etc. | ⚪ Planned |

**[REVIEW]** E0: yes, but still ongoing. We started with the Statsig approach, implementing A/B variant testing. It's measurable... but quality isn't yet determined. As in, LLM is deciding what quality is, and we haven't completed evals on actual data yet (only simulated; generated). As of Feb, we now have the first traces that are eval-able. And there will be more comparisons as we continue to to tweak the extract and generate APIs. 

E01: I wouldn't call this a pass yet. Same as E0, we don't have compelling actual data yet. We did instrument the Statsig Experiment Metrics. 
1. Include a Summary (not in exec sum, but in full docs) of the Statsig implementation. 

E02: Again, feels thin. Dig a bit deeper into this. 

E03: Yes, still in progress, and this is the most active research question that drove the current custom EVAL infrastucture approach. 

---

## The Evidence

| Type | Quantity | Location |
|------|----------|----------|
| Git commits | 462 | Private GitHub repository |
| Version releases | 16 (v1.0.0 → v1.7.4) | CHANGELOG.md |
| Experiment one-pagers | 4 (E0-E3) | docs/experiments/one-pagers/ |
| Design documents | 30+ | docs/plans/ |
| Session notes | 8 | docs/session-notes/ |
| Timesheets | Weekly | Toggl |

All evidence is **contemporaneous** (created during R&D, not reconstructed).

**[REVIEW]** This is good, but I'm ultimately uncomfortable about Experiment Register and One pagers. A good idea at the time of creation, but went stale quickly. I think there's probably value in working backwards from the Changelog, and idenfitifying the purpose of each release. I feel like a good whack of these lately have been instrumentation, and testing infrastructure, to make sure that we have rigour. If not that, then innovating the experience, such that we can get enough engagement and real input from participants. The design and customer engagement problem is acutlaly a big one. 'The cold start'. If users can't bring themselves to interact (because the questions aren't relevant, the input methods aren't their preference, or for any other reason, then the foundation research question "can we generate quality strategic advice from an LLM" is disconfirmed. This adds significant weight to the importance of interaction design in the overall reasearch approach. **should this be a seperate research question**? I think there's enough to support it. E.g. how does text, voice and transcribe, doc upload, copy/paste all impact on quality?

---

## Estimated Eligible Expenditure

| Category | Amount | Basis |
|----------|--------|-------|
| Director salary (40% R&D) | $72,000 | Toggl timesheets, git activity |
| Superannuation | $8,280 | 11.5% of salary allocation |
| Cloud/API costs | $8,000 | Vercel, Anthropic, Statsig invoices |
| **Total eligible** | **$88,000** | |

**[REVIEW]** Summary works. Adjust amounts based on actuals later. 

---

## Expected Benefit

| Calculation | Amount |
|-------------|--------|
| Eligible R&D expenditure | $88,000 |
| Refundable offset rate | 43.5% |
| **Expected refund** | **$38,280** |

**[REVIEW]** To be quantified 

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `docs/r-and-d/EVIDENCE_TIMELINE.md` | Week-by-week evidence mapping |
| `docs/r-and-d/R&D-LOG.md` | Decision records with uncertainty framing |
| `docs/r-and-d/methodology/time-cost-evidence.md` | Time and cost allocation methodology |
| `docs/r-and-d/narrative/technical-uncertainty.md` | Compiled uncertainty statements |
| `docs/r-and-d/activities/A1-*.md` | Core activity descriptions |
| `docs/experiments/EXPERIMENT_REGISTER.md` | Experiment hypothesis and outcomes |

---

## Registration Timeline

| Milestone | Date |
|-----------|------|
| FY24-25 ends | 30 June 2025 |
| Registration deadline | 30 April 2026 |
| Tax return lodgement | With FY24-25 company return |

---

## Contact

**Director:** Jonny
**Email:** [email]
**Accountant:** [accountant details]

---

*This summary is intended for R&D tax advisors and accountants. Full documentation is available in the project repository.*
