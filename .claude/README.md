# Decision Stack v4 - Developer Guide

**Last Updated:** 2025-12-09
**Current Status:** Phase 1 Implementation - Adaptive Conversation Flow
**Active Branch:** development

---

## 🚀 Quick Start for New Sessions

### 1. Read Current State (Start Here!)
```bash
# Understand what exists NOW
- session-notes.md                    # What's been built (chronological)
- readme/CURRENT_ARCHITECTURE.md      # System as implemented
- docs/issues-and-bugfixes.md         # Known issues and fixes
```

### 2. Check Active Work
```bash
# What's in progress
- git status                          # Any uncommitted changes
- git log -5 --oneline                # Recent commits
```

### 3. Review Historical Context (Optional)
```bash
# Where we started vs where we ended up
- readme/archive/original-plan/       # Initial planning docs (outdated but useful context)
- docs/plans/                         # Implementation plans from recent work
```

---

## 📊 Current State (As Built)

### What Exists Now

**Adaptive Conversation Flow** ✅
- 3-10 question adaptive flow with confidence-based stopping
- 6 strategic lenses for targeted depth exploration
- Multi-phase conversation: INITIAL → EXPLORING → LENS_SELECTION → QUESTIONING → COMPLETE
- Real-time confidence assessment (HIGH/MEDIUM/LOW)
- Enhanced context extraction with enrichment + reflective summary

**Database Schema** ✅
- Conversation tracking with phase management
- Message history with confidence scores
- Comprehensive trace logging
- Error coding fields for Phase 2 analysis

**API Routes** ✅
- `/api/conversation/start` - Initialize conversation
- `/api/conversation/continue` - Multi-phase flow with lens selection
- `/api/conversation/assess-confidence` - Real-time confidence scoring
- `/api/extract` - Enhanced context extraction (core + enrichment + reflective summary)
- `/api/generate` - Strategy generation using enriched context
- `/api/feedback` - User feedback collection

**UI Components** ✅
- ChatInterface - Phase-aware conversation UI
- LensSelector - Strategic lens selection
- ExtractionConfirm - Context review with "Generate" or "Keep Exploring"
- StrategyDisplay - ReactFlow visualization of strategy
- FeedbackButtons - Simple helpful/not helpful buttons

**Trace Review System** ✅ (Phase 2 prep)
- Jupyter-based workflow for error analysis
- Python helper library (`scripts/trace_analysis.py`)
- Database schema for open coding annotations
- Starter notebook with examples

### Tech Stack (As Implemented)

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database:** Vercel Postgres + Prisma ORM
- **AI:** Claude API (claude-sonnet-4.5) via @anthropic-ai/sdk
- **Visualization:** ReactFlow
- **Deployment:** Vercel (main branch only via vercel.json)
- **Analysis Tools:** Python + Jupyter + pandas + SQLAlchemy

---

## 🎯 Active Work & Outstanding Issues

### Currently In Progress

**Generation Timeout Investigation** 🔍
- Issue: Strategy generation times out after user clicks "Generate my strategy"
- Status: Diagnostic logging added to frontend + backend
- Next: UAT testing with logging to identify exact failure point
- See: `docs/issues-and-bugfixes.md` for full details

### Known Issues

1. **Generation Timeout** - Investigation in progress
2. **No authentication yet** - Using temp user IDs for now
3. **No deployment to Vercel yet** - Configured but not deployed

### Next Steps

1. Complete generation timeout fix
2. Full UAT testing of adaptive conversation flow
3. Deploy to Vercel for beta testing
4. Implement authentication (NextAuth magic links)
5. Begin Phase 2 error analysis with trace review system

---

## 🏗️ Architecture

### Database Schema

**Conversation Model:**
- Tracks user conversations with phase management
- Fields: `id`, `userId`, `status`, `currentPhase`, `selectedLens`, `questionCount`
- Phases: INITIAL | EXPLORING | LENS_SELECTION | QUESTIONING | COMPLETE

**Message Model:**
- Stores conversation history
- Fields: `id`, `conversationId`, `role`, `content`, `stepNumber`, `confidenceScore`, `confidenceReasoning`
- Includes message-level annotations for Phase 2

**Trace Model:**
- Comprehensive logging for evals
- Stores: extracted context (JSON), generated output (JSON), Claude thoughts
- Metrics: tokens, latency, model used
- Feedback: user rating, refinement requests
- Phase 2: open coding notes, error categories, review metadata

### API Architecture

**Conversation Flow:**
1. `POST /api/conversation/start` - Initialize with opening question
2. `POST /api/conversation/continue` - Handle responses, phase transitions, lens selection
3. `POST /api/conversation/assess-confidence` - Real-time confidence assessment
4. `POST /api/extract` - Extract enhanced context when ready
5. `POST /api/generate` - Generate strategy from enriched context
6. `POST /api/feedback` - Collect user feedback

**Context Types:**
- `ExtractedContext` (legacy) - 3 fields: industry, targetMarket, uniqueValue
- `EnhancedExtractedContext` (current) - core + enrichment + reflective_summary
  - Core: industry, target_market, unique_value
  - Enrichment: competitive_context, customer_segments, operational_capabilities, technical_advantages
  - Reflective Summary: strengths, emerging themes, unexplored gaps, thought prompts

### Component Structure

```
src/
├── app/
│   ├── page.tsx                    # Main orchestration (chat → extraction → strategy)
│   └── api/                        # API routes
├── components/
│   ├── ChatInterface.tsx           # Phase-aware conversation
│   ├── LensSelector.tsx            # Strategic lens selection
│   ├── ExtractionConfirm.tsx       # Context review
│   ├── StrategyDisplay.tsx         # ReactFlow visualization
│   └── FeedbackButtons.tsx         # User feedback
└── lib/
    ├── types.ts                    # TypeScript definitions
    ├── db.ts                       # Prisma client
    ├── claude.ts                   # Claude API client
    └── utils.ts                    # XML parsing, etc.
```

**See `readme/CURRENT_ARCHITECTURE.md` for complete details**

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

### Strategic Lenses (Implemented)

1. **Competitive Advantage** - Market position and differentiation
2. **Customer-Centric** - User needs and value delivery
3. **Innovation-Driven** - Novel approaches and capabilities
4. **Operations Excellence** - Efficiency and execution
5. **Growth & Scale** - Expansion and scalability
6. **Resource Optimization** - Efficiency with constraints

### Strategy Output (Current Scope)

- **Vision** - Aspirational future state
- **Mission** - Current purpose and focus
- **Objectives** - SMART goals (3 per strategy)

**Future:** May expand to full Decision Stack (Vision → Mission → Objectives → Initiatives)

### Evals Methodology (Phase 2)

Following Hamel Husain & Shreya Shankar's approach:
1. Error Analysis First (manual review of traces)
2. Open Coding (label failures manually)
3. Axial Coding (group into categories)
4. LLM-as-Judge (automate detection)
5. Continuous Improvement (weekly cycle)

**Current Phase:** Data collection with comprehensive trace logging
**Phase 2:** Implement open coding workflow with Jupyter + Python

---

## 📚 Documentation Map

### Session & Historical Context
- `session-notes.md` - Chronological session summaries (START HERE)
- `COMMIT_NOTES.md` - Current session working notes
- `readme/archive/original-plan/` - Initial planning docs (outdated but useful context)

### Technical Documentation
- `readme/CURRENT_ARCHITECTURE.md` - Complete system architecture as built
- `docs/issues-and-bugfixes.md` - Rolling record of issues and fixes
- `docs/plans/` - Implementation plans for recent features

### Process Documentation
- `.claude/workflow.md` - Detailed commit and git procedures
- `.claude/superpowers-integration.md` - Hybrid superpowers strategy
- `.claude/architecture.md` - Original architecture doc (may be outdated)

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

1. ✅ Read `session-notes.md` to understand what's been built
2. ✅ Review `docs/issues-and-bugfixes.md` for known issues
3. ✅ Check `git status` for current branch and uncommitted changes
4. ✅ Review `readme/CURRENT_ARCHITECTURE.md` if touching core systems
5. ✅ Use TodoWrite to track progress during session
6. ✅ Update `session-notes.md` with session summary before ending

---

_This is a living document. Update as implementation evolves._
