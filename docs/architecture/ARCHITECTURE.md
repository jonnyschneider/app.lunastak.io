# Architecture Documentation

**Last Updated:** 2026-09-11

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
0. **Extraction** — Emergent themes from conversations/documents (LLM). Each theme cites a
   verbatim span from its source and self-reports `verbatim | interpretation`
   (`src/lib/evidence/`); spans are verified at ingest, and the source is not persisted.
1. **Structuring** — Persist as Fragments with dimensional tags and their `Evidence` rows
2. **Meaning-Making** — Synthesise across 11 strategic dimensions (LLM, background). A dimension's
   summary describes **exactly its active fragments**: any change to that set since the last run —
   a discard, or a restore — forces a full rebuild on the next synthesis run (`decideSynthesis`,
   `src/lib/synthesis/update-synthesis.ts`). Refresh reads these summaries, so a discard must reach
   them; nothing regenerates *on* a discard itself.
3. **Output** — Generate Decision Stack: vision, strategy, objectives (LLM). **Does not follow
   Layer 1 automatically.** An initial conversation stops after fragments; the user reviews the
   ground truths, and the first strategy is generated only on a later `generate_from_knowledge`
   (`POST /api/project/[id]/generate-strategy`).

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

Each stage's **static** prompt (task framing + output format) lives in
`prompts/stages/` and is referenced by its policy entry, so the whole block is
byte-identical on every call and can serve as a **cached prefix**. Call sites assemble only
the variable payload. Six stages are cached, each measured ≥1024 tokens with `count_tokens`;
`cache_control: {type:'ephemeral'}` is applied at the seam, and `cacheWriteTokens` /
`cacheReadTokens` on `llm_token_usage` are what prove it is actually hitting.

A stage prompt marks where its guidance belongs with a `{guidance}` slot, so the output-format
instruction can stay last rather than being buried under the bundle.

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
| Cacheable-stage measurement test | `cacheable: true` set from an estimate rather than count_tokens | test |
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
│   └── Evidence (verbatim span per fragment + its verification result)
├── DimensionalSynthesis × 11 (LLM summary per dimension)
├── DecisionStack → DecisionStackComponent (objectives, opportunities, principles)
├── DecisionStackSnapshot (versioned, per generation/refresh)
└── knowledgeSummary, suggestedQuestions
```

`GeneratedOutput` and `StrategyVersion` were retired when the strategy side moved to
`DecisionStack` (see `intelligence-pipeline-v2.md` §6, 2026-08-29).

**Full ER diagram:** `docs/architecture/intelligence-pipeline-v2.md` §3

### Data Contracts

Contracts define expected shapes at pipeline boundaries. Located in `src/lib/contracts/` with tests in `src/lib/__tests__/contracts/`.

> ### ⚠ Contracts are type-level only — they are not enforced at runtime (verified 2026-08-29)
>
> **5 of the 6 exported validators are never called in production code.** Only
> `validateStrategyVersionInput` runs (in `/api/project/[id]/strategy-version`);
> `validateEmergentExtraction`, `validateGenerationInput`, `validateGenerationOutput`,
> `validateRefreshStrategyOutput` and `validateUser` are exercised **only by their own tests**.
>
> So `npm run verify` passing means the contracts agree with themselves — **not** that the pipeline
> honours them. Two consequences already observed:
>
> - `FragmentContract` declares `contentType: 'theme'` and `status: 'active'`. Production holds
>   **933 `insight` fragments** (bundle imports) against 921 themes, plus archived rows. Nothing
>   caught it.
> - There is **no contract for `DimensionalSynthesis`** — the boundary where four unread fields
>   accumulated undetected.
> - `contracts/strategy-version.ts` is named for a model retired after 2026-02-15, and its
>   `StrategyComponentType` (`vision | strategy | objective`) disagrees with the schema's
>   `DecisionStackComponent.componentType` (`objective | opportunity | principle`).
>
> **Do not patch these individually.** They are symptoms of one unexamined question — what contracts
> are for here and where they should bind — deferred to a systematic pass. Findings:
> `docs/_plans/2026-08-29-knowledge-architecture-audit.md` (local).

When adding a new API or data flow:
1. Define contract types in `src/lib/contracts/`
2. Add validation tests in `src/lib/__tests__/contracts/`
3. Update smoke test if it affects the critical path

---

## Navigation & Landing — `/project/[id]`

*Added 2026-09-11.* The project page's mode is a URL (`?mode=stack | knowledge | review`), where a
user lands is decided by **one server-side table**, and everything that moves a user between modes
or into a review goes through a small set of handlers. The design is
`docs/_plans/2026-09-10-navigation-and-guidance-map-design.md` (local); what is on screen in each
state is [`screen-map.md`](screen-map.md) §3. This section is the **how to build on it** half.

```
/project/[id]            page.tsx (server) ── no ?mode ──▶ resolveProjectMode() ──▶ redirect ?mode=…
/project/[id]?mode=…     page.tsx (server) ── has mode ──▶ <ProjectClient mode=…>   (no DB work)
                                                              │
                         setMode() · presentIngestReview() ◀──┘  every in-session move
```

### Preferred handlers — use these, not the thing they wrap

| job | use | never |
|---|---|---|
| Change mode | `setMode(next, { batch?, deepDive?, filter? })` — `ProjectClient.tsx` | `router.push('?mode=…')` by hand. `setMode` writes the mode cookie (never for `review`), strips `batch`/`deepDive` outside the review, carries a knowledge `filter` only on the move that asks for it (a filter is an arrival instruction), and pushes (so back undoes a toggle) |
| Decide where a bare URL lands | a **row** in `resolveProjectMode` — `src/lib/navigation/resolve-mode.ts`, tested by enumeration | a client effect, or a special case at a call site. The table replaced four racing effects |
| Show an ingest's review | `presentIngestReview(source, id, deepDiveId?)` — `ProjectClient.tsx` | `setMode('review')` directly. It enforces pre-strategy / non-demo, refuses to act for a project no longer on screen, and will not yank a user out of a review they are reading |
| Name an ingest | `reviewBatchKey(source, id)` / `parseReviewBatchKey(key)` — `review-batch.ts` | string templates like `` `doc:${id}` ``. The parser is the shape gate for user input |
| Link into a filtered knowledgebase | from outside the page, `knowledgeHref(projectId, filter)`; from inside it, `setMode('knowledge', { filter })`; read with `parseKnowledgeFilter` — `knowledge-filter.ts` (both write through `knowledgeFilterParams`) | hand-built `?dimension=` / `?filter=`. Two writers and no reader is how `?dimension=` went dead for a day |
| "Does this project have a strategy?" | `projectHasStrategy({ hasVision, generationTraceCount })` + `hasStackVision(vision)` — `has-strategy.ts` | `!!decisionStack`, or `strategyOutputs.length` on its own. Server and client disagreeing on this stranded users on an unrenderable review |
| Per-device memory | `writeModeCookie` / `readModeCookieValue` (`mode-cookie.ts`); `writeLastProjectCookie` / `readLastProjectCookie` / `readLastProjectCookieFromDocument` (`last-project-cookie.ts`) | `localStorage` for anything the server must read — the redirect runs before any client code |
| Record that a review was deferred | `useDismissed(projectId, 'ground_truth_review', batchKey).dismiss` | a per-project key. Reviews are per ingest; one deferral must not silence the next ingest |
| "Who is this request?" (server) | `getUserId()` — `src/lib/auth/current-user.ts` in pages; the guard in API routes | reading the `guestUserId` cookie directly. The cookie is an id, not a proof — see [API Access](#api-access--every-route-goes-through-the-guard) |

### Invariants — each one has already cost a bug

1. **The redirect happens on the server, before render.** A client redirect makes the back button
   return to the redirector, which sends the user forward again — they cannot leave the project.
2. **A URL with `?mode` does no database work.** A search-param change re-executes the server
   component, so any query there puts a round-trip on every toggle. State reads stay behind the
   no-mode branch of `page.tsx`.
3. **An empty project renders the cold start whatever the URL says.** The server only checks when
   `?mode` is absent, so `ProjectClient` re-applies rule 1 itself.
4. **`review` is a moment, not a place.** Never written to the cookie; reached only by address (the
   landing table on arrival, `presentIngestReview` in session); only for a project with no
   strategy, and never a demo.
5. **A prompt that can fire on a project with a strategy cannot point at the review screen.** The
   review is first-contact framed (Build is its primary exit). Post-strategy destinations are
   filters on `?mode=knowledge` — `filter=changed`, `dimension=<d>` — not screens.
6. **Anything in the URL that names an entity is validated.** Shape-gated always (`batch`, the
   mode cookie, the last-project cookie); checked against `projectData` when it drives an action
   (`deepDive` decides what a review's uploads attach to).
7. **Callbacks can outlive the page.** Background-task completions are held by the root-layout
   provider and fire after navigation. Anything that navigates from one checks the project is still
   the one on screen (`liveProjectIdRef` in `ProjectClient`).
8. **Demos are shop windows.** Always land on `stack`, never offered a review, never recorded as the
   last project.

### Adding things — the checklists

**A new ingest source** (something that produces ground truths). All four must agree:
1. `ReviewBatchSource` + its prefix in `review-batch.ts` (and a parser test).
2. The pending-ingest queries in `project/[id]/page.tsx` — how the landing table finds one waiting.
3. The batch labelling in `api/project/[id]/fragments/route.ts` — how the review filters to it.
   ⚠ This is a **second, hand-kept copy** of the source-precedence logic in step 2; they agree today
   only because each fragment carries exactly one source. Unifying them into one
   `fragmentReviewBatch()` is outstanding.
4. A `presentIngestReview(source, id)` call when the ingest completes in session, and the source's
   noun in `ingest-messaging.ts`.

**A new URL param:** parse it into a whitelist in `lib/navigation/` (with a builder if anything
links to it); decide whether `setMode` keeps or strips it; decide whether the redirector carries it
through (`page.tsx`, beside `dimension` and `filter`); validate any entity id it names (invariant 6).

**A new landing rule:** a row in `resolveProjectMode` with its reason in a comment, an enumeration
test, and — if it needs new state — a query behind the no-mode branch only (invariant 2).

**A guidance register row** (design §6; row 4 is the worked example):
1. Trigger and words in `src/lib/guidance/<row>.ts` — a pure function over data the page already
   has, returning null when the row should say nothing (`stack-behind.ts`). Test it.
2. Check invariant 5 first: if the trigger can fire on a project with a strategy, its destination
   is a filter, never the review screen.
3. Shape follows the job. **State** (true until something changes it) sits on the object it is
   about and is not dismissible — `GuidanceLink` (`components/ui/guidance-link.tsx`). A **prompt**
   (advice the user may decline) needs dismissal, and a component that does not exist yet — build
   it in `components/ui/`, not inline.
4. Destination through `setMode` / `knowledgeHref` — never a hand-built URL.
5. An exposure event (`guidance_shown`, `value` = the row) and an action event, in
   `analytics-events.md` in the same commit. Anything that owns a hook sits above
   `ProjectClient`'s loading/error returns (pinned by a test).

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

**Canonical event reference: [`docs/architecture/analytics-events.md`](analytics-events.md).** Every
custom Statsig event and its metadata is listed there. Update it in the same commit as any
change to an event's name, value or metadata — dashboards on the "Lunastak v2" board are built
from it, and drift means someone filters on a field that was never emitted.

**PostHog runs alongside Statsig (spike, from 2026-09-11)** — see
[analytics-events.md → PostHog](analytics-events.md#posthog-alongside-statsig). Every event goes to
both through the same two wrappers; nothing changes at call sites.

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
| `llm_token_usage` misses 10 of 26 LLM call sites (those without a `userId`), skewing cost dashboards toward the cheap stages | Documented in `docs/architecture/analytics-events.md`; exact per-stage cost comes from the local capture instrument | **Revisit:** alongside the quota/telemetry split |
| Cross-component state (project deletion) | Window events | **Revisit:** proper state management |
| **`max_tokens` ceilings were fitted to sonnet-4-5's verbosity** and are too tight for thinking models, which spend reasoning tokens from the same budget. `maxTokensFor()` adds headroom as a workaround; measured demand is `continue_questioning` ~459 against a shipped ceiling of 200, and `continue_confidence` ~765 against 300 | Headroom at the `createMessage()` seam (`src/lib/model-config.ts`). The rest of that module's surface was promoted to permanent at the Phase 4 ruling; this is the one item that remains a workaround | **Revisit:** re-tune the per-stage ceilings to the measured demand, then delete the headroom |

---

## API Access — every route goes through the guard

*Added 2026-09-11.* **Every `src/app/api/**/route.ts` calls `@/lib/auth/guard`, or sits on the
`PUBLIC` allowlist in `src/app/api/__tests__/route-auth.test.ts` with a reason — the test fails
otherwise.** `src/middleware.ts` does **no** auth (it only rewrites `/demo/<slug>`), so a route that
doesn't check is open to anyone with the URL. The gate replaced ~17 hand-rolled copies of "who is
this request" and 14 routes that had no check at all. The inventory is
`docs/_plans/2026-09-11-api-auth-gap.md` and the plan `…-plan.md` (both local). The decisions behind
demo access are in [Security & Access Control](#security--access-control). This section is the
**how to build on it** half.

```
route.ts ──▶ require<Resource>Access(id, opts) ──▶ getRequester()   session, else the guestUserId
                 │                                                   cookie VALIDATED against the DB
                 │  one findFirst whose `where` IS the ownership rule
                 ▼
     { requester, <resource> }   ·   401 no requester (or a guest on guests:false)
                                 ·   404 not yours, or not there — never 403
```

**Identity.** `getRequester()` (`src/lib/auth/current-user.ts`) returns `{ userId, isGuest }`: the
NextAuth session if there is one, otherwise the `guestUserId` cookie. It trusts the cookie only
after checking the row exists and has a guest email. Guests are real `User` rows (see
[Identity model](#identity-model-read-before-touching-any-per-user-counter)). Server pages and the
navigation redirector use `getUserId()`, its one-line wrapper. API routes don't call either
directly. They go through the guard.

### Which guard

| the route… | call |
|---|---|
| addresses a **project**: `project/[id]/*`, or a `projectId` in the body or query (`deep-dive`, `documents/upload`) | `requireProjectAccess(projectId, opts)` |
| addresses a **conversation**: `conversation/[id]/*`, `extraction-status/[conversationId]`, or a `conversationId` in the body (`extract`, `conversation/continue`, `generate`) | `requireConversationAccess(conversationId, opts)`. Ownership is `conversation.userId` **or** `conversation.project.userId`, because `projectId` is nullable and a transferred guest's project can be deleted |
| addresses a **trace** (a generated strategy) | `requireTraceAccess(traceId, opts)`. Owned directly, through its conversation, or through its project |
| addresses a **document** | `requireDocumentAccess(documentId, opts)`, through its project |
| addresses something owned **through a parent** (a deep dive belongs to a project) | load it, then call the **parent's** guard on its parent id (`deep-dive/[id]`) |
| acts only on the requester's **own** rows (list, create, dismiss), or on no resource at all | `requireUser(opts)`, then scope every query by `requester.userId` |

| option | on | means | default |
|---|---|---|---|
| `access: 'read'` | resource guards | the owner **or** anyone, when the resource sits in an `isDemo` project. Use it for GETs that a demo must show. **Never on a write.** | `'write'`: owner only |
| `guests: false` | all | signed-up only. A guest cookie is a 401 | guests allowed |
| `active: true` | `requireProjectAccess` only | an archived project is a 404, even to its owner. It is a filter in the query, not a check afterwards | archived projects found |
| `as: requester` | all | use an already-resolved requester and skip the lookup. `project/[id]` GET passes the guest it just minted for a demo visitor, because a cookie set in this request can't be read back | looks it up |

`isDemo` is honoured in exactly one place, `projectVisibleTo()` in `guard.ts`, and only at `read`.

### A new route — the recipe

```ts
import { requireProjectAccess, isDenied } from '@/lib/auth/guard'

const auth = await requireProjectAccess(projectId, { active: true })
if (isDenied(auth)) return auth
const { requester, project } = auth   // project is { id, userId, isDemo, status } — load the rest yourself
```

Put the guard **before** any `checkAndIncrementGuestApiCalls`, `createMessage`, pipeline call or
`waitUntil`, so a denied caller spends neither LLM calls nor quota. When the id arrives in the body,
parse the body first and then guard. Route tests pin each rule: anonymous 401, someone else's 404,
a demo is readable where it should be and never writable. See `src/app/api/__tests__/*-auth.test.ts`.

### A public route

Add it to `PUBLIC` in `route-auth.test.ts` with a `reason`. If its safety depends on something in
the file, such as an env guard (`VERCEL_ENV`, `NODE_ENV`, `ENABLE_TEST_ENDPOINTS`), a signature check
(`svix`) or `getRequester`, also add `mustContain` with that string. The test then fails if that
check is ever removed. Today's list: NextAuth, `auth/verify-marketing` (marketing-site magic-link
sign-in: the signed JWT is the credential), `guest/init` (it mints the guest cookie, so there is
no requester yet), dev- and test-only routes, the Resend webhook, public demo content, and
`events` / `waitlist`, which are anonymous by design. Anonymous-capable still means identity comes
from `getRequester()` or nowhere — never from the request body (the retired `feedback` route stored
a body-supplied `userId` as given until 2026-09-11).

Minting a guest belongs to the two places that also **set the cookie**: `guest/init` and the demo
deep-link fallback in `project/[id]` GET. A route that mints a guest without setting a cookie makes
a user nobody can come back as, and every call gets a fresh one, so nothing is metered.
`conversation/start` did exactly that and was an open LLM proxy until it moved to `requireUser()`.

### What the test holds, and what it can't see

`route-auth.test.ts` fails when:
- a route neither imports the guard nor is on `PUBLIC`;
- a `PUBLIC` entry has lost its `mustContain`, or names a deleted file;
- a route re-implements identity (its own `GUEST_COOKIE_NAME` or `get*UserId()`);
- any **handler** in a non-public route calls no guard. It's checked per exported `GET`/`POST`/…,
  not per file, so an unguarded `DELETE` beside a guarded `GET` fails. A same-file helper that calls
  the guard counts, one level deep (`deep-dive/[id]`'s `canAccessDeepDiveProject`);
- any handler in a route whose **path** names a resource by id doesn't reach that resource's guard.

It can't see an id that arrives in the **body**, or a `read` used where `write` was meant.
[`conventions-rubric.md`](conventions-rubric.md) C29/C30 cover those at audit.

### Don'ts — each one is a bug that shipped

| don't | what it caused | instead |
|---|---|---|
| Mint a guest for a caller with no requester | `conversation/start` gave every cookieless call a fresh guest and project, then ran the LLM on text from the body. It set no cookie, so the chat couldn't be continued, and each call was a new guest, so the guest quota never applied | `requireUser()` → 401. Only `guest/init` and the demo deep link in `project/[id]` GET mint a guest, because they also set the cookie |
| Read the `guestUserId` cookie yourself | `conversation/start` passed the raw cookie to `getOrCreateDefaultProject`, so a cookie set to a signed-up user's id started chats in **their** projects | `getRequester()` or the guard. (`transfer-session` reads the cookie as the thing being handed over, and `transferGuestToUser` validates it) |
| Trust a client-supplied id for a **second** resource | `documents/upload` checked the project but stored the form's `deepDiveId` as given, so a known deep-dive id from another project put a document (file name visible) in someone else's deep dive. `conversation/[id]` PATCH was the same bug through a second door | Scope it to the resource you guarded: `deepDiveInProject(deepDiveId, projectId)`, or a lookup with the parent id in its `where` |
| `fetch` your own API route server-side | The executor fetched `/api/project/[id]/extract-from-template` with no cookies, so the route couldn't be guarded without breaking its only caller. Left unguarded, it let anyone write fragments into any project | Call the library directly (`src/lib/pipeline/extract-from-template.ts`). Routes are thin wrappers, so there is always a library to call |
| `requireUser()` then load by id | Authenticated isn't authorised. A signed-in stranger gets your row | The resource's guard, whose `where` clause does the ownership check |
| Honour `isDemo` on a write | `project/[id]/content` shared one access check across methods. When GET was opened to demos (`4ff4995`, 2026-03-27), POST/PUT/DELETE were opened too, so any guest could edit a showcase project for 5½ months | Leave writes on the default `write`. Ask for `read` per method |

---

## Security & Access Control

Who can call which route is [API Access](#api-access--every-route-goes-through-the-guard), above.
This section keeps the decisions behind it.

### Demo Project Access (Decision: 2026-03-27)

**Context:** Acquired podcast demo Decision Stacks (Costco, TSMC, Nike) need to be viewable by any user — guests, logged-in users, and unauthenticated visitors.

**Decision:** Server-side `isDemo` boolean on the Project model controls access. When `isDemo=true`:
- **`read` access admits demo projects** (`projectVisibleTo()` in `guard.ts`, the one place `isDemo` is honoured). The project, its conversations, traces, documents, content and fragments are readable by any requester
- **Writes are owner-only, demo or not**. That includes the content API's POST/PUT/DELETE (see the 2026-09-11 note below)
- A visitor with no session and no cookie who opens a demo gets a guest minted by `GET /api/project/[id]`, so every later read has a requester
- UI renders in read-only mode (no edit/add affordances)

**Amended 2026-09-11, trace reads (plan D6).** The trace API used to let a caller with **no session
and no guest cookie** read any trace's full output. The reason given was that a guest who had just
generated needed to read the result before the auth transfer. That no longer held: guests carry a
validated cookie and pass as owners, and shared links go through `/share/[token]`, which never
touches this route. So the allowance only served strangers who held a trace id. Removed: anonymous
is now a 401 and someone else's non-demo trace a 404. The strategy page's 403 branch went with it.

**Amended 2026-09-11, content writes honoured `isDemo`.** `4ff4995` (2026-03-27) opened content GET
to demos by widening the single access check the whole route shared. That opened POST/PUT/DELETE
too, so any signed-in user or guest could create, edit or delete opportunities and principles on a
showcase project. Meanwhile this doc's route table said owner-only. No UI path relied on it (demos
render `readOnly`). It was found when the route moved onto the guard, which forced each method to
choose its access level, and it is owner-only now. Recorded as a lesson in `conventions-rubric.md`.

**Why not a query param?** An earlier iteration used `?readonly=true` to bypass the trace API ownership check. This was a security hole — any user with a trace ID could bypass auth by appending the param. Reverted within the same session.

**Why `isDemo` and not a public/sharing flag?** `isDemo` is deliberately limited:
- Only settable via direct DB access (no API endpoint to set it)
- Only used for showcase projects we control
- A proper sharing/public access model (link sharing, viewer roles, public URLs) is a separate design concern for the product roadmap

**Scaling considerations:**
- If we add user-initiated sharing, it needs its own access model (viewer tokens, expiring links, or role-based access)
- `isDemo` should remain admin-only — don't let users set their own projects to demo mode
- The guard's `read` filter, `OR: [{ userId }, { isDemo: true }]`, works for small numbers of demo projects but would need an index if demo count grows significantly

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

*Replaced 2026-09-11.* This used to be a hand-kept table covering five of ~55 routes, and it had
drifted: it still said the trace API admitted "guest-with-traceId". Each route's rule is now its
guard call (`grep -rn "requireUser\|require[A-Z][a-z]*Access" src/app/api`), and
`src/app/api/__tests__/route-auth.test.ts` fails on any route that has none. See
[API Access](#api-access--every-route-goes-through-the-guard).
