# Lunastak Analytics Events

Reference list of every custom Statsig event emitted by the app. Dashboards built on these events live in Statsig itself ("Lunastak v2" board).

> **Before changing instrumentation, read
> [ARCHITECTURE.md → Analytics & Instrumentation](../architecture/ARCHITECTURE.md#analytics--instrumentation).**
> It covers the identity model (guests are real `User` rows, deleted on conversion), why
> `apiCallCount` is a **quota** rather than telemetry, and the LLM-call coverage gap below.

## Event metadata conventions

- **`value`** — Statsig's primary tag (passed as the second arg to `logEvent`). Used as the per-event "what kind / where from" string. Filterable in Statsig as the event value column.
- **`metadata.userType`** — `guest` | `signed_up` | `unknown`. Auto-attached to every client event by `logAndFlush` based on the user's session/cookie state. Lets every dashboard segment by account state with no per-callsite work.
- **`metadata.projectId`** — passed where the event is scoped to a specific project.
- Other metadata fields are event-specific (see below).

## Client vs server

- **Client events** fire from the browser via `logAndFlush(name, value?, metadata?)` in `src/components/StatsigProvider.tsx`. Auto-attach `userType`, flush immediately to survive UI transitions.
- **Server events** fire from API routes / NextAuth callbacks via `logStatsigEvent(userId, name, value?, metadata?)` in `src/lib/statsig.ts`. Used when the truth lives server-side (signups, server-side resource creation, LLM token accounting).

---

## Account & conversion

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_create_account` | client | `marketing-hero` \| `marketing-header` \| `sign-in-gate` \| `guest-banner` | userType | User clicked a CTA to create an account. Origin in `value`. **Click only — does not confirm signup.** |
| `account_created` | server | — | `provider` (`google` \| `email`), userType=`signed_up` | First successful sign-in for a userID. Confirms a real signup completed. Use this (not `cta_create_account`) for true conversion. |
| `account_signed_in` | server | — | `provider`, userType=`signed_up` | Every subsequent successful sign-in. Returning-user activity. |

## Project lifecycle

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_create_project` | client | `header` \| `empty-state` | userType | User clicked "New Project". For guests, this triggers the signup gate; for signed-up free users at the limit, it triggers the paywall. |
| `cta_view_demo` | client | `<companyname>` (marketing) \| `launchpad` \| `overflow-menu` (app) | `source: marketing` \| `source: app`, `projectId`, `demo` | User viewed a demo project. Always segment by `source` — marketing intent ≠ in-app exploration. |
| ~~`cta_demo_peek`~~ | — | — | — | **Dead 2026-09-10.** Only emitter was `FirstTimeEmptyState`, which had been orphaned for months and is now deleted. The live demo path is `cta_view_demo` (surface `launchpad`). |
| ~~`cta_demo_confirm`~~ | — | — | — | **Dead 2026-09-10.** Same emitter, same deletion. |
| `demo_exit` | client | `banner` | `projectId`, userType | User exited a demo project via the banner. |

## Paywall (real Pro feature)

The unlimited-projects gate is the only real paywall in the product.

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `paywall_prompt_view` | client | `unlimited-projects` | `state: "interstitial"`, userType | Real paywall interstitial shown — signed-up free user tried to create a 2nd project. |
| `paywall_upgrade_click` | client | `unlimited-projects` | userType | User clicked Upgrade on the real paywall. Strongest "convert me" signal. |

## Fake doors — retired 2026-09-08

`fake_door_view` and `fake_door_click` are **gone**, along with every fake door that emitted
them. There are no active feature keys. See [Deprecated events](#deprecated-events) below for the
evidence, and `retired-fake-doors.md` for the retro.

`unlimited-projects` is not affected — it was never a fake door but the real free-tier cap, and it
reports through `paywall_*` above.

## Strategy generation flow

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_start_initial_conversation` | client | `inline-chat` | `projectId`, userType | First message sent in a fresh project. |
| `cta_generate_strategy` | client | `inline-chat` \| `early-exit` | `projectId`, userType | User triggered strategy generation. Surface in `value`. (`extraction-confirm` retired 2026-09-08 with `ExtractionConfirm` — see `retired-extraction-run.md`.) |
| `cta_update_direction` | client | `overflow-menu` | `projectId`, userType | User opened the strategy refresh flow. |
| `cta_refresh_strategy` | client | `knowledge-panel` | userType | "Create strategy from KB" header CTA. |
| `cta_draft_opportunities` | client | `overflow-menu` \| `opportunity-section` | `projectId`, userType | User triggered opportunity drafting. |
| `confirm_refresh` | client | `generation-dialog` | `projectId`, `fragmentsSinceStrategy`, userType | User confirmed strategy refresh in the generation dialog. `fragmentsSinceStrategy` reveals whether they refreshed with new context (good) or re-rolled without changes. |
| `confirm_opportunities` | client | `generation-dialog` | `projectId`, userType | User confirmed opportunity generation. |

## Knowledge base & evidence

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_upload_doc` | client | `launchpad` \| `overflow-menu` \| `ground-truth-review` | `projectId`, userType | User opened the document upload dialog. **Watch `launchpad`.** Upload was dropped from the empty state while narrowing it to two cards, and no document was uploaded on production between March and September 2026 as a result — the backend was live the whole time. Restored to the **launchpad** 2026-09-09. A flatline here means the door has gone again. `first-time` and `kb-empty-state` retired 2026-09-10 — see the note below this table. |
| `cta_import_bundle` | client | `launchpad` \| `overflow-menu` \| `ground-truth-review` | `projectId`, userType | User imported a project bundle. `kb-empty-state` retired 2026-09-10. |
| `cta_new_chat` | client | `launchpad` \| `overflow-menu` \| `ground-truth-review` | `projectId`, userType | User started a chat. `launchpad` replaces the one-day-old `kb-empty-state` surface (2026-09-10); the cold-start doors now have exactly one home each. |
| `kb_summary_viewed` | client | `knowledge-panel` | `strategyIsStale`, `fragmentCount`, userType | Knowledge Summary panel expanded. |
| `cta_open_evidence` | client | `evidence-panel` \| `dimension-chip` \| `overflow-menu` | varies, userType | Canonical event for "user reached the Evidence sheet". Group by `value` to see which surface drives it. |
| `cta_open_deep_dive` | client | `explore-next` | `projectId`, userType | User started a deep-dive thread. |
| `cta_add_deep_dive` | client | `explore-next` | userType | User added a new deep-dive topic. |
| `bundle_imported` | server | — | `fragmentsCreated`, etc. | Server-side confirmation that a project bundle import succeeded. Pairs with client `cta_import_bundle`. |
| `bundle_import_failed` | server | — | error context | Bundle import failed server-side. |

### ⚠ `kb-empty-state` and `first-time` go to zero on purpose, from 2026-09-10

The `kb-empty-state` surface was added on **2026-09-09** — one day before it was removed — so that
all three cold-start doors (chat, upload, import) were comparable. The screen it measured is gone:
the knowledgebase's empty state showed the same three cards as the launchpad, which meant the
`Decision Stack | Knowledgebase` toggle above them offered a choice between one screen and a subset
of itself. It is now unreachable by construction (with no context the toggle does not render, and
"has context" cannot flip back). `first-time` went the same day with `FirstTimeEmptyState`, which
had been orphaned for months.

**The doors are not gone — they consolidated onto `launchpad`, which is now the only cold-start
surface.** The question stays answerable with fewer moving parts: *which door does a new user take,
and does a strategy get built after they take it?*

This is written down loudly because release 2.7.1 exists on account of exactly this shape. Upload
was dropped from the launchpad by defocus in March 2026; `cta_upload_doc` kept firing from other
surfaces and simply flatlined; no commit said "removed"; nobody noticed for six months. A flatline
with no note is indistinguishable from a feature quietly dying. This is the note.

Design: `docs/_plans/2026-09-10-empty-state-consolidation-design.md`.

## Output & navigation

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_export_brief` | client | `overflow-menu` | `projectId`, userType | User exported a strategic brief. |
| `cta_version_history` | client | `overflow-menu` | `projectId`, userType | User opened version history. |
| `version_history_downloaded` | client | `version-history` | `projectId`, `version`, userType | User downloaded a specific version snapshot. |
| `tab_switch` | client | `decision-stack` \| `knowledgebase` \| `first-context-landed` \| `pre-strategy-add-context` | `projectId`, `chip` (on `decision-stack`), userType | User switched tabs in the project view. `chip: 'true'` means the strategy-ready dot was on the Decision Stack button when it was pressed — that is how a chip-driven visit is told from an ordinary one, without a second event. The two non-tab values are app-initiated moves, not clicks: `first-context-landed` is the one-shot move to the knowledgebase when a project's first context arrives, and `pre-strategy-add-context` is the "Add more context" exit from the empty Decision Stack tab. Segment them out before reading this as user behaviour. |
| `card_thinking_viewed` | client | `vision` \| `strategy` \| `objective` \| `opportunity` \| `principle` | `projectId`, userType | User revealed the back of a Decision Stack card via the "The thinking" strip. Fires on the **reveal only** — flipping back is not a second read. Segment by `value` to see which layers people actually read. **No pre-2026-08-27 baseline exists** — the flip was completely uninstrumented before the disclosure strip shipped, so this measures the new affordance, not the improvement over the old one. |
| `review_deferred` | client | `ground-truth-review` | `projectId`, `fragmentCount`, userType | User chose "Review these later" on the first-look ground-truth screen — moving on without building and without adding. **Deferring is data, not an absence of it**: paired with `cta_build_strategy` on the same surface it answers "does anyone read the extraction at the moment of highest context, or do they all move past it?" The predecessor of this button (deleted 2026-09-09) logged nothing at all, which is why that question had no answer. |
| `cta_build_strategy` | client | `ground-truth-review` | `projectId`, userType | User pressed Build on the ground-truth review, in the knowledgebase. Re-homed 2026-09-10: the old `first-time` surface came from `FirstTimeEmptyState`, which was orphaned and is now deleted, so this event never fired in production. This is its first live emitter. |
| `cta_complete_template` | client | `review` \| `early-exit` | `projectId`, userType | User completed (or early-exited) the template flow. (Template page is orphaned.) |

## Sharing

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_share` | client | `signed_up` \| `guest` | `projectId`, userType | User clicked the Share button in the project header. Guests get the sign-in gate instead of the dialog — `value` splits the two. |
| `share_link_enabled` | client | `<projectId>` | `projectId`, userType | Owner turned sharing on ("anyone with the link can view"). |
| `share_link_disabled` | client | `<projectId>` | `projectId`, userType | Owner turned sharing off — link goes dead immediately. |
| `share_link_copied` | client | `<projectId>` | `projectId`, userType | Owner copied the share URL. Best proxy for "actually sent to someone". |
| `share_page_view` | server | — | `projectId` | A recipient loaded `/share/[token]`. Attributed to the **owner's** userID (recipients are anonymous — no Statsig client runs on the public page). |

## Cost & infrastructure

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `llm_token_usage` | server | total tokens (**number**: input + output) | `context`, `promptHash`, `promptTokens`, `completionTokens`, `model`, `latencyMs`, `maxTokens`, `truncated`, `cached`, `cacheWriteTokens`, `cacheReadTokens` | Fired from `src/lib/claude.ts` on Claude API calls **that pass a `userId`** — see the coverage gap below. Drives token-burn dashboards and per-context cost analysis. |

### `llm_token_usage` — corrections and a coverage gap

**Doc/code drift corrected 2026-08-26.** The row above previously documented `value` as
`<model>` and metadata as `inputTokens`/`outputTokens`. Neither matched the code: `value` is a
number (input + output tokens), and the token keys are `promptTokens`/`completionTokens`. A
dashboard built from the old description would have filtered on fields that were never emitted.

Note this event deviates from the `value` convention at the top of this file — it carries a
number rather than a "what kind / where from" string. Filter by model via `metadata.model`.

**Added 2026-08-26:** `latencyMs`, `maxTokens`, `truncated`. `truncated` is `"true"` when the
response hit `stop_reason: max_tokens` — a canary that matters most immediately after a model
change, when a ceiling tuned for the previous model starts cutting answers off. No user content
is carried; prompt/response capture is a local-only instrument (`src/lib/experiment/capture.ts`,
hard-gated out of production).

**Added 2026-08-27:** `promptHash` — the first 16 hex chars of a sha256 over the resolved
`system` block plus the serialised user content. It answers "which prompt produced this output"
for **all 20 stages**, which is what the retired prompt registry promised for three and never
delivered ([retired-prompt-registry.md](../architecture/retired-prompt-registry.md)). A hash
carries no user content, so it is production-safe.

Two things follow from how it is computed. It changes when the guidance changes, because the
guidance is now part of the `system` block — that is the point, and it is how a prompt change
becomes visible in the cost data. And it changes per call for stages whose user message carries
the payload, so it identifies a *resolved request*, not a prompt template. To group by template,
group by `context`.

**Added 2026-08-27 with prompt caching:** `cached` (whether this stage ships its system
block as a cached prefix), `cacheWriteTokens` (`cache_creation_input_tokens`) and
`cacheReadTokens` (`cache_read_input_tokens`).

These exist because **a cache that silently never hits looks exactly like one that works** —
same output, same latency profile, quietly full price. Nothing else distinguishes the two
from outside, so they shipped with the feature rather than after it. Six stages are cached:
the four generation/synthesis prose stages plus `knowledge_summary` and
`incremental_synthesis`, each measured ≥1024 tokens.

A healthy cached stage shows one call with `cacheWriteTokens > 0` followed by calls with
`cacheReadTokens > 0`. **`cached: true` with `cacheReadTokens` persistently 0 means the
prefix is being rewritten every call** — the failure this instrumentation exists to catch.

**⚠ `promptHash` inherits the coverage gap below.** The hash is durable only where the event
fires. `captureCall()` records it regardless, locally.

**⚠ Coverage gap — the event does not fire on every LLM call.** It sits inside
`if (userId && response.usage)`, and **10 of 26 `createMessage` call sites pass no `userId`**:
`extraction`, `knowledge_summary`, `full_synthesis`, `incremental_synthesis`,
`document_extraction`, `reflective_summary_prescriptive`,
`template_extraction`, `import_dimension_tagging`, `suggest_opposite`.

(`dimensional_analysis` was on this list until 2026-08-27, when the orphaned
`analyzeDimensionalCoverage()` that owned it was deleted. The stage no longer exists.)

Those calls emit no event and no `User` token increment. Several are among the most expensive
stages in the pipeline, so **token-burn dashboards and per-user counters understate real usage,
and understate it unevenly** — the heavy stages are the ones missing. Do not treat either as a
complete cost picture until this is closed.

---

## Cross-site note

`lunastak.io` (marketing) and `app.lunastak.io` (this repo) emit into the same Statsig project but use per-origin stableIDs, so anonymous visitors are siloed across the two sites until they reach the app and get a guest userID. Aggregate funnels (drop-off ratios, raw counts) work fine across the boundary; per-user attribution does not. See ARCHITECTURE.md → "Decision: Cross-Site Statsig Identity Stitching (2026-04-07)" for the ADR and the implementation recipe to fix it.

## Deprecated events

- `cta_view_fragments` — folded into `cta_open_evidence` in v2.4.2.
- `pro_interstitial_view`, `pro_upgrade_click`, `pro_coming_soon_view` — replaced by `paywall_*` and `fake_door_*` taxonomy in the v2.4.5 cutover. Hard removed.
- `fake_door_view` / `fake_door_click` — **the whole taxonomy is retired, 2026-09-08.** Every fake
  door was removed: `model-selection`, `knowledge-chat`, `knowledge-edit`, `ai-improve`,
  `monthly-review`, `quarterly-review`, `strategic-narrative`, `connect-data` and the unreachable
  `audio-memo`.

  **Why: they measured nothing.** Checked via the Statsig Console API on 2026-09-08 —
  `fake_door_view::event_count` exists, and `fake_door_click::event_count` **does not exist at
  all**. Statsig creates a metric on an event's first log, so no user has ever clicked Upgrade from
  any fake door. Eight surfaces, indefinite maintenance, zero signal. (`paywall_upgrade_click` is
  likewise absent, so the real paywall has never converted either — that is a product finding, not
  a reason to remove the paywall.)

  `paywall_prompt_view` and `paywall_upgrade_click` continue, and now carry the only remaining
  Pro surface, `unlimited-projects` — which is a real cap, not a fake door.
