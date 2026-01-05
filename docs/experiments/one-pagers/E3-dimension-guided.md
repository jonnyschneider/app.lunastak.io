# Experiment 3: Dimension-Guided Questioning

**Status:** 🟡 In Progress
**Variant ID:** `dimension-guided-e3`
**Date:** 2026-01-05
**Comparison:** Running parallel with E2 (`emergent-extraction-e1a`)

---

## What We're Learning

Does guiding questions toward the 11 strategic dimensions achieve higher coverage than emergent questioning, and at what cost to output quality/authenticity?

---

## Hypothesis

Dimension-guided questioning will achieve higher dimensional coverage (~90%+) than emergent questioning (~75%), but may produce more "wooden" or formulaic outputs. The trade-off between coverage completeness and output authenticity is unknown.

**Key question:** Is higher coverage worth the potential rigidity?

---

## Context: E2 Baseline

E2 established that emergent questioning (freeform, following the user's thread) achieves ~75% dimensional coverage when measured post-hoc against the 11 Tier 1 dimensions. This is surprisingly good given no explicit dimensional guidance.

**E2 approach:**
- Questions emerge naturally from conversation
- Post-hoc analysis maps themes to dimensions
- ~75% coverage achieved organically

**E3 approach:**
- Questions explicitly guided toward uncovered dimensions
- Same post-hoc dimensional analysis
- Hypothesis: higher coverage, but at what cost?

---

## The 11 Strategic Dimensions

Both E2 and E3 measure coverage against the same taxonomy:

| # | Dimension | What We're Understanding |
|---|-----------|-------------------------|
| 1 | Customer & Market | Who we serve, their problems, buying behaviour |
| 2 | Problem & Opportunity | The problem space, opportunity size, why now |
| 3 | Value Proposition | What we offer, how it solves problems |
| 4 | Differentiation & Advantage | What makes us unique, defensibility |
| 5 | Competitive Landscape | Who else plays, positioning |
| 6 | Business Model & Economics | How we create/capture value, unit economics |
| 7 | Go-to-Market | Sales strategy, customer success, channels |
| 8 | Product Experience | The experience we're creating, customer journey |
| 9 | Capabilities & Assets | What we can do, team, technology |
| 10 | Risks & Constraints | 4 risks, dependencies, limitations |
| 11 | Strategic Intent | Raw aspirational statements, goals |

---

## What Changes from E2

### Questioning Approach
**E2 (Emergent):** "Based on the conversation, ask a natural follow-up..."
**E3 (Guided):** "Based on the conversation and dimensional gaps, ask a question targeting under-covered areas..."

### Conversation Flow
**E2:** Follow the user's thread, let themes emerge
**E3:** Gently steer toward dimensions that haven't been touched

### Inline Coverage Tracking
**E2:** No awareness of dimensions during questioning
**E3:** Light inline analysis identifies which dimensions have been touched, guides next question

### What Stays the Same
- Post-hoc dimensional coverage analysis (same measurement)
- Extraction approach (emergent themes)
- Generation approach (same prompts)
- User experience (questions should still feel natural)

---

## Implementation Details

**Architecture:**
```
User responds
    ↓
[E3] Light dimensional scan of conversation so far
    ↓
[E3] Identify under-covered dimensions
    ↓
[E3] Generate question targeting gaps (while staying conversational)
    ↓
Repeat until confidence HIGH or max questions
    ↓
Extraction + dimensional coverage analysis (same as E2)
```

**Code Changes:**
- `src/app/api/conversation/continue/route.ts` - Variant-aware questioning prompts
- `src/lib/statsig.ts` - Add `dimension-guided-e3` to valid variants
- Feature flag in Statsig for alpha cohort routing

**E3 Questioning Prompt (Draft):**
```
You are a strategic advisor helping develop a strategic framework.

Conversation so far:
{conversationHistory}

Strategic dimensions to explore (for your awareness, not to mention explicitly):
1. Customer & Market
2. Problem & Opportunity
3. Value Proposition
4. Differentiation & Advantage
5. Competitive Landscape
6. Business Model & Economics
7. Go-to-Market
8. Product Experience
9. Capabilities & Assets
10. Risks & Constraints
11. Strategic Intent

Based on the conversation, some dimensions appear less covered.
Ask a warm, conversational follow-up question that naturally explores
an under-covered area without feeling like a checklist.

Return only the question, no preamble.
```

---

## Success Criteria

**Primary Metrics (Comparison with E2):**
- Dimensional coverage % (target: >85% vs E2's ~75%)
- Gap frequency (which dimensions still missed)
- Coverage consistency (variance across conversations)

**Quality Metrics (Two Levels):**

*Fragment/Extraction Quality:*
- Theme richness (depth, specificity)
- Fragment authenticity (user's voice vs generic)
- Information density per theme

*Output Quality (Generated Strategy):*
- Vision/Strategy quality ratings (good/bad %)
- Authenticity assessment (does it sound like a real leader?)
- "Wooden" indicator (corporate speak, generic platitudes)
- Actionability (would teams understand and act on this?)

*Conversation Quality:*
- User engagement (response depth, conversation flow)
- Naturalness (interrogation vs conversation)

**Pass Criteria:**
- Coverage improvement of 10%+ over E2
- No significant degradation in quality ratings
- Conversation still feels natural (not like an interrogation)

**Learn Regardless:**
- The coverage/quality trade-off curve
- Which dimensions are hardest to cover even with guidance
- Whether "unconstrained creative thinking + post-hoc mapping" beats "structured questioning"

---

## Measurement

**Quantitative:**
- Coverage % per dimension (E2 vs E3)
- Average dimensions covered per trace
- Question count to reach HIGH confidence
- Time to completion

**Qualitative:**
- Blind review of outputs (E2 vs E3)
- Conversation naturalness assessment
- Theme richness comparison
- User feedback (if available)

**Sample Size:** Alpha cohort, 50/50 split E2/E3

---

## Potential Outcomes

### Scenario A: Coverage up, quality same
E3 achieves higher coverage without sacrificing quality. Winner: dimension-guided becomes default.

### Scenario B: Coverage up, quality down
E3 achieves higher coverage but outputs feel more wooden. Decision: is the trade-off worth it? May depend on use case.

### Scenario C: Coverage similar, quality down
Guidance doesn't help coverage and hurts quality. Winner: emergent approach (E2).

### Scenario D: Coverage similar, quality same
No meaningful difference. Winner: emergent (simpler, no guidance needed).

**Hypothesis:** Scenario B is most likely. The question is degree of trade-off.

---

## Related Artifacts

- **E2 One-Pager:** `docs/experiments/one-pagers/E2-dimensional-coverage.md`
- **Taxonomy Reference:** `docs/plans/strategic/TAXONOMY_REFERENCE.md`
- **Taxonomy Design Session:** `docs/plans/strategic/2026-01-03-taxonomy-design-session.md`
- **Experiment Register:** `docs/experiments/EXPERIMENT_REGISTER.md`

---

**Document Version:** 1.0
**Last Updated:** 2026-01-05
