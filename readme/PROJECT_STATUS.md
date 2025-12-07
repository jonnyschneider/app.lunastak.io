# Decision Stack v4 - Project Status

**Last Updated:** 2025-12-07
**Current Phase:** Phase 0 - Foundation
**Status:** Planning Complete, Development Starting

---

## Quick Status

| Phase | Status | Completion | Key Milestone |
|-------|--------|------------|---------------|
| Phase 0 | 🟡 In Progress | 5% | Foundation with logging & conversation flow |
| Phase 1 | ⚪ Not Started | 0% | Launch beta, collect 50+ traces |
| Phase 2 | ⚪ Not Started | 0% | Error analysis |
| Phase 3 | ⚪ Not Started | 0% | Build first LLM judge |
| Phase 4 | ⚪ Not Started | 0% | Continuous improvement |

---

## Phase 0: Foundation

**Goal:** Build v4 with comprehensive logging and conversation flow
**Started:** 2025-12-07
**Target Completion:** TBD
**Status:** 🟡 In Progress

### Acceptance Criteria Progress

#### Functionality
- [ ] Users can start a conversation
- [ ] 3 sequential questions are asked naturally
- [ ] Free-form text responses accepted
- [ ] Context extraction shows to user
- [ ] User can edit extracted context
- [ ] Strategy generation works
- [ ] ReactFlow visualization displays
- [ ] Feedback buttons present (even if just logging)

#### Technical
- [ ] All conversations saved to database
- [ ] All messages logged with timestamps
- [ ] Traces include full conversation history
- [ ] Claude calls logged with tokens/latency
- [ ] Works on mobile (responsive)
- [ ] Deployed to Vercel
- [ ] Environment variables configured

#### Data Quality
- [ ] Can export traces to CSV easily
- [ ] CSV includes all necessary fields for analysis
- [ ] Trace IDs are unique and trackable
- [ ] Timestamps are accurate

#### User Experience
- [ ] Flow feels conversational, not form-like
- [ ] No obvious bugs or crashes
- [ ] Load times acceptable (<3s per response)
- [ ] Instructions clear for beta users

---

## Development Sessions

### Session 1: Planning & Architecture (2025-12-07)

**Duration:** ~2 hours
**Participants:** Jonny, Claude Code

#### What We Did
1. ✅ Reviewed V4 Development Plan
2. ✅ Resolved architectural and strategic questions
3. ✅ Updated V4_DEVELOPMENT_PLAN.md with:
   - Marketing strategy for Humble Ventures
   - R&D tax documentation requirements
   - Architectural principles for future flexibility
   - Tech stack decisions (magic link auth, Vercel Postgres, etc.)
4. ✅ Created PROJECT_STATUS.md (this file)
5. ✅ Created FEATURE_BACKLOG.md with initial ideas and validation methods
6. ✅ Reviewed v3 code at `/Users/Jonny/Desktop/decision-stack-v3`
7. ⏳ Pending: Initialize Next.js project

#### Key Decisions Made

**Architecture:**
- Use flexible JSON schemas for `extracted_context` to support future expansion
- Keep 3-field extraction for Phase 0 (industry, target_market, unique_value)
- Design for iteration without over-engineering

**Auth & Infrastructure:**
- Magic link email auth via NextAuth.js
- Integrates with humventures.com.au mailing list
- Vercel Postgres from day 1 (no local SQLite)
- Vercel default domain for Phase 0
- Vercel Analytics (simple, built-in)

**UX Approach:**
- Build simple chat interface first (v1)
- Iterate based on user feedback and data
- Use fake door tests for feature validation
- Capture ideas in FEATURE_BACKLOG.md, build what resonates

**Business Goals:**
- Dual purpose: Learning project + marketing vehicle
- Partnership with Martin Eriksson for beta rollout
- R&D tax claim documentation from day 1

#### Why We Did It This Way

**Flexible JSON Schema:**
- Strategic analysis will evolve beyond 3 fields
- Future may include competitive analysis, technical advantages, strategic "powers", etc.
- Want to avoid database migrations when adding new extraction dimensions

**Magic Link Auth:**
- Simplest user experience (no passwords)
- Grows Humble Ventures mailing list organically
- One integration serves two purposes

**Vercel Postgres Day 1:**
- Matches production environment
- No migration pain from SQLite
- Easier team collaboration (if needed)

**Simple Chat UX First:**
- Get working version to react against
- Anticipate future needs (voice input, doc upload) but don't build yet
- Use experimentation to validate before building

#### v3 Code Review Findings

**Location:** `/Users/Jonny/Desktop/decision-stack-v3/web`

**Tech Stack (v3):**
- Next.js 14.1.0 with App Router ✅
- TypeScript ✅
- Tailwind CSS ✅
- @anthropic-ai/sdk ^0.17.1 ✅
- ReactFlow ^11.11.4 (for visualization) ✅
- Vercel Analytics ^1.1.1 ✅
- Zod for validation ✅

**Components to Reuse:**
1. **StrategyFlow.tsx** (`src/components/StrategyFlow.tsx`)
   - ReactFlow visualization of Vision → Mission → Objectives
   - Well-structured with proper types
   - Already handles the Decision Stack visualization
   - **Action:** Copy to v4 with minimal changes

2. **Types** (`src/lib/types.ts`)
   - `BusinessContext` - matches our 3 fields (industry, targetMarket, uniqueValue)
   - `StrategyStatements` - vision, mission, objectives[]
   - `GenerationResponse` - thoughts + statements structure
   - **Action:** Extend for v4 (add conversation/trace types)

3. **Utils** (`src/lib/utils.ts`)
   - `extractXML()` - parses Claude's XML responses
   - `buildPrompt()` - constructs prompts from context
   - **Action:** Keep utils, refactor buildPrompt for conversational flow

4. **Claude API Integration** (`src/app/api/generate/route.ts`)
   - Edge runtime configured ✅
   - Proper error handling ✅
   - Uses Claude 3 Opus (we'll upgrade to newer model)
   - **Action:** Adapt for new conversation-based flow

**What NOT to Reuse:**
1. **InputForm.tsx** - Static 3-field form (replacing with chat interface)
2. **page.tsx** - Two-column layout (redesigning for conversational UX)

**Configuration Files to Reuse:**
- `tailwind.config.ts` ✅
- `tsconfig.json` ✅
- `next.config.js` ✅
- `.env.local` structure (will add more vars)

**Dependencies Analysis:**
- All dependencies are current and suitable for v4
- Need to add:
  - `@prisma/client` for database
  - `next-auth` for authentication
  - `nodemailer` for magic links (if not handled by NextAuth)

**Key Insights:**
1. v3 has solid foundation - Next.js 14 + TypeScript + Tailwind
2. Claude API integration is working and well-structured
3. StrategyFlow visualization is production-ready
4. Current prompt engineering uses XML format (we'll keep this pattern)
5. No database layer - this is the biggest addition for v4
6. No auth layer - second biggest addition

**Reuse Strategy:**
- **80% reuse**: Core infrastructure, types, utils, visualization
- **20% new**: Chat UI, database layer, auth, extraction flow, logging

#### What We Deferred

**Not Building in Phase 0:**
- Voice-to-text input (captured in backlog)
- Document upload for extraction (captured in backlog)
- Initiatives layer of Decision Stack (future phase)
- Statsig for experimentation (Phase 1+)
- Custom domain (Phase 1+)
- Advanced strategy frameworks (Phase 2+)

**Research Needed:**
- ATO requirements for R&D tax claims
- Integration details with humventures.com.au mailing list
- Timeline for Martin Eriksson collaboration

#### Blockers & Risks
- None currently

#### Next Steps
1. Create FEATURE_BACKLOG.md
2. Review v3 code at `/Users/Jonny/Desktop/decision-stack-v3`
3. Initialize Next.js 14 project structure
4. Set up Prisma schema
5. Configure NextAuth with magic link

---

### Session 2: [Date] - TBD

_Template for next session_

**Duration:**
**Participants:**

#### What We Did
- [ ] Task 1
- [ ] Task 2

#### Key Decisions Made
-

#### Why We Did It This Way
-

#### What We Deferred
-

#### Blockers & Risks
-

#### Next Steps
-

---

## R&D Tax Tracking

### Time Log (Phase 0)

| Date | Person | Hours | Activity | Category |
|------|--------|-------|----------|----------|
| 2025-12-07 | Jonny | 2.0 | Planning & architecture | R&D |

**Total Phase 0 Hours:** 2.0

### Cost Log (Phase 0)

| Date | Item | Cost (AUD) | Category |
|------|------|------------|----------|
| - | - | $0.00 | - |

**Total Phase 0 Costs:** $0.00

---

## Technical Debt & Improvements

_Track technical debt as it accumulates, address in future phases_

### Known Issues
- None yet

### Future Improvements
- See FEATURE_BACKLOG.md

---

## Metrics Baseline

_Will populate once Phase 0 is deployed_

### Product Metrics
- Total conversations started: 0
- Completion rate: N/A
- User feedback (👍 vs 👎): N/A
- Average session time: N/A
- Return user rate: N/A

### Technical Metrics
- API latency (p50): N/A
- API latency (p95): N/A
- Token usage per trace: N/A
- Error rate: N/A

---

## Notes & Learnings

### Phase 0 Learnings
- Planning took ~2 hours but saved significant rework
- Clear architectural principles early = less decision paralysis later
- Dual-purpose design (learning + marketing) adds constraints but increases ROI

---

## Git Branching Strategy

### Branch Structure

We use a **two-branch strategy** for this project:

```
main (production-ready, deployed to users)
  └─ Stable releases only
  └─ Vercel auto-deploys from this branch
  └─ Merge from development when ready for beta users

development (active development)
  └─ Daily work happens here
  └─ WIP commits allowed
  └─ Experimental features
  └─ Can have broken code temporarily
```

### Workflow

**Daily Development:**
```bash
# Work on development branch
git checkout development

# Make changes, commit often
git add .
git commit -m "Add chat interface component"
git push

# Development branch can have broken/incomplete code
```

**Deploying to Beta Users:**
```bash
# When feature is complete and tested
git checkout main
git merge development
git push

# Vercel will auto-deploy from main
# Only merge to main when ready for users to see it
```

### Branch Rules

**Commit to `development` when:**
- Daily progress on features
- Experimental code
- Work in progress (WIP)
- Broken code that you're actively fixing
- Testing new ideas

**Merge to `main` when:**
- Feature is complete and tested
- Ready for beta users to see
- Passing basic quality checks
- No obvious bugs or crashes
- Ready to deploy to production

**Future: Feature Branches (Phase 2+)**
- When building large features (multi-day work)
- Create branch from `development`: `git checkout -b feature/voice-input`
- Merge back to `development` when done
- Not needed for Phase 0 (solo dev, fast iteration)

### Current State
- **Active Branch:** `development`
- **Default Branch (GitHub):** `main`
- **Deployment Source (Vercel):** `main`

---

## Quick Reference

**Current Working Directory:** `/Users/Jonny/Dev/humventures/agents/Decision Stack/dc-agent-v4-with-evals`
**v3 Location:** `/Users/Jonny/Desktop/decision-stack-v3`
**Repository:** `github.com/YOUR_USERNAME/dc-agent-v4-with-evals` (update after first push)

**Key Contacts:**
- Martin Eriksson (beta partnership)

**Important Links:**
- V4 Development Plan: `readme/V4_DEVELOPMENT_PLAN.md`
- Feature Backlog: `readme/FEATURE_BACKLOG.md`
- R&D Tracking: `docs/rd-tracking/`
