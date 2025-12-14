# Decision Stack v4 - Developer Guide

**Last Updated:** 2025-12-15
**Current Status:** Baseline-v1 (Control Variant) - Production Deployment Complete
**Active Branch:** development
**Production:** https://strategist.humventures.com.au

---

## 🚀 Quick Start for New Sessions

### 1. Read Current State (Start Here!)
```bash
# Understand what exists NOW
- docs/session-notes/_session-notes-combined.md  # What's been built (chronological)
- docs/deployment/README.md                      # Deployment guide and current state
- docs/experiments/EXPERIMENT_REGISTER.md        # Active experiments and variants
- docs/journal/                                  # Research synthesis and learnings
```

### 2. Check Active Work
```bash
# What's in progress
- git status                          # Any uncommitted changes
- git log -5 --online                # Recent commits
- docs/experiments/EXPERIMENT_REGISTER.md  # Current experiment status
```

### 3. Review Historical Context (Optional)
```bash
# Research and strategic thinking
- docs/journal/                       # Synthesis journals (e.g., extraction-generation learnings)
- docs/framework-reference/           # Quality criteria and Decision Stack examples
- docs/plans/                         # Implementation plans from recent work
```

---

## 📊 Current State (As Built)

### What Exists Now

**Baseline-v1 (Control Variant)** ✅
- Normalized, simplified conversation flow for systematic experimentation
- 3-10 question adaptive flow with confidence-based stopping
- Simplified multi-phase conversation: INITIAL → QUESTIONING → COMPLETE
- Enhanced context extraction with enrichment + reflective summary
- Honest UX about what we can generate (Vision, Mission, Objectives) vs future features (Initiatives, Principles)

**Instrumentation & Measurement** ✅
- Comprehensive event tracking (fake door clicks, info icon views, extraction choices)
- Quality rating system (researcher-only, binary good/bad)
- Experiment variant tagging (baseline-v1, emergent-extraction, etc.)
- User feedback (helpful/not helpful, separate from quality ratings)
- Jupyter notebook analysis workflow

**Database Schema** ✅
- Conversation tracking with phase management and variant tagging
- Message history with confidence scores
- Comprehensive trace logging with quality ratings
- Event model for user interaction tracking

**API Routes** ✅
- `/api/conversation/start` - Initialize conversation with variant tagging
- `/api/conversation/continue` - Simplified flow (INITIAL → QUESTIONING → COMPLETE)
- `/api/conversation/assess-confidence` - Real-time confidence scoring
- `/api/extract` - Enhanced context extraction (core + enrichment + reflective summary)
- `/api/generate` - Strategy generation using enriched context
- `/api/feedback` - User feedback collection (helpful/not helpful)
- `/api/events` - Event logging for user interactions
- `/api/quality-rating` - Researcher quality assessments (good/bad)

**UI Components** ✅
- ChatInterface - Multi-line conversation UI (8 rows, Cmd+Enter to send)
- ExtractionConfirm - Context review with three-option UI (continue/flag for later/dismiss)
- StrategyDisplay - Enhanced display with info icons, edit buttons (fake doors), accordion for Strategic Thinking
- FeedbackButtons - Simple helpful/not helpful buttons
- InfoModal - Educational content for Decision Stack elements
- Simplified Objectives display (removed flip interaction, filter toggles)
- Placeholder cards for Initiatives and Principles (fake door CTAs)

**Analysis Workflow** ✅
- Jupyter-based workflow for trace and event analysis
- Python helper library (`scripts/trace_analysis.py`) with event loading
- Starter notebook with experiment comparison examples
- Quality rating and variant comparison capabilities

### Tech Stack (As Implemented)

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database:** Vercel Postgres + Prisma ORM
- **AI:** Claude API (claude-sonnet-4.5) via @anthropic-ai/sdk
- **Visualization:** ReactFlow
- **Deployment:** Vercel (main branch only via vercel.json)
- **Analysis Tools:** Python + Jupyter + pandas + SQLAlchemy

---

## 🎯 Active Work & Experiment Framework

### Current Status

**Baseline-v1 Deployed** ✅
- Production deployment at https://strategist.humventures.com.au
- Comprehensive instrumentation and measurement in place
- Ready for systematic experimentation
- See: `docs/experiments/EXPERIMENT_REGISTER.md` for full experiment tracking

### Active Experiments

**E0: Baseline-v1** 🟢 Complete
- Status: Infrastructure validated through UAT, deployed to production
- Purpose: Establishes normalized control for all future experiments
- See: `docs/experiments/one-pagers/E0-baseline-v1.md`

**E1: Emergent Extraction** ⚪ Planned (Next)
- Hypothesis: Emergent theme extraction will produce less "wooden" outputs than prescriptive fields
- Target: 10-15 participants for comparison with baseline-v1

**E2: Energetic Prompts** ⚪ Planned
- Hypothesis: Energetic generation prompts will reduce generic corporate speak

**E3: Lens Inference** ⚪ Planned
- Hypothesis: Inferring strategic focus from conversation beats explicit selection

### Known Limitations

1. **No authentication yet** - Using temp user IDs for now
2. **Limited to Vision/Mission/Objectives** - Initiatives and Principles are fake doors
3. **Single-session only** - Multi-session strategy development is future enhancement

---

## 🏗️ Architecture

### Database Schema

**Conversation Model:**
- Tracks user conversations with phase management and experiment variant tagging
- Fields: `id`, `userId`, `status`, `currentPhase`, `questionCount`, `experimentVariant`
- Phases: INITIAL | QUESTIONING | COMPLETE
- Variant examples: `baseline-v1`, `emergent-extraction`, `energetic-prompts`

**Message Model:**
- Stores conversation history
- Fields: `id`, `conversationId`, `role`, `content`, `stepNumber`, `confidenceScore`, `confidenceReasoning`

**Trace Model:**
- Comprehensive logging for evals and quality assessment
- Stores: extracted context (JSON), generated output (JSON), Claude thoughts
- Metrics: tokens, latency, model used
- Feedback: user rating (helpful/not helpful)
- Quality: researcher rating (good/bad), rating timestamp
- Events: related Event records for user interactions

**Event Model:**
- Tracks user interactions for feature demand and behavior analysis
- Fields: `id`, `conversationId`, `traceId`, `timestamp`, `eventType`, `eventData`
- Event types: `fake_door_click`, `info_icon_view`, `extraction_choice`, `quality_rating`

### API Architecture

**Conversation Flow:**
1. `POST /api/conversation/start` - Initialize with opening question
2. `POST /api/conversation/continue` - Handle responses, phase transitions, lens selection
3. `POST /api/conversation/assess-confidence` - Real-time confidence assessment
4. `POST /api/extract` - Extract enhanced context when ready
5. `POST /api/generate` - Generate strategy from enriched context
6. `POST /api/feedback` - Collect user feedback

**Context Types:**
- `EnhancedExtractedContext` (current) - core + enrichment + reflective_summary
  - Core: industry, target_market, unique_value
  - Enrichment: competitive_context, customer_segments, operational_capabilities, technical_advantages
  - Reflective Summary: strengths, emerging themes, opportunities_for_enrichment (renamed from unexplored), thought prompts

### Component Structure

```
src/
├── app/
│   ├── page.tsx                    # Main orchestration (chat → extraction → strategy)
│   └── api/                        # API routes
├── components/
│   ├── ChatInterface.tsx           # Multi-line conversation UI
│   ├── ExtractionConfirm.tsx       # Three-option context review
│   ├── StrategyDisplay.tsx         # Enhanced display with info icons, fake doors
│   ├── FeedbackButtons.tsx         # User feedback (helpful/not helpful)
│   ├── InfoModal.tsx               # Educational content modal
│   ├── FlipCard.tsx                # 3D flip card component
│   └── ui/                         # shadcn/ui components (Accordion, Card, Badge)
└── lib/
    ├── types.ts                    # TypeScript definitions
    ├── db.ts                       # Prisma client
    ├── claude.ts                   # Claude API client
    ├── events.ts                   # Event logging helpers
    └── utils.ts                    # XML parsing, etc.
```

**See `docs/deployment/README.md` for deployment guide and architecture notes**

---

## 🔄 Key Workflows

### Development Workflow

**Git Strategy:**
- Work on `development` branch (WIP allowed)
- **Agent commits directly** as work completes (no approval needed)
- Jonny controls `development` → `main` merges
- Vercel auto-deploys only from `main` (configured in vercel.json)

**Commit Workflow:**
1. Agent commits to development when work is done
2. Good descriptive commit messages (feat:, fix:, docs:, etc.)
3. Update `session-notes.md` throughout session
4. At session end: Add summary to `session-notes.md`

**Release Workflow:**
1. Jonny reviews development branch when ready
2. Jonny merges to main with release notes
3. Push to main triggers Vercel deployment

**Why this way:** Fast iteration on dev, controlled releases to production

### Superpowers Integration

**For Feature Development:**
- `/superpowers:brainstorm` - Design refinement and requirements
- `/superpowers:write-plan` - Create implementation plans (bite-sized tasks)
- `/superpowers:execute-plan` - Execute with TDD, code review, systematic approach

**Important:**
- ✅ Use superpowers for systematic feature development
- ✅ Check constraints below BEFORE planning
- ✅ Auto-commit is now ALLOWED - commits to development automatically
- ✅ Update session-notes.md to summarize what was built

### Testing & Debugging

**Local Development:**
```bash
npm run dev          # Start dev server (http://localhost:3000)
npx prisma studio    # View database
npm run build        # Test production build
```

**Logging:**
- Frontend: Check browser DevTools console for `[Generate]` and other logs
- Backend: Check terminal running `npm run dev` for `[API]` logs
- Database: Use Prisma Studio or `scripts/trace_analysis.py`

---

## ⚠️ Important Constraints

### Git Management (Updated)
- **Do** commit directly to development branch as work completes
- **Do** write good descriptive commit messages
- **Do NOT** merge to main or push main - Jonny controls releases

### R&D Tax Documentation
- **Do** track time and decisions in session-notes.md
- **Do** document technical reasoning and experiments
- **Why:** Australian R&D tax claim requirements

### Validated Learning
- **Do NOT** build features without validation
- **Do** use fake door tests for feature ideas
- **Do** capture ideas in readme/archive/original-plan/FEATURE_BACKLOG.md
- **Why:** Build what users want, not assumptions

### Architecture Flexibility
- **Do** use flexible JSON schemas (extractedContext, output)
- **Do NOT** commit to rigid structures prematurely
- **Do** design for iteration and evolution
- **Why:** Strategic analysis will expand beyond current fields

### Simplicity First
- **Do NOT** over-engineer
- **Do** ship working product quickly
- **Do** embrace "good enough for beta"
- **Why:** Learning project, iterate based on real data

---

## 🎓 Domain Knowledge

### Decision Stack Framework

**Current Implementation:**
- **Vision** - Aspirational future state (where we want to be)
- **Mission** - Current purpose and focus (what we do now)
- **Objectives** - SMART goals (3 per strategy, actionable and measurable)

**Future Enhancements (Fake Doors):**
- **Initiatives** - Key projects/workstreams that support objectives
- **Principles** - Decision-making guidelines and cultural values

**Target Domain:** Digital strategy for SaaS products and services (pre-seed to Fortune 500)

### Experimentation Methodology

**Systematic A/B Testing:**
1. Establish baseline with comprehensive measurement (E0: baseline-v1)
2. Test single variable changes in parallel experiments
3. Compare quality ratings (good/bad %) and user feedback (helpful %)
4. Merge successful variants to main, document failed experiments

**Quality Assessment:**
- Researcher ratings: Binary good/bad on strategy outputs
- User feedback: Helpful/not helpful on generated strategies
- Event tracking: Feature demand via fake door clicks
- Dimensional coverage: Ensure framework completeness

**Current Focus:** Improving "wooden output" problem through extraction and generation experiments

---

## 📚 Documentation Map

### Session & Historical Context
- `docs/session-notes/_session-notes-combined.md` - Chronological session summaries (START HERE)
- `docs/session-notes/2025-12-13_baseline-v1-normalization-and-instrumentation.md` - Latest major session
- `docs/journal/2025-12-12-extraction-generation-learnings.md` - Research synthesis on "wooden output" problem

### Deployment & Operations
- `docs/deployment/README.md` - Deployment guide for production
- `docs/deployment/RELEASE_NOTES.md` - Version history and release notes
- `docs/deployment/DEVELOPMENT.md` - Development setup instructions

### Experiment Framework
- `docs/experiments/EXPERIMENT_REGISTER.md` - Central index of all experiments
- `docs/experiments/one-pagers/E0-baseline-v1.md` - Baseline variant documentation
- Future one-pagers for E1-E5 experiments

### Framework Reference
- `docs/framework-reference/QUALITY_CRITERIA.md` - What makes good strategy outputs
- `docs/framework-reference/example-humble-ventures-decision-stack.md` - Real Decision Stack example
- `docs/framework-reference/original-product-vision-2025-02.md` - Original product thinking

### Implementation Plans
- `docs/plans/` - Detailed implementation plans for recent features
- `docs/feature-backlog/` - Future feature ideas and validated learning notes

### Process Documentation
- `.claude/workflow.md` - Detailed commit and git procedures
- `.claude/superpowers-integration.md` - Hybrid superpowers strategy

---

## 🤖 Working with Claude Code

### Communication Style
- Brief, concise responses (CLI-appropriate)
- No emojis unless requested
- Focus on technical accuracy over validation
- Disagree when necessary (rigorous standards)

### Tool Usage
- Use TodoWrite for multi-step tasks
- Prefer Read tool over bash for file operations
- Use Task tool for complex exploration
- Always call multiple independent tools in parallel when possible

### Planning Without Timelines
- Provide concrete steps, not time estimates
- Never suggest "this will take X weeks"
- Focus on what needs to be done, not when
- Let Jonny decide scheduling

---

## 💡 Session Startup Checklist

1. ✅ Read `docs/session-notes/_session-notes-combined.md` to understand what's been built
2. ✅ Review `docs/experiments/EXPERIMENT_REGISTER.md` for current experiment status
3. ✅ Check `git status` for current branch and uncommitted changes
4. ✅ Review `docs/deployment/README.md` if touching deployment or architecture
5. ✅ Use TodoWrite to track progress during session
6. ✅ Update session notes with session summary before ending (create new dated file in `docs/session-notes/`)

---

_This is a living document. Update as implementation evolves._
