# Lunastak

AI-powered strategy coach that helps founders develop strategic clarity through conversation.

## Quick Start

```bash
# Install
npm install

# Set up environment
cp .env.example .env.local
# Add: DATABASE_URL, ANTHROPIC_API_KEY

# Initialize database
npx prisma generate && npx prisma db push

# Run
npm run dev
```

## Features

- **Guided Conversation** - Adaptive questioning to understand your business
- **Document Upload** - Extract context from PDFs, DOCX, TXT files
- **Strategy Generation** - Vision, strategy, and SMART objectives
- **Experiment Framework** - A/B testing via Statsig

## Tech Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Vercel Postgres + Prisma
- Claude API (Sonnet 4.5)
- Statsig for experiments

## Development

```bash
npm run dev          # Start dev server
npm run type-check   # TypeScript validation
npm run test         # Run tests
npm run verify       # Full verification (type-check + tests + smoke)
```

## Scripts

```bash
npm run regen <traceId>                    # Regenerate strategy locally
npm run regen:remote <traceId> [baseUrl]   # Regenerate via API
```

See [scripts/README.md](scripts/README.md) for details.

## Documentation

| File | Purpose |
|------|---------|
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [CLAUDE.md](CLAUDE.md) | Context for Claude Code |
| [.claude/architecture.md](.claude/architecture.md) | Technical architecture |
| [docs/experiments/](docs/experiments/) | Experiment documentation |

## License

Proprietary - Humble Ventures
