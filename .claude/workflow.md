# Development Workflows

**Last Updated:** 2025-12-07

---

## Git & Commit Workflow

### Overview

**Key Principle:** Jonny manages git manually. Agent assists with documentation.

**Process:**
1. Agent updates `COMMIT_NOTES.md` during session
2. Jonny reviews and edits notes
3. Jonny executes git commands manually
4. Agent archives session notes
5. Agent clears `COMMIT_NOTES.md` for next session

---

## Detailed Commit Workflow

### During the Session

**Agent's Role:**
```markdown
1. Work on tasks with Jonny
2. Update COMMIT_NOTES.md > Current Session Notes with:
   - Changes made
   - Why these changes
   - What's deferred
   - Technical notes
   - Suggested commit message
3. Keep notes updated as session progresses
```

**File:** `COMMIT_NOTES.md` (root of project)

---

### Before Committing

**Jonny's Role:**
```bash
1. Review COMMIT_NOTES.md
2. Add own observations and notes
3. Edit commit message if desired
4. Decide what to stage/commit
```

**Agent's Role:**
- Ensure COMMIT_NOTES.md is complete and accurate
- Answer questions about changes
- Clarify technical decisions if needed

---

### Executing the Commit

**Jonny executes manually:**
```bash
# 1. Check status
git status
git branch  # Confirm on 'development'

# 2. Stage files
git add .
# Or selectively: git add <specific-files>

# 3. Commit (copy message from COMMIT_NOTES.md or write own)
git commit -m "Your commit message here"

# 4. Push
git push
# Or first time: git push -u origin development

# 5. Optional: Note commit hash for session notes
git log -1 --oneline
```

---

### After Committing

**Agent's Role:**
```markdown
1. Create session archive file:
   - Location: docs/session-notes/YYYY-MM-DD_description.md
   - Content: Copy from COMMIT_NOTES.md Current Session Notes
   - Include: Changes, reasoning, commit message used
   - Add placeholder for commit hash

2. Clear COMMIT_NOTES.md:
   - Remove Current Session Notes content
   - Reset to template
   - Keep "Instructions for Use" section intact
   - Ready for next session
```

**Jonny's Role (optional):**
```bash
# Add commit hash to archived session notes
# Edit docs/session-notes/YYYY-MM-DD_description.md
# Add hash from: git log -1 --oneline
```

---

## Branch Management Workflow

### Two-Branch Strategy

```
main (production)
  └─ Stable, deployable code
  └─ Vercel deploys from here
  └─ Merge from development when ready

development (active work)
  └─ Daily commits
  └─ WIP allowed
  └─ Experimental features
  └─ Can be broken temporarily
```

### Daily Work

**Always work on `development`:**
```bash
# Start session
git checkout development
git pull  # Get latest

# Make changes, commit often
git add .
git commit -m "Work in progress: chat interface"
git push

# WIP commits are fine on development
```

### Deploying to Beta Users

**When feature is complete:**
```bash
# 1. Ensure development is clean and pushed
git checkout development
git status  # Should be clean
git push

# 2. Switch to main
git checkout main
git pull

# 3. Merge development
git merge development

# 4. Push to trigger Vercel deployment
git push

# 5. Go back to development for next work
git checkout development
```

**Checklist before merging to main:**
- [ ] Feature is complete (not WIP)
- [ ] No obvious bugs or crashes
- [ ] Tested locally
- [ ] Ready for beta users to see
- [ ] Matches Phase acceptance criteria

---

## Session End Workflow

### Before Ending Session

**Agent checklist:**
```markdown
1. ✅ All work committed?
   - If yes: Archive session notes
   - If no: Update COMMIT_NOTES.md with uncommitted work

2. ✅ Update PROJECT_STATUS.md:
   - Mark completed acceptance criteria
   - Update R&D time tracking (hours spent)
   - Add any new technical debt / learnings

3. ✅ Update TodoWrite:
   - Mark completed todos
   - Add next session todos if clear

4. ✅ Ask Jonny:
   - "Ready to archive session notes?"
   - "Anything else to capture before ending?"
```

**Jonny checklist:**
```bash
# Review uncommitted changes
git status

# Decide: commit now or leave for next session?
# If leaving uncommitted:
  - Ensure COMMIT_NOTES.md has notes
  - Can continue next session

# If committing:
  - Follow commit workflow above
```

---

## Session Start Workflow

### At Start of New Session

**Agent's first steps:**
```markdown
1. Read .claude/README.md (session startup checklist)
2. Check git status
   git status
   git branch
3. Review COMMIT_NOTES.md
   - Is there uncommitted work from last session?
   - Or is it cleared and ready for new session?
4. Review latest session notes
   - Read docs/session-notes/[most recent].md
   - Understand where we left off
5. Check PROJECT_STATUS.md
   - Current phase and acceptance criteria
   - What's completed vs pending
6. Initialize TodoWrite with session tasks
```

**Jonny's role:**
```bash
# Tell agent what we're working on today
# Agent will update todos and start tracking in COMMIT_NOTES.md
```

---

## R&D Tax Tracking Workflow

### Time Tracking

**When to log:**
- Planning sessions
- Development work
- Error analysis (Phase 2+)
- Experimentation and testing

**How to log:**
```markdown
Update: readme/PROJECT_STATUS.md > R&D Tax Tracking > Time Log

| Date | Person | Hours | Activity | Category |
|------|--------|-------|----------|----------|
| YYYY-MM-DD | Jonny | X.X | Description | R&D |
```

**Agent's role:**
- Remind Jonny to log time at session end
- Suggest time estimate based on session length
- Update totals

### Cost Tracking

**What to log:**
- API costs (Anthropic, others)
- Infrastructure (Vercel, database)
- Tools and subscriptions

**How to log:**
```markdown
Update: readme/PROJECT_STATUS.md > R&D Tax Tracking > Cost Log

| Date | Item | Cost (AUD) | Category |
|------|------|------------|----------|
| YYYY-MM-DD | Anthropic API | $XX.XX | R&D |
```

### Technical Documentation

**Captured automatically in:**
- Session notes (docs/session-notes/)
- Commit messages
- PROJECT_STATUS.md (Why We Did It This Way sections)

---

## Feature Development Workflow

### Use Superpowers Plugin

For systematic feature development, use the superpowers plugin:

**Workflow:**
```markdown
1. /superpowers:brainstorm
   - Interactive design refinement
   - Clarify requirements
   - BUT: Check .claude/ constraints first (no over-engineering, validated learning, etc.)

2. /superpowers:write-plan
   - Creates 2-5 minute task breakdown
   - Review plan against .claude/architecture.md
   - Ensure it respects Phase 0 scope and v3 reuse strategy

3. /superpowers:execute-plan
   - TDD workflow (RED-GREEN-REFACTOR)
   - Automated code review
   - BUT: STOP before auto-commit
   - Follow COMMIT_NOTES.md workflow instead

4. Update R&D tracking
   - Log time in PROJECT_STATUS.md
   - Document technical decisions in session notes
```

**See:** `.claude/superpowers-integration.md` for complete details

### Quality Standards (For Non-Superpowers Work)

**Do:**
- Simple, focused solutions
- Direct implementations
- Trust internal code and framework guarantees
- Validate only at system boundaries

**Don't:**
- Add features beyond what's asked
- Refactor surrounding code unnecessarily
- Add error handling for impossible scenarios
- Create abstractions for one-time use
- Add backwards-compatibility hacks

---

## Error Analysis Workflow (Phase 2+)

_Will be populated in Phase 2_

**Placeholder for:**
- Trace export to CSV
- Manual open coding process
- Axial coding with Claude
- Building LLM judges
- Measuring improvement

---

## Notes

- This is a living document
- Update as workflows evolve
- Keep it practical and actionable
- Remove ceremony that doesn't add value
