# Lunastak

> AI strategy coach for founders. Talk to Luna, get a Decision Stack.

Lunastak helps founders develop strategic clarity through conversation. You talk to Luna about your business; the system extracts what you said into structured knowledge across 11 strategic dimensions; and from that knowledge it generates and refines a **Decision Stack** — a versioned vision, strategy, and set of objectives that evolves as your thinking does.

The product is at [app.lunastak.io](https://app.lunastak.io). The marketing site lives in a separate repo (`lunastak.io`).

---

## Try the demos

Three pre-built demo projects show what a finished Decision Stack looks like for well-known companies. They're public — no signup needed.

| Company | URL |
|---|---|
| Nike | [app.lunastak.io/demo/nike](https://app.lunastak.io/demo/nike) |
| Costco | [app.lunastak.io/demo/costco](https://app.lunastak.io/demo/costco) |
| TSMC | [app.lunastak.io/demo/tsmc](https://app.lunastak.io/demo/tsmc) |

Demos are powered by the same pipeline as live projects — they just have hydrated context bundles so you can see the output without running through onboarding.

---

## How it works

Lunastak's intelligence pipeline transforms unstructured conversation into structured strategy through four layers, orchestrated by a single planner.

```
HTTP routes (thin)
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  Pipeline orchestrator   src/lib/pipeline/           │
│                                                      │
│  planPipeline(trigger) → executePipeline(plan)       │
│  pure decision function   calls existing libraries   │
└──────────────────────────────────────────────────────┘
        │
        ▼
Layer 0  Extraction       Themes from conversations and documents
Layer 1  Structuring      Persist as Fragments tagged to dimensions
Layer 2  Meaning-making   Synthesise across 11 strategic dimensions
Layer 3  Output           Generate the Decision Stack
```

The 11 dimensions are the spine of the model: Customer & Market, Problem & Opportunity, Value Proposition, Differentiation, Competitive Landscape, Business Model, Go-to-Market, Product & Experience, Capabilities, Risks & Constraints, and Strategic Intent. Every Fragment is tagged to one to three of them; every dimension gets its own LLM-written synthesis; the Decision Stack reads from all of them.

### Data model (high level)

```
Project
├── Conversations → Messages → Fragments
├── Documents → Fragments
├── Fragments (tagged 1–3 of 11 dimensions, with confidence)
├── DimensionalSynthesis × 11 (LLM narrative per dimension)
├── DecisionStack (versioned vision / strategy / objectives)
├── DeepDives (focused exploration sessions)
└── knowledgeSummary, suggestedQuestions
```

Schema lives in [`prisma/schema.prisma`](prisma/schema.prisma). Architecture deep-dive in [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md). Pipeline details in [`docs/architecture/intelligence-pipeline-v2.md`](docs/architecture/intelligence-pipeline-v2.md).

---

## Quick start

```bash
npm install
cp .env.example .env.local    # set DATABASE_URL, ANTHROPIC_API_KEY, NEXTAUTH_SECRET
npm run prisma:generate
npm run dev
```

> **Note on `prisma db push`:** the project does not use Prisma migrations. **Do not run `npm run prisma:push` against shared environments** — it can drop columns and tables without warning. For schema changes, apply raw SQL per env via the Neon console or a small `@neondatabase/serverless` script. The drift check (below) will tell you if any env disagrees with `schema.prisma`.

### Schema drift check

`npm run db:check-drift` compares each env's live schema to `prisma/schema.prisma` and fails if anything differs from the approved baseline in `prisma/drift-baseline/`. It runs automatically on `git push`. When you intentionally change the schema (or directly modify a database), run `npm run db:approve-drift` to recapture the baselines, then commit them. See [`prisma/drift-baseline/README.md`](prisma/drift-baseline/README.md) for the full story.

### Common scripts

```bash
npm run dev               # next dev
npm run type-check        # tsc --noEmit
npm test                  # jest
npm run smoke             # smoke tests only
npm run verify            # type-check + tests + smoke (run by pre-push hook)
npm run db:check-drift    # compare each env's schema to prisma/schema.prisma
npm run db:approve-drift  # capture current diffs as the new baseline
npm run prisma:studio     # browse the DB
npm run pipeline          # run the pipeline manually against a project
npm run seed:hydrate      # hydrate a demo project from a JSON bundle
```

---

## Tech stack

- **Frontend** — Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui (Radix primitives)
- **Backend** — Next.js Route Handlers + Edge middleware
- **Database** — Neon Postgres via Prisma 5 (`@prisma/adapter-neon`)
- **LLM** — Claude (`@anthropic-ai/sdk`)
- **Auth** — NextAuth (`@next-auth/prisma-adapter`) with a guest-cookie fallback for unauthenticated visitors
- **Analytics & flags** — Statsig (`@statsig/js-client`, session replay, web analytics), Vercel Analytics
- **Email** — React Email + Resend
- **Testing** — Jest + Testing Library
- **Hosting** — Vercel (dev / preview / production), with three Neon branches to match

---

## Repository layout

```
src/
├── app/                      Next.js App Router — pages and route handlers
│   ├── api/                  HTTP layer (thin; delegates to lib/)
│   ├── project/[id]/         Project page (Decision Stack, Knowledgebase tabs)
│   └── demo/[slug]/          Pretty demo URLs (resolved by middleware)
├── components/               UI — shadcn/ui primitives in components/ui/
├── lib/
│   ├── pipeline/             Planner + executor for the 4-layer intelligence pipeline
│   ├── extraction/           Theme extraction from conversations/documents
│   ├── synthesis/            Dimensional synthesis
│   ├── generation/           Decision Stack generation
│   ├── constants/dimensions  The 11 strategic dimensions
│   ├── db.ts                 Prisma client (Neon serverless adapter)
│   └── projects.ts           Project + guest user helpers
├── middleware.ts             Demo slug rewrites (/demo/<slug> → /project/<id>)
└── data/demos/               Demo project context bundles (nike, costco, tsmc)

prisma/schema.prisma          Single source of truth for the data model
scripts/                      One-off ops scripts (regenerate, backfill, seed)
docs/architecture/            Design docs and ADRs
```

---

## Demo URLs (`/demo/<slug>`)

The `/demo/<slug>` route is a runtime middleware rewrite — `src/middleware.ts` queries `Project.demoSlug` directly via `@neondatabase/serverless` (Prisma is too heavy for the Edge runtime) and rewrites the request to `/project/<id>` while keeping the URL pretty in the browser.

Adding or renaming a demo is a database operation only — set `Project.demoSlug = '<slug>'` (and `isDemo = true`) and the URL is live. No deploy needed.

---

## Workflow

- **Branch model** — work on `development`, merge to `main` for production. Feature branches off `development`.
- **Commits** — conventional (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- **Pre-push** — `npm run verify` runs automatically; do not bypass with `--no-verify`.

### Environments

| Env | Branch | URL | Database |
|---|---|---|---|
| Dev | local | `localhost:3000` | Neon (sweet-dawn) |
| Preview | `development` | Vercel preview deploys | Neon (shiny-salad) |
| Production | `main` | [app.lunastak.io](https://app.lunastak.io) | Neon (soft-grass) |

---

## Documentation

| File | Purpose |
|---|---|
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | System design, data model, key decisions |
| [docs/architecture/intelligence-pipeline-v2.md](docs/architecture/intelligence-pipeline-v2.md) | How conversations become strategy |
| [docs/architecture/background-task-messaging.md](docs/architecture/background-task-messaging.md) | Async task patterns |

---

## License

Proprietary — Humble Ventures.
