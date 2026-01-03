# Future Improvements

## Intake & Question Flow Enhancement

**Context:** Current initial question is very open-ended ("What business challenge or opportunity are you working on?"). Need stronger pre-requisites to collect higher quality information for strategy generation.

**Observation:** The quality of strategy output depends heavily on understanding:
- Industry context
- Target market specifics
- Unique value proposition
- Competitive positioning
- Current business stage/maturity

**Options to explore:**
1. Structured intake form before conversation
2. Guided conversation with stricter question sequence
3. Lens-specific question tailoring

**Next steps:**
- Dedicated brainstorming session
- Review what information is truly required vs. nice-to-have
- Consider trade-offs between conversation naturalness and information completeness
- Look at successful strategy frameworks for required inputs

**Date noted:** 2025-12-10

---

## Lens Inference & Iterative Development

**Context:** Moving away from explicit lens selection toward inferred focus areas, with support for iterative development over multiple sessions.

### Core Context Assumption

**Target domain:** Digital strategy for SaaS products and services
- **Range:** Pre-seed startups → teams/divisions in Fortune 500 companies
- **Safe assumption:** Technology focus (while useful for other businesses, optimize for digital/SaaS)
- **Implication:** Can assume certain baseline knowledge (e.g., digital business models, recurring revenue, product-market fit concepts)

### Lens Inference Approach

**Current state:** Explicit lens selection (A/B/C/D/E choice after first question)

**Future direction:** Infer lens from focus area questions

**Example opening:**
> "What would you like to focus on developing?"
> - Understanding the customer problem you're solving
> - Your competitive differentiation and market position
> - Growth economics and scalability
> - Product capabilities and roadmap
> - Operational efficiency and delivery
> - [Let me guide you based on your context]

**Why inference over explicit selection:**
- More natural conversation entry
- User thinks about what matters to them, not abstract "lenses"
- Focus areas are concrete and actionable
- Still guides dimensional exploration, just more contextually

### Multi-Session Iterative Development

**Vision:** Same user develops their Decision Stack across multiple sessions, each focusing on different dimensions.

**User journey examples:**

**Early-stage founder:**
1. Session 1: Customer problem focus → develops initial Vision/Mission
2. Session 2: Competitive differentiation → refines positioning, adds Objectives
3. Session 3: Growth economics → adds Initiatives around scaling

**Enterprise product team:**
1. Session 1: Product capabilities → aligns on technical Vision
2. Session 2: Customer segments → refines target market and Mission
3. Session 3: Operational efficiency → develops execution Objectives

**Technical requirements:**
- State persistence across sessions
- Version tracking of Decision Stack evolution
- Ability to "pick up where we left off"
- Show what's already developed vs. what's unexplored
- Merge/refine rather than overwrite previous work

**Benefits:**
- Matches reality of strategy development (iterative, not one-shot)
- Reduces pressure to "get it perfect" in one conversation
- Allows focus on one dimension at a time (less overwhelming)
- Natural evolution as business context changes

### Multi-Contributor Convergence (Future Vision)

**Long-term vision:** Multiple contributors develop separate or complementary Decision Stacks, eventually converging into unified executive-owned strategy.

**Scenarios:**

**Team-based development:**
- Customer Success: Develops stack focused on customer outcomes
- Product: Develops stack focused on technical capabilities
- Sales: Develops stack focused on market positioning
- Executive team: Reviews all inputs, synthesizes into unified stack

**Cross-functional iteration:**
- Different stakeholders contribute to same stack from their lens
- System tracks contributions, perspectives, tensions
- Facilitated convergence process to resolve conflicts and integrate views

**Technical challenges:**
- Multi-user state management
- Conflict resolution when perspectives differ
- Attribution tracking (who contributed what)
- Merge/synthesis workflows
- Ownership and approval flows

**Strategic value:**
- Captures organizational knowledge, not just founder/leader knowledge
- Surfaces healthy tensions between perspectives (customer vs. technical vs. financial)
- Creates buy-in through participation
- Richer, more comprehensive strategies

**Dependencies:**
- First solve single-user multi-session (simpler)
- Learn from how real teams actually collaborate
- Requires authentication and access control

**Date noted:** 2025-12-12

---

## Domain-Specific Strategic Models (Premium Feature)

**Context:** From taxonomy design session (2026-01-03). The universal strategic dimensions work for general product strategy, but high-value assessments (e.g., VC due diligence, industry-specific evaluations) require bespoke domain models.

**Observation:** Jonny's consulting work includes domain-specific evaluation frameworks (e.g., 4PL logistics maturity model, retail media competitive evaluation). These take 2-3 days of consulting work to develop and provide significantly deeper, more relevant assessment than generic frameworks.

**Proposed Model:**

1. **Premium Consulting Service:** Jonny leads research to develop domain-specific model for a vertical (e.g., HealthTech, FinTech, Logistics SaaS)

2. **Side-load to Lunastak:** Domain model becomes available as a "lens" or "mode" within the app, enabling:
   - Domain-specific questioning (e.g., "Carrier integration depth" for logistics)
   - Domain-aware extraction (maps to industry-specific dimensions)
   - Domain-relevant generation (benchmarks against industry norms)

3. **User Experience:**
   - User selects or is detected as being in a specific domain
   - Conversation, extraction, and generation adapt accordingly
   - Outputs include domain-specific assessments and benchmarks

**Examples from existing work:**
- **4PL Logistics:** Areas of Value (Cost Optimisation, E2E Orchestration, Visibility, Customer Success, Data)
- **Product Maturity:** People & Team, Value Aligned Delivery, Technical Architecture dimensions with Level 0-5 rubrics
- **VC Diligence:** Strategic Clarity, Customer Fit, Product Economics, Unfair Advantage

**Technical Requirements:**
- Domain model schema (dimensions, sub-dimensions, assessment criteria)
- Model loading/selection mechanism
- Domain-aware prompt templates (questioning, extraction, generation)
- Benchmark data storage (optional, for comparative assessment)

**Business Model:**
- Premium tier feature (not available in free/standard)
- Consulting engagement to develop model ($X,XXX)
- Ongoing access via subscription or per-use
- Potential: Marketplace for domain models (contributed by domain experts)

**Priority:** Future enhancement (after core taxonomy and multi-session are proven)

**Date noted:** 2026-01-03

---

## Voice Memo Capture & Takeover UI

**Context:** From taxonomy design session (2026-01-03). Leaders have strategic thoughts at unexpected moments (in the car, running, shower). Current app requires active conversation sessions, missing these valuable fragments.

**Core Insight:** Strategy development is fragmented and iterative. Leaders percolate, hear something that sparks a thought, and later connect dots in unexpected ways. We need to capture this thinking when it happens.

**Proposed Features:**

### 1. Voice Memo Capture
- User records voice memo at any time (mobile-first)
- Transcription via speech-to-text
- Model analyses and tags to strategic dimensions
- Fragment added to user's strategic context corpus
- Synthesis updated asynchronously

### 2. "Takeover" UI Experience
- Proactive engagement: app poses 1 approachable question
- User records voice response
- Transcribe → Extract → Synthesise → Capture
- Next question "riffs" on previous response (dynamic chaining)

**Technical Challenge:** Real-time dynamic questioning is hard (transcribe + extract + synthesise + generate question). 

**Alternative:** "Canned questions" designed to elicit different types of information mapped to taxonomy dimensions:
- "Tell me about a recent customer conversation that surprised you" → Customer & Market
- "What's the one thing competitors can't easily copy?" → Differentiation & Advantage  
- "What keeps you up at night about this business?" → Risks & Constraints
- "If you had unlimited resources, what would you build first?" → Strategic Intent

### 3. Unstructured "Record Now" Option
- For unplanned epiphanies
- No prompt, just capture
- Model tags and categorises after the fact

**Dependencies:**
- Baseline taxonomy must be established first
- Multi-session state persistence
- Speech-to-text integration
- Mobile-friendly UI

**Validation Approach:**
- Fake door test for demand
- Prototype with small user group
- Measure: Do people actually use it? Does it improve synthesis quality?

**Priority:** Future enhancement (after core taxonomy proven with conversation-based capture)

**Date noted:** 2026-01-03
