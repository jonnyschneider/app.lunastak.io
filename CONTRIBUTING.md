# Contributing Guide

## Documentation Structure

We maintain three types of documentation to balance detail with clarity:

### 1. Design & Implementation Plans (`docs/plans/`)

**When:** Before implementing any significant feature via `/superpowers` workflow

**Format:**
- `YYYY-MM-DD-feature-name-design.md` - Problem, solution, technical approach, rationale
- `YYYY-MM-DD-feature-name.md` - Step-by-step implementation tasks

**Purpose:** Captures the "why" and "how" of planned work. Generated during brainstorming and planning phases.

**Example:**
```
docs/plans/
├── 2025-12-21-cold-start-entry-points-design.md
└── 2025-12-21-cold-start-entry-points.md
```

### 2. Session Notes (`docs/session-notes/`)

**When:** Only for unplanned/iterative work discovered during testing

**Format:** `YYYY-MM-DD_feature-description.md`

**Purpose:** Documents deviations from plans, gotchas, user feedback, post-implementation insights

**When NOT to use:**
- Planned superpowers sessions (rationale already in design doc)
- Routine bug fixes
- Documentation updates

**Example:**
```
docs/session-notes/
└── 2025-12-22_cold-start-iterative-improvements.md  # User testing discovered issues
```

### 3. CHANGELOG.md

**Single source of truth** for all releases

**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

**Sections:**
- `[Unreleased]` - Changes merged to development but not released
- `[X.Y.Z] - YYYY-MM-DD` - Released versions with dates

**Categories:**
- Added - New features
- Changed - Changes to existing functionality
- Deprecated - Soon-to-be removed features
- Removed - Removed features
- Fixed - Bug fixes
- Security - Security fixes

---

## Development Workflow

### Phase 1: Design & Plan (Superpowers Workflow)

1. **Use `/superpowers:brainstorming`** to refine the idea
   - Explore alternatives
   - Identify edge cases
   - Clarify requirements

2. **Use `/superpowers:writing-plans`** to create implementation plan
   - Creates design doc in `docs/plans/YYYY-MM-DD-feature-name-design.md`
   - Creates implementation plan in `docs/plans/YYYY-MM-DD-feature-name.md`

3. **Review & Approve** the plan
   - Discuss trade-offs
   - Confirm approach

### Phase 2: Implementation

1. **Use `/superpowers:executing-plans`** to implement
   - Follow tasks in implementation plan
   - Commit after each logical unit
   - Run tests/type-check between tasks

2. **If issues discovered during implementation:**
   - Fix immediately for small issues
   - For significant deviations: Update plan or create session note

### Phase 3: Testing & Iteration

1. **User testing on localhost or preview**
   - Test all entry points
   - Verify edge cases
   - Get user feedback

2. **If issues discovered during testing:**
   - Create session note: `docs/session-notes/YYYY-MM-DD_feature-iteration.md`
   - Document: Problem → Solution → Implementation → Gotchas
   - Iterate and commit fixes

### Phase 4: Release Preparation

1. **Update CHANGELOG.md**
   - Move items from `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`
   - Use semantic versioning:
     - Major (2.0.0): Breaking changes
     - Minor (1.X.0): New features, backward compatible
     - Patch (1.1.X): Bug fixes, backward compatible

2. **Update package.json version**
   ```bash
   npm version patch|minor|major
   ```

3. **Update README.md** (if needed)
   - Current version number
   - New features in quick reference
   - Updated screenshots/examples

4. **Create git tag**
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0: Cold Start Entry Points"
   git push origin v1.2.0
   ```

### Phase 5: Merge & Deploy

1. **Squash and merge PR** to keep main branch clean
   - Use PR title format: "feat: cold start entry points with document upload"
   - Reference CHANGELOG in PR description

2. **Deploy to production**
   - Vercel auto-deploys from main
   - Verify deployment in production
   - Monitor errors/issues

---

## Git Workflow

### Branch Strategy
- `main` - Production-ready code
- `development` - Active development, merged via squash merge
- Feature branches as needed for parallel work

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add document upload entry point
fix: handle undefined createdAt in regenerate script
chore: add tsx as dev dependency
docs: update CHANGELOG with cold start features
refactor: separate InfoDialog from FakeDoorDialog
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `chore`: Maintenance (deps, config)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `perf`: Performance improvement

### Squash Merge Strategy
When merging development → main:
- Squash all commits into one
- Use descriptive commit message from CHANGELOG
- Keeps main branch history clean and readable

---

## Regeneration Scripts (Testing Productivity)

When testing prompt changes or UI iterations:

### Local Testing
```bash
# Direct database access, fastest
npm run regen <traceId>
```

### Preview/Production Testing
```bash
# Via API endpoint
npm run regen:remote <traceId> https://preview-url.vercel.app
npm run regen:remote <traceId> https://production-url.vercel.app
```

**Use Cases:**
- Testing prompt tweaks without redoing Q&A
- Comparing different model outputs
- Quick iteration on UI changes
- A/B testing generation approaches

See `scripts/README.md` for full documentation.

---

## File Organization

```
dc-agent-v4-with-evals/
├── CHANGELOG.md                    # Single source of truth for releases
├── CONTRIBUTING.md                 # This file
├── README.md                       # Project overview, current version
├── docs/
│   ├── plans/                      # Design docs + implementation plans
│   │   ├── YYYY-MM-DD-feature-design.md
│   │   └── YYYY-MM-DD-feature.md
│   ├── session-notes/              # Unplanned/iterative work only
│   │   └── YYYY-MM-DD_iteration.md
│   └── experiments/                # Experiment-specific docs
│       └── one-pagers/
├── scripts/                        # Utility scripts
│   ├── README.md                   # Script documentation
│   ├── regenerate.ts               # Local regeneration
│   └── regenerate-remote.ts        # Remote regeneration
└── src/                            # Application code
```

---

## Quality Standards

### Before Committing
- [ ] `npm run type-check` passes
- [ ] No console errors in browser
- [ ] Tested on localhost
- [ ] Commit message follows conventional commits

### Before Creating PR
- [ ] All tasks from implementation plan completed
- [ ] User testing completed (if applicable)
- [ ] CHANGELOG.md updated in `[Unreleased]` section
- [ ] Session notes created (if iterative work)
- [ ] No merge conflicts with main

### Before Merging PR
- [ ] PR reviewed (if applicable)
- [ ] All CI checks pass
- [ ] Tested on preview deployment
- [ ] Release notes finalized

---

## Questions?

- **Design decisions:** Refer to `docs/plans/*-design.md` files
- **Implementation details:** Refer to `docs/plans/*-implementation.md` or session notes
- **Release history:** Refer to `CHANGELOG.md`
- **Development process:** This file (CONTRIBUTING.md)
