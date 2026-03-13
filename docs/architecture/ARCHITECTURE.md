# Architecture Documentation

**Last Updated:** 2026-02-15

---

## Tech Stack

- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Neon Postgres via Prisma ORM
- **Auth:** NextAuth.js (Google OAuth + magic links)
- **LLM:** Claude API via `@anthropic-ai/sdk`
- **Hosting:** Vercel (3 environments: dev, preview, production)
- **Feature Flags:** Statsig
- **Testing:** Jest + React Testing Library

---

## System Architecture

### Intelligence Pipeline

The core of Lunastak is a 4-layer pipeline orchestrated by `src/lib/pipeline/`:

```
API Routes (thin) → planPipeline() → executePipeline()
                     pure function     calls libraries
```

**Layers:**
0. **Extraction** — Emergent themes from conversations/documents (LLM)
1. **Structuring** — Persist as Fragments with dimensional tags
2. **Meaning-Making** — Synthesise across 11 strategic dimensions (LLM, background)
3. **Output** — Generate Decision Stack: vision, strategy, objectives (LLM)

**Full pipeline documentation:** `docs/architecture/intelligence-pipeline-v2.md`

### Pipeline Module Structure

```
src/lib/pipeline/
├── types.ts        # PipelineTrigger, PipelinePlan, PipelineResult
├── plan.ts         # planPipeline() — pure decision function
├── executor.ts     # executePipeline() — orchestrates library calls
├── generation.ts   # runInitialGeneration(), runRefreshGeneration()
└── index.ts        # barrel export
```

### Prompt System

Versioned prompts with shared format constants:

```
src/lib/prompts/
├── shared/
│   ├── objectives.ts        # OBJECTIVE_GUIDELINES, OBJECTIVE_XML_FORMAT
│   └── vision-strategy.ts   # VISION_GUIDELINES, VISION_XML_FORMAT, etc.
├── generation/
│   └── v4-pithy-statements.ts  # Current generation prompt
├── extraction/
│   └── v1-emergent.ts
└── index.ts                 # getCurrentPrompt() resolver
```

### Data Model

```
Project
├── Conversations → Messages
├── Documents
├── Fragments (extracted themes, tagged with dimensions)
├── DimensionalSynthesis × 11 (LLM summary per dimension)
├── GeneratedOutputs (versioned Decision Stacks)
│   └── StrategyVersions (per-component edit history)
└── knowledgeSummary, suggestedQuestions
```

**Full ER diagram:** `docs/architecture/intelligence-pipeline-v2.md` §3

### Data Contracts

Contracts define expected shapes at pipeline boundaries. Located in `src/lib/contracts/` with tests in `src/lib/__tests__/contracts/`.

When adding a new API or data flow:
1. Define contract types in `src/lib/contracts/`
2. Add validation tests in `src/lib/__tests__/contracts/`
3. Update smoke test if it affects the critical path

---

## Claude API Usage

### Use createMessage() Wrapper

All Claude API calls MUST go through `createMessage()` in `src/lib/claude.ts`:

```typescript
import { createMessage } from '@/lib/claude'

const response = await createMessage({
  model,
  max_tokens: 1000,
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.7,
}, 'your_context_label')
```

The wrapper provides automatic truncation detection, consistent logging, and a single point of control. A test in `src/lib/__tests__/claude-wrapper.test.ts` enforces this — only `src/lib/claude.ts` may call `anthropic.messages.create` directly.

---

## Schema Change Policy

The Prisma schema (`prisma/schema.prisma`) is a protected boundary. Before modifying:

1. Consider if the change can be made in application code instead
2. Update relevant contracts in `src/lib/contracts/`
3. Run `npm run verify` to catch breaking changes
4. Test migration on preview deployment before production
5. Document the change in CHANGELOG.md

---

## Known Compromises

Runtime discoveries and conscious trade-offs. Each notes whether the fix is **durable** (keep) or **revisit** (when trigger condition met).

### Platform

| Discovery | Solution | Status |
|-----------|----------|--------|
| Vercel: background tasks silently fail when response completes | `await` all async operations before response | **Durable** |
| Statsig: events don't flush in serverless | Call `statsig.flush()` after logging | **Durable** |
| Claude: adds preamble to JSON responses | `extractJSON()` finds JSON within text | **Durable** |
| Claude: silent truncation at `max_tokens` | `createMessage()` logs warning | **Revisit:** auto-retry with higher limit |

### Application

| Discovery | Solution | Status |
|-----------|----------|--------|
| Synthesis race conditions | Sequential: synthesis → then knowledge summary | **Revisit:** parallel with coordination |
| Guest-to-auth duplicate projects | Merge guest data, delete guest project | **Revisit:** proper session-to-user binding |
| Cross-component state (project deletion) | Window events | **Revisit:** proper state management |
