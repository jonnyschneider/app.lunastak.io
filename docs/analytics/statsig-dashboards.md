# Statsig Dashboard Spec

**Last updated:** 2026-04-07
**Updated for:** v2.4.3 — cross-site (marketing + app) funnels
**Status:** Ready to implement

This is the canonical spec for the Lunastak Statsig dashboards. All events listed below are instrumented in the codebase across `lunastak.io` (marketing) and `app.lunastak.io` (the product). This document describes what to build in the Statsig dashboard UI.

**Sister repos:**
- App: `humventures/lunastak/app.lunastak.io` (this repo) — emits `cta_*`, `confirm_*`, `kb_*`, `pro_*`, `fake_door_*`, `tab_switch`, `bundle_*`, `llm_token_usage`, etc.
- Marketing: `humventures/lunastak/lunastak.io` — emits `cta_create_account`, `cta_sign_in`, `cta_start_conversation`, `cta_view_demo`, `tool_copy_command`.

> **Important — known limitation:** Marketing-site and app events are siloed for anonymous users (Statsig stableID is per-origin). Aggregate funnels work fine; per-user attribution does not. See `docs/architecture/ARCHITECTURE.md` → "Decision: Cross-Site Statsig Identity Stitching (2026-04-07)" for the full ADR and the recipe to fix it (~3hrs work) when we want it.

---

## Event Reference

### Marketing site (`lunastak.io`)

| Event | Value | Metadata | Source file |
|---|---|---|---|
| `cta_create_account` | `marketing-hero` | — | `components/Hero.tsx` |
| `cta_create_account` | `marketing-header` | — | `components/Header.tsx` (Get Started) |
| `cta_sign_in` | `marketing-header` | — | `components/Header.tsx` (desktop nav) |
| `cta_sign_in` | `marketing-mobile-menu` | — | `components/Header.tsx` (mobile menu) |
| `cta_start_conversation` | `hero-tab` | — | `components/PrimaryFeatures.tsx` |
| `cta_view_demo` | `<companyname>` | `source: marketing`, `company` | `components/AcquiredShowcase.tsx` |
| `tool_copy_command` | `<text>` | — | `components/ToolsPanel.tsx` |
| `auto_capture::page_view` | (URL) | (autocapture) | global |

### App (`app.lunastak.io`)

| Event | Value (representative) | Metadata | Notes |
|---|---|---|---|
| `cta_create_account` | `guest-banner` / `sign-in-gate` | — | In-app conversion prompts |
| `cta_create_project` | `empty-state` / `header` | — | |
| `cta_start_initial_conversation` | `inline-chat` | `projectId` | First message in a fresh project |
| `cta_upload_doc` | `first-time` / `overflow-menu` | `projectId` | |
| `cta_import_bundle` | `overflow-menu` | `projectId` | |
| `cta_new_chat` | `overflow-menu` | `projectId` | Subsequent conversations |
| `cta_generate_strategy` | `inline-chat` / `early-exit` / `extraction-confirm` | `projectId` | |
| `cta_update_direction` | `overflow-menu` | `projectId` | Refresh strategy CTA |
| `cta_refresh_strategy` | `knowledge-panel` | — | Create strategy from KB header |
| `cta_open_evidence` | `evidence-panel` / `dimension-chip` / `overflow-menu` | varies | Evidence sheet entry — see "Note on `cta_open_evidence`" below |
| `cta_view_demo` | `overflow-menu` | `source: app`, `projectId`, `demo` | Switch to a demo project from inside the app |
| `cta_open_deep_dive` | `explore-next` | `projectId` | |
| `cta_export_brief` | `overflow-menu` | `projectId` | |
| `cta_version_history` | `overflow-menu` | `projectId` | |
| `confirm_refresh` | `generation-dialog` | `projectId`, `fragmentsSinceStrategy` | |
| `confirm_opportunities` | `generation-dialog` | `projectId` | |
| `kb_summary_viewed` | `knowledge-panel` | `strategyIsStale`, `fragmentCount` | Knowledge Summary expand |
| `tab_switch` | `decision-stack` / `knowledgebase` | `projectId` | |
| `pro_interstitial_view` | feature name | — | Fake-door upgrade prompt |
| `pro_upgrade_click` | feature name | — | |
| `pro_coming_soon_view` | feature name | — | |
| `fake_door_click` | `Additional Metrics (Pro)` / `AI Rewrite for Opportunities` | — | |
| `bundle_imported` / `bundle_import_failed` | — | server-side | |
| `llm_token_usage` | model | tokens, context | server-side, every LLM call |
| `version_history_downloaded` | — | `projectId` | |
| `auto_capture::page_view` | (URL) | (autocapture) | global |

#### Note on `cta_open_evidence`

`cta_open_evidence` (introduced in v2.4.2) is the canonical event for "user reached the Evidence sheet". It replaces the deprecated `cta_view_fragments`. Three sources, distinguished by the `source` field via the `value` parameter:

- `evidence-panel` — clicked the Evidence card on the Knowledgebase tab
- `dimension-chip` — drilled in via a dimension chip in the Knowledge Summary panel
- `overflow-menu` — opened from the project overflow menu's "View all N fragments"

In dashboards, filter on the event name for "did the user reach Evidence?" funnels; group by source to see which surface is winning.

#### Note on `cta_view_demo` (cross-site)

`cta_view_demo` is emitted from BOTH sites with different semantics. Always segment by the `source` metadata field:

- `source: marketing` — user clicked a demo card in the Acquired showcase on the marketing site (intent: "I want to see this")
- `source: app` — user switched to a demo project from the in-app overflow menu (intent: "I'm exploring a demo")

---

## Dashboard 1: Activation Funnel (cross-site)

**Type:** Funnel chart (multi-step, multi-path entry)
**Purpose:** Track conversion from first marketing visit through to in-app strategy and opportunities.

**Steps:**

```
Step 1 — Marketing arrival
  auto_capture::page_view
  filter: host = lunastak.io

Step 2 — Marketing CTA click (any of)
  ├─ cta_create_account     value: marketing-hero | marketing-header
  ├─ cta_sign_in            value: marketing-header | marketing-mobile-menu
  ├─ cta_start_conversation value: hero-tab
  └─ cta_view_demo          where source = marketing

Step 3 — App arrival
  auto_capture::page_view
  filter: host = app.lunastak.io

Step 4 — Account creation or guest project
  ├─ cta_create_account     value: guest-banner | sign-in-gate
  └─ cta_create_project     value: empty-state | header

Step 5 — First in-app entry action (any of)
  ├─ cta_start_initial_conversation value: inline-chat
  ├─ cta_upload_doc                 value: first-time | overflow-menu
  └─ cta_import_bundle              value: overflow-menu

Step 6 — Strategy generated
  cta_generate_strategy
  value: inline-chat | early-exit | extraction-confirm

Step 7 — Opportunities confirmed
  confirm_opportunities
  value: generation-dialog
```

**Metrics to display:**
- Marketing → App conversion rate (steps 1→3)
- App arrival → First action rate (steps 3→5)
- First action → Strategy rate (steps 5→6)
- Strategy → Opportunities rate (steps 6→7)
- End-to-end activation rate (1→7)
- Time from marketing arrival to strategy generated

**Segments:** Guest vs signed-in (after step 4); marketing entry source (which step-2 event); UI location (value parameter).

**Caveat:** Steps 1→3 are only joinable per-user once stableID stitching is implemented. Until then, treat them as aggregate counts (drop-off ratios), not per-user funnel rates.

---

## Dashboard 2: Engagement

**Purpose:** Measure depth and breadth of usage for returning users.

### 2a: Action Frequency

**Type:** Bar chart (event counts, last 7d / 30d)

| Event | Value (UI location) | What it means |
|---|---|---|
| `cta_new_chat` | `overflow-menu` | Adding context via conversation |
| `cta_upload_doc` | `overflow-menu` | Adding context via document |
| `cta_import_bundle` | `overflow-menu` | Adding context via bundle |
| `cta_update_direction` | `overflow-menu` | Refreshing strategy |
| `confirm_refresh` | `generation-dialog` | Confirmed strategy refresh |
| `confirm_opportunities` | `generation-dialog` | Confirmed opportunity generation |
| `cta_export_brief` | `overflow-menu` | Exporting strategic brief |
| `cta_version_history` | `overflow-menu` | Reviewing past versions |
| `cta_open_evidence` | (any source) | Exploring knowledge base |
| `cta_open_deep_dive` | `explore-next` | Starting a deep dive |
| `cta_refresh_strategy` | `knowledge-panel` | Refresh from KB header |

### 2b: Weekly Active Projects

**Type:** Line chart (trend over time)

Count of distinct `projectId` metadata values across all events per week.

### 2c: Navigation Pattern

**Type:** Pie chart

`tab_switch` event split by value: `decision-stack` vs `knowledgebase`.

### 2d: Refresh Quality

**Type:** Histogram or table

`confirm_refresh` events with `fragmentsSinceStrategy` metadata — distribution shows whether people refresh with new data (good) or re-roll without changes (uncertain).

### 2e: Evidence Surface Mix (new in v2.4.3)

**Type:** Pie or stacked bar

`cta_open_evidence` split by `source` value: `evidence-panel` vs `dimension-chip` vs `overflow-menu`. Tells us which surface drives Evidence engagement.

---

## Dashboard 3: Demo Engagement (cross-site)

**Purpose:** Understand how demos drive activation across both sites.

### 3a: Demo Views (split by surface)

**Type:** Stacked bar chart (by company, stacked by source)

| Event | Value | Metadata | Surface |
|---|---|---|---|
| `cta_view_demo` | `nike` / `costco` / `tsmc` | `source: marketing`, `company` | Marketing showcase |
| `cta_view_demo` | `overflow-menu` | `source: app`, `projectId`, `demo` | In-app overflow |
| `cta_demo_peek` | `first-time` | — | App empty state |
| `cta_demo_confirm` | `first-time` | — | App empty state |

Always filter by `source` to avoid lumping marketing intent ("I clicked a demo card") and in-app exploration ("I switched to a demo project") together.

### 3b: Demo Exit

**Type:** Event count (line chart, trend)

| Event | Value | Metadata |
|---|---|---|
| `demo_exit` | `banner` | `projectId` |

### 3c: Demo → Activation (cross-site funnel)

**Type:** Funnel chart

```
Step 1 — Marketing demo view
  cta_view_demo where source = marketing

Step 2 — App arrival
  auto_capture::page_view
  filter: host = app.lunastak.io

Step 3 — First in-app entry action
  cta_start_initial_conversation OR cta_upload_doc OR cta_import_bundle
```

Caveat: same per-user stitching limitation as Dashboard 1. Treat as aggregate until stableID stitching is implemented.

---

## Dashboard 4: Pro Feature Demand

**Purpose:** Measure demand for gated features before building them.

### 4a: Fake Door Clicks

**Type:** Ranked bar chart (by feature, descending)

| Event | Value / Feature | What it means |
|---|---|---|
| `pro_interstitial_view` | feature name | User saw the upgrade prompt |
| `pro_upgrade_click` | feature name | User clicked upgrade |
| `pro_coming_soon_view` | feature name | User saw coming soon |
| `fake_door_click` | `Additional Metrics (Pro)` | Clicked add metric (Pro gate) |
| `fake_door_click` | `AI Rewrite for Opportunities` | Clicked improve with AI |

### 4b: Feature Demand Ranking

**Type:** Table

| Feature | Interstitial Views | Upgrade Clicks | CTR |
|---|---|---|---|
| `ai-improve` | | | |
| `knowledge-chat` | | | |
| `knowledge-edit` | | | |
| `model-selection` | | | |
| `Additional Metrics (Pro)` | | | |

### 4c: Repeat Interest

**Type:** Table (users who clicked the same fake door 2+ times)

Strong signal — users who repeatedly hit the same gate genuinely want the feature.

---

## Dashboard 5: Account Conversion (cross-site)

**Purpose:** Track marketing → guest → signed-up conversion.

### 5a: Conversion Funnel (cross-site)

**Type:** Funnel chart

```
Step 1 — Marketing arrival
  auto_capture::page_view
  filter: host = lunastak.io

Step 2 — Marketing account/sign-in CTA
  cta_create_account OR cta_sign_in
  filter: value starts with "marketing-"

Step 3 — In-app account creation prompt
  cta_create_account
  filter: value in (guest-banner, sign-in-gate)

Step 4 — Account created
  (Statsig auth.signUp event OR a server-side event from /api/auth/callback)
```

Step 4 is currently inferred from successful `cta_create_account` clicks where the user later appears with a real `userID`. Add an explicit `account_created` server-side event in a future iteration if precision matters.

### 5b: New Projects

**Type:** Event count (line chart, daily trend)

| Event | Value |
|---|---|
| `cta_create_project` | `empty-state` / `header` |
| `cta_build_strategy` | `first-time` |

### 5c: Conversion by Trigger

**Type:** Pie chart

`cta_create_account` split by value:
- `marketing-hero` vs `marketing-header` (which marketing surface converts?)
- `guest-banner` vs `sign-in-gate` (which in-app trigger converts?)

---

## Dashboard 6: Token Usage

**Purpose:** Track LLM cost per user for capacity planning and future billing.

**Data source:** Database (User table), not Statsig events.

**Type:** Admin query / spreadsheet export (not a Statsig dashboard)

**Fields on User table:**
- `totalPromptTokens` (int)
- `totalCompletionTokens` (int)
- `apiCallCount` (int)
- `lastLlmCallAt` (timestamp)

**Query for top users:**
```sql
SELECT email, "apiCallCount", "totalPromptTokens", "totalCompletionTokens",
  ("totalPromptTokens" + "totalCompletionTokens") as total_tokens,
  "lastLlmCallAt"
FROM "User"
WHERE "apiCallCount" > 0
ORDER BY total_tokens DESC
LIMIT 50
```

**Key metrics:**
- Total tokens consumed (all users)
- Average tokens per strategy generation
- Top 10 users by token usage
- Tokens per day trend

**Implementation:** Build a simple admin page (`/admin/usage`) or run ad-hoc against prod DB.

The complementary Statsig event is `llm_token_usage`, fired server-side on every LLM call with model and context metadata. Useful for time-series cost analysis without hitting the DB.

---

## Implementation Checklist

- [ ] Create "Activation Funnel" (cross-site) funnel chart in Statsig
- [ ] Create "Engagement" dashboard (bar chart + line chart + pie chart + Evidence surface mix)
- [ ] Create "Demo Engagement" dashboard (stacked bar + cross-site funnel)
- [ ] Create "Pro Feature Demand" dashboard (ranked bar chart + table)
- [ ] Create "Account Conversion" dashboard (cross-site funnel + pie chart)
- [ ] Build token usage query (admin page or script)
- [ ] Set up weekly email digest from Statsig with key metrics

---

## Deprecated events (do not use)

- **`cta_view_fragments`** — folded into `cta_open_evidence` in v2.4.2. If any dashboards or metrics still reference this name, point them at `cta_open_evidence` filtered by `source=overflow-menu`.

---

## Related Documents

- **Architecture decision (cross-site stitching):** `docs/architecture/ARCHITECTURE.md` → "Decision: Cross-Site Statsig Identity Stitching (2026-04-07)"
- **CHANGELOG:** `CHANGELOG.md`
