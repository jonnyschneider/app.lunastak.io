# Decision Stack v4 - Development Plan
## AI Product Development with Evals Learning Journey

---

## 🎯 Project Goals

### Primary Objectives
1. **Learn evals methodology** through building a real AI product
2. **Ship a closed beta** Decision Stack app (publicly accessible)
3. **Build systematic improvement process** using error analysis and LLM judges
4. **Achieve "good enough"** quality for 100 beta users
5. **Marketing vehicle for Humble Ventures** - Generate leads and showcase AI capabilities
6. **R&D project** - Document for Australian R&D tax claim

### Success Criteria
- ✅ Product works: Users can generate strategies consistently
- ✅ Data flows: Every interaction is logged comprehensively  
- ✅ Top issues identified: Know 3-5 main failure modes through error analysis
- ✅ Improvement visible: Metrics show quality improving week-over-week
- ✅ User satisfaction: >50% of users give positive feedback

---

## 📚 Learning Framework

This project follows the eval methodology from Hamel Husain & Shreya Shankar's course:

1. **Error Analysis First** - Look at real user data before building evals
2. **Open Coding** - Manually label traces to discover failure modes
3. **Axial Coding** - Group failures into categories
4. **LLM-as-Judge** - Automate detection of top failure modes
5. **Continuous Improvement** - Weekly analysis → prompt fixes → measure impact

---

## 🏗️ Architecture Overview

### v3 → v4 Evolution

**v3 (Current):**
- Static form: 3 fields → generate strategy
- No logging/observability
- No user feedback mechanism
- One-shot generation only

**v4 (Target):**
- **Conversational flow:** 3-4 dynamic questions
- **Full trace logging:** Every interaction saved
- **User feedback:** Thumbs up/down, refinement requests
- **Extraction step:** Claude extracts structured context from conversation
- **Iteration support:** Users can refine strategies

---

## 🏛️ Architectural Principles

### Design for Future Flexibility
The strategic analysis will evolve significantly beyond the initial 3-field extraction (industry, target_market, unique_value). Future iterations may include:
- Competitive analysis
- Product experience evaluation
- Technical advantages
- Economies of scale
- Strategic "powers" (Hamilton Helmer framework)
- Other strategic frameworks (Porter's 5 Forces, etc.)

### Architectural Decisions
- **Use flexible JSON schemas** for extracted_context to accommodate future fields without database migrations
- **Keep prompt engineering modular** - separate prompts for each extraction dimension
- **Design for iteration** - users should be able to add more context over time
- **No premature commitments** - avoid locking into specific frameworks or structures early

### Current Scope (Phase 0-1)
For v4 launch, we focus on:
- **3 extraction fields**: industry, target_market, unique_value
- **Output**: Vision → Mission → Objectives (top half of Decision Stack)
- **Future consideration**: Initiatives layer (bottom half of Decision Stack)

> **Note:** The 3-field extraction is intentionally "just enough" to generate a usable Decision Stack. This was validated in v1-v3 iterations.

---

## 📈 Marketing & Growth Strategy

### Beta Launch Campaign
**Goal:** Generate leads for Humble Ventures while collecting user data

**Partnership:** Collaborate with Martin Eriksson
- Private beta rollout to targeted segments
- Controlled access to manage load and quality

**Lead Generation Flow:**
1. Landing page on humventures.com.au subdomain/path
2. Email signup form (integrated with existing mailing list infrastructure)
3. Magic link auth serves dual purpose:
   - Grows Humble Ventures mailing list
   - Provides authentication for the app
4. Onboarding experience highlights AI capabilities

**Messaging Strategy:**
- Position as cutting-edge AI strategy consultant
- "Free beta access - limited spots"
- Showcase Humble Ventures AI expertise
- Collect testimonials for marketing materials

**Validation Through Experimentation:**
- Use fake door tests embedded in product
- Test feature ideas before building (e.g., voice input, document upload)
- Build only what resonates with users
- See FEATURE_BACKLOG.md for experiment ideas

---

## 💰 R&D Tax Documentation

### Australian R&D Tax Incentive
This project qualifies as Research & Development:
- **Technical uncertainty**: Building reliable LLM-based strategy extraction
- **Experimentation**: Testing eval methodologies and improvement cycles
- **Innovation**: Novel application of LLM-as-judge for strategy quality

### What to Track
1. **Time & Effort**
   - Development hours by person
   - Error analysis sessions
   - Experimentation and iteration cycles

2. **Costs**
   - API costs (Claude, other services)
   - Infrastructure costs (Vercel, database)
   - Tools and subscriptions

3. **Technical Documentation**
   - Architecture decisions and why
   - Experiments run and results
   - Failures and learnings
   - Innovation narrative

### Documentation Location
- Time tracking: See `docs/rd-tracking/time-log.md`
- Cost tracking: See `docs/rd-tracking/costs.csv`
- Technical narrative: Captured in PROJECT_STATUS.md phase notes

> **Action Required:** Investigate specific ATO requirements for R&D tax claims

---

## 📋 Implementation Phases

### Phase 0: Foundation (Week 1) - **START HERE**
**Goal:** Build v4 with comprehensive logging and conversation flow

#### Core Features to Build:
1. **Conversational Interface**
   - Chat-style UI (not form)
   - 3 sequential questions with natural follow-ups
   - Show conversation history
   - "Generate Strategy" button after questions complete

2. **Database Schema**
   - Conversations table (conversation sessions)
   - Messages table (Q&A history)
   - Traces table (generation events with full context)

3. **Context Extraction Step**
   - Claude extracts structured context from conversation
   - Confidence scoring (HIGH/MEDIUM/LOW)
   - Optional 4th clarifying question if confidence < HIGH
   - Show extracted context to user for confirmation

4. **User Feedback UI**
   - 👍 Helpful / 👎 Not helpful buttons
   - ✏️ Refine option (for iteration - implement later)

5. **Comprehensive Logging**
   - Every message saved
   - Every Claude call logged with tokens/latency
   - Full conversation → trace linkage

#### Tech Stack for Phase 0:
- **Frontend:** Next.js 14 + TypeScript (keep from v3)
- **Database:** Vercel Postgres + Prisma ORM (from day 1)
- **Auth:** NextAuth.js with magic link email auth
- **API:** Claude API (already integrated in v3)
- **Deployment:** Vercel (default domain for Phase 0)
- **Analytics:** Vercel Analytics (built-in)

#### What NOT to Build Yet:
- ❌ Braintrust integration
- ❌ Jupyter notebooks
- ❌ Eval judges
- ❌ Monitoring dashboards
- ❌ Refinement/iteration flow
- ❌ Advanced features

---

### Phase 1: Launch & Collect Data (Week 2-3)
**Goal:** Get 50-100 traces from real users

#### Tasks:
1. Deploy v4 to Vercel
2. Recruit 100 beta users (LinkedIn, network, etc.)
3. Simple onboarding page
4. Monitor traces accumulating
5. Manual spot-checks (10-20 traces mid-week)

#### Milestone:
- 50+ traces with diverse inputs
- Database contains conversation + trace data

---

### Phase 2: Error Analysis (Week 4)
**Goal:** Identify top 3-5 failure modes

#### Process:
1. **Export traces to CSV**
2. **Open Coding Session:**
   - Review 100 traces manually
   - Write notes on each (e.g., "question unclear", "missed key context", "generic vision")
3. **Axial Coding:**
   - Use Claude to group notes into categories
   - Count frequency of each failure mode
4. **Create pivot table:** Which problems are most common?

#### Tools:
- Jupyter notebooks (NOW introduce them)
- Google Sheets for pivot tables
- Claude for synthesis

#### Expected Failure Modes:
**Conversation Quality:**
- Questions unclear/confusing
- Failed to extract key info from free-form responses
- Lost context between messages
- Irrelevant follow-up questions

**Strategy Quality:**
- Generic vision statements
- Objectives not measurable (SMART)
- Missing info user provided
- Doesn't reflect unique context

#### Deliverable:
```
Failure Mode                    | Count | Example Trace IDs
--------------------------------|-------|------------------
Generic/boring vision           | 23    | #142, #156, #189
Questions felt robotic          | 18    | #103, #144, #201
Missed extraction of key detail | 12    | #088, #129, #177
```

---

### Phase 3: Build First LLM Judge (Week 5)
**Goal:** Automate detection of #1 failure mode

#### Process:
1. Pick most common error (e.g., "generic vision statements")
2. Write LLM-as-judge prompt:
   ```
   Evaluate if this vision statement is generic or specific.
   
   Return TRUE if:
   - Specific to the industry (not generic platitudes)
   - Memorable and distinctive
   - Aspirational but achievable
   
   Return FALSE if:
   - Could apply to any company
   - Uses buzzwords without substance
   - Lacks specificity
   ```
3. Test on 50 labeled traces
4. Calculate confusion matrix (judge vs. your labels)
5. Iterate prompt until 80%+ agreement

#### Tools to Consider:
- **Option A:** Braintrust (for eval infrastructure)
- **Option B:** Python scripts + pandas (simpler, more control)

#### Deliverable:
- Judge prompt with 80%+ accuracy
- Script to run on new traces

---

### Phase 4: Improve & Monitor (Week 6+)
**Goal:** Close the feedback loop

#### Weekly Cycle:
1. Fix top failure mode (update prompts/logic)
2. Run judge on new traces
3. Track metric: "% passing quality checks"
4. Do error analysis on remaining failures
5. Build judge for failure mode #2
6. Repeat

#### Long-term Vision:
- Dashboard showing eval metrics over time
- Cron job running judges automatically
- 30-min weekly error analysis sessions
- Continuous improvement flywheel

---

## 💬 Conversation Flow Design

### The 3 Core Questions

**Question 1: Business Challenge**
```
Prompt: "You are a strategy consultant. Ask them to describe their 
business challenge or opportunity in their own words. Keep it warm, 
conversational, and open-ended."

Example output: 
"What business challenge or opportunity are you working on right now?"
```

**Question 2: Target Market**
```
Prompt: "Based on their description, ask a natural follow-up about 
who they're serving. Reference something specific from their answer."

Example output:
"Got it! When you say small restaurants, who specifically are you 
targeting? Is there a particular type or size?"
```

**Question 3: Differentiation**
```
Prompt: "Ask what makes their approach unique. Make it feel like 
curiosity, not an interrogation."

Example output:
"What makes your approach different from other solutions in this space?"
```

### Context Extraction Step

After 3 questions, Claude extracts structured context:

```xml
<context>
  <industry>Specific industry identified</industry>
  <target_market>Specific customer segment</target_market>
  <unique_value>Key differentiator</unique_value>
  <confidence>HIGH/MEDIUM/LOW</confidence>
</context>

<!-- If confidence < HIGH -->
<missing>
  What information is still unclear or missing
</missing>
```

**User Experience:**
- Show extracted context to user
- Allow corrections/additions
- If confidence < HIGH, ask ONE clarifying question
- Then proceed to strategy generation

---

## 🗄️ Database Schema

### Tables

#### Conversations
```sql
id                uuid PRIMARY KEY
user_id           varchar(255) NOT NULL
created_at        timestamp NOT NULL
updated_at        timestamp NOT NULL
status            enum('in_progress', 'completed', 'abandoned')
```

#### Messages
```sql
id                uuid PRIMARY KEY
conversation_id   uuid REFERENCES conversations(id)
role              enum('assistant', 'user')
content           text NOT NULL
step_number       integer NOT NULL
timestamp         timestamp NOT NULL
```

#### Traces
```sql
id                      uuid PRIMARY KEY
conversation_id         uuid REFERENCES conversations(id)
user_id                 varchar(255) NOT NULL
timestamp               timestamp NOT NULL

-- Extracted Context
extracted_context       jsonb NOT NULL
  {
    industry: string,
    target_market: string,
    unique_value: string,
    extraction_confidence: 'HIGH' | 'MEDIUM' | 'LOW',
    raw_conversation: Message[]
  }

-- Generated Output
output                  jsonb NOT NULL
  {
    vision: string,
    mission: string,
    objectives: string[]
  }
claude_thoughts         text

-- Metadata
model_used              varchar(100)
total_tokens            integer
prompt_tokens           integer
completion_tokens       integer
latency_ms              integer

-- User Feedback (added later)
user_feedback           enum('helpful', 'not_helpful') NULL
feedback_timestamp      timestamp NULL
refinement_requested    boolean DEFAULT false
```

---

## 🎨 UI/UX Requirements

### Conversation Interface
- Chat bubbles (assistant on left, user on right)
- Auto-scroll to latest message
- Loading indicator while Claude thinks
- Clear visual distinction between questions and responses

### Extraction Confirmation
```
┌─────────────────────────────────────────┐
│ Here's what I understood:               │
│                                         │
│ Industry: Restaurant inventory mgmt     │
│ Target Market: Small restaurants (5-20) │
│ Unique Value: Automated reordering AI   │
│                                         │
│ [Edit] [Looks Good →]                   │
└─────────────────────────────────────────┘
```

### Strategy Display
- Same ReactFlow visualization from v3
- Add feedback buttons below:
  - 👍 This is helpful
  - 👎 Not quite right
  - ✏️ Refine this (Phase 2+)

### User Dashboard (Optional Phase 1)
- List of past conversations
- Click to view previous strategies
- Simple profile management

---

## 📊 Metrics to Track

### Product Metrics
- Total conversations started
- Completion rate (% that reach strategy generation)
- User feedback distribution (👍 vs 👎)
- Time spent per session
- Return user rate

### Eval Metrics (Phase 3+)
- % of strategies passing quality checks
- By failure mode:
  - Generic vision rate
  - Non-SMART objectives rate
  - Context loss rate
- Week-over-week improvement

### Technical Metrics
- API latency (p50, p95, p99)
- Token usage per trace
- Error rates
- Database query performance

---

## 🚀 Deployment Strategy

### Phase 0 Deployment
- Deploy to Vercel preview URL
- Test with 5-10 friends first
- Fix critical bugs
- Deploy to production URL

### Phase 1 Deployment
- Custom domain (optional)
- Simple landing page
- Beta signup form
- Email invites to users

### Monitoring
- Vercel Analytics (built-in)
- Error tracking (Sentry optional)
- Database monitoring (Vercel Postgres dashboard)

---

## 🛠️ Development Environment Setup

### Required Tools
- Node.js 18+
- pnpm (or npm)
- PostgreSQL (via Vercel)
- Claude API key
- Vercel account

### Local Development
```bash
# Clone/create repo
git clone [repo] decision-stack-v4
cd decision-stack-v4

# Install dependencies
pnpm install

# Setup database
pnpm prisma generate
pnpm prisma db push

# Run dev server
pnpm dev
```

### Environment Variables
```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

---

## 📁 File Structure

```
decision-stack-v4/
├── prisma/
│   └── schema.prisma           # Database schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── conversation/   # Chat endpoints
│   │   │   ├── extract/        # Context extraction
│   │   │   └── generate/       # Strategy generation
│   │   ├── chat/
│   │   │   └── [id]/          # Conversation view
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   ├── ChatInterface.tsx
│   │   ├── ExtractionConfirm.tsx
│   │   ├── StrategyDisplay.tsx
│   │   └── FeedbackButtons.tsx
│   └── lib/
│       ├── claude.ts           # API wrapper
│       ├── db.ts               # Prisma client
│       └── types.ts            # TypeScript types
├── jupyter/                    # For Phase 2+
│   ├── notebooks/
│   └── requirements.txt
└── docs/
    └── evals/                  # Eval documentation
```

---

## 🎓 Learning Resources

### Key References
- **Podcast:** Lenny's Podcast - Hamel Husain & Shreya Shankar on Evals
- **Course:** Maven - AI Evals for Engineers and PMs
- **Blog:** Hamel's blog on error analysis
- **Tools:** Braintrust docs, Jupyter tutorials

### Concepts to Master
1. **Error Analysis:** Manual trace review with open coding
2. **Axial Coding:** Grouping failures into categories
3. **LLM-as-Judge:** Building reliable binary judges
4. **Confusion Matrix:** Measuring judge accuracy
5. **Theoretical Saturation:** Knowing when to stop labeling

---

## ⚠️ Common Pitfalls to Avoid

### Don't Do This:
- ❌ Skip error analysis and jump straight to evals
- ❌ Use Likert scale (1-5) judges instead of binary
- ❌ Let AI do the open coding (you must do it manually)
- ❌ Build evals for everything (prioritize top failures)
- ❌ Over-engineer Phase 0 (ship fast, iterate)
- ❌ Ignore user feedback data
- ❌ Make perfect the enemy of good

### Do This Instead:
- ✅ Look at data first, always
- ✅ Use binary pass/fail judges
- ✅ Manual coding for first 100 traces
- ✅ Focus on top 3-5 failure modes
- ✅ Ship working product quickly
- ✅ Collect real user data ASAP
- ✅ Embrace "good enough for beta"

---

## 🎯 Phase 0 Acceptance Criteria

Before moving to Phase 1, v4 must have:

### Functionality
- [ ] Users can start a conversation
- [ ] 3 sequential questions are asked naturally
- [ ] Free-form text responses accepted
- [ ] Context extraction shows to user
- [ ] User can edit extracted context
- [ ] Strategy generation works
- [ ] ReactFlow visualization displays
- [ ] Feedback buttons present (even if just logging)

### Technical
- [ ] All conversations saved to database
- [ ] All messages logged with timestamps
- [ ] Traces include full conversation history
- [ ] Claude calls logged with tokens/latency
- [ ] Works on mobile (responsive)
- [ ] Deployed to Vercel
- [ ] Environment variables configured

### Data Quality
- [ ] Can export traces to CSV easily
- [ ] CSV includes all necessary fields for analysis
- [ ] Trace IDs are unique and trackable
- [ ] Timestamps are accurate

### User Experience
- [ ] Flow feels conversational, not form-like
- [ ] No obvious bugs or crashes
- [ ] Load times acceptable (<3s per response)
- [ ] Instructions clear for beta users

---

## 📝 Next Session Instructions for Claude Code

### Context
You are helping build Decision Stack v4 - an AI strategy consultant that helps users articulate their business strategy through conversational interaction. This is a learning project focused on implementing systematic evals methodology.

### Current State
- v3 exists at `/Users/Jonny/Desktop/decision-stack-v3`
- v3 is a working Next.js app with Claude API integration
- v3 uses a static form → we're replacing with conversational flow

### Your Mission: Build Phase 0
Implement the foundation described in this document:

1. **Create new v4 repository structure**
2. **Implement conversational interface** (3-question flow)
3. **Add database layer** (Prisma + Postgres)
4. **Build context extraction step** (with user confirmation)
5. **Implement comprehensive trace logging**
6. **Add user feedback UI** (buttons only, no logic yet)

### Key Constraints
- Keep it simple - no over-engineering
- Reuse working v3 components where possible
- Focus on data collection, not polish
- Every interaction must be logged
- Ship fast, iterate later

### Technical Preferences
- Next.js 14 with App Router
- TypeScript (strict mode)
- Tailwind CSS (from v3)
- Prisma ORM
- Vercel Postgres
- NextAuth.js for auth

### First Steps
1. Review v3 code structure
2. Design database schema (Prisma)
3. Build conversation API endpoints
4. Create chat UI components
5. Implement extraction flow
6. Test end-to-end
7. Deploy to Vercel

### Success = Phase 0 Acceptance Criteria (above)

### Questions to Ask Jonny
- Where should v4 repo live?
- Preferred auth provider? (GitHub/Google/Email)
- Domain name for deployment?
- Any v3 components to definitely keep/remove?

---

## 🙋 FAQ

**Q: Why not start with Jupyter/Braintrust immediately?**  
A: You need data first. Tools are only useful once you have traces to analyze.

**Q: Can I skip manual error analysis?**  
A: No. This is the most important step. AI cannot replace your judgment here.

**Q: How many traces before building judges?**  
A: At least 50-100. You need to see patterns emerge.

**Q: What if users don't engage?**  
A: Make the conversation more interesting. Use error analysis to find out why.

**Q: Binary judges feel limiting?**  
A: They're more reliable than scores. You can always build multiple binary judges.

**Q: How long until the product is "good"?**  
A: Plan for 6-8 weeks of iteration. Good enough ≠ perfect.

---

## 📅 Timeline Summary

| Phase | Duration | Goal |
|-------|----------|------|
| Phase 0 | Week 1 | Build v4 foundation |
| Phase 1 | Week 2-3 | Launch beta, collect 50+ traces |
| Phase 2 | Week 4 | Error analysis, identify top failures |
| Phase 3 | Week 5 | Build first LLM judge |
| Phase 4 | Week 6+ | Continuous improvement cycle |

**Total to "good enough":** 6-8 weeks

---

## ✅ Definition of Done

**This project succeeds when:**

1. ✅ You deeply understand how to do error analysis
2. ✅ You can build reliable LLM-as-judge evals
3. ✅ You have a working AI product in production
4. ✅ You can demonstrate measurable improvement over time
5. ✅ You have 100 real users who got value from the product
6. ✅ You have a portfolio piece showcasing eval methodology

**Remember:** The goal is learning evals, not building the perfect strategy tool. Good enough is good enough.

---

## 📚 Related Documents

- **PROJECT_STATUS.md** - Phase-by-phase progress tracking and session notes
- **FEATURE_BACKLOG.md** - Potential features and experiment ideas
- **docs/rd-tracking/** - R&D tax documentation

---

Last updated: 2025-12-07
Version: 1.1
Updated with architectural principles, marketing strategy, and R&D tracking.
