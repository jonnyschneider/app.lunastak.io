# Decision Stack v4 - Developer Guide

**Last Updated:** 2025-12-22
**Current Version:** v1.2.0 (unreleased - development branch)
**Active Branch:** development
**Production:** https://strategist.humventures.com.au (v1.1.0)

---

## 🚀 Quick Start for New Sessions

### 1. Read Current State (Start Here!)
```bash
# Essential reading
- CHANGELOG.md                           # What's been built (all versions)
- CONTRIBUTING.md                        # Development workflow
- docs/plans/                            # Recent design docs and implementation plans
```

### 2. Check Active Work
```bash
# What's in progress
- git status                             # Any uncommitted changes
- git log -5 --oneline                  # Recent commits
- CHANGELOG.md [Unreleased] section     # What's merged but not released
```

### 3. Review Historical Context (Optional)
```bash
# Deep dives on specific features
- docs/session-notes/                    # Unplanned/iterative work notes
- docs/experiments/EXPERIMENT_REGISTER.md # A/B test tracking
- docs/journal/                          # Research synthesis
```

---

## 📊 Current State (v1.2.0 - Unreleased)

### What Exists Now

**Cold Start Entry Points** ✅ (New in v1.2.0)
- Four entry point options (Guided, Document Upload, Canvas, Fast Track)
- Document upload with unstructured.io extraction (PDF, DOCX, TXT, MD)
- AI-generated document summaries and context-aware first questions
- Fake door validation for Canvas and Fast Track options
- Separate InfoDialog for educational content vs FakeDoorDialog for feature validation

**Redesigned Objective Display** ✅ (New in v1.2.0)
- Timeframe badges in top-left (3M, 6M, 9M, 12M, 18M)
- Objective text decoupled from metrics and timeframes
- Visual metric display: `↑ Market share | from 20% to 35%`
- Intelligent parser extracts metrics from Claude-generated text
- Supports flexible formats (percentages, currency, counts, qualitative)

**Developer Productivity Tools** ✅ (New in v1.2.0)
- Regeneration scripts: `npm run regen <traceId>` for local testing
- Remote API: `npm run regen:remote <traceId> [baseUrl]` for preview/prod
- Perfect for testing prompt changes without redoing Q&A flow
- Full documentation in `scripts/README.md`

**Terminology Updates** ✅ (New in v1.2.0)
- Renamed "Mission" to "Strategy" throughout codebase
- Updated types, UI labels, API prompts, XML tags
- Better reflects coherent choices concept

**Baseline-v1 (Control Variant)** ✅ (v1.0.0)
- Normalized, simplified conversation flow for systematic experimentation
- 3-10 question adaptive flow with confidence-based stopping
- Enhanced context extraction with enrichment + reflective summary
- Vision, Strategy, Objectives generation

**E1a: Emergent Extraction** ✅ (v1.1.0)
- Themes-based extraction (alternative to prescriptive fields)
- Statsig feature flag integration for A/B testing
- Dual schema support with type guards
- Ready for data collection and comparison

**Instrumentation & Measurement** ✅
- Comprehensive event tracking (entry points, document uploads, fake doors, info views)
- Quality rating system (researcher-only, binary good/bad)
- Experiment variant tagging
- User feedback (helpful/not helpful)
- Jupyter notebook analysis workflow

### Tech Stack (As Implemented)

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database:** Vercel Postgres + Prisma ORM
- **AI:** Claude API (claude-sonnet-4.5) via @anthropic-ai/sdk
- **Document Processing:** unstructured.io API for file extraction
- **Experiments:** Statsig for A/B testing
- **Deployment:** Vercel (main branch auto-deploys)
- **Analysis Tools:** Python + Jupyter + pandas + SQLAlchemy

---

## 🎯 Active Work & Experiment Framework

### Current Status

**Development Branch** 🟡 In Progress
- Cold start entry points complete and tested
- Ready for squash merge to main
- Will become v1.2.0 release
- See: `CHANGELOG.md [Unreleased]` section

### Released Experiments

**E0: Baseline-v1** 🟢 Complete (v1.0.0)
- Status: Deployed to production
- Purpose: Establishes normalized control for all future experiments
- See: `docs/experiments/one-pagers/E0-baseline-v1.md`

**E1a: Emergent Extraction** 🟢 Complete (v1.1.0)
- Status: Deployed with Statsig feature flag
- Hypothesis: Emergent theme extraction produces less "wooden" outputs
- Target: 10-15 participants per variant
- See: `docs/experiments/one-pagers/E1a-emergent-extraction.md`

### Planned Experiments

**E2: Energetic Prompts** ⚪ Planned
- Hypothesis: Energetic generation prompts reduce generic corporate speak

**E3: Lens Inference** ⚪ Planned
- Hypothesis: Inferring strategic focus beats explicit lens selection

### Known Limitations

1. **No authentication yet** - Using temp user IDs for now
2. **Limited to Vision/Strategy/Objectives** - Initiatives and Principles are fake doors
3. **Single-session only** - Multi-session development is future enhancement
4. **Preview deployment protection** - Remote regeneration requires disabling auth wall or using production

---

## 🏗️ Architecture

### Database Schema

**Conversation Model:**
- Tracks user conversations with phase management and experiment variant tagging
- Fields: `id`, `userId`, `status`, `currentPhase`, `questionCount`, `experimentVariant`
- Phases: INITIAL | QUESTIONING | COMPLETE

**Message Model:**
- Stores conversation history
- Fields: `id`, `conversationId`, `role`, `content`, `stepNumber`, `confidenceScore`, `confidenceReasoning`

**Trace Model:**
- Comprehensive logging for evals and quality assessment
- Stores: extracted context (JSON), generated output (JSON), Claude thoughts
- Metrics: tokens, latency, model used
- Feedback: user rating, quality rating, timestamps

**Event Model:**
- Tracks user interactions for feature demand and behavior analysis
- Event types: `fake_door_click`, `info_icon_view`, `extraction_choice`, `quality_rating`, `entry_point_selected`, `document_uploaded`

### API Routes

**Conversation Flow:**
- `POST /api/conversation/start` - Initialize with opening question
- `POST /api/conversation/continue` - Handle responses, phase transitions
- `POST /api/conversation/assess-confidence` - Real-time confidence assessment
- `POST /api/extract` - Extract enhanced context
- `POST /api/generate` - Generate strategy from context
- `POST /api/feedback` - Collect user feedback

**New in v1.2.0:**
- `POST /api/upload-document` - Handle file upload and extraction
- `POST /api/admin/regenerate` - Regenerate strategies from existing traces

**Event Tracking:**
- `POST /api/events` - Log user interactions
- `POST /api/quality-rating` - Researcher quality assessments

### Component Structure

```
src/
├── app/
│   ├── page.tsx                    # Main orchestration
│   └── api/                        # API routes
├── components/
│   ├── IntroCard.tsx               # Welcome + entry point selection
│   ├── EntryPointSelector.tsx     # 4 entry point options (NEW)
│   ├── DocumentUpload.tsx         # File upload UI (NEW)
│   ├── DocumentSummary.tsx        # AI summary display (NEW)
│   ├── ChatInterface.tsx          # Multi-line conversation UI
│   ├── ExtractionConfirm.tsx      # Context review
│   ├── StrategyDisplay.tsx        # Enhanced display
│   ├── InfoDialog.tsx             # Educational content (NEW)
│   ├── FakeDoorDialog.tsx         # Feature validation (NEW)
│   └── ui/                        # shadcn/ui components
└── lib/
    ├── types.ts                   # TypeScript definitions
    ├── placeholders.ts            # Placeholder generators + metric parser
    └── utils.ts                   # XML parsing, etc.
```

---

## 🔄 Key Workflows

### Development Workflow (UPDATED)

**Git Strategy:**
- Work on `development` branch (WIP allowed)
- **Agent commits directly** as work completes (no approval needed)
- Jonny controls `development` → `main` merges (squash merge)
- Vercel auto-deploys only from `main`

**For Planned Features (Superpowers Workflow):**
1. `/superpowers:brainstorming` - Refine idea, explore alternatives
2. `/superpowers:writing-plans` - Create design doc + implementation plan in `docs/plans/`
3. `/superpowers:executing-plans` - Execute task-by-task with checkpoints
4. Update `CHANGELOG.md [Unreleased]` section
5. Commit to development throughout

**For Iterative/Testing Discoveries:**
1. Discover issue during testing
2. Create session note in `docs/session-notes/YYYY-MM-DD_description.md`
3. Fix and commit to development
4. Update `CHANGELOG.md [Unreleased]` section

**Release Workflow:**
1. Jonny reviews development branch
2. Move `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` in CHANGELOG
3. Update `package.json` version
4. Squash merge to main with release message
5. Push to main triggers Vercel deployment
6. Create git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`

**See `CONTRIBUTING.md` for complete workflow documentation**

### Testing & Debugging

**Local Development:**
```bash
npm run dev              # Start dev server (http://localhost:3000)
npx prisma studio        # View database
npm run type-check       # TypeScript validation
npm run build            # Test production build
```

**Regeneration Scripts (Testing Productivity):**
```bash
# Local testing (direct DB access)
npm run regen <traceId>

# Remote testing (via API)
npm run regen:remote <traceId>                                    # localhost
npm run regen:remote <traceId> https://preview-url.vercel.app    # preview
npm run regen:remote <traceId> https://dc-agent-v4.vercel.app    # production
```

**Logging:**
- Frontend: Browser DevTools console
- Backend: Terminal running `npm run dev`
- Database: Prisma Studio or Jupyter notebooks

---

## ⚠️ Important Constraints

### Git Management
- **Do** commit directly to development branch as work completes
- **Do** write descriptive commit messages (feat:, fix:, docs:, etc.)
- **Do NOT** merge to main or push main - Jonny controls releases
- **Do** update CHANGELOG.md [Unreleased] section

### Documentation
- **Do** use `docs/plans/` for all superpowers sessions (design + implementation)
- **Do** use `docs/session-notes/` only for unplanned/iterative work
- **Do** update CHANGELOG.md as single source of truth for releases
- **Do NOT** create redundant release notes files
- **See:** `CONTRIBUTING.md` for full documentation workflow

### R&D Tax Documentation
- **Do** track time and decisions in session notes (when applicable)
- **Do** document technical reasoning and experiments
- **Why:** Australian R&D tax claim requirements

### Validated Learning
- **Do NOT** build features without validation
- **Do** use fake door tests for feature ideas
- **Do** capture ideas for evaluation
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
- **Strategy** - Coherent choices to achieve vision (what we focus on)
- **Objectives** - SMART goals with visual metrics (3 per strategy)

**Visual Metric Format (v1.2.0):**
- Timeframe badge: 3M, 6M, 9M, 12M, 18M
- Direction: ↑ (increase) or ↓ (decrease)
- Metric name: Revenue, Market share, Customer churn, etc.
- Metric value: "from 20% to 35%", "$10M ARR", "500 new customers"

**Future Enhancements (Fake Doors):**
- **Initiatives** - Key projects/workstreams that support objectives
- **Principles** - Decision-making guidelines and cultural values

**Target Domain:** Digital strategy for SaaS products and services (pre-seed to Fortune 500)

### Experimentation Methodology

**Systematic A/B Testing:**
1. Establish baseline with comprehensive measurement
2. Test single variable changes in parallel experiments
3. Compare quality ratings (good/bad %) and user feedback
4. Merge successful variants, document failed experiments

**Quality Assessment:**
- Researcher ratings: Binary good/bad on strategy outputs
- User feedback: Helpful/not helpful
- Event tracking: Feature demand via fake door clicks
- Dimensional coverage: Ensure framework completeness

**Current Focus:** Multiple entry points, document-based starting context, improved objective display

---

## 📚 Documentation Map (UPDATED)

### Primary Documentation (Start Here)
- **`CHANGELOG.md`** - All releases, version history, what's been built
- **`CONTRIBUTING.md`** - Development workflow, documentation structure, git strategy
- **`README.md`** - Project overview, current version, features

### Design & Implementation
- **`docs/plans/`** - Design docs and implementation plans for all planned features
  - Format: `YYYY-MM-DD-feature-name-design.md` (problem, solution, rationale)
  - Format: `YYYY-MM-DD-feature-name.md` (step-by-step implementation tasks)
- **`docs/session-notes/`** - Notes from unplanned/iterative work only
  - Only create when discovering issues during testing
  - Documents deviations, gotchas, user feedback

### Developer Tools
- **`scripts/README.md`** - Regeneration scripts documentation
- **`scripts/regenerate.ts`** - Local regeneration script
- **`scripts/regenerate-remote.ts`** - Remote API regeneration

### Experiments & Research
- **`docs/experiments/EXPERIMENT_REGISTER.md`** - Central index of all experiments
- **`docs/experiments/one-pagers/`** - One-pager per experiment
- **`docs/journal/`** - Research synthesis and learnings

### Framework Reference
- **`docs/framework-reference/QUALITY_CRITERIA.md`** - What makes good strategy outputs
- **`docs/framework-reference/example-humble-ventures-decision-stack.md`** - Real examples

### Process Documentation
- **`.claude/workflow.md`** - Detailed commit and git procedures
- **`.claude/superpowers-integration.md`** - Hybrid superpowers strategy

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

1. ✅ Read `CHANGELOG.md` to understand what's been built and current status
2. ✅ Review `CONTRIBUTING.md` if first session or workflow questions
3. ✅ Check `git status` for current branch and uncommitted changes
4. ✅ Review `docs/plans/` for recent design decisions (if relevant)
5. ✅ Use TodoWrite to track progress during session
6. ✅ Update `CHANGELOG.md [Unreleased]` section before ending
7. ✅ Create session note in `docs/session-notes/` only if iterative/unplanned work

---

**Version:** 2.0 (updated 2025-12-22)
_This is a living document. Update as implementation evolves._
