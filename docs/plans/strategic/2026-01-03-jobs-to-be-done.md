# Lunastak: Jobs to be Done

**Date:** 2026-01-13
**Status:** Validated
**Purpose:** Core positioning framework for product and marketing

---

## Target User

**Executive Leaders** - people who *operate* the business. They make decisions, set direction, and orchestrate teams. Others execute the plans and strategies that cascade from those decisions.

Lunastak is not for individual contributors or project managers. It's for the people accountable for strategic outcomes.

---

## The Three Jobs

### Job 1: Clarify

> "Help me clarify the strategy we have, so we can get decisions made, develop coherent plans, and orchestrate teams to do the work that matters most."

**When:** Starting out, strategy is fuzzy, or alignment is breaking down.

**Outcome:** A clear, coherent strategy that enables:
- Decisions to be made confidently
- Plans to be developed with direction
- Teams to be orchestrated toward what matters

**Lunastak's role:** Guide leaders through articulating Vision, Strategy, and Objectives (with metrics) through conversation and document synthesis.

**How Clarify actually works (the consulting model):**

```
1. Initial conversations → Basics, high-level coverage across dimensions (vanilla stuff)
                ↓
2. Expert + domain knowledge → "Areas of value" emerge (Deep Dives)
                ↓
3. Open questions surface → Priority topics to explore next
                ↓
4. Investigation & exploration → Hypotheses confirmed/disconfirmed
                ↓
5. Understanding deepens → More deep dives emerge
                ↓
6. Strategic clarity crystallizes
```

**Key insight:** The "Luna Wonders" and "Worth Exploring" features are **provocations** - they surface gaps that need attention. They're not destinations themselves.

**Two complementary sources of strategic content:**

| Source | What it contributes | Nature |
|--------|---------------------|--------|
| **Conversations / Documents** | The straightforward, uncontroversial stuff | Easy wins, basics, breadth coverage |
| **Deep Dives** | The hard, contested, differentiating stuff | Complex questions, areas of real value |

**Both are equally valuable.** No good strategy skips deep dives. And no collection of deep dives by itself is good strategy. You need:
- Breadth from conversations/docs (no gaps in coverage)
- Depth from deep dives (no shallow thinking on hard questions)

**Luna Wonders / Worth Exploring** surface two types of gaps:
1. Gaps in breadth → "Add more context" (conversation or document)
2. Hard questions needing depth → "Create a Deep Dive"

The user chooses which path based on the nature of the gap.

---

### Job 2: Adapt

> "Help me adapt and improve the strategy continuously, in response to new information, learning emerging from execution, or new directions from breakthrough thinking."

**The reality of executive strategy work:**

Executive teams have cadence. Offsites once or twice a year for big planning. Revisions quarterly. Reviews monthly. Everyone does prep, gets busy, and inevitably a deadline—driven by calendar and investment cycles—forces decisions. This is **theatrical, point-in-time**. The strategy gets "locked" for a period, unlikely to change until the next cycle.

**But executives are scheming continuously.**

Ideas come at inconvenient moments:
- 5 minutes between meetings
- After a run through the park
- At 3am
- In the shower
- Observing how teams execute

**Adapt is for the individual leader.** This is their **second brain for strategy**. A private space to explore and elaborate thinking. The ideas, hypotheses, strategies, and evidence developed here become inputs to decisions in the next cycle.

**This is the critical engagement hook.** If Lunastak is only for theatrical planning moments, users come back 4x/year. If it's their second brain for continuous strategy thinking, they're using it daily/weekly.

**Example interactions:**
- Voice memos ("pull the thread later")
- Forward an email that piqued interest
- Drop in a research report, data, slidedeck, PDF
- Quick capture of an idea before it evaporates
- "What's new since last strategy" view
- Private exploration without polluting "official" strategy

**Lunastak's role:** Always on, always capturing, always refining—so when the theatrical moment arrives, the thinking is ready.

---

### Job 3: Operate

> "Help me measure, inspect, and review our performance on a regular basis, so we can make better operational decisions that optimise for maximum impact for effort/investment."

**When:** Regular cadence - monthly, quarterly business reviews.

**Outcome:** The right information to run the business, synthesized into decision-ready artifacts.

**Lunastak's role:** Connect the dots between three lenses:

| Lens | What it answers |
|------|-----------------|
| **What we said we'd do** | Strategy, objectives, committed direction |
| **What we learned** | Execution insights, pivots, discoveries |
| **How we're performing** | Metrics tied to strategy (e.g., OKRs) |

...and produce actionable artifacts like Draft MBRs that enable operational decisions.

---

## Key Positioning Insight

**Lunastak is a decision-enabling tool, not a measurement tool.**

It doesn't track OKRs or collect metrics. It *synthesizes* strategy + execution learnings + performance data (that users bring) into artifacts leaders can act on.

The value is in the synthesis and the guidance - helping leaders see clearly so they can decide confidently.

---

## What Lunastak is NOT

- Not a project management tool (leaders don't manage tasks)
- Not a metrics dashboard (leaders have those already)
- Not for individual contributors (they execute, not operate)
- Not a documentation repository (it's a thinking partner)

---

## Implications for Product

| Job | Current Support | Gap |
|-----|-----------------|-----|
| **Clarify** | Core flow built | Refine UX, improve guidance |
| **Adapt** | Partial (Deep Dives, add content) | No distinct "Thinking" space |
| **Operate** | Not built | MBR generation, review synthesis |

The product roadmap should sequence: **Clarify (polish) → Adapt (enable) → Operate (build)**

---

## UI Structure

The three jobs map to a clear navigation model:

```
Projects
├── My Strategy
│   ├── Strategy       ← Job 1: Clarify (the locked artifact)
│   ├── Thinking       ← Job 2: Adapt (second brain, continuous)
│   └── Outcomes       ← Job 3: Operate (enable decisions from results)
```

**Why this works:**
- Sidebar submenu tells the story at a glance—no page load needed
- "Thinking" visible in nav signals this is an always-on companion, not just a planning tool
- "Outcomes" connects strategy to results, where MBRs and review artifacts live
- Clear mental model: what we decided → how we're refining → what happened

---

## Usage

This document informs:
- Product prioritization and roadmap
- Marketing positioning and messaging
- Feature design decisions
- User journey mapping
