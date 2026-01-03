# Experiment 2: Deployment Strategy

**Date:** 2026-01-03
**Experiment:** E2 - Dimensional Coverage Tracking
**Related:** `docs/plans/2026-01-03-e1a-dimensional-coverage-implementation.md`

---

## Rationale for Feature Branch

**Problem:**
- Parallel work may be happening on `development` (e.g., UX adjustments)
- E2 implementation spans 8-12 hours of work
- Want to isolate E2 changes for clean testing and potential rollback

**Solution:** Use a dedicated feature branch with git tagging

---

## Branch Strategy

### 1. Create Feature Branch

```bash
# Start from development (ensure it's up to date)
git checkout development
git pull origin development

# Create feature branch
git checkout -b experiment/e2-dimensional-coverage
```

### 2. Implementation Workflow

**During implementation:**
```bash
# Make changes following the implementation plan
# Commit regularly with clear messages

git add <files>
git commit -m "feat(e2): <description>"

# Push to remote for backup
git push -u origin experiment/e2-dimensional-coverage
```

**Commit message conventions:**
- `feat(e2): <description>` - New features
- `test(e2): <description>` - Tests
- `docs(e2): <description>` - Documentation
- `refactor(e2): <description>` - Refactoring

### 3. Keep Feature Branch Updated

**If development branch gets updates during implementation:**
```bash
# From feature branch
git checkout experiment/e2-dimensional-coverage
git fetch origin
git merge origin/development

# Resolve any conflicts
# Run tests to ensure nothing broke
npm run type-check
npm test
```

### 4. Merge to Development

**When implementation complete:**
```bash
# Ensure all changes are committed
git status

# Switch to development and update
git checkout development
git pull origin development

# Merge feature branch (use --no-ff to preserve experiment history)
git merge --no-ff experiment/e2-dimensional-coverage

# Push to development
git push origin development
```

### 5. User Acceptance Testing (UAT)

**On development branch:**
- Deploy to staging/preview environment
- Test dimensional coverage with real conversations
- Verify no regressions in baseline functionality
- Review Jupyter notebook queries

**If issues found:**
- Fix on `experiment/e2-dimensional-coverage` branch
- Merge fixes back to `development`

### 6. Merge to Main & Tag

**When UAT passes:**
```bash
# Switch to main and update
git checkout main
git pull origin main

# Merge development
git merge --no-ff development

# Tag the release
git tag -a v1.3.0 -m "Release v1.3.0: Experiment 2 - Dimensional Coverage Tracking

Features:
- Dimensional coverage tracking for emergent extraction
- Strategic dimension mapping (10 Tier 1 dimensions)
- Jupyter notebook analysis tools
- Experiment 2 one-pager and documentation

Related: E2, docs/experiments/one-pagers/E2-dimensional-coverage.md"

# Push main and tags
git push origin main
git push origin v1.3.0
```

### 7. Cleanup (Optional)

**After successful merge to main:**
```bash
# Delete local feature branch (optional)
git branch -d experiment/e2-dimensional-coverage

# Delete remote feature branch (optional - keep for reference)
# git push origin --delete experiment/e2-dimensional-coverage
```

---

## Version Numbering

**Current version:** v1.2.1 (per latest tag)

**Proposed version for E2:** v1.3.0

**Rationale:**
- Minor version bump (1.2.x → 1.3.x) for new feature
- Not a patch (would be 1.2.2) because it's new functionality, not a bug fix
- Not a major version (2.0.0) because it's backward compatible

**Semantic Versioning:**
- Major (X.0.0): Breaking changes, incompatible API changes
- Minor (1.X.0): New features, backward compatible
- Patch (1.2.X): Bug fixes, backward compatible

---

## Deployment Checklist

### Pre-Implementation
- [ ] Create feature branch from development
- [ ] Verify development is up to date with origin
- [ ] Set up local environment for testing

### During Implementation
- [ ] Commit regularly with clear messages
- [ ] Push to remote for backup
- [ ] Keep feature branch updated with development changes
- [ ] Run type checks after each major change: `npm run type-check`

### Pre-Merge to Development
- [ ] All implementation phases complete (see implementation plan)
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Experiment one-pager created

### UAT on Development
- [ ] Deploy to staging environment
- [ ] Test with at least 3-5 real conversations
- [ ] Verify dimensional coverage captured correctly
- [ ] Test Jupyter notebook queries
- [ ] Verify no regression in baseline-v1 functionality
- [ ] Review coverage data quality (manual inspection)

### Pre-Merge to Main
- [ ] All UAT checklist items complete
- [ ] Update experiment register with E2 status
- [ ] Update E1 one-pager to reference E2
- [ ] Prepare release notes
- [ ] Determine version number (v1.3.0)

### Post-Merge to Main
- [ ] Tag release with detailed message
- [ ] Push tags to remote
- [ ] Update experiment register with completion status
- [ ] Archive planning documents
- [ ] (Optional) Delete feature branch

---

## Parallel Work Management

**If UX work or other features are being developed in parallel:**

### Option 1: Multiple Feature Branches (Recommended)
```
development
├── experiment/e2-dimensional-coverage (this experiment)
└── feature/ux-adjustments (parallel work)
```

**Workflow:**
- Both branches start from `development`
- Work independently
- Merge to `development` separately when ready
- Test together on `development` before merging to `main`

### Option 2: Coordination via Development
```
development (shared integration branch)
├── experiment/e2-dimensional-coverage
└── feature/ux-adjustments
```

**Workflow:**
- Both branches periodically merge updates from `development`
- Coordinate merge timing to avoid conflicts
- Run integration tests on `development` after both merge

---

## Rollback Strategy

**If critical issues found after merge to main:**

### Option 1: Revert Merge Commit
```bash
# Find the merge commit
git log --oneline --merges

# Revert the merge
git revert -m 1 <merge-commit-sha>

# Push revert
git push origin main
```

### Option 2: Feature Flag Disable
- If E2 uses feature flags, disable via Statsig
- Investigate issue on feature branch
- Fix and re-deploy when ready

### Option 3: Hotfix Branch
```bash
# Create hotfix from last known good tag
git checkout -b hotfix/e2-fix v1.2.1

# Fix the issue
# Test thoroughly
# Merge to main and development
```

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Feature branch creation | 5 min | None |
| Implementation | 8-12 hours | None |
| Merge to development | 15 min | Implementation complete |
| UAT | 2-4 hours | Development deployment |
| Merge to main & tag | 15 min | UAT pass |
| **Total** | **1-2 days** | Assumes no major issues |

**Note:** Timeline assumes focused work. Actual calendar time may vary based on schedule.

---

## References

- Git workflow: https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows
- Semantic Versioning: https://semver.org/
- Conventional Commits: https://www.conventionalcommits.org/
- Implementation Plan: `docs/plans/2026-01-03-e1a-dimensional-coverage-implementation.md`
- Experiment Register: `docs/experiments/EXPERIMENT_REGISTER.md`

---

**Status:** Ready for Implementation
**Next Step:** Create feature branch and begin Phase 1 (Core Infrastructure)
