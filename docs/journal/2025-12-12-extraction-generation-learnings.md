# Extraction & Generation Learnings - December 2025

**Date:** 2025-12-12
**Author:** Jonny
**Type:** Synthesis Journal
**Phase:** Post-Implementation Reflection

---

## Context

Following implementation of adaptive conversation flow (Dec 8-9) and initial testing with simulated inputs across 4-5 different industries and thinking styles, we're stepping back to synthesize what we've learned about the core extraction and generation mechanisms.

**Related Artifacts:**
- `docs/UX_OBSERVATIONS.md` - First testing session observations (Dec 7)
- `docs/plans/2025-12-08-adaptive-conversation-design.md` - Design rationale for lenses and enrichment
- `docs/plans/2025-12-10-enhanced-strategy-display-design.md` - Vision for complete strategy display
- `docs/future-improvements.md` - Notes on intake/question flow enhancement
- `session-notes.md` - Implementation history (Dec 8-10)

---

## The Evolution So Far

### What We Built

**Phase 0 → Phase 1 Journey:**
1. Fixed 3-question conversation → Adaptive 3-10 questions with confidence scoring
2. Simple 3-field extraction → Enhanced extraction (core + enrichment + reflective_summary)
3. Generic questioning → 6 strategic lenses for user-led framing
4. Static output → Designed for objectives/initiatives/principles hierarchy

**Key Architectural Decisions:**
- Core context: `industry`, `target_market`, `unique_value`
- Enrichment fields: `competitive_context`, `customer_segments`, `operational_capabilities`, `technical_advantages`
- Reflective summary: `strengths`, `emerging`, `unexplored`, `thought_prompt`
- Strategic lenses: Competitive Advantage, Customer-Centric, Innovation-Driven, Operations Excellence, Growth & Scale, Resource Optimization

### What We Learned from Testing

**Observation 5 (UX_OBSERVATIONS.md):** "3 questions isn't really enough to develop a useful strategy... it's reasonable given the inputs, but it's not going to 'wow' anyone."

This led to adaptive conversation flow, but testing revealed deeper issues.

---

## 5 Key Synthesis Insights

### 1. The Formulaic Problem

**Observation:** Even with very rich simulation inputs across diverse industries and thinking styles, the vision and strategy statements all felt "wooden" - lacking the drive and energy you hear from real leaders.

**What we tested:**
- 4-5 different industries
- Various thinking styles (customer-focused, technical, commercial, etc.)
- Rich, detailed simulated inputs
- All 6 strategic lenses

**Result:** Outputs feel generic, templated, lifeless. The current structure (core + enrichment categories) produces technically accurate but uninspiring strategies.

**Hypothesis:** The problem isn't just question count or depth - it's the extraction schema itself. By prescribing fixed categories (industry, target market, unique value, competitive context, etc.), we're forcing diverse strategic thinking into a one-size-fits-all mold.

### 2. Doing Too Much Too Early

**Current State:** One extraction schema, one generation approach, trying to serve all thinking styles through 6 lenses.

**Insight:** The 6 thinking styles/lenses may need their own unique:
- **Core context fields** (not just industry/target_market/unique_value)
- **Enrichment areas** specific to that expertise
- **Generation approach** weighted toward that lens

**Example Distinctions:**
- **Customer experience person:** Core might be `customer_jobs`, `pain_points`, `desired_outcomes` + enrichment around journey stages, emotional drivers
- **Accountant/CFO:** Core might be `revenue_model`, `cost_structure`, `margin_drivers` + enrichment around financial metrics, risk factors
- **Product/tech founder:** Core might be `capabilities`, `technical_advantages`, `product_vision` + enrichment around roadmap, innovation areas

**Implication:** We need a **rubric or mapping** where thinking styles/role types have their own collections of concerns. The conversation, extraction, and generation should be fundamentally different, not just framed differently.

### 3. LLM-as-Judge Mission

**Goal:** Create an agent that can facilitate and develop strategy at the same level or better than expert consultants.

**Gap Identified:** Current approach isn't yet intelligent or dynamic enough in:
1. **Asking the right questions** - Still too generic despite lenses
2. **Extracting useful information** - Fixed schema misses what actually matters
3. **Generating meaningful artifacts** - Outputs lack energy and specificity

**Challenge:** We're treating this like a data extraction problem (get fields → fill template) rather than a strategic thinking problem (understand context → develop insight → articulate vision).

### 4. Layering and Cross-Pollination

**Observation:** Strategic clarity resolves over many iterations and discussions. It's rarely "good inputs → smart algos → quality outputs."

**Reality Check:**
- Hero use cases today are just scratching the surface
- Real strategy development involves:
  - Multiple conversations
  - Refinement over time
  - Testing ideas against reality
  - Integration of diverse perspectives
  - Evolution as understanding deepens

**Current Limitation:** We've built for single-session completion. Even with "explore further" option, it's not truly iterative.

**Implication:** Breaking the formulaic outcomes will likely require:
- Several leaders as participants (multi-stakeholder input)
- Many iterations for strategic clarity (versioning, evolution tracking)
- Cross-pollination between different lenses/perspectives
- Memory of what's been explored and what remains uncertain

### 5. Quality Gap

**Bottom Line:** It's nowhere near the quality of output we need. Yet.

**Context:** Much of strategy development is in:
- **The people** - Real leaders bring context, passion, constraints, vision
- **The conversations** - Dialogue surfaces tensions, priorities, trade-offs
- **The relationship** - Trust enables vulnerability and honest exploration

**Current State:** We're simulating this with LLM-generated inputs, which produces technically coherent but lifeless outputs.

**Path Forward:** Need more experimentation around all of this to increase overall quality **before** seeking real external feedback.

### 6. Framework Rigor

**Critical Note:** The Decision Stack framework has specific formats for particular components, and these formats exist for good reasons.

**Implication:** While we need flexibility in extraction and questioning, we must maintain rigor around:
- What constitutes a properly formed Vision statement
- What makes a Mission statement effective vs. generic
- SMART objective criteria and structure
- How Initiatives relate to Objectives
- What Principles are and how they function in the framework

**Tension:** We're balancing two competing needs:
1. **Flexibility** - Different lenses, dynamic extraction, emergent categories
2. **Rigor** - Framework integrity, proven formats, structural coherence

**Risk:** In trying to solve the "wooden output" problem by adding flexibility, we might lose the disciplined thinking that makes the Decision Stack framework valuable.

**Question:** How do we maintain framework rigor while allowing lens-specific approaches? Is the rigor in the output format (Vision/Mission/etc. have specific structures) while the input/extraction can be flexible?

---

## Implications for Extract & Generate

### For Extraction (`/api/extract`)

**Current approach:**
```json
{
  "core": { "industry", "target_market", "unique_value" },
  "enrichment": { "competitive_context", "customer_segments", ... },
  "reflective_summary": { "strengths", "emerging", "unexplored" }
}
```

**Potential new approach:**
- **Lens-specific core contexts** - Different fundamental fields per lens
- **Dynamic enrichment** - Emergent categories based on conversation, not prescribed
- **Reflective summary** - Keep this, it's valuable for iteration prompting

### For Generation (`/api/generate`)

**Current approach:**
- Single prompt using all extracted fields
- Produces Vision → Mission → Objectives
- Same structure regardless of lens or context

**Potential new approach:**
- **Lens-weighted generation** - Different emphasis/structure per lens
- **Narrative vs. structural balance** - More storytelling, less template filling
- **Multi-dimensional outputs** - Not just Vision/Mission/Objectives, but different artifacts per lens

---

## Clarifications from Brainstorming Session (2025-12-12)

### Framework Rigor vs. Flexibility

**Decision:** Mix of explicit output rigor and implicit dimensional exploration
- **Output structure:** Maintain specific formats for Vision/Mission/Objectives (repeatable, resonant, action-oriented)
- **Input/questioning:** Be flexible - the formulaic extraction (industry/target_market/unique_value) caused "wooden" results
- **Behind the scenes:** Certain dimensions need exploring (not all, all the time) but in a less explicit way

**Key insight:** Structuring inputs was meant to fast-track getting right details, but this was incorrect and caused wooden results.

### Target Domain & Lens Approach

**Primary context:** Digital strategy for SaaS products and services
- Range: Pre-seed startups → Fortune 500 teams/divisions
- Safe to assume technology focus and baseline digital business knowledge

**Lens inference over selection:**
- Move away from explicit lens choice (A/B/C/D/E)
- Infer focus from contextual questions: "What would you like to focus on?"
  - Customer problem
  - Competitive differentiation
  - Growth economics
  - Product capabilities
  - Operational efficiency
- More natural, concrete, actionable for users

### Iterative & Multi-Contributor Vision

**Single-user iteration:** Same user develops Decision Stack over multiple sessions, each focusing on different dimensions
- Matches reality of strategy development
- Reduces "get it perfect" pressure
- Allows dimensional focus without overwhelming

**Multi-contributor convergence (future):** Multiple stakeholders develop complementary perspectives, converge into executive-owned unified strategy
- Captures organizational knowledge
- Surfaces healthy tensions
- Creates buy-in through participation
- Requires auth, state management, conflict resolution

*(See `docs/future-improvements.md` for full details)*

### Dimensional Exploration Philosophy

**Current stance:** Don't narrow down too early - parts of multiple approaches are likely true:
- Some focus areas have natural dimensional mappings
- Some dimensions emerge from conversation
- Some core dimensions may always need light exploration
- Focus/strengths can guide prescriptive deeper questioning

**Approach for now:** Minimalist and open
- Let areas of focus emerge naturally (higher quality extraction suspected)
- Acknowledge common executive coverage areas exist
- Provide more prescriptive guidance once focus/strengths known
- **Ongoing experimental focus** - systematic hypothesis testing going forward

---

## Immediate Improvements (Low-Risk Changes)

### 1. Loosen Prescriptive Extraction Schema

**Current approach:**
```json
{
  "core": { "industry", "target_market", "unique_value" },
  "enrichment": { "competitive_context", "customer_segments", "operational_capabilities", "technical_advantages" },
  "reflective_summary": { "strengths", "emerging", "unexplored", "thought_prompt" }
}
```

**New approach:**
- **Emergent theme-based extraction** - AI identifies 3-5 key themes from conversation, creates headings based on what actually emerged (e.g., "Market Positioning", "Customer Pain Points", "Technical Differentiation")
- **Keep reflective_summary** with tweaks:
  - Keep: `strengths`, `emerging` (working well)
  - Change: `unexplored` → `opportunities_for_enrichment` (more positive, action-oriented)
  - Keep: `thought_prompt` (pairs with user choice to continue now or later)

**Rationale:** Accommodate their perspective and extract accordingly, rather than railroad into prescribed information. Better results by extracting what matters to them. Outputs resonate more because of topic familiarity.

### 2. Energetic Generation Prompts

**Change:** Rewrite generation prompts with explicit instructions for "energetic" output
- Reference real leader language
- Avoid generic corporate speak
- Use user's themes and language from extraction
- Produce Vision/Mission/Objectives that feel resonant and action-oriented, not wooden

**Quality Criteria Reference:** See `docs/archive/framework-reference/QUALITY_CRITERIA.md` for detailed framework requirements extracted from real Decision Stack examples.

**Energetic vs. Wooden characteristics:**
- ✅ Authentic voice, strategic themes, specific/evocative, transformation-focused
- ❌ Generic corporate speak, abstract platitudes, activity-focused, vague

**Real Example (Humble Ventures Vision):**
> "To be the trusted strategic partner that empowers growth-stage SaaS leadership teams to turn strategic ambiguity into decisive action and measurable outcomes."

What works: Specific audience, clear transformation, outcome-focused, professional but energetic.

**To be designed:** Specific prompt improvements for each framework component (Vision, Strategy, Objectives, Initiatives, Principles) based on quality criteria.

### 3. Focus Area Inference (Replace Explicit Lens Selection)

**Current:** Explicit A/B/C/D/E lens choice after first question

**New:** Natural focus area question that infers lens
- "What would you like to focus on developing?"
- Options around: customer problem, competitive differentiation, growth economics, product capabilities, operational efficiency
- More natural, concrete, actionable

### 4. Enhanced Extraction UI

**Current:** Two options after extraction:
- "Generate my strategy"
- "Explore further"

**New:** Three explicit options:
- **Continue** - explore opportunities now
- **Flag for next session** - acknowledge but defer
- **Dismiss** - not interested in exploring further

**Keep:** Agent suggesting "we have enough to generate strategy" (working well)

**Improvement:** Make the choice more explicit and support multi-session thinking

---

## Experimental Hypotheses Backlog

**Priority-ordered experiments for systematic testing:**

### Priority 1: Generation Quality (CRITICAL)

**Hypothesis:** Emergent theme extraction + energetic generation prompts will produce measurably less "wooden" outputs compared to current prescriptive approach.

**Test design:**
- Baseline: Current system (prescriptive extraction, current generation prompts)
- Variant: New system (emergent themes, energetic prompts)
- Input: Same 4-5 simulated conversations across industries/thinking styles
- Measure: Subjective quality ratings on dimensions:
  - Energy/drive (1-5 scale)
  - Specificity vs. generic (1-5 scale)
  - Sounds like real leader vs. corporate template (1-5 scale)
  - Overall "wow factor" (1-5 scale)
- Compare: Mean scores baseline vs. variant

**Why first:** Core value proposition - if we can't produce quality output, nothing else matters.

### Priority 2: Dimensional Coverage

**Hypothesis:** Loose/emergent extraction still captures the strategic dimensions needed for complete Decision Stack framework compliance.

**Test design:**
- Run conversations with emergent theme extraction
- Retrospectively code: which strategic dimensions were captured
  - Customer/market understanding
  - Value proposition/differentiation
  - Capabilities/advantages
  - Competitive context
  - Growth model
  - [Other dimensions TBD based on framework requirements]
- Measure: Coverage percentage, gaps analysis
- Compare: Does emergent approach miss critical dimensions vs. prescriptive?

**Why second:** Framework integrity check - ensure flexibility doesn't compromise completeness.

### Priority 3: Focus Area Effectiveness

**Hypothesis:** Different focus areas (customer problem vs. growth economics vs. product capabilities) produce different quality outcomes and dimensional coverage patterns.

**Test design:**
- Run same business scenario through different focus area pathways
- Measure per pathway:
  - Output quality ratings (per Priority 1 metrics)
  - Dimensional coverage (per Priority 2 metrics)
  - User engagement signals (question depth, response length)
  - Time to completion
- Identify: Which pathways work best for which contexts

**Why third:** Informs how to guide users toward most effective pathway for their context.

### Priority 4: Question Count/Depth Relationship

**Hypothesis:** With emergent extraction, there's an optimal question count range where quality plateaus (diminishing returns beyond certain depth).

**Test design:**
- Vary conversation length: 3 questions, 5 questions, 7 questions, 10 questions
- Same scenario, same focus area
- Measure:
  - Output quality at each length (per Priority 1 metrics)
  - Dimensional coverage at each length
  - Marginal quality improvement per additional question
- Identify: Optimal range, diminishing returns threshold

**Why fourth:** Balances user time investment vs. output quality - critical for UX and conversion.

### Priority 5: Theme Resonance

**Hypothesis:** Outputs using user's emergent themes and language will resonate more (feel more familiar/relevant) than outputs using standardized terminology.

**Test design:**
- Generate two versions from same conversation:
  - Version A: Uses user's actual themes/language from extraction
  - Version B: Normalizes to standardized strategic terminology
- User preference testing (A/B)
- Measure:
  - Which feels more relevant/actionable
  - Which feels more "like theirs"
  - Which would they actually use

**Why fifth:** Validates core assumption about accommodation vs. prescription - but needs quality baseline first.

---

## Notes on Experimental Rigor

As we move into more formal experiment phases, we need to:

1. **Identify specific challenges** with precision (not just "quality is low")
2. **Formulate testable hypotheses** (e.g., "Emergent themes will produce 30% higher energy ratings")
3. **Design controlled experiments** (vary one thing, measure impact)
4. **Capture qualitative and quantitative data** (subjective ratings + usage metrics)
5. **Document reasoning and trade-offs** (for R&D tax and learning)

This journal format should help bridge informal exploration and rigorous experimentation.

---

**Status:** Synthesis complete, clarifying dialogue to follow
**Cross-references:** 5 artifacts linked above
**Next journal:** After clarifying questions and decisions
