# Superpowers + .claude/ Hybrid Strategy

**Last Updated:** 2025-12-07
**Status:** Active (superpowers installed)

---

## Overview

This project uses **both** superpowers plugin and custom `.claude/` documentation:

- **Superpowers:** Handles feature development workflows, TDD, code review
- **`.claude/` docs:** Handles project-specific context, constraints, domain knowledge

---

## Division of Responsibilities

### ✅ Superpowers Handles (Use Plugin Commands)

**When building features:**
1. **`/superpowers:brainstorm`** - Design refinement and requirements clarification
2. **`/superpowers:write-plan`** - Create implementation plans (breaks into 2-5 min tasks)
3. **`/superpowers:execute-plan`** - Execute with TDD, code review, systematic approach

**What superpowers provides:**
- ✅ Design refinement (interactive questioning)
- ✅ Git worktree isolation
- ✅ Task planning (2-5 minute chunks)
- ✅ TDD workflow (RED-GREEN-REFACTOR)
- ✅ Code review against plan
- ✅ PR creation and branch cleanup
- ✅ Systematic debugging
- ✅ Test-driven approach

**When to use:**
- Starting a new feature (e.g., chat interface, auth setup)
- Complex implementation requiring planning
- When TDD is appropriate
- Code review before merging to main

---

### ✅ .claude/ Docs Handle (Custom Context)

**Project-specific context:**
- Business goals (R&D tax claim, marketing vehicle)
- Domain knowledge (evals methodology, strategy frameworks)
- Architectural constraints (flexible JSON schemas, no over-engineering)
- v3 code reuse strategy
- Manual git workflow (Jonny commits, not agent)
- Session startup procedures

**What .claude/ provides:**
- ✅ Session startup checklist (`.claude/README.md`)
- ✅ Project constraints and principles
- ✅ Commit workflow (COMMIT_NOTES.md process)
- ✅ R&D tax tracking requirements
- ✅ Phase-specific context (Phase 0 goals, acceptance criteria)
- ✅ Architecture decisions and rationale
- ✅ Quick reference (paths, contacts, repo info)

**When to use:**
- Starting a new session (read `.claude/README.md`)
- Understanding project goals and constraints
- Checking what NOT to build (validated learning approach)
- Following commit workflow
- R&D documentation requirements

---

## Recommended Workflow

### Starting a New Session

```markdown
1. Read .claude/README.md (session startup)
   - Understand current phase, constraints, goals
   - Check COMMIT_NOTES.md for uncommitted work
   - Review latest session notes

2. Ready to build a feature?
   - Use /superpowers:brainstorm for design
   - Use /superpowers:write-plan for implementation
   - Use /superpowers:execute-plan with TDD
```

### Building a Feature (Example: Chat Interface)

```markdown
Step 1: Clarify with superpowers
  /superpowers:brainstorm
  - Interactive design refinement
  - Clarify requirements
  - Consider constraints from .claude/architecture.md

Step 2: Plan with superpowers
  /superpowers:write-plan
  - Break into 2-5 minute tasks
  - Reference v3 reuse strategy from .claude/architecture.md
  - Remember: no over-engineering (from .claude/ constraints)

Step 3: Execute with superpowers
  /superpowers:execute-plan
  - TDD workflow
  - Code review
  - But DON'T auto-commit (Jonny does that manually)

Step 4: Follow .claude/ commit workflow
  - Update COMMIT_NOTES.md
  - Jonny reviews and commits manually
  - Archive session notes
```

### When NOT to Use Superpowers

**Skip superpowers for:**
- ❌ Simple documentation updates
- ❌ Planning/architecture discussions (use .claude/ docs)
- ❌ Session startup routines
- ❌ R&D tracking updates
- ❌ Quick fixes or trivial changes

**Use .claude/ docs instead:**
- Session preparation
- Understanding project context
- Checking constraints before building
- Commit workflow
- R&D documentation

---

## Key Integration Points

### 1. Manual Git Workflow (Override Superpowers)

**Problem:** Superpowers can create PRs and commits automatically

**Solution:**
- ⚠️ Use superpowers for planning/execution
- ⚠️ But DON'T let it commit automatically
- ✅ Always use COMMIT_NOTES.md workflow
- ✅ Jonny commits manually (learning + control)

**In practice:**
```markdown
When using /superpowers:execute-plan:
- Let it write code
- Let it run tests
- Let it review code
- BUT stop before auto-commit
- Follow .claude/workflow.md for commits
```

### 2. Constraints from .claude/ Inform Superpowers

**Before using superpowers, check .claude/ for:**
- ❗ No over-engineering (YAGNI principle)
- ❗ Flexible JSON schemas (avoid rigid structures)
- ❗ Validated learning (don't build unvalidated features)
- ❗ v3 code reuse (don't rebuild what exists)
- ❗ Phase 0 scope (only build what's in acceptance criteria)

**Feed these into superpowers brainstorm/plan:**
```
Example:
/superpowers:brainstorm

Agent mentions: "Let's add error handling for all edge cases"
You respond: "Per .claude/ constraints, only handle errors at system boundaries.
Trust internal code. Keep it simple for Phase 0."
```

### 3. R&D Tax Documentation

**Superpowers provides:** Task breakdowns, time estimates, technical decisions

**You capture in .claude/:**
- Update PROJECT_STATUS.md with time spent
- Document technical decisions in session notes
- Note experiments and outcomes
- Capture for R&D tax claim

**Workflow:**
```markdown
After using superpowers:
1. Check how long the work took
2. Update readme/PROJECT_STATUS.md > R&D Time Log
3. Document decisions in COMMIT_NOTES.md
4. Archive for tax claim
```

---

## Superpowers Commands Reference

### `/superpowers:brainstorm`
**When:** Starting a new feature, unclear requirements
**Output:** Refined requirements, design decisions
**Follow-up:** Use for `/superpowers:write-plan`

### `/superpowers:write-plan`
**When:** Requirements are clear, ready to plan
**Output:** Task list (2-5 min chunks), implementation strategy
**Follow-up:** Review against .claude/ constraints, then execute

### `/superpowers:execute-plan`
**When:** Plan is approved, ready to code
**Output:** Code + tests + review
**Remember:** Stop before auto-commit, use COMMIT_NOTES.md workflow

---

## Comparison: When to Use What

| Task | Use Superpowers | Use .claude/ Docs |
|------|----------------|-------------------|
| Session startup | ❌ | ✅ Read .claude/README.md |
| Feature brainstorming | ✅ /superpowers:brainstorm | Review constraints first |
| Implementation planning | ✅ /superpowers:write-plan | Check architecture.md |
| TDD execution | ✅ /superpowers:execute-plan | Follow YAGNI from .claude/ |
| Code review | ✅ Superpowers automated | Check against Phase 0 goals |
| Git commits | ❌ Manual only | ✅ workflow.md process |
| R&D tracking | ❌ | ✅ PROJECT_STATUS.md |
| Understanding constraints | ❌ | ✅ .claude/ docs |
| Quick fixes | ❌ Overkill | ✅ Direct implementation |

---

## Practical Examples

### Example 1: Building Chat Interface

```markdown
1. Read .claude/README.md (session startup)
   - Note: Phase 0, keep simple, reuse v3 patterns

2. /superpowers:brainstorm
   "I need to build a conversational chat interface for 3 questions"
   - Superpowers asks clarifying questions
   - Reference .claude/architecture.md for context
   - Constraint: Don't over-engineer, YAGNI

3. /superpowers:write-plan
   - Creates task breakdown
   - Review: Does it reuse v3 components? (per .claude/)
   - Review: Is it simple enough for Phase 0?

4. /superpowers:execute-plan
   - Implements with TDD
   - Runs tests, reviews code
   - STOP before auto-commit

5. Follow .claude/workflow.md
   - Update COMMIT_NOTES.md
   - Jonny commits manually
   - Archive session notes
   - Update R&D time log
```

### Example 2: Simple Documentation Update

```markdown
1. DON'T use superpowers (overkill)

2. Just update the file directly
   - Read file
   - Edit file
   - Update COMMIT_NOTES.md

3. Jonny commits when ready
```

### Example 3: Database Schema Design

```markdown
1. Read .claude/architecture.md first
   - Constraint: Use flexible JSON schemas
   - Why: Avoid migrations as strategy analysis evolves

2. /superpowers:brainstorm
   "Design Prisma schema for conversations, messages, traces"
   - Include constraint about JSON flexibility
   - Superpowers helps refine design

3. /superpowers:write-plan
   - Plan schema creation
   - Plan migration setup
   - Plan seed data

4. Review plan against .claude/ constraints
   - Is extracted_context using Json type? ✅
   - Is output using Json type? ✅
   - Flexible enough for future fields? ✅

5. /superpowers:execute-plan
   - Implement schema
   - Test migrations
   - STOP before commit

6. .claude/ workflow for commit
```

---

## Updates to .claude/ Docs

### What to Remove

**From .claude/workflow.md:**
- ❌ Remove "Code Review Workflow" section (superpowers handles this)
- ❌ Remove "Feature Development Workflow" section (superpowers handles this)

**What to keep:**
- ✅ Git & Commit Workflow (manual, not automated)
- ✅ Session Start/End Workflow
- ✅ R&D Tax Tracking Workflow
- ✅ Branch Management Workflow

### What to Add

**To .claude/README.md:**
Add section:
```markdown
## Superpowers Integration

For feature development, use superpowers plugin:
- /superpowers:brainstorm - Design refinement
- /superpowers:write-plan - Task planning
- /superpowers:execute-plan - TDD implementation

But always:
- Check .claude/ constraints before planning
- Use COMMIT_NOTES.md workflow (not auto-commit)
- Update R&D tracking after sessions

See .claude/superpowers-integration.md for details.
```

---

## Best Practices

### ✅ Do This

- Start sessions with `.claude/README.md` (context)
- Use superpowers for feature development (systematic)
- Check `.claude/` constraints before planning
- Stop superpowers before auto-commit
- Update COMMIT_NOTES.md manually
- Track R&D time in PROJECT_STATUS.md
- Keep both systems in sync

### ❌ Don't Do This

- Don't use superpowers for trivial tasks
- Don't let superpowers auto-commit (Jonny commits)
- Don't skip .claude/ session startup
- Don't ignore constraints in .claude/ docs
- Don't forget R&D time tracking
- Don't over-engineer (even if superpowers suggests it)

---

## Next Steps

1. Update `.claude/README.md` with superpowers section
2. Trim `.claude/workflow.md` (remove what superpowers handles)
3. Test workflow with first feature (chat interface or Prisma setup)
4. Iterate based on what works

---

_This is a living document. Update as we learn how superpowers and .claude/ work together._
