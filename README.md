# Lunastak

AI strategy coach that helps founders develop strategic clarity through conversation. Users talk to Luna, context is extracted into structured knowledge, and a Decision Stack (vision, strategy, objectives) is generated and refined over time.

## How It Works

Lunastak's intelligence pipeline transforms unstructured conversation into structured strategy through four layers:

```
API Routes (thin HTTP layer)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Pipeline Orchestrator  ·  src/lib/pipeline/        │
│                                                     │
│  planPipeline(trigger)  →  executePipeline(plan)    │
│  pure decision function    calls existing libraries │
└─────────────────────────────────────────────────────┘
    │
    ▼
Layer 0: Extraction     Emergent themes from conversations/documents
Layer 1: Structuring    Persist as Fragments with dimensional tags
Layer 2: Meaning-Making Synthesise across 11 strategic dimensions
Layer 3: Output         Generate Decision Stack (vision, strategy, objectives)
```

### Data Model

```
Project
├── Conversations → Messages
├── Documents
├── Fragments (extracted themes, tagged with 1-3 of 11 dimensions)
├── DimensionalSynthesis × 11 (LLM narrative per dimension)
├── GeneratedOutputs (versioned Decision Stacks)
│   └── StrategyVersions (per-component edit history)
└── knowledgeSummary, suggestedQuestions
```

## Quick Start

```bash
npm install
cp .env.example .env.local    # Add: DATABASE_URL, ANTHROPIC_API_KEY
npx prisma generate && npx prisma db push
npm run dev
```

## Development

```bash
npm run dev          # Start dev server
npm run type-check   # TypeScript validation
npm run test         # Run tests
npm run verify       # Full verification (type-check + tests + smoke)
```

## Tech Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Neon Postgres + Prisma
- Claude API via @anthropic-ai/sdk
- Vercel (dev, preview, production)

## Documentation

| File | Purpose |
|------|---------|
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [CLAUDE.md](CLAUDE.md) | Context for Claude Code (workflow, constraints, domain) |
| [docs/architecture/](docs/architecture/) | Architecture docs (technical overview, pipeline diagrams, decision matrix, ER diagram) |

## License

Proprietary - Humble Ventures
