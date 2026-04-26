# Lunastak Analytics Events

Reference list of every custom Statsig event emitted by the app. Dashboards built on these events live in Statsig itself ("Lunastak v2" board).

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
| `cta_demo_peek` | client | `first-time` | userType | User chose "see a demo" path from first-time empty state. |
| `cta_demo_confirm` | client | `first-time` | userType | User confirmed demo selection. |
| `demo_exit` | client | `banner` | `projectId`, userType | User exited a demo project via the banner. |

## Paywall (real Pro feature)

The unlimited-projects gate is the only real paywall in the product.

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `paywall_prompt_view` | client | `unlimited-projects` | `state: "interstitial"`, userType | Real paywall interstitial shown — signed-up free user tried to create a 2nd project. |
| `paywall_upgrade_click` | client | `unlimited-projects` | userType | User clicked Upgrade on the real paywall. Strongest "convert me" signal. |

## Fake doors (Pro features that don't exist yet)

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `fake_door_view` | client | `<feature-key>` | `state: "interstitial"` (free user) \| `"pro_coming_soon"` (Pro user), userType | User clicked a Pro feature surface; coming-soon dialog shown. Demand signal. |
| `fake_door_click` | client | `<feature-key>` | userType | User clicked Upgrade inside the fake-door interstitial. Strongest demand signal per feature. |

Active feature keys: `monthly-review`, `quarterly-review`, `strategic-narrative`, `connect-data`, `audio-memo`, `model-selection`, `knowledge-chat`, `knowledge-edit`. (`outcomes/` and `template/` pages also reference fake-door features but are currently orphaned — no inbound paths.)

## Strategy generation flow

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_start_initial_conversation` | client | `inline-chat` | `projectId`, userType | First message sent in a fresh project. |
| `cta_generate_strategy` | client | `inline-chat` \| `early-exit` \| `extraction-confirm` | `projectId`, userType | User triggered strategy generation. Surface in `value`. |
| `cta_update_direction` | client | `overflow-menu` | `projectId`, userType | User opened the strategy refresh flow. |
| `cta_refresh_strategy` | client | `knowledge-panel` | userType | "Create strategy from KB" header CTA. |
| `cta_draft_opportunities` | client | `overflow-menu` \| `opportunity-section` | `projectId`, userType | User triggered opportunity drafting. |
| `confirm_refresh` | client | `generation-dialog` | `projectId`, `fragmentsSinceStrategy`, userType | User confirmed strategy refresh in the generation dialog. `fragmentsSinceStrategy` reveals whether they refreshed with new context (good) or re-rolled without changes. |
| `confirm_opportunities` | client | `generation-dialog` | `projectId`, userType | User confirmed opportunity generation. |

## Knowledge base & evidence

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_upload_doc` | client | `first-time` \| `overflow-menu` | `projectId`, userType | User uploaded a document. |
| `cta_import_bundle` | client | `overflow-menu` \| `launchpad` \| `kb-empty-state` | `projectId`, userType | User imported a project bundle. |
| `cta_new_chat` | client | `overflow-menu` | `projectId`, userType | User started a subsequent (non-initial) chat. |
| `kb_summary_viewed` | client | `knowledge-panel` | `strategyIsStale`, `fragmentCount`, userType | Knowledge Summary panel expanded. |
| `cta_open_evidence` | client | `evidence-panel` \| `dimension-chip` \| `overflow-menu` | varies, userType | Canonical event for "user reached the Evidence sheet". Group by `value` to see which surface drives it. |
| `cta_open_deep_dive` | client | `explore-next` | `projectId`, userType | User started a deep-dive thread. |
| `cta_add_deep_dive` | client | `explore-next` | userType | User added a new deep-dive topic. |
| `bundle_imported` | server | — | `fragmentsCreated`, etc. | Server-side confirmation that a project bundle import succeeded. Pairs with client `cta_import_bundle`. |
| `bundle_import_failed` | server | — | error context | Bundle import failed server-side. |

## Output & navigation

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `cta_export_brief` | client | `overflow-menu` | `projectId`, userType | User exported a strategic brief. |
| `cta_version_history` | client | `overflow-menu` | `projectId`, userType | User opened version history. |
| `version_history_downloaded` | client | `version-history` | `projectId`, `version`, userType | User downloaded a specific version snapshot. |
| `tab_switch` | client | `decision-stack` \| `knowledgebase` | `projectId`, userType | User switched tabs in the project view. |
| `cta_build_strategy` | client | `first-time` | `projectId`, userType | User started the build-strategy path from first-time empty state. (Note: `FirstTimeEmptyState` is currently orphaned; this event may not fire in production.) |
| `cta_complete_template` | client | `review` \| `early-exit` | `projectId`, userType | User completed (or early-exited) the template flow. (Template page is orphaned.) |

## Cost & infrastructure

| Event | Side | Value | Metadata | What it means |
|---|---|---|---|---|
| `llm_token_usage` | server | `<model>` | `inputTokens`, `outputTokens`, `context`, … | Fired on every Claude API call from `src/lib/claude.ts`. Drives token-burn dashboards and per-context cost analysis. |

---

## Cross-site note

`lunastak.io` (marketing) and `app.lunastak.io` (this repo) emit into the same Statsig project but use per-origin stableIDs, so anonymous visitors are siloed across the two sites until they reach the app and get a guest userID. Aggregate funnels (drop-off ratios, raw counts) work fine across the boundary; per-user attribution does not. See ARCHITECTURE.md → "Decision: Cross-Site Statsig Identity Stitching (2026-04-07)" for the ADR and the implementation recipe to fix it.

## Deprecated events

- `cta_view_fragments` — folded into `cta_open_evidence` in v2.4.2.
- `pro_interstitial_view`, `pro_upgrade_click`, `pro_coming_soon_view` — replaced by `paywall_*` and `fake_door_*` taxonomy in the v2.4.5 cutover. Hard removed.
