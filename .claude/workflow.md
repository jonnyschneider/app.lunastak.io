# Development Workflows

**Last Updated:** 2025-12-09

---

## Git & Commit Workflow

### Overview

**New Approach (Streamlined):**

**Development Branch:**
- Agent/Superpowers commits directly as work completes
- No manual approval needed for dev commits
- Good descriptive commit messages
- Fast iteration, no bottlenecks

**Main Branch:**
- Jonny controls merges from dev → main
- Review batch of work before merging
- Write release notes summarizing what's shipping
- Merge triggers Vercel deployment

**Session Tracking:**
- Update `session-notes.md` throughout session
- At end of session: Add summary of session's work
- No batching into commits - session notes are separate documentation

---

## Development Branch Workflow

### During Development

**Agent commits freely:**
```bash
# Agent can run these commands directly when work is complete
git add .
git commit -m "feat: add diagnostic logging to generation API"
git push

# Or via superpowers auto-commit (now allowed)
```

**Good commit messages:**
- Describe what changed and why
- Use conventional commit format if possible: `feat:`, `fix:`, `docs:`, `refactor:`
- Examples:
  - `feat: add adaptive conversation flow with confidence assessment`
  - `fix: connect enriched context to strategy generation`
  - `docs: update architecture to reflect current implementation`
  - `refactor: extract lens selection into separate component`

**No manual approval needed** - trust the agent/superpowers to commit when logical

---

## Main Branch Workflow

### Merging to Production

**When ready to deploy:**

```bash
# 1. Review what's on development
git checkout development
git log main..development --oneline  # See what's new

# 2. Test locally one more time
npm run build
npm run dev  # Smoke test

# 3. Switch to main and merge
git checkout main
git pull
git merge development --no-ff  # No fast-forward to preserve history

# 4. Write release notes as merge commit message
git commit --amend  # Edit merge commit message

# 5. Push to trigger Vercel deployment
git push

# 6. Back to development
git checkout development
```

**Release Notes Format:**
```
Release: [Brief Title]

Summary:
- Major feature/change 1
- Major feature/change 2
- Bug fixes and improvements

Details:
[Brief description of what this batch delivers to users]

Technical Notes:
[Any important implementation details or breaking changes]
```

**Checklist before merging:**
- [ ] All tests passing
- [ ] Tested locally
- [ ] No known critical bugs
- [ ] Ready for beta users
- [ ] Session notes updated

---

## Session Documentation Workflow

### During Session

**Update session-notes.md throughout:**
- What you're working on
- Key decisions made
- Issues encountered and fixed
- Technical insights

**No need for COMMIT_NOTES.md** - that file can be deleted

### End of Session

**Agent adds session summary:**
```markdown
1. Add new section to session-notes.md with today's date
2. Summarize:
   - What was accomplished
   - Key technical details
   - Outstanding issues
   - Next steps
   - Approximate hours spent
3. Commit the session-notes.md update
```

**Session notes are separate from code commits** - they're documentation, not batched commit messages

---

## Branch Management

### Two-Branch Strategy

```
main (production)
  └─ Stable, deployable code
  └─ Vercel deploys from here (configured in vercel.json)
  └─ Merge from development when ready
  └─ Release notes in merge commits

development (active work)
  └─ Frequent commits as work completes
  └─ WIP allowed
  └─ Experimental features
  └─ Can be temporarily broken
```

### Daily Work

```bash
# Always work on development
git checkout development
git pull

# Make changes, agent commits as work completes
# (no manual intervention needed)

# Continue iterating
```

---

## Session Start Workflow

### At Start of New Session

**Agent's first steps:**
```markdown
1. Read .claude/readme.md (quick start checklist)
2. Read session-notes.md (what's been built)
3. Check git status
   git status
   git branch  # Should be on development
4. Review docs/issues-and-bugfixes.md (known issues)
5. Ask Jonny what we're working on today
6. Use TodoWrite if it's a multi-step task
```

**No need to check COMMIT_NOTES.md** - session notes is the record

---

## Feature Development Workflow

### Using Superpowers

**Workflow:**
```markdown
1. /superpowers:brainstorm
   - Interactive design refinement
   - Clarify requirements
   - Check .claude/readme.md constraints first

2. /superpowers:write-plan
   - Creates bite-sized task breakdown
   - Review plan against constraints
   - Ensure it fits architecture

3. /superpowers:execute-plan
   - TDD workflow (RED-GREEN-REFACTOR)
   - Automated code review
   - Auto-commit is NOW ALLOWED
   - Commits happen as tasks complete

4. Update session-notes.md
   - Summarize what superpowers built
   - Link to detailed plan docs if useful
   - Note any deviations or decisions
```

**Superpowers generates detailed docs** - session notes summarize at higher level for consistency across all work (superpowers and non-superpowers)

---

## R&D Tax Tracking

### Time Tracking

**At end of each session:**
- Add hours estimate to session-notes.md entry
- Agent can estimate based on conversation length
- Don't need precise tracking, rough estimates fine

**Format in session notes:**
```markdown
## 2025-12-09: Session Title

[Session content...]

### Hours
Approximately 2-3 hours of focused development work.
```

### Technical Documentation

**Automatically captured in:**
- `session-notes.md` - Session summaries
- `docs/issues-and-bugfixes.md` - Problem-solving record
- `docs/plans/` - Implementation plans from superpowers
- Git commit messages - What changed
- `readme/CURRENT_ARCHITECTURE.md` - System design

**This provides comprehensive R&D documentation** for tax purposes

---

## Quality Standards

### For All Work (Superpowers or Not)

**Do:**
- Simple, focused solutions
- Direct implementations
- Trust framework guarantees
- Validate only at boundaries
- Good commit messages

**Don't:**
- Add features beyond what's asked
- Refactor unnecessarily
- Over-engineer
- Add abstractions for one-time use
- Add backwards-compatibility hacks

**Philosophy:** Build what's needed, ship quickly, iterate based on learning

---

## Summary: What Changed

### Old Way (Slow)
- Agent updates COMMIT_NOTES.md
- Jonny reviews and manually commits
- Agent archives to session-notes/
- Lots of manual steps, batching

### New Way (Fast)
- Agent commits directly to development
- Agent updates session-notes.md throughout
- Jonny controls dev → main merges
- Jonny writes release notes for deployments
- Much faster iteration

### Key Insight
**Development commits ≠ Release notes**

Development commits are frequent, detailed, technical. Release notes are batched, high-level, user-focused. Session notes are comprehensive documentation for R&D and continuity. These serve different purposes.

---

_This is a living document. Update as workflows evolve._
