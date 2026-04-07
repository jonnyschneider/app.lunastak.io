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
| Statsig: stableID is per-origin, so `lunastak.io` and `app.lunastak.io` see the same physical visitor as two anonymous users until guest userID is created on app arrival | Accepted gap. Aggregate funnels are sufficient. See [Decision: Cross-Site Statsig Identity Stitching (2026-04-07)](#decision-cross-site-statsig-identity-stitching-2026-04-07). | **Revisit:** when running marketing A/B tests or per-user attribution analysis |
| Claude: adds preamble to JSON responses | `extractJSON()` finds JSON within text | **Durable** |
| Claude: silent truncation at `max_tokens` | `createMessage()` logs warning | **Revisit:** auto-retry with higher limit |

### Application

| Discovery | Solution | Status |
|-----------|----------|--------|
| Synthesis race conditions | Sequential: synthesis → then knowledge summary | **Revisit:** parallel with coordination |
| Guest-to-auth duplicate projects | Merge guest data, delete guest project | **Revisit:** proper session-to-user binding |
| Cross-component state (project deletion) | Window events | **Revisit:** proper state management |

---

## Security & Access Control

### Authentication Model

- **Authenticated users:** NextAuth session → ownership check on all API routes
- **Guest users:** `guestUserId` cookie → limited access to own guest project only
- **Demo projects:** `isDemo` flag on Project model bypasses ownership checks

### Demo Project Access (Decision: 2026-03-27)

**Context:** Acquired podcast demo Decision Stacks (Costco, TSMC, Nike) need to be viewable by any user — guests, logged-in users, and unauthenticated visitors.

**Decision:** Server-side `isDemo` boolean on the Project model controls access. When `isDemo=true`:
- Trace API skips ownership check (any user can view)
- Content API (`/api/project/[id]/content`) allows read access for any authenticated/guest user
- UI renders in read-only mode (no edit/add affordances)

**Why not a query param?** An earlier iteration used `?readonly=true` to bypass the trace API ownership check. This was a security hole — any user with a trace ID could bypass auth by appending the param. Reverted within the same session.

**Why `isDemo` and not a public/sharing flag?** `isDemo` is deliberately limited:
- Only settable via direct DB access (no API endpoint to set it)
- Only used for showcase projects we control
- A proper sharing/public access model (link sharing, viewer roles, public URLs) is a separate design concern for the product roadmap

**Scaling considerations:**
- If we add user-initiated sharing, it needs its own access model (viewer tokens, expiring links, or role-based access)
- `isDemo` should remain admin-only — don't let users set their own projects to demo mode
- The content API `OR: [{ userId }, { isDemo: true }]` pattern works for small numbers of demo projects but would need an index if demo count grows significantly

### Related Documents

- **Product & Tech Summary:** `My Drive (jonny@humventures.com.au)/05-Initiatives/Lunastak/2026 01 26 Product and Tech Summary.md` — broader product context, auth model rationale, and scaling roadmap

### Decision: Cross-Site Statsig Identity Stitching (2026-04-07)

**Context:** As of 2026-04-07, both `lunastak.io` (marketing) and `app.lunastak.io` are wired into the same Statsig project and share the same client key. We want to measure the activation funnel end-to-end, from marketing page view through to in-app strategy generation.

**Discovery:** The Statsig client SDK uses `localStorage` for stableID, which is per-origin. A single physical visitor browsing both sites is registered as two distinct anonymous users in Statsig. Once they reach `app.lunastak.io`, Lunastak auto-creates a guest user, and Statsig stitches all subsequent events by `userID` — but the marketing-side events remain siloed under a different stableID.

**Decision:** Accept the gap. Do not implement cross-site stableID stitching at this time.

**Rationale:**
- ✅ **Aggregate funnel metrics work without stitching** — "1000 marketing visits → 200 CTA clicks → 150 account creations" is computable from raw event counts. No per-user joining required.
- ✅ **Post-arrival behaviour stitches by `userID`** — once a visitor lands on the app, every event is tied to a guest or real user.
- ❌ **Per-user marketing attribution doesn't work** — "which copy variant did *this specific user* see before signup?" is unanswerable without stitching.
- ❌ **A/B test analysis spanning the marketing→app jump is broken.**

We currently care about aggregate metrics, not per-user attribution or A/B test analysis. The fix is additive and low-risk (~3 hours), so we can revisit when the trigger conditions arrive (running marketing experiments, or wanting copy-level attribution).

**The fix (when we want it):** Use Statsig's `customIDs` feature with a shared identifier stored in a `.lunastak.io` parent-domain cookie. Both sites pass `customIDs.crossSiteId` to `StatsigClient` at init, and dashboards are configured to use `crossSiteId` as the unit of analysis instead of stableID. Full recipe, sample code, effort estimate, and caveats are in the spec doc.

**Trigger to revisit:**
- Running an A/B test where the variant assignment is on the marketing site and the conversion is in the app
- Wanting to attribute signups to specific marketing copy or referral sources at the per-user level
- Implementing campaign tracking or paid acquisition analysis

**Related Documents:**
- **Statsig Dashboards Spec:** `My Drive (jonny@humventures.com.au)/05-Initiatives/Lunastak/docs/plans/statsig-dashboards.md` — full dashboard catalogue, event reference, and the "Known Limitation: Cross-Site Identity Stitching" section with the implementation recipe.

### API Route Auth Summary

| Route | Auth Model |
|-------|-----------|
| `GET /api/trace/[traceId]` | Owner OR guest-with-traceId OR `isDemo` project |
| `GET /api/project/[id]/content` | Owner OR guest-owner OR `isDemo` project |
| `POST/PUT/DELETE /api/project/[id]/content` | Owner only (strict) |
| `POST /api/project/[id]/strategy-version` | Owner only (strict) |
| `GET /api/project/[id]/strategy` | Owner OR guest-owner |
