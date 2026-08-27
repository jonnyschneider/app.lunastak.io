# Architecture Documentation

**Last Updated:** 2026-08-26

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

Every LLM stage is classified in one exhaustive policy table. Voice and language guidance is
resolved from it at the `createMessage()` seam and injected as the `system` block — call sites
cannot supply their own, so **there is no call-site expression that produces an ungoverned
request.**

```
src/lib/llm/policy.ts        # LLM_POLICY: Record<LlmContext, Policy> — model, effort,
                             # maxTokens, guidance bundle, system block, per stage.
                             # systemFor(context) is the only sanctioned way to build a
                             # system block.
src/lib/prompts/shared/      # The guidance constants the bundles compose:
├── voice.ts                 #   VOICE_CONSTRAINT
├── plain-language.ts        #   PLAIN_LANGUAGE_TITLE_GUIDANCE, ..._EXPLAINER_GUIDANCE
├── question-titles.ts       #   QUESTION_TITLE_GUIDANCE
├── objectives.ts            #   OBJECTIVE_GUIDELINES, OBJECTIVE_XML_FORMAT
└── vision-strategy.ts       #   VISION_GUIDELINES, STRATEGY_GUIDELINES, + XML formats
```

Stage prompts live at their call sites; only the *shared* guidance is centralised.

**Six guidance bundles**, selected per artefact type — applying the wrong one to the wrong
artefact is a real bug this shape prevents (`09a1050`):

| Bundle | Composition | Applied to |
|---|---|---|
| `commitment` | vision + strategy + objectives + voice | strategy generation, refresh generation |
| `opportunity` | plain-language title + explainer + voice | opportunity generation |
| `question-gap` | plain-language explainer + question titles + voice | full/incremental synthesis, knowledge summary |
| `summary` | plain-language explainer + voice (**no title rules**) | refresh change-summary, reflective summary |
| `chat` | *deliberately empty, pending an A/B* | conversational turns |
| `none` | — | structured extraction (XML/JSON), where guidance is cost and parse risk |

**Enforcement is by type and test, not by author recall:**

| Mechanism | Catches | When |
|---|---|---|
| `Record<LlmContext, Policy>` exhaustiveness | a new stage with no classification | compile |
| `context: LlmContext` required | an unclassified or typo'd context string | compile |
| `system` not settable by callers | a call site hand-rolling its own guidance | compile |
| Guidance test, **derived from `LLM_POLICY`** | a resolved system block missing its declared guidance | test |
| Cache-floor test | a guidance trim that silently disables prompt caching | test |
| Content-hash ratchet | any edit to a measured guidance constant | test |

The guidance test iterates the policy table rather than a hand-maintained file list, so a new
stage is covered the moment it is classified. The predecessor was an inventory of four
filenames; it missed `incremental-synthesis.ts` and stayed wrong after the fix.

**The versioned prompt registry was retired 2026-08-27** — its backtest consumer was never
built. See [retired-prompt-registry.md](retired-prompt-registry.md). Prompt provenance is now a
`promptHash` stamped on every call at the seam.

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

### ⚠ Reading the response: use `extractText()`, never `content[0]`

```typescript
import { extractText } from '@/lib/extract-text'
const text = extractText(response)          // ✅
const text = response.content[0].text       // ❌ loses the response on thinking models
```

`response.content[0]` is the text block only when the response has exactly one block. With
adaptive thinking a **`thinking` block is returned first** (verified live 2026-08-26: both
`claude-sonnet-5` and `claude-opus-5` return `[thinking, text]` on realistic prompts), so a
`content[0]?.type === 'text' ? … : ''` guard falls through to its fallback and **silently
discards a good response** — no exception, just empty text and a stage that quietly does
nothing. This was live across 25 call sites.

**`extractText()` is the single universal reader.** It lives in `src/lib/extract-text.ts`,
deliberately standalone and side-effect free: `@/lib/claude` throws at import when
`ANTHROPIC_API_KEY` is unset, so it cannot be imported by tests or pure code paths.
`@/lib/claude` re-exports it for convenience. It joins **all** text blocks in order, ignores
`thinking` / `redacted_thinking` / `tool_use`, and returns `''` rather than throwing on a
malformed response — so `extractText(r) || fallback` also handles a genuinely empty answer,
which the old ternary passed through as `''`.

There must be exactly one implementation. Three separate hand-rolled variants existed at the
point this was found (positional index, `.find(b => b.type === 'text')`, and inline
`.filter().map().join()`); all now delegate. `src/lib/__tests__/content-block-access.test.ts`
scans **both `src/` and `tools/`** and rejects all three shapes.

---

## Analytics & Instrumentation

**Canonical event reference: [`docs/analytics/events.md`](../analytics/events.md).** Every
custom Statsig event and its metadata is listed there. Update it in the same commit as any
change to an event's name, value or metadata — dashboards on the "Lunastak v2" board are built
from it, and drift means someone filters on a field that was never emitted.

### Identity model (read before touching any per-user counter)

Every project has a `userId` — `Project.userId` is non-null. There is no anonymous path:

- A visitor who starts without signing in gets a **real `User` row** created by
  `createGuestUser()`, identified by a synthetic email (`isGuestUser()` recognises the pattern)
  and a `guestUserId` cookie.
- On signup, `transferGuestToUser()` moves projects, conversations, fragments and dismissals to
  the authenticated user, then **deletes the guest `User` row**
  (`src/lib/transfer-session.ts`).

**Consequence:** per-user counters on the guest row do not survive conversion. A converted
user's `totalPromptTokens` / `totalCompletionTokens` count post-signup activity only. Any
analysis of "tokens per user" silently excludes every user's pre-signup work.

### ⚠ `apiCallCount` is a QUOTA, not telemetry

`GUEST_API_LIMIT = 20` (`src/lib/projects.ts`). `checkAndIncrementGuestApiCalls()` blocks a
guest once `apiCallCount` reaches it. **`createMessage()` also increments the same field** on
every call that passes a `userId`.

So the field is written from two places and means two things. The rule that follows:

> **Adding telemetry must never add an `apiCallCount` increment.** Metering more call sites
> would consume guests' allowance faster and could wall them mid-flow — a product change
> wearing the costume of an instrumentation fix.

Separating quota from telemetry (a dedicated counter for each) is unbuilt work; until then,
treat the metered/unmetered split as **product surface**, not an oversight to tidy up.

### Telemetry coverage gap

`llm_token_usage` fires inside `if (userId && response.usage)`, and **10 of 26 `createMessage`
call sites pass no `userId`** — including `extraction`, `knowledge_summary`, `full_synthesis`,
`incremental_synthesis` and `document_extraction`. Those emit no event and no counter increment.

Token-burn dashboards and per-user counters therefore **understate real usage, and understate it
unevenly**, since several unmetered stages are among the most expensive. Do not treat either as
a complete cost picture. For exact per-stage cost, use the local capture instrument
(`src/lib/experiment/capture.ts` + `npm run experiment:replay`), which records every call
regardless of metering.

### Prompt/response capture is local-only

`src/lib/experiment/capture.ts` writes resolved requests and responses to disk for model
comparison. It is **hard-gated off in production** (`NODE_ENV === 'production'` returns false
regardless of `LUNASTAK_CAPTURE_DIR`) because the payloads are user content and a serverless
filesystem is ephemeral anyway. The safe half — context, model, tokens, latency, truncation —
rides on `llm_token_usage` instead.

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
| Claude 5 family: a too-tight `max_tokens` yields an **empty string**, not a partial answer — reasoning consumes the whole budget before the first visible token (measured 2026-08-26). Pre-5 models degrade to usable partial text | `maxTokensFor()` adds reasoning headroom for thinking models; see `src/lib/model-config.ts` | **Revisit:** re-tune the per-stage ceilings, and audit call sites that assume non-empty text |

### Application

| Discovery | Solution | Status |
|-----------|----------|--------|
| Synthesis race conditions | Sequential: synthesis → then knowledge summary | **Revisit:** parallel with coordination |
| Guest-to-auth duplicate projects | Merge guest data, delete guest project | **Revisit:** proper session-to-user binding |
| `apiCallCount` serves as both the guest quota and LLM call telemetry, written from two places | Documented; metering more call sites is a product change, not a fix. See [Analytics & Instrumentation](#analytics--instrumentation) | **Revisit:** split into separate quota and telemetry counters |
| Guest `User` row is deleted at transfer, destroying its token counters | Accepted — per-user token history starts at signup | **Revisit:** carry counters across on transfer |
| `llm_token_usage` misses 10 of 26 LLM call sites (those without a `userId`), skewing cost dashboards toward the cheap stages | Documented in `docs/analytics/events.md`; exact per-stage cost comes from the local capture instrument | **Revisit:** alongside the quota/telemetry split |
| Cross-component state (project deletion) | Window events | **Revisit:** proper state management |
| **`max_tokens` ceilings were fitted to sonnet-4-5's verbosity** and are too tight for thinking models, which spend reasoning tokens from the same budget. `maxTokensFor()` adds headroom as a workaround; measured demand is `continue_questioning` ~459 against a shipped ceiling of 200, and `continue_confidence` ~765 against 300 | Headroom at the `createMessage()` seam (`src/lib/model-config.ts`). The rest of that module's surface was promoted to permanent at the Phase 4 ruling; this is the one item that remains a workaround | **Revisit:** re-tune the per-stage ceilings to the measured demand, then delete the headroom |

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
