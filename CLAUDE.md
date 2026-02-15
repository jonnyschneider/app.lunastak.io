# Claude Code Context

This file provides context for Claude Code when working on this codebase.

## Project Overview

Lunastak is an AI strategy coach. Users have conversations, context is extracted into fragments, syntheses are built across dimensions, and strategy (vision, strategy, objectives) is generated.

**Key flow:** Conversation → Extraction → Fragments → Synthesis → Generation

## Essential Commands

```bash
npm run dev          # Start dev server
npm run type-check   # TypeScript validation
npm run test         # Run tests
npm run verify       # Full verification (pre-push runs this automatically)
npm run smoke        # Smoke tests only
```

## Architecture

See [docs/architecture/](docs/architecture/) for full details.

**Pipeline orchestrator** — all business logic flows through the pipeline. Routes are thin HTTP wrappers.

```
/extract ──────┐
/doc-upload ───┤
/template ─────┤──── PipelineTrigger ──── planPipeline() ──── executePipeline()
/refresh ──────┤                              │                     │
/generate ─────┘                         PipelinePlan          calls existing
                                      (pure function)          libraries
Routes handle HTTP only.              One decision matrix.     No duplication.
```

New pipeline behaviour (triggers, layers, generation paths) should go through the orchestrator — not be added as standalone route logic. Decision log in `docs/architecture/intelligence-pipeline-v2.md` §6.

**Key directories:**
- `src/app/api/` - API routes (thin HTTP layer, 28 route groups)
- `src/lib/pipeline/` - Pipeline orchestrator (plan → execute → generate)
- `src/lib/prompts/` - Versioned prompt system with shared format constants
- `src/lib/contracts/` - Data contracts for pipeline boundaries
- `src/lib/` - Core logic, types, utilities
- `src/components/` - React components
- `prisma/schema.prisma` - Database schema (protected boundary)

**Data contracts:** Define expected shapes at extraction/persistence/generation boundaries. Run `npm run verify` to catch breaking changes.

## Git Workflow

- Work on `development` branch
- Commit directly as work completes (no approval needed for commits)
- Jonny controls merges to `main`
- Pre-push hook runs `npm run verify` automatically

**Commit format:** Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)

## Development & Release Process

**Development cycle:** Commit → UAT on dev → fix → confirm → repeat until happy.

**Background tasks (`waitUntil`):** `waitUntil` from `@vercel/functions` is a no-op in the Next.js dev server — background work (extraction, generation) won't complete locally. Test background task flows on Preview.

**Release:** Update `CHANGELOG.md` (move [Unreleased] to [X.Y.Z]), update `package.json` version, commit, push to preview and production. **Check:** if any schema changes landed since last release, ensure migrations are applied to each environment during deploy.

**Single source of truth for versions:** `CHANGELOG.md`

## Documentation Structure

| Location | Purpose |
|----------|---------|
| `CHANGELOG.md` | Version history (update on release) |
| `docs/plans/` | Design docs and implementation plans |
| `docs/r-and-d/` | R&D tax documentation (activities, evidence, narrative) |

**Note:** `docs/` is gitignored - kept locally for R&D tax records, not version controlled.

**For planned features:** Use `/r-and-d-brainstorm` — this runs the standard brainstorming workflow and appends R&D context (activity mapping, uncertainty, evidence trail) to the design doc and R&D source files. This creates contemporaneous documentation for R&D tax purposes.

## Schema & Data Contracts

`prisma/schema.prisma` is a **protected boundary**. Schema changes ripple through contracts, API shapes, fragment/synthesis creation, and production migrations.

**Before modifying the schema:**
1. Consider if the change can live in application code instead (JSON fields are flexible)
2. Update affected contracts in `src/lib/contracts/`
3. Run `npm run verify` — contract tests catch shape mismatches
4. Create migration locally: `npx prisma migrate dev --name descriptive-name`
5. Test migration on preview before production

**Migrations are gitignored** — created locally, applied via `prisma migrate deploy`. When a release includes schema changes, migrations MUST be applied to preview and production as part of the release. Push code before (or simultaneously with) destructive migrations — dropping columns while old code is deployed causes 500s.

## Constraints

- **Build sensibly:** Anticipate likely future needs. If something will have multiple callers or use-cases, set it up to be centrally managed (orchestrator, provider, service). Don't gold-plate for scale, but don't leave obvious extension points unserved either.
- **Validated learning:** Use fake door tests before building features.

## Domain: Decision Stack Framework

**What we generate:**
- **Vision** - Pithy headline (4-15 words) + elaboration
- **Strategy** - Coherent choices headline (15-25 words) + elaboration
- **Objectives** - Title, statement, explanation, OMTM (metric name + aspiration)

**Extraction:** Emergent theme-based extraction with dimensional tagging (11 strategic dimensions).

**Generation paths:**
- `initial` - First generation from fragments via versioned prompt (currently v4-pithy-statements)
- `refresh` - Incremental update from new/removed fragments + dimensional syntheses
- `template` - User-provided strategy, no LLM
