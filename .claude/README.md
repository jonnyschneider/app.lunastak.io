# Decision Stack v4 - Claude Code Instructions

**Last Updated:** 2025-12-07
**Current Phase:** Phase 0 - Foundation
**Active Branch:** development

---

## 🚀 Session Startup Checklist

Follow these steps at the start of each session:

### 1. Review Planning Documentation
```bash
# Read these files to understand current state
- readme/V4_DEVELOPMENT_PLAN.md    # Overall plan, phases, architecture
- readme/PROJECT_STATUS.md         # Current phase, acceptance criteria, branching strategy
- readme/FEATURE_BACKLOG.md        # Feature ideas and validation methods
```

### 2. Check Git Status
```bash
# Verify current branch and status
git status
git branch  # Should show: development (active branch)
```

### 3. Review Latest Session
```bash
# Read the most recent session notes
- docs/session-notes/[latest].md   # Last session's work
- COMMIT_NOTES.md                  # Current session's working notes
```

### 4. Check Phase Progress
```bash
# Review acceptance criteria for current phase
- See readme/PROJECT_STATUS.md > Phase 0: Foundation > Acceptance Criteria Progress
- Note what's complete vs. pending
```

### 5. Update Todo List
```bash
# Use TodoWrite tool to track tasks for this session
# Review existing todos and update status
```

---

## 📋 Quick Reference

### Project Locations
- **Current Working Directory:** `/Users/Jonny/Dev/humventures/agents/Decision Stack/dc-agent-v4-with-evals`
- **v3 Code (for reference):** `/Users/Jonny/Desktop/decision-stack-v3/web`
- **Planning Docs:** `readme/*.md`
- **Session Archives:** `docs/session-notes/`
- **Active Session Notes:** `COMMIT_NOTES.md`

### Key Contacts
- Martin Eriksson (beta partnership)

### Repository Info
- **GitHub:** github.com/[USERNAME]/dc-agent-v4-with-evals (update after first push)
- **Deployment:** Vercel (from `main` branch)
- **Branch Strategy:** Two-branch (development/main) - see [workflow.md](workflow.md)

---

## 🏗️ Architecture Overview

### Tech Stack (Phase 0)
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** Vercel Postgres + Prisma ORM
- **Auth:** NextAuth.js with magic link email
- **AI:** Claude API (@anthropic-ai/sdk)
- **Deployment:** Vercel
- **Analytics:** Vercel Analytics

### Project Structure
```
dc-agent-v4-with-evals/
├── .claude/                  # Claude Code instructions (this folder)
├── docs/
│   ├── session-notes/       # Archived session notes
│   └── rd-tracking/         # R&D tax claim documentation
├── readme/
│   ├── V4_DEVELOPMENT_PLAN.md
│   ├── PROJECT_STATUS.md
│   └── FEATURE_BACKLOG.md
├── COMMIT_NOTES.md          # Working file for current session
└── [Next.js project files - to be created]
```

**Detailed architecture:** See [architecture.md](architecture.md)

---

## 🔄 Key Workflows

### Superpowers Plugin Integration

**For feature development**, use the superpowers plugin:
- **`/superpowers:brainstorm`** - Interactive design refinement and requirements clarification
- **`/superpowers:write-plan`** - Create implementation plans (2-5 minute task chunks)
- **`/superpowers:execute-plan`** - Execute with TDD, code review, systematic approach

**Important integration points:**
- ✅ Use superpowers for systematic feature development
- ✅ Check `.claude/` constraints BEFORE planning (no over-engineering, validated learning, etc.)
- ⚠️ **STOP before auto-commit** - Always use COMMIT_NOTES.md workflow instead
- ✅ Update R&D tracking after superpowers sessions

**See [superpowers-integration.md](superpowers-integration.md) for complete hybrid strategy**

### Commit Workflow
**Important:** Jonny manages git manually (not automated by agent or superpowers)

See [workflow.md](workflow.md) for detailed commit workflow using COMMIT_NOTES.md

**Summary:**
1. Agent updates COMMIT_NOTES.md with session notes
2. Jonny reviews and edits
3. Jonny executes git commands manually
4. Agent archives session notes to docs/session-notes/
5. Agent clears COMMIT_NOTES.md for next session

### Development Workflow
- Work on `development` branch (WIP code allowed)
- Merge to `main` when ready for beta users
- Vercel deploys from `main` only

---

## 🎯 Current Phase: Phase 0 - Foundation

### Goal
Build v4 with comprehensive logging and conversation flow

### Acceptance Criteria
See `readme/PROJECT_STATUS.md` for full checklist

**Key deliverables:**
- [ ] Conversational chat interface (3-question flow)
- [ ] Database layer (Prisma + Postgres)
- [ ] Context extraction step
- [ ] Strategy generation with ReactFlow visualization
- [ ] Comprehensive trace logging
- [ ] User feedback UI (buttons only)

### Next Steps (Pending)
1. Initialize Next.js 14 project structure
2. Set up Prisma with database schema
3. Configure NextAuth with magic link
4. Build chat interface components
5. Implement extraction flow
6. Add comprehensive logging

---

## ⚠️ Important Constraints

### Manual Git Management
- **Do NOT** run git commands automatically
- **Do** draft commit messages in COMMIT_NOTES.md
- **Do** let Jonny execute all git operations
- **Why:** Learning process + manual control preferred

### R&D Tax Documentation
- **Do** track time spent in PROJECT_STATUS.md > R&D Tax Tracking
- **Do** document technical decisions and reasoning
- **Do** note experiments and their outcomes
- **Why:** Australian R&D tax claim requirements

### Validated Learning
- **Do NOT** build features without validation
- **Do** use fake door tests for feature ideas
- **Do** prioritize based on user data (Phase 2+)
- **Do** capture ideas in FEATURE_BACKLOG.md
- **Why:** Build what users actually want, not assumptions

### Architecture Flexibility
- **Do** use flexible JSON schemas (avoid rigid structures)
- **Do NOT** commit to specific frameworks prematurely
- **Do** design for iteration and evolution
- **Why:** Strategic analysis will expand beyond initial 3 fields

### Simplicity First
- **Do NOT** over-engineer Phase 0
- **Do** ship working product quickly
- **Do** embrace "good enough for beta"
- **Why:** Learning project, iterate based on real data

---

## 🎓 Domain Knowledge

### Strategy Frameworks (Future Consideration)
- Hamilton Helmer's 7 Powers
- Porter's 5 Forces
- Decision Stack framework (Vision → Mission → Objectives → Initiatives)

**Current scope:** Vision → Mission → Objectives only (top half of Decision Stack)

### Evals Methodology
This project follows Hamel Husain & Shreya Shankar's approach:
1. Error Analysis First (manual review of traces)
2. Open Coding (label failures manually)
3. Axial Coding (group into categories)
4. LLM-as-Judge (automate detection of top failures)
5. Continuous Improvement (weekly cycle)

**Phase 0-1:** Focus on data collection
**Phase 2+:** Implement evals methodology

---

## 📚 Additional Documentation

- **[superpowers-integration.md](superpowers-integration.md)** - Hybrid strategy for superpowers + .claude/ docs
- **[workflow.md](workflow.md)** - Detailed Git and commit procedures
- **[architecture.md](architecture.md)** - Full architecture documentation, v3 reuse notes

---

## 🤖 Working with Claude Code

### Communication Style
- Brief, concise responses (CLI-appropriate)
- No emojis unless requested
- Focus on technical accuracy over validation
- Disagree when necessary (rigorous standards)

### Tool Usage
- Use TodoWrite frequently to track progress
- Prefer Read tool over bash for file operations
- Use Task tool for complex exploration
- Always call multiple independent tools in parallel

### Planning Without Timelines
- Provide concrete steps, not time estimates
- Never suggest "this will take 2-3 weeks"
- Focus on what needs to be done, not when
- Let Jonny decide scheduling

---

## 💡 Tips for Effective Sessions

1. **Start each session** by reading this file
2. **Check COMMIT_NOTES.md** to see if there's uncommitted work
3. **Review latest session notes** to understand context
4. **Use TodoWrite** to make progress visible
5. **Update COMMIT_NOTES.md** before ending session
6. **Ask clarifying questions** rather than assuming

---

_This is a living document. Update as workflows evolve and patterns emerge._
