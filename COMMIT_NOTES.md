# Commit Notes

**Purpose:** Temporary workspace for drafting commit messages and session notes before committing to Git.

---

## Current Session Notes

**Date:** 2025-12-07
**Session:** Planning Phase Complete

### Changes Made
- ✅ Created `readme/V4_DEVELOPMENT_PLAN.md` with architecture, marketing strategy, R&D tracking
- ✅ Created `readme/PROJECT_STATUS.md` with phase tracking, session logs, Git branching strategy
- ✅ Created `readme/FEATURE_BACKLOG.md` with validation-driven feature ideas
- ✅ Created `COMMIT_NOTES.md` for manual git workflow
- ✅ Created `.claude/README.md` - Session startup checklist and quick reference
- ✅ Created `.claude/workflow.md` - Git/commit/session workflows
- ✅ Created `.claude/architecture.md` - Full technical documentation
- ✅ Created `docs/session-notes/2025-12-07_planning-phase.md` - Session archive template
- ✅ Reviewed v3 code and documented reusable components
- ✅ Documented architectural decisions for future flexibility

### Why These Changes
- Established clear project direction and constraints
- Set up tracking for R&D tax claim (time, costs, technical narrative)
- Defined two-branch Git strategy (development/main)
- Captured feature ideas with validation methods (fake door tests)
- Identified 80% code reuse from v3 (StrategyFlow, types, utils, Claude API)
- Created `.claude/` docs for efficient session startup (~1200 tokens vs 5000+ for full repo scan)
- Created workflow that keeps Jonny hands-on with Git (learning + control)
- Prepared for superpowers plugin integration (baseline documentation)

### What's Deferred
- Voice-to-text input (captured in backlog)
- Document upload (captured in backlog)
- Initiatives layer of Decision Stack
- Advanced strategy frameworks
- Custom domain

### Technical Notes
- Using flexible JSON schemas for `extracted_context` to avoid future migrations
- Magic link auth integrates with Humble Ventures mailing list
- Vercel Postgres from day 1 (no SQLite migration needed)
- Planning session: ~2 hours (R&D tax claimable)

### Suggested Commit Message
```
Initial commit: Phase 0 planning complete

Planning documents and architecture decisions for Decision Stack v4.

Changes:
- Add V4 Development Plan with evals methodology
- Add Project Status tracking document
- Add Feature Backlog with validation framework
- Document Git branching strategy (development/main)
- Document v3 code review findings
- Establish R&D tax tracking structure

Architecture decisions:
- Flexible JSON schemas for future expansion
- Magic link auth via NextAuth
- Vercel Postgres from day 1
- Two-branch strategy: development (WIP) / main (production)

Business goals:
- Learning project (evals methodology)
- Marketing vehicle (Humble Ventures lead gen)
- R&D tax claim documentation
- Partnership with Martin Eriksson for beta

Next steps: Initialize Next.js 14 project, set up Prisma schema

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Instructions for Use

### Before Each Commit

1. **Agent Updates This File**
   - Claude Code adds session notes to "Current Session Notes"
   - Lists changes, reasoning, deferred items
   - Drafts suggested commit message

2. **You Review & Edit**
   - Add your own notes and observations
   - Edit commit message to your preference
   - Add context Claude might have missed
   - Note any manual changes you made

3. **You Execute Git Commands**
   - Copy commit message (or write your own)
   - Stage files: `git add .`
   - Commit: `git commit -m "..."`
   - Push: `git push`

4. **Archive Session Notes**
   - Claude creates `docs/session-notes/YYYY-MM-DD_description.md`
   - Copies the full session notes to the archive file
   - You can add the commit hash to the archived notes after committing

5. **Clear for Next Session**
   - Claude clears "Current Session Notes" section back to template
   - COMMIT_NOTES.md stays as working file (don't move it)
   - Ready for next session

### Why This Workflow?

- **Learning:** You stay hands-on with Git
- **Control:** Manual git management prevents surprises
- **Documentation:** Rich session notes for R&D tax claim
- **Collaboration:** Agent drafts, you decide
- **History:** Detailed context for each commit

---

## Template for Next Session

_Copy this template when starting a new session_

```markdown
## Current Session Notes

**Date:** YYYY-MM-DD
**Session:** [Brief description]

### Changes Made
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3

### Why These Changes
- Reasoning for major decisions
- Trade-offs considered
- Constraints that influenced choices

### What's Deferred
- Items captured in backlog
- Future considerations
- Known limitations

### Technical Notes
- Implementation details
- Performance considerations
- Dependencies added/removed
- Configuration changes

### Suggested Commit Message
```
[Commit title - 50 chars max]

[Detailed description of changes]

[Why we made these changes]

[Any breaking changes or important notes]

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```
```

---

## Archived Session Notes

_After committing, move session notes here for reference_

### Session 1: Planning Phase (2025-12-07)
- Initial planning documents created
- Architecture and branching strategy defined
- See commit: [hash will go here after commit]
