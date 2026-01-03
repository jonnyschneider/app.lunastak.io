# Brainstorming Brief: Strategic Context Synthesis & Compression

**Date:** 2026-01-03  
**Type:** Design Problem  
**Status:** Ready for brainstorming

---

## The Core Problem

Leaders will generate **vast amounts of fragmented input** over time:
- Voice memos captured in the car
- Conversation snippets across multiple sessions
- Document uploads
- Shower epiphanies recorded on the fly

We **cannot keep all of this in context** forever (token limits, cost, coherence degradation). But we need the agent to behave as if it deeply understands the business — producing high-quality outputs and giving users the **perception of memory, understanding, and accuracy** that keeps them engaged across sessions.

**The design challenge:** How do we synthesize complex, fragmented inputs into a structured representation (the taxonomy) that allows us to **discard the raw inputs** while retaining enough fidelity that:
1. Generated outputs are high quality
2. The user feels understood
3. We can identify gaps and guide further questioning
4. The representation evolves as new inputs arrive

---

## What We're Synthesizing Into

The three-tier taxonomy:

```
Tier 1: Strategic Dimensions (10 universal areas)
        → Coverage assessment, gap identification

Tier 2: Sub-Dimensions (depth within each dimension)
        → Richer understanding, domain-specific where relevant

Tier 3: Captured Fragments (raw material)
        → Source of truth, but eventually discardable
```

**The key insight:** Tier 3 (fragments) is where inputs land. Tier 1 and 2 is where *synthesized understanding* lives. Once synthesis is good enough, we should be able to throw away Tier 3 and still "know" the business.

---

## Design Questions

1. **What does "synthesized understanding" look like at each tier?**
   - Is it prose summaries per dimension?
   - Structured fields (key-value)?
   - Embeddings?
   - Some hybrid?

2. **How do we synthesize incrementally?**
   - New fragment arrives → gets tagged to dimensions → how does it update the synthesis?
   - Do we re-synthesize from all fragments? Or merge new into existing?
   - How do we handle contradictions between old and new?

3. **What fidelity is required to preserve "understanding"?**
   - What's the minimum representation that still generates quality outputs?
   - How do we validate synthesis quality? (LLM-as-judge?)
   - When is it safe to discard raw fragments?

4. **How do we maintain the perception of memory?**
   - User says something → agent recalls relevant context → user feels understood
   - What retrieval mechanism over the synthesized representation?
   - How do we surface "I remember you mentioned X" without having X in context?

5. **How does this evolve across sessions?**
   - Version the synthesis? Track deltas?
   - Show user what's changed in their strategic context?
   - Handle stale information?

---

## Concrete Scenarios to Design For

**Scenario A: First conversation**
- User has 10-turn conversation about their business
- We extract themes, map to dimensions, synthesize
- What gets stored? In what form?

**Scenario B: Second conversation, 3 days later**
- User adds new context that enriches some dimensions, contradicts others
- How does synthesis update?
- Can we show "here's what I now understand"?

**Scenario C: Voice memo arrives**
- 90-second voice memo transcribed
- Contains fragments relevant to 3 different dimensions
- How does it integrate without re-processing everything?

**Scenario D: Generation request after 5 sessions**
- User asks to generate Decision Stack
- We can't fit all 5 sessions in context
- What synthesized representation do we use?
- Does output feel like it "knows" the business?

---

## Tension to Resolve

**Compression vs. Fidelity**
- More compression = less context needed = cheaper/faster
- More fidelity = richer understanding = better outputs

**Structure vs. Voice**
- Structured representation is queryable and comparable
- But loses the leader's authentic voice (which makes outputs "wooden")
- How do we preserve voice/energy in synthesis?

---

## What We Have Now

- E1a extracts emergent themes (captures voice better than prescriptive fields)
- Dimensional coverage tracking maps themes to Tier 1 dimensions
- Traces store full conversation + extracted context as JSON
- Single-session only — no cross-session synthesis yet

---

## What We Need to Design

1. **Synthesis data model** — What's the structure of "understanding" per dimension?
2. **Synthesis process** — How do fragments become synthesized understanding?
3. **Update mechanics** — How does new input modify existing synthesis?
4. **Retrieval approach** — How do we use synthesized understanding in generation?
5. **Validation method** — How do we know synthesis is "good enough" to discard inputs?

---

## References

- `docs/plans/strategic/TAXONOMY_REFERENCE.md` — The taxonomy structure
- `docs/plans/strategic/2026-01-03-taxonomy-design-session.md` — Full design context
- `docs/journal/2025-12-12-extraction-generation-learnings.md` — Learnings on extraction quality

---

## The North Star

A user can have fragmented conversations and inputs over weeks or months. At any point, they can ask the agent to generate their strategy, and the output will feel like it came from someone who deeply understands their business — even though the agent has never seen most of the original inputs in its current context.
