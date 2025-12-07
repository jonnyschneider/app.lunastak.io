# Commit Notes

**Purpose:** Temporary workspace for drafting commit messages and session notes before committing to Git.

---

## Current Session Notes

**Date:** [New session]
**Session:** [Session description]

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

_After committing, session notes are moved to docs/session-notes/_

### Session 1: Planning Phase (2025-12-07)
- Initial planning documents created
- Architecture and branching strategy defined
- See commit: [Add hash after first commit]
- Archive: docs/session-notes/2025-12-07_planning-phase.md

### Session 2: Superpowers Integration (2025-12-07)
- Superpowers plugin installed and integrated
- Hybrid strategy documented
- See commit: [Add hash after second commit]
- Archive: docs/session-notes/2025-12-07_superpowers-integration.md
