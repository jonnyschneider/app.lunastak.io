# Feature Backlog

**Last Updated:** 2025-12-07

---

## About This Document

This backlog captures potential features and experiments for Decision Stack v4.

**Important Principles:**
- Brief summaries only (not detailed specs)
- Only capture customer-facing value (not infrastructure/technical items)
- Build only what's validated through data and experimentation
- Use fake door tests to validate demand before building

**Template:**
- **Feature Name**
- **Description:** Bullet list of what it does
- **Target User:** Who benefits
- **Expected Value:** What problem it solves
- **Evidence/Validation:** Why we think this matters

---

## Backlog Status

| Feature | Status | Priority | Validation Method | Phase |
|---------|--------|----------|-------------------|-------|
| Voice-to-Text Input | 💡 Idea | Medium | Fake door test | TBD |
| Document Upload | 💡 Idea | Medium | Fake door test | TBD |
| Initiatives Layer | 💡 Idea | Low | Data analysis | Phase 3+ |
| Competitive Analysis | 💡 Idea | Low | User interviews | Phase 2+ |
| Strategy Refinement/Iteration | 💡 Idea | High | User feedback | Phase 1 |

**Status Legend:**
- 💡 Idea - Captured but not validated
- 🧪 Validating - Fake door test or user research in progress
- ✅ Validated - Data shows users want this
- 🚧 Building - In active development
- ✔️ Shipped - Live in production
- ❌ Rejected - Tested but not valuable enough

---

## Features

### Voice-to-Text Input

**Description:**
- Allow users to speak responses instead of typing
- Especially useful for mobile users
- Could integrate with browser's native speech-to-text or service like Deepgram

**Target User:**
- Busy executives and founders
- Mobile-first users
- Users who think better verbally than in writing

**Expected Value:**
- Reduces friction in conversation flow
- Captures richer, more natural responses
- Better mobile experience

**Evidence/Validation:**
- Hypothesis: Users struggle with text input on mobile
- Hypothesis: Verbal responses are richer than typed ones
- **Validation method:** Fake door test - show "🎤 Speak instead" button, track clicks
- **Success criteria:** >20% click rate = worth building

---

### Document Upload for Context Extraction

**Description:**
- Allow users to upload documents (PDFs, slides, strategy docs)
- Extract relevant context automatically
- Pre-populate conversation or extraction fields

**Target User:**
- Users with existing strategy documents
- Consultants with client materials
- Teams with prior work to build on

**Expected Value:**
- Saves time re-typing existing information
- Leverages work already done
- More accurate extraction from structured docs

**Evidence/Validation:**
- Hypothesis: Users have existing documents they want to build from
- Hypothesis: Typing everything from scratch is friction
- **Validation method:** Fake door test - show "📎 Upload document" option, track interest
- **Success criteria:** >15% engagement = worth building
- **Risk:** Complex to implement well, may not be v4 scope

---

### Strategy Refinement/Iteration

**Description:**
- Allow users to edit generated strategy
- Re-run generation with modified context
- Conversational refinement ("make the vision more aspirational")
- Version history of iterations

**Target User:**
- All users (core feature)
- Especially users who need to workshop their strategy

**Expected Value:**
- Rarely perfect on first try
- Iterative refinement is how good strategy emerges
- Builds confidence that output reflects their vision

**Evidence/Validation:**
- **Deferred to Phase 1** - placeholder in v4
- Will measure via user feedback: "Would you want to refine this?"
- Track how many users click "👎 Not quite right"
- **Success criteria:** >30% negative feedback = iteration feature needed

**Priority:** High (core value prop)

---

### Initiatives Layer (Bottom Half of Decision Stack)

**Description:**
- Extend Decision Stack beyond Vision → Mission → Objectives
- Add Initiatives layer (concrete projects/workstreams)
- Map initiatives to objectives
- Timeline and sequencing

**Target User:**
- Users who want complete strategic plan
- Teams ready to execute
- Product/project managers

**Expected Value:**
- Completes the Decision Stack framework
- Bridges strategy to execution
- More actionable output

**Evidence/Validation:**
- Hypothesis: Objectives alone aren't actionable enough
- **Validation method:** User interviews after Phase 1
- Ask: "What would you do with this strategy next?"
- Track: Do users ask "What should we actually build?"
- **Success criteria:** >40% ask for execution guidance

**Priority:** Low for Phase 0-1 (focus on top half first)

---

### Competitive Analysis Module

**Description:**
- Ask questions about competitors
- Extract competitive positioning
- Identify whitespace opportunities
- Generate differentiation recommendations

**Target User:**
- Founders in crowded markets
- Product managers
- Strategy consultants

**Expected Value:**
- Better differentiation insights
- Identifies gaps in market
- Strengthens unique value proposition

**Evidence/Validation:**
- Hypothesis: Differentiation is hard without competitive context
- **Validation method:** Error analysis in Phase 2
- Track: How often do strategies lack clear differentiation?
- Track: Do users mention competitors in conversation?
- **Success criteria:** >50% of users reference competitors = add this module

**Priority:** Medium (depends on Phase 2 error analysis)

---

### Technical Advantages / Product Experience Module

**Description:**
- Extract technical differentiation
- Understand product experience and UX advantages
- Capture engineering/design moats

**Target User:**
- Technical founders
- Product-led companies
- SaaS businesses

**Expected Value:**
- Better captures technical differentiation
- Identifies defensibility through tech/product
- More relevant for technical products

**Evidence/Validation:**
- Hypothesis: Generic extraction misses technical nuances
- **Validation method:** Review traces where users describe technical products
- Track: Does current extraction capture technical advantages well?
- **Success criteria:** >30% of traces lose technical context = build this

**Priority:** Low (wait for data)

---

### Strategic Powers Framework (Hamilton Helmer)

**Description:**
- Analyze strategy through 7 Powers lens:
  - Scale economies
  - Network effects
  - Counter-positioning
  - Switching costs
  - Branding
  - Cornered resource
  - Process power
- Identify which powers apply
- Strengthen strategic narrative

**Target User:**
- Strategy enthusiasts
- Investors evaluating businesses
- Founders building defensibility

**Expected Value:**
- Structured strategic thinking
- Identifies competitive moats
- Framework-driven rigor

**Evidence/Validation:**
- Hypothesis: Users want framework-based analysis
- **Validation method:** User research with strategy-savvy users
- Ask: "What strategic frameworks do you use?"
- Track: References to "moats", "defensibility", "competitive advantage"
- **Success criteria:** >20% of target users request framework-based analysis

**Priority:** Low (nice-to-have, not core)

---

### Porter's 5 Forces Integration

**Description:**
- Analyze industry structure:
  - Threat of new entrants
  - Bargaining power of suppliers
  - Bargaining power of buyers
  - Threat of substitutes
  - Competitive rivalry
- Generate industry attractiveness assessment

**Target User:**
- MBA types
- Consultants
- Investors doing market analysis

**Expected Value:**
- Industry-level strategic context
- Identifies structural challenges/opportunities
- Classic strategic framework

**Evidence/Validation:**
- Hypothesis: Users want industry analysis
- **Validation method:** User interviews
- Ask: "What industry factors affect your strategy?"
- **Success criteria:** >25% want industry analysis = build module

**Priority:** Low (Phase 3+)

---

### Real-Time Collaboration

**Description:**
- Multiple team members in same conversation
- Real-time editing of extracted context
- Comments and discussion threads
- Shared strategy workspace

**Target User:**
- Teams (not solo founders)
- Consultants working with clients
- Executive teams workshopping strategy

**Expected Value:**
- Collaborative strategy development
- Consensus building
- Multiplayer experience

**Evidence/Validation:**
- Hypothesis: Strategy is a team sport
- **Validation method:** Track user patterns
- Measure: Do users share output with teammates?
- Ask: "Who else should see this?"
- **Success criteria:** >40% share with team = add collaboration

**Priority:** Low (Phase 2+ at earliest)

---

### Strategy Templates by Industry

**Description:**
- Pre-built templates for common industries
- Industry-specific questions
- Benchmarks and best practices
- Example strategies from similar companies

**Target User:**
- First-time founders
- Users in established industries
- People who want guidance

**Expected Value:**
- Faster time to value
- Learn from best practices
- Confidence through examples

**Evidence/Validation:**
- Hypothesis: Users want industry-specific guidance
- **Validation method:** Track questions asked
- Measure: Do users ask "What do others in my industry do?"
- **Success criteria:** >30% want examples = build templates

**Priority:** Medium (depends on user requests)

---

### Export & Integration

**Description:**
- Export to PDF/PowerPoint/Notion
- Integration with project management tools
- API for custom integrations
- Embed in other tools

**Target User:**
- Users who need to present strategy
- Teams using PM tools (Asana, Linear, etc.)
- Companies with existing workflows

**Expected Value:**
- Strategy lives where work happens
- Easier to socialize and execute
- Fits into existing processes

**Evidence/Validation:**
- **Validation method:** User feedback
- Ask: "Where would you use this strategy?"
- Track: Screenshot/copy-paste behavior
- **Success criteria:** >50% want to export = add export features

**Priority:** Medium (Phase 1-2)

---

## Experiments Queue

_Fake door tests and experiments to run_

### Planned Experiments

| Experiment | Hypothesis | Method | Success Criteria | Status |
|------------|------------|--------|------------------|--------|
| Voice Input Test | Users want to speak instead of type | Fake door button "🎤 Speak" | >20% click | Not started |
| Document Upload Test | Users have existing docs to upload | Fake door button "📎 Upload" | >15% click | Not started |

### Completed Experiments

_None yet_

---

## Rejected Ideas

_Ideas we tested but decided not to pursue_

_None yet_

---

## Notes

**Validation Philosophy:**
- Data over opinions
- Test with fake doors before building
- Use error analysis to find real problems
- Build for validated needs, not hypothetical ones

**Prioritization:**
- Phase 0-1: Core flow + basic features only
- Phase 2+: Let user feedback and error analysis drive roadmap
- Always ask: "Do we have evidence this matters?"
