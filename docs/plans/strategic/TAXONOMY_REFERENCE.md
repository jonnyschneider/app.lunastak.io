# Strategic Dimensions Taxonomy Reference

**Version:** 0.1 (Draft)  
**Created:** 2026-01-03  
**Status:** Framework Established, Sub-Dimensions TBD  
**Related:** `docs/plans/strategic/2026-01-03-taxonomy-design-session.md`

---

## Purpose

This document defines the taxonomy of strategic dimensions used by Lunastak to:
1. **Capture** strategic thinking from leaders (via conversation, documents, voice memos)
2. **Extract** and tag fragments to dimensions (via LLM)
3. **Assess** coverage and gaps (via LLM-as-judge)
4. **Generate** Decision Stack outputs (Vision, Strategy, Objectives, Initiatives, Principles)

---

## Architecture Overview

### Three-Tier Structure

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Strategic Dimensions                               │
│  Universal areas of understanding (~10 dimensions)          │
│  Used for: Coverage assessment, gap identification          │
├─────────────────────────────────────────────────────────────┤
│  TIER 2: Sub-Dimensions                                     │
│  Depth within each dimension                                │
│  Mix of: Universal, Emergent, Domain-specific               │
│  Status: TO BE DEFINED (let emerge from data first)         │
├─────────────────────────────────────────────────────────────┤
│  TIER 3: Captured Fragments                                 │
│  Raw material: voice memos, conversation, documents         │
│  Tagged with: dimension(s), confidence, source, timestamp   │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Dimensions as lenses, not fields** — We assess coverage across dimensions, not extract into rigid schemas
2. **Fragments accumulate, synthesis evolves** — Raw material preserved, understanding refined over time
3. **Model tags, expert evaluates** — Automated tagging with human error-coding for improvement
4. **Sub-dimensions emerge from data** — Avoid prescriptive sub-categories until patterns observed

---

## Tier 1: Strategic Dimensions

### The Universal Scaffold

| # | Dimension | What We're Understanding | Primary Decision Stack Outputs |
|---|-----------|-------------------------|-------------------------------|
| 1 | **Customer & Market** | Who we serve, their problems, buying behaviour, market dynamics | Vision, Strategy |
| 2 | **Problem & Opportunity** | The problem space, opportunity size, why now, market need | Vision, Strategy |
| 3 | **Value Proposition** | What we offer, how it solves problems, why it matters to customers | Strategy |
| 4 | **Differentiation & Advantage** | What makes us unique, defensibility, right to win, moats | Strategy, Principles |
| 5 | **Competitive Landscape** | Who else plays, their strengths/weaknesses, positioning, substitutes | Strategy |
| 6 | **Business Model & Economics** | How we create/capture value, unit economics, growth model, pricing | Objectives |
| 7 | **Go-to-Market** | Sales strategy, customer success, growth channels, acquisition | Objectives, Initiatives |
| 8 | **Product Experience** | The experience we're creating, usability, customer journey | Objectives, Initiatives |
| 9 | **Capabilities & Assets** | What we can do, what we have, team, technology, IP | Strategy, Initiatives |
| 10 | **Risks & Constraints** | What could go wrong, dependencies, limitations, the 4 big risks | Principles, Initiatives |

### Special Category: Strategic Intent

| **Strategic Intent** | Raw aspirational statements, goals, directional preferences |

**Note:** Strategic Intent is not a dimension to assess coverage against. It's a *capture category* for raw aspirational input that gets *transformed* through synthesis into Vision and Strategy.

Leaders often begin with inside-out statements ("We want to grow 50%", "We want to be market leader"). Through understanding other dimensions, these transform into outside-in, customer-centric Vision and coherent Strategy choices.

---

## Dimension Details

### 1. Customer & Market

**What we're understanding:**
- Who are the target customers/users?
- What are their problems, needs, jobs-to-be-done?
- How do they buy? Who decides?
- What is the market size and dynamics?
- How is the market segmented?

**Related frameworks:**
- Jobs-to-be-Done (Christensen)
- Customer segments (Osterwalder)
- Buyers vs. users distinction
- Market sizing (TAM/SAM/SOM)

**Sub-dimensions (to emerge):** Customer segments, buyer personas, jobs-to-be-done, pain points, buying process, market size, market dynamics, customer acquisition cost signals

---

### 2. Problem & Opportunity

**What we're understanding:**
- What problem are we solving?
- Why does this problem exist?
- Why now? What has changed?
- How big is the opportunity?
- What happens if the problem isn't solved?

**Related frameworks:**
- Rumelt's Diagnosis ("What's going on here?")
- Problem-Solution Fit
- Timing and market readiness

**Sub-dimensions (to emerge):** Problem definition, root causes, timing factors, opportunity size, urgency, consequences of inaction

---

### 3. Value Proposition

**What we're understanding:**
- What do we offer?
- How does it solve the problem?
- Why does it matter to customers?
- What is the value delivered?
- What is the "job" we do for customers?

**Related frameworks:**
- Value Proposition Canvas (Osterwalder)
- Jobs-to-be-Done outcomes
- Lafley/Martin "How to Win"

**Sub-dimensions (to emerge):** Core offering, key benefits, value drivers, differentiated value, customer outcomes

---

### 4. Differentiation & Advantage

**What we're understanding:**
- What makes us unique?
- Why can't competitors easily copy this?
- What is our "right to win"?
- What moats or powers do we have/could develop?

**Related frameworks — Helmer's 7 Powers:**
| Power | Description |
|-------|-------------|
| Scale Economies | Per-unit cost decreases with volume |
| Network Economies | Value increases as more people use it |
| Counter-Positioning | Business model incumbents can't copy without hurting themselves |
| Switching Costs | Customers can't switch without significant cost |
| Branding | Trust, affective valence, uncertainty reduction |
| Cornered Resource | Exclusive access to vital resource (IP, talent, location) |
| Process Power | Efficiency that competitors can't easily replicate |

**Sub-dimensions (to emerge):** Unique capabilities, IP/patents, network effects, switching costs, brand strength, data advantages, talent, process advantages

---

### 5. Competitive Landscape

**What we're understanding:**
- Who are the competitors (direct and indirect)?
- What are their strengths and weaknesses?
- How are we positioned relative to them?
- What substitutes exist?
- What are barriers to entry?

**Related frameworks — Porter's Five Forces:**
| Force | Description |
|-------|-------------|
| Competitive Rivalry | Intensity among existing competitors |
| Threat of New Entrants | Ease of new competitors entering |
| Threat of Substitutes | Alternative solutions to the same problem |
| Bargaining Power of Suppliers | Supplier influence on costs/terms |
| Bargaining Power of Buyers | Customer influence on prices/terms |

**Sub-dimensions (to emerge):** Direct competitors, indirect competitors, substitutes, competitive positioning, barriers to entry, industry dynamics

---

### 6. Business Model & Economics

**What we're understanding:**
- How do we make money?
- What is the pricing model?
- What are the unit economics (CAC, LTV, margins)?
- How does the business scale?
- What is the path to profitability?

**Related frameworks:**
- Business Model Canvas (Osterwalder)
- Unit economics (SaaS metrics)
- Lafley/Martin "Capabilities" and "Management Systems"

**Sub-dimensions (to emerge):** Revenue model, pricing strategy, unit economics, cost structure, margins, path to profitability, scalability

---

### 7. Go-to-Market

**What we're understanding:**
- How do we reach customers?
- What is the sales model?
- How do we acquire customers?
- How do we retain and grow customers?
- What channels do we use?

**Related frameworks:**
- Lafley/Martin "Where to Play"
- Sales-led vs. product-led growth
- Customer success strategy

**Sub-dimensions (to emerge):** Sales strategy, marketing channels, customer acquisition, customer success, retention strategy, expansion strategy, partnerships

---

### 8. Product Experience

**What we're understanding:**
- What experience are we creating?
- How do customers interact with the product?
- What is the customer journey?
- How usable is the product?
- What is the "ideal journey"?

**Related frameworks:**
- Customer journey mapping
- Usability (Cagan's usability risk)
- Product-market fit signals

**Sub-dimensions (to emerge):** User experience, customer journey, usability, key interactions, onboarding, engagement, satisfaction signals

---

### 9. Capabilities & Assets

**What we're understanding:**
- What can we do well?
- What do we have (team, tech, IP, data)?
- What capabilities are required to win?
- What capabilities are we missing?
- What is our technical architecture?

**Related frameworks:**
- Lafley/Martin "Must-Have Capabilities"
- Resource-based view
- Technical due diligence dimensions

**Sub-dimensions (to emerge):** Team and talent, technology stack, technical architecture, data assets, IP, operational capabilities, partnerships, gaps

---

### 10. Risks & Constraints

**What we're understanding:**
- What could go wrong?
- What are the dependencies?
- What constraints limit us?
- What trade-offs must we navigate?

**Related frameworks — Cagan's 4 Big Risks:**
| Risk | Question |
|------|----------|
| Value Risk | Will customers buy it / want to use it? |
| Usability Risk | Can users figure out how to use it? |
| Feasibility Risk | Can we build it with available time, skills, tech? |
| Business Viability Risk | Does it work for the business (legal, financial, GTM)? |

**Additional risk categories:**
- Regulatory and compliance
- Competitive response
- Technology risks
- Team and execution risks
- Market timing risks

**Sub-dimensions (to emerge):** Value risks, usability risks, feasibility risks, viability risks, regulatory constraints, dependencies, key assumptions

---

## Dimension → Decision Stack Mapping

### Vision Generation

**Primary dimensions:**
- Strategic Intent (transformed from inside-out → outside-in)
- Customer & Market (the "who" and "why it matters")
- Problem & Opportunity (the "what" we're solving)

**Quality criteria:**
- Aspirational but achievable
- Customer/stakeholder-centric
- Future-focused (3+ years)
- Specific and evocative (not vague platitudes)
- Memorable and inspiring

---

### Strategy Generation

**Primary dimensions:**
- Differentiation & Advantage (how we win)
- Competitive Landscape (who we're up against)
- Value Proposition (what we offer)
- Capabilities & Assets (what we can leverage)
- Customer & Market (where we play)

**Quality criteria:**
- Coherent set of choices (not a list of goals)
- Clear "where to play" and "how to win" (Lafley/Martin)
- Authentic strategic voice
- Specific enough to guide decisions
- Time horizon: 12-18 months

**Related frameworks:**
- Lafley/Martin: "Where to Play" + "How to Win"
- Rumelt: Guiding Policy (overall approach to overcome obstacles)

---

### Objectives Generation

**Primary dimensions:**
- Business Model & Economics (financial outcomes)
- Go-to-Market (growth outcomes)
- Product Experience (customer outcomes)
- Problem & Opportunity (impact outcomes)

**Quality criteria:**
- SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Outcome-focused, not activity-focused
- Balanced across strategic themes
- Measurable for accountability
- Time horizon: 12-18 months (with 3M/6M/9M/12M/18M markers)

---

### Initiatives Generation

**Primary dimensions:**
- Capabilities & Assets (what we can execute)
- Go-to-Market (how we'll reach customers)
- Product Experience (what we'll build)
- Risks & Constraints (what we must address)

**Quality criteria:**
- Specific with clear timelines (3-12 months)
- Deliverable-focused
- Connects to objectives above
- Practical and executable

**Related frameworks:**
- Rumelt: Coherent Actions (coordinated actions to carry out guiding policy)

---

### Principles Generation

**Primary dimensions:**
- Risks & Constraints (trade-offs we must navigate)
- Differentiation & Advantage (what we protect)
- Strategic Intent (values and priorities)

**Quality criteria:**
- "Even/over" format (clear trade-offs)
- Addresses real decision points
- Guides day-to-day operations
- Prevents failure patterns
- 4-6 principles maximum

---

## Gap Analysis Framework

For LLM-as-judge, assess each dimension:

| Assessment | Question | Signal |
|------------|----------|--------|
| **Coverage** | Do we have any fragments for this dimension? | None = critical gap |
| **Depth** | How rich is our understanding? | Thin / Adequate / Deep |
| **Confidence** | How certain is the model about what it's captured? | Low / Medium / High |
| **Coherence** | Does this fit with other dimensions? | Contradictions = surface tension |
| **Recency** | When was this last updated? | Stale = prompt refresh |

**Example gap surfacing:**
> "I have a strong understanding of your customers and competitive landscape, but I'd like to understand more about your business model and how you think about unit economics."

---

## Framework Alignment Summary

| Framework | Author | Key Contribution to Taxonomy |
|-----------|--------|------------------------------|
| **Decision Stack** | Eriksson | Output structure (Vision → Strategy → Objectives → Initiatives → Principles) |
| **Playing to Win** | Lafley/Martin | "Where to Play" + "How to Win" + Capabilities + Management Systems |
| **Good Strategy/Bad Strategy** | Rumelt | Diagnosis + Guiding Policy + Coherent Actions |
| **7 Powers** | Helmer | Sources of sustainable competitive advantage |
| **Five Forces** | Porter | Industry structure and competitive dynamics |
| **4 Big Risks** | Cagan | Product risk categories (Value, Usability, Feasibility, Viability) |
| **Jobs-to-be-Done** | Christensen | Customer problem understanding |
| **Business Model Canvas** | Osterwalder | Business model components |

---

## What's Defined vs. TBD

### ✅ Defined
- Tier 1 dimensions (10 + Strategic Intent)
- Dimension → Decision Stack output mapping
- Gap analysis framework
- Framework alignment

### 🔲 To Be Defined (Emergence Approach)
- Tier 2 sub-dimensions (let emerge from E1a data, then codify)
- Fragment schema (data structure for captured fragments)
- Confidence scoring approach
- Multi-session state model
- Evaluation rubrics for LLM-as-judge training

### 🔲 Future Enhancements
- Domain-specific dimension models (premium feature)
- Voice memo capture and tagging
- "Takeover" UI with taxonomy-mapped questions

---

## Usage Notes

### For Development
- Use Tier 1 dimensions as tags for fragment extraction
- Track dimensional coverage in Traces
- Surface gaps to users as questions, not as "missing fields"

### For Evaluation
- Assess whether fragments are correctly tagged to dimensions
- Assess whether coverage assessment accurately reflects gaps
- Assess whether synthesis quality reflects fragment richness

### For Generation
- Use dimension → output mapping to inform generation prompts
- Draw from relevant dimensions for each Decision Stack component
- Maintain authentic voice from fragments (avoid generic platitudes)

---

## References

- `docs/plans/strategic/2026-01-03-taxonomy-design-session.md` — Full design session context
- `docs/decision-stack-reference/QUALITY_CRITERIA.md` — What makes good outputs
- `docs/decision-stack-reference/example-humble-ventures-decision-stack.md` — Real example
- `docs/experiments/one-pagers/E1a-emergent-extraction.md` — Emergent extraction experiment
- `docs/feature-backlog/future-improvements.md` — Feature candidates (domain models, voice memo)

---

**Document Version:** 0.1  
**Last Updated:** 2026-01-03  
**Next Review:** After E1a data collection (sub-dimension emergence)
