# Experiment E0: Baseline-v1 (Control Variant)

**Status:** 🟢 Complete
**Variant ID:** `baseline-v1`
**Date:** 2025-12-13

---

## What We're Learning

Can we systematically measure whether strategy outputs are genuinely useful, or just technically coherent but "wooden"?

Before testing different approaches, we need a stable baseline that:
- Represents our current best effort
- Has comprehensive measurement in place
- Provides a fair comparison point for future improvements

---

## Why This Matters

**The Problem:**
Early testing revealed that generated strategies feel generic and lifeless—lacking the energy and specificity of real strategic thinking. We suspect the issue is how we extract and generate strategy, but we need to prove it.

**The Risk:**
Without a controlled baseline, we're just guessing. We might change something and *think* it's better, but have no way to prove it actually improved quality.

**The Value:**
A well-instrumented baseline lets us run parallel experiments and confidently say "This approach generates 40% more good strategies than before" instead of "We hope this is better."

---

## How We'll Achieve This

### Simplified User Experience
- Removed friction from conversation flow
- Honest about what we can generate (Vision, Mission, Objectives) and what we can't yet (Initiatives, Principles)
- Clear choices when opportunities for deeper exploration emerge

### Comprehensive Measurement
- **Event tracking** - Record which features users want, which educational content they view, what choices they make
- **Quality ratings** - Binary good/bad assessment by reviewers (separate from user feedback)
- **Variant tagging** - Every conversation labeled `baseline-v1` for comparison

### What Stays Constant
This baseline uses:
- Prescriptive extraction (industry, target market, unique value)
- Standard generation prompts
- 3-10 question adaptive conversation
- Single-session completion

Future experiments will change one of these at a time to measure impact.

---

## Expected Results

**Success means:**
- Infrastructure works (events log correctly, quality ratings captured)
- We get a stable quality distribution (X% good, Y% bad)
- Measurement is reliable enough to detect meaningful differences

**Failure would mean:**
- Can't measure quality reliably
- Too few conversations to establish baseline
- Instrumentation broken or incomplete

**Current Status:** ✅ Infrastructure complete and verified through UAT

---

## What This Tells Us Next

### If Baseline Shows Consistent Quality Issues:
→ Confirms the "wooden output" problem is real and systematic
→ Validates need for extraction/generation experiments (E1, E2, E3)
→ Provides clear benchmark to beat

### If Baseline Shows Good Quality:
→ Problem may be in specific edge cases, not systemic
→ Focus shifts to consistency and edge case handling
→ May not need major architectural changes

### Either Way:
→ Establishes what "normal" looks like for this approach
→ Creates foundation for rigorous A/B testing
→ Proves measurement system works before scaling experiments

---

## Decision Points

**After 10 conversations:**
- Do we have stable quality distribution?
- Is measurement working reliably?
- Ready to start first experiment (E1)?

**After 25 conversations:**
- Is baseline quality acceptable as-is, or does it confirm need for improvement?
- Which experiment should be priority based on observed patterns?
- Any unexpected insights from event data?

---

## Key Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| Quality rating distribution | Establish baseline % | Comparison point |
| User feedback (helpful %) | Establish baseline % | User value signal |
| Conversation completion rate | >80% | Engagement check |
| Event coverage | 100% logging | Infrastructure validation |

---

## Links

- **Implementation:** `docs/session-notes/2025-12-13_baseline-v1-normalization-and-instrumentation.md`
- **Release Notes:** `RELEASE_NOTES.md`
- **Analysis:** `notebooks/trace_analysis_starter.ipynb`

---

**In Plain English:**
We're establishing a controlled starting point with solid measurement, so we can scientifically prove whether our ideas for improvement actually work. Think of it as the "before" photo in a before/after comparison.
