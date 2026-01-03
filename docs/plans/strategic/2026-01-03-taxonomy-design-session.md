# Strategic Dimensions Taxonomy Design Session

**Date:** 2026-01-03  
**Participants:** Jonny Schneider, Claude (AI collaborator)  
**Type:** Strategic Planning Session  
**Status:** Initial Framework Established

---

## Purpose

Design a taxonomy of strategic dimensions that will serve as the foundational scaffold for Lunastak's input capture, extraction, and synthesis capabilities.

---

## Problem Framing

### The Cold Start Problem

Lunastak has a cold start problem. Simply asking "what are you trying to achieve" or "what is your strategy" is too difficult for most people to answer. The current prescriptive extraction schema (`industry`, `target_market`, `unique_value`) produces technically accurate but "wooden" outputs—lacking the drive and energy you hear from real leaders.

### The Fragmented Input Reality

Strategy is almost never "one and done". Leaders think and percolate, they hear something that sparks a thought, and later, in unexpected ways, they join the dots and have breakthrough thinking (in the car, while running, in the shower). 

We need a way of capturing this thinking when it happens, in a somewhat unstructured way. But completely unstructured information isn't efficient. We need a **middle layer**—flexible enough to accommodate diverse thinking styles and fragmented inputs, structured enough to be machine-usable.

### The Quality Gap

Current E1a experiment is testing emergent theme extraction (vs. prescriptive fields). The hypothesis: accommodating the user's natural perspective rather than forcing diverse strategic thinking into a one-size-fits-all mold will produce less wooden outputs.

But even with emergent extraction, we need a way to:
1. Assess **completeness** — have we captured enough across key areas?
2. Assess **coherence** — do the pieces fit together?
3. Assess **readiness** — is there enough to generate useful Decision Stack outputs?
4. Enable **multi-session accumulation** — fragments captured over time build toward complete understanding

---

## The Opportunity

### Decision Stack as Output Framework

Martin Eriksson's Decision Stack provides the output scaffold:
- **Vision** (3+ years) — Aspirational, customer-centric, future-focused
- **Strategy** (12-18 months) — Coherent set of choices
- **Objectives** (12-18 months) — SMART, outcome-focused, balanced
- **Initiatives** (3-12 months) — Problem-opportunity space mapping
- **Principles** — "Even/over" statements that clarify trade-offs

### What's Missing: The Input Taxonomy

The Decision Stack tells us what outputs to generate. What's missing is the **input taxonomy**—the strategic dimensions that need to be understood to generate quality outputs.

### LLM-as-Judge Training

The overarching design challenge: train a model to produce an outcome that is the same or better quality than expert consultants achieve working face-to-face with executive teams.

The taxonomy enables this by providing:
- **Coverage assessment** — which dimensions have we understood?
- **Gap identification** — what's missing or thin?
- **Quality evaluation** — is this genuine strategic thinking or platitudes?
- **Executability check** — would teams understand and be able to act on this?

---

## Key Design Decisions

### 1. Three-Tier Architecture

The taxonomy uses three tiers:

| Tier | Purpose | Characteristics |
|------|---------|-----------------|
| **Tier 1: Strategic Dimensions** | Universal areas of understanding | ~10 dimensions that almost always matter for product strategy |
| **Tier 2: Sub-Dimensions** | Depth within each dimension | Mix of universal, emergent, and domain-specific |
| **Tier 3: Captured Fragments** | Raw material | Voice memos, conversation snippets, document excerpts, epiphanies |

### 2. Dimensions as Lenses, Not Fields

Tier 1 dimensions are **lenses through which strategic thinking can be captured and assessed**—not prescriptive fields to fill. The LLM-as-judge evaluates coverage across dimensions without requiring rigid extraction into fixed schemas.

### 3. Strategic Intent as Special Category

Leaders often begin with inside-out statements ("We want to grow 50%", "We want to be the market leader"). These are valuable fragments, but they're not yet strategy.

**Strategic Intent** captures raw aspirational statements, goals, and directional preferences. Through understanding other dimensions (Customer & Market, Competitive Position, etc.), these get transformed into:
- **Vision** (outside-in, customer-centric, aspirational)
- **Strategy** (coherent choices about where to play and how to win)

This enables detecting and guiding the "inside-out → outside-in" transformation that's central to good strategy work.

### 4. Fragment Accumulation Over Time

Fragments are:
- Timestamped and sourced
- Tagged with dimension(s) by the model
- Confidence-scored
- Preserved in original form (for context and voice)

**Key insight:** Fragments accumulate, synthesis evolves. You don't throw away fragments—you use them to continuously refine synthesised understanding.

### 5. Model Tags, Expert Evaluates

Fragment tagging approach:
1. **Model tags automatically** — every fragment gets dimension/sub-dimension tags + confidence
2. **Expert evaluates** — researchers review samples, code errors (wrong tags, missing tags, confidence miscalibration)
3. **Improve from there** — error patterns inform prompt improvements

Users never see tagging complexity. They see coherent synthesis, gaps surfaced as questions, and ability to correct via conversation.

### 6. Domain-Specific Models as Premium Feature

Universal dimensions work for general product strategy. High-value assessments (VC due diligence, industry-specific evaluations) require bespoke domain models.

**Future enhancement:** Premium consulting service develops domain-specific models that get side-loaded to Lunastak for domain-aware questioning, extraction, and generation.

*(Captured in `docs/feature-backlog/future-improvements.md`)*

---

## Tier 1: Strategic Dimensions

### The Universal Scaffold

| Dimension | What We're Understanding | Maps to Decision Stack |
|-----------|-------------------------|------------------------|
| **Customer & Market** | Who we serve, their problems, buying behaviour, market dynamics | Vision, Strategy |
| **Problem & Opportunity** | The problem space, opportunity size, why now | Vision, Strategy |
| **Value Proposition** | What we offer, how it solves problems, why it matters | Strategy |
| **Differentiation & Advantage** | What makes us unique, defensibility, right to win | Strategy, Principles |
| **Competitive Landscape** | Who else plays, their strengths/weaknesses, positioning | Strategy |
| **Business Model & Economics** | How we create/capture value, unit economics, growth model | Objectives |
| **Go-to-Market** | Sales strategy, customer success, growth channels | Objectives, Initiatives |
| **Product Experience** | The experience we're creating, usability, customer journey | Objectives, Initiatives |
| **Capabilities & Assets** | What we can do, what we have, team, technology | Strategy, Initiatives |
| **Risks & Constraints** | Cagan's 4 risks, dependencies, limitations | Principles, Initiatives |

### Special Category

| **Strategic Intent** | Raw aspirational statements, goals, directional preferences | → Transforms into Vision, Strategy via synthesis |

---

## Dimension → Decision Stack Mapping

### Vision Generation

**Primary inputs:**
- Strategic Intent (transformed, not raw)
- Customer & Market (the "who" and "why it matters")
- Problem & Opportunity (the "what" we're solving)

**Quality signals:**
- Specific and evocative (not vague platitudes)
- Customer/stakeholder-centric
- Future-focused but grounded
- Memorable and inspiring

### Strategy Generation

**Primary inputs:**
- Differentiation & Advantage (how we win)
- Competitive Landscape (who we're up against)
- Value Proposition (what we offer)
- Capabilities & Assets (what we can leverage)
- Customer & Market (where we play)

**Quality signals:**
- Coherent set of choices (not a list of goals)
- Authentic strategic voice
- Specific enough to guide decisions
- Clear "where to play" and "how to win"

### Objectives Generation

**Primary inputs:**
- Business Model & Economics (financial outcomes)
- Go-to-Market (growth outcomes)
- Product Experience (customer outcomes)
- Problem & Opportunity (impact outcomes)

**Quality signals:**
- SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Outcome-focused, not activity-focused
- Balanced across strategic themes
- Measurable for accountability

### Initiatives Generation

**Primary inputs:**
- Capabilities & Assets (what we can execute)
- Go-to-Market (how we'll reach customers)
- Product Experience (what we'll build)
- Risks & Constraints (what we must address)

**Quality signals:**
- Specific with clear timelines
- Deliverable-focused
- Connects to objectives above
- Practical and executable

### Principles Generation

**Primary inputs:**
- Risks & Constraints (trade-offs we must navigate)
- Differentiation & Advantage (what we protect)
- Strategic Intent (values and priorities)

**Quality signals:**
- "Even/over" format (clear trade-offs)
- Addresses real decision points
- Guides day-to-day operations
- Prevents failure patterns

---

## Gap Analysis Framework

For LLM-as-judge, assess each dimension on:

| Assessment | Question | Implication |
|------------|----------|-------------|
| **Coverage** | Do we have any fragments for this dimension? | Missing = gap to address |
| **Depth** | How rich is our understanding? (thin/adequate/deep) | Thin = probe further |
| **Confidence** | How certain is the model about what it's captured? | Low = clarify with user |
| **Coherence** | Does this fit with other dimensions? | Contradiction = surface tension |
| **Recency** | When was this last updated? | Stale = prompt refresh |

This enables proactive gap identification:
> "I have a strong understanding of your customers and competitive landscape, but I'd like to understand more about your business model and how you think about unit economics."

---

## Open Questions / Future Work

### Sub-Dimension Design

Each Tier 1 dimension needs sub-dimensions. These should be:
- **Universal** — apply to almost all SaaS/digital products
- **Emergent** — surface from conversation and get named by model
- **Domain-specific** — activated when industry/context is known

**Next step:** Deep dive on 2-3 dimensions to flesh out sub-dimensions.

### Fragment Schema

What does a fragment look like as a data structure?
- Relationship to existing Trace model
- Tag structure (array of dimension references?)
- Confidence scoring approach
- Source attribution (conversation, document, voice memo)

**Next step:** Design fragment schema for development planning.

### Evaluation Rubrics

How do we train evaluators (human and LLM) to assess:
- Tag accuracy (did model tag correctly?)
- Coverage completeness (are gaps real gaps?)
- Synthesis quality (does the rolled-up understanding reflect the fragments?)

**Next step:** Develop evaluation rubrics based on existing quality criteria work.

### Multi-Session State

How does strategic context persist and evolve across sessions?
- Versioning of synthesis
- Surfacing what's changed
- Handling contradictions between old and new fragments

**Next step:** Design multi-session state model.

---

## Feature Candidates Identified

This session identified several feature candidates, captured in `docs/feature-backlog/future-improvements.md`:

1. **Domain-Specific Strategic Models** — Premium consulting service to develop industry-specific dimension models that get side-loaded to Lunastak

2. **Voice Memo Capture & Takeover UI** — Capture strategic thinking when it happens via voice memos, with optional proactive questioning based on taxonomy dimensions

---

## Reference Materials Consulted

### Lunastak Codebase
- `.claude/README.md` — Current state and architecture
- `.claude/architecture.md` — Technical architecture
- `docs/decision-stack-reference/QUALITY_CRITERIA.md` — What makes good strategy outputs
- `docs/decision-stack-reference/example-humble-ventures-decision-stack.md` — Real example
- `docs/experiments/EXPERIMENT_REGISTER.md` — Current experiments
- `docs/experiments/one-pagers/E1a-emergent-extraction.md` — Emergent extraction experiment
- `docs/journal/2025-12-12-extraction-generation-learnings.md` — Key learnings on extraction
- `src/lib/types.ts` — Current type definitions

### Humble Ventures Consulting Materials
- `List-of-strategy-models-and-analysis-examples.md` — VC due diligence frameworks
- `Domain Model for Product Comparison.md` — 4PL logistics areas of value
- `Maturity Model Example.md` — Product/tech maturity assessment rubrics

### Published Content
- [When Written Product Strategy Beats Workshop Theatre](https://www.humventures.com.au/insights/written-product-strategy-workshop-theatre) — Product narrative approach

### Frameworks Referenced (Not Yet Deeply Integrated)
- Rumelt's Good Strategy, Bad Strategy
- Porter's 5 Forces
- Helmer's 7 Powers
- Cagan's 4 Big Product Risks
- Jobs-to-be-Done
- Lafley/Martin's Playing to Win

---

## Session Notes

### On "Ambition & Direction"

Initial proposal included "Ambition & Direction" as a Tier 1 dimension. Jonny's feedback:

> "That sounds more like Vision and Strategy to me. Leaders often start here with an 'inside out' view. Over time, by understanding the other dimensions, I will typically push them toward an 'outside in' perspective, often expressed as an 'Ideal Journey'. The Direction part directly relates to specific choices about what we will and won't do."

This led to reframing as **Strategic Intent** — a special category that captures raw aspirational input and gets *transformed* through synthesis rather than being a dimension to assess coverage against.

### On Scope

Jonny confirmed product strategy scope includes:
- Opportunity-solution fit
- Product-market fit
- Sales and go-to-market strategy
- Customer success strategy
- Product experience
- Differentiation/unfair advantage
- Competition
- Product economics
- The 4 big risks (Cagan)

Not excluded, but not prioritised:
- Org design / team structure
- Culture and values
- Hiring and talent
- Financial modelling / unit economics (included in Business Model & Economics)
- Governance and risk (included in Risks & Constraints)

### On First Users

Jonny noted:

> "It's not just a feature backlog—we need to be thinking about how to engage first users, so we can get actual data to inform next decisions."

This is critical context. The taxonomy work is foundational, but the path to validation is through real users, not theoretical completeness.

---

## Next Steps

1. **Pick-up session: Sub-dimensions** — Deep dive on Customer & Market, Business Model & Economics, and Differentiation & Advantage to flesh out universal sub-dimensions

2. **Pick-up session: Decision Stack mapping** — More explicit mapping of which dimensions/sub-dimensions inform which Decision Stack components, for generation prompting

3. **Development planning** — Fragment schema design, multi-session state model

4. **User engagement strategy** — How to get first users generating real data (separate from taxonomy work)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-03
