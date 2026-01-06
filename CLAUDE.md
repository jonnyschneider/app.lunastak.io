# Claude Code Context

This file provides context for Claude Code when working on this codebase.

## Project Overview

Lunastak is an AI strategy coach. Users have conversations, context is extracted, and strategy (vision, strategy, objectives) is generated.

**Key flow:** Conversation → Extraction → Fragment Persistence → Generation

## Essential Commands

```bash
npm run dev          # Start dev server
npm run type-check   # TypeScript validation
npm run test         # Run tests
npm run verify       # Full verification (pre-push runs this automatically)
npm run smoke        # Smoke tests only
```

## Architecture

See [.claude/architecture.md](.claude/architecture.md) for full details.

**Key directories:**
- `src/app/api/` - API routes (conversation, extract, generate)
- `src/lib/` - Core logic, types, utilities
- `src/lib/contracts/` - Data contracts for pipeline boundaries
- `src/components/` - React components
- `prisma/schema.prisma` - Database schema (protected boundary)

**Data contracts:** Define expected shapes at extraction/persistence/generation boundaries. Run `npm run verify` to catch breaking changes.

## Git Workflow

- Work on `development` branch
- Commit directly as work completes (no approval needed for commits)
- Jonny controls merges to `main`
- Pre-push hook runs `npm run verify` automatically

**Commit format:** Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)

## Release Process

1. Update `CHANGELOG.md` - move [Unreleased] to [X.Y.Z]
2. Update `package.json` version
3. Commit: `git commit -m "vX.Y.Z: Description"`
4. Push to development, create PR to main

**Single source of truth for versions:** `CHANGELOG.md`

## Documentation Structure

| Location | Purpose |
|----------|---------|
| `CHANGELOG.md` | Version history (update on release) |
| `docs/plans/` | Design docs and implementation plans |
| `docs/experiments/` | Experiment one-pagers and guides |
| `.claude/architecture.md` | Technical architecture |

**For planned features:** Use superpowers workflow (brainstorming → planning → execution)

**For iterative work:** Create session note in `docs/session-notes/YYYY-MM-DD_description.md`

## Constraints

- **Schema changes:** Prisma schema is protected. Update contracts, run verify, test on preview before production.
- **No over-engineering:** Build only what's needed. "Good enough for beta" is the target.
- **Validated learning:** Use fake door tests before building features.

## Domain: Decision Stack Framework

**What we generate:**
- **Vision** - Aspirational future state
- **Strategy** - Coherent choices to achieve vision
- **Objectives** - SMART goals with metrics (timeframe, direction, target)

**Extraction approaches:**
- `emergent` - Theme-based extraction with dimensional tagging
- `prescriptive` - Structured fields (industry, target_market, unique_value)

## Experiments

A/B testing via Statsig. Current experiment: `questioning_approach`

Valid variants: `baseline-v1`, `emergent-extraction-e1a`, `dimension-guided-e3`

See [docs/experiments/](docs/experiments/) for details.
