# Screen map — what exists, where it lives, and what state it can be in

**Date:** 2026-09-11 (refreshed against `052c3ce`, after the navigation routing and 2.8.1; accuracy-corrected against `1076ea8`)
**Previous:** 2026-09-07, which described `development` *before* the ground truth gate and the
routing landed — see §8 for what changed and why the old version is not worth reading.
**Status:** Descriptive. Current state of `development`.
**Companion to:** [`service-blueprints.md`](service-blueprints.md) — that doc says *what happens, in
what order, when a user does something*. This says **what exists on screen, where it lives, what
state it can be in, and what can be done to it.**

Same two rules as the blueprints, or this rots the way the ERD did:

1. **Every row names the file that governs it.** A map that drifts from the code is worse than none.
2. **Descriptive, not normative.** This argues for nothing. It says what is there so the next change
   starts from fact.

---

## 1. The shell

There is **no sidebar.** It was removed on 2026-03-29 (`2026-03-29-sidebar-versions-brief-impl.md`)
and the app shell is a single sticky top header, 56px, defined in
`src/components/layout/app-layout.tsx`.

| slot | content | governed by |
|---|---|---|
| left | Lunastak logo → current project (or `/`) | `app-layout.tsx:236` |
| centre | **`tabNav` — an empty slot the page fills** | `HeaderContext.tsx` · `app-layout.tsx:242` |
| right | project switcher + account menu | `app-layout.tsx:250` |

Below the header, `StatusBanner` renders a single line of running-task text when any background task
is active, and nothing otherwise (`StatusBanner.tsx`). Demo projects get a mulberry **Demo** strip
there instead, with an ✕ that exits to `/` (`ProjectClient.tsx:1040`).

**The header owns no navigation of its own.** `tabNav` is a React node pushed up from the page through
`HeaderContext` — on a project it is `ProjectTabNav`. Below `md` it moves to a second header row
(`app-layout.tsx:478`), so it is never lost at any width.

`rightSlot` — a second slot that let demo mode replace the switcher — was deleted 2026-09-11; nothing
had written to it since the demos moved into the switcher.

**Project switcher** (popover, `app-layout.tsx:258`) — searchable project list, New Project, Rename,
Delete, and an **Examples** group listing the four demos (`app-layout.tsx:335`, `cta_view_demo` /
`surface: 'project-switcher'`). The demos' first permanent home, 2026-09-10 — before that they lived
in the `⋯` menu. This is still the only cross-project navigation in the product.

**Account menu** (dropdown, `app-layout.tsx:361`) — upgrade prompt when not Pro, Account, external
links to docs and data-security, footer credits, sign out.

---

## 2. Every route

Derived from `src/app/**/page.tsx`. Still **one route is the product** — but it is now a server
redirector in front of a client, and its mode is in the URL (§3).

| route | kind | what it is | governed by |
|---|---|---|---|
| `/` | redirect | Nobody sees a homepage. Mints a guest cookie if needed; lands on the **last project you were in** (`lunastak_last_project` cookie), else your oldest | `app/page.tsx` · `lib/navigation/last-project-cookie.ts` |
| `/project` | redirect | → the same last-project cookie as `/`, else the first. Client-side, because it is also where a guest-to-account transfer waits | `project/page.tsx` |
| **`/project/[id]`** (no `?mode`) | **server redirect** | Resolves where you land from one table, then redirects to `?mode=…`. No render | `project/[id]/page.tsx` (198 lines) · `lib/navigation/resolve-mode.ts` |
| **`/project/[id]?mode=…`** | **the app** | `stack` · `knowledge` · `review` — see §3 | `project/[id]/ProjectClient.tsx` (**1,974 lines**) |
| `/project/[id]/template` | page | 6-step manual Decision Stack builder | `template/page.tsx` (613 lines) |
| `/project/[id]/fragments` | **legacy redirect** | → `/project/[id]?evidence=1`, preserving `?dimension=` | `fragments/page.tsx` |
| `/project/[id]/strategy` | **legacy redirect** | → latest trace view | `strategy/page.tsx` |
| `/share/[token]` | public | Read-only stack, server-rendered, `noindex`. No knowledgebase | `share/[token]/page.tsx` |
| `/strategy/[traceId]` | read-only | A single generation's output | `strategy/[traceId]/page.tsx` |
| `/account` | page | Account settings | `account/page.tsx` |
| `/auth/signin` · `/auth/verify-request` | auth | Sign-in, magic-link confirmation | `auth/*` |
| `/demo/strategy` | demo | Standalone demo page | `demo/strategy/*` |
| `/admin/eval` · `/admin/eval/[evalId]` | admin | Evaluation runs | `admin/eval/*` |
| `/dev/playback` · `/dev/pipeline-test` | dev | Conversation playback, pipeline harness | `dev/*` |
| `/prototype/graph` | prototype | Disposable. The three ground-truth prototypes are gone | `prototype/graph/*` |

Deleted since the last map: `/project/[id]/outcomes` (`retired-fake-doors.md`), `/extraction/[id]`
and `/demo/extraction` (`retired-extraction-run.md`), `/prototype/ground-truth*`.

**Demo projects are not a route.** Four project ids (Nike, Costco, TSMC, Ferrari) render through
`/project/[id]` with `isDemo` flipping behaviour. The ids now live in **one registry**,
`src/lib/demos.ts` (`DEMO_PROJECTS`, with `DEMO_META` and `DEMO_EPISODE_URLS` derived from it), read by
the switcher, the Launchpad and the project page.

---

## 3. `/project/[id]` — one page, three modes, all addressable

```
┌ header ─────────────────────────────────────────────────────────┐
│ logo   [ Decision Stack • | Knowledgebase 35 ]      project  acct│
└─────────────────────────────────────────────────────────────────┘
  StatusBanner — only while a task runs  (demo: the Demo strip)
```

The **•** after *Decision Stack* is the **strategy-ready dot** (`ProjectTabNav.tsx`): a strategy
finished while the user was on another mode. It renders only on the inactive button, in the label
rather than on the corner (the corner is the group's seam), and clears when the stack is viewed.
Persisted per trace in `UserDismissal(itemType:'strategy_ready', itemKey:<traceId>)`, so a refresh
raises a fresh one (`useStrategyReady.ts`).

### 3.0 How a mode is chosen

**The mode is `?mode=`**, parsed on the server (`page.tsx`) and passed to `ProjectClient` as a prop.
A bare `/project/[id]` runs the landing table and redirects; a URL that already has a mode does **no
database work** — deliberately, because a search-param change re-executes the server component and a
query there would put a round-trip on every toggle.

`resolveProjectMode` (`lib/navigation/resolve-mode.ts`) — first match wins:

| # | rule | lands on |
|---|---|---|
| 1 | no context (no fragments, chats or documents) | `stack` — the cold start. **Forced** |
| 2 | `?evidence=1` | `knowledge` |
| 3 | demo project | `stack` |
| 4 | no strategy **and** an ingest whose review is still pending | `review` (+ `batch`, `landed=1`) |
| 5 | the mode cookie (`stack` or `knowledge`, per project, per device) | that mode |
| 6 | otherwise | `stack` |

"Pending" is **per ingest** since 2026-09-10: a document, a bundle's import batch, or a chat that
produced ground truths, until its own `UserDismissal(itemType:'ground_truth_review', itemKey:
'doc:<id>' | 'bundle:<id>' | 'chat:<id>')` exists. Only *Review these later* writes that row
(`lib/navigation/review-batch.ts`).

**Changing mode is a `router.push`** (`setMode`, `ProjectClient.tsx:354`): every toggle is a history
entry, so back undoes it. The mode cookie is written for `stack`/`knowledge` only — `review` is a
moment, not a place to return to.

**One rule is re-applied on the client:** an empty project renders the cold start whatever `?mode`
says (`activeTab`, `ProjectClient.tsx:346`), because the server does not check when a mode is given.

| param | meaning | read by |
|---|---|---|
| `mode` | `stack` · `knowledge` · `review` | `page.tsx` → `ProjectClient` |
| `batch` | the ingest a review is scoped to | review only, `ProjectClient.tsx:301` |
| `deepDive` | the deep dive a review hands back to on leaving | review only, `ProjectClient.tsx:319` |
| `landed` | fires the arrival event once, then is stripped | `ProjectClient.tsx:511` |
| `filter=changed` | opens the knowledge panel on the *changed since vN* diff | `ProjectClient.tsx:485` → `KnowledgeSummaryPanel` |
| `evidence=1` | consumed by the redirect (rule 2); never reaches the client | `page.tsx` |
| `dimension` | opens the knowledge panel filtered to one dimension (`filter=changed` wins if both) | `parseKnowledgeFilter` → `KnowledgeSummaryPanel` |

### 3.1 The cold start — no context

`!hasContext && !isDemo` (`ProjectClient.tsx:1069`). Not a tab: the header has **no nav at all**
(`setTabNav(null)`, pinned by `__tests__/empty-project-has-no-nav.test.ts`), and this is the whole
screen. `Launchpad.tsx`:

| element | action |
|---|---|
| The premise — *"Every company has a story. And every strategy is a Decision Stack."* | — |
| Talk to Luna card | opens chat sheet (`cta_new_chat` / `launchpad`) |
| Upload a document card | opens upload dialog |
| Import from AI card | opens import dialog |
| *See it on four real companies* — 4 demo cards | navigates to the demo |

### 3.2 Mode: `stack`

Governed by `ProjectClient.tsx:1095-1290`. Two states, forked on whether a strategy exists.

**No strategy yet — the signpost** (`:1265`). *"Your Decision Stack goes here"*, the ground truth
count, **Build my strategy** (when fragments > 0) and **Add more context** → `knowledge`. Deliberately
not the Launchpad and not a stepper.

**Strategy exists — masthead, then the stack.**

| element | states | actions | governed by |
|---|---|---|---|
| Masthead: Decision Stack mark (left) · company logo (centre, demo only) · version (right) | — | mark → attribution popover | `ProjectClient.tsx:1119` |
| **`Version N \| ⋯`** split pill | real projects; demo shows *"Generated from Acquired podcast transcript"* instead | ⋯ → **Export** · **Past versions** (opens the sheet) | `:1176` |
| **Share** | real projects with a strategy | share dialog, or sign-in gate for guests | `:1222` |
| **"N changes since vN"** — guidance row 4, under the version control | real projects with a strategy, comparable snapshot, knowledgebase has moved on since this version; hidden while a build runs. State, not a prompt: no dismissal | → `?mode=knowledge&filter=changed`, where Rebuild lives | `GuidanceLink` · `lib/guidance/stack-behind.ts` |
| **Vision** card | read · flipped-to-edit | edit inline | `FlipCard` · `StrategyDisplay` |
| **Strategy** card | read · flipped-to-edit | edit inline | `StrategyDisplay` |
| **Objectives** grid | read · flipped-to-edit · empty | edit inline, add | `StrategyDisplay` |
| **Opportunities** | populated · empty | Draft with Luna (first time skips the confirm) · Add manually · edit · delete | `OpportunitySection.tsx` |
| **Principles** | populated · empty | Add Principle (dialog) · edit | `PrinciplesSection.tsx` |

The version label is deliberately **not** a button — it names what the ⋯ acts on. Every card uses
`FlipCard`; `readOnly` (demo, share) hides every edit affordance.

### 3.3 Mode: `knowledge`

Governed by `ProjectClient.tsx:1300-1799`. **Two states** now — the empty-knowledgebase branch was
deleted 2026-09-10, unreachable once rule 1 forces empty projects to the cold start.

**Demo** (`:1365`): `KnowledgeSummaryPanel` alone, `readOnly` and expanded by default. It shows the
same ground truths as any other project — `readOnly` means *no controls that change it*, not *no
list*. `FragmentExplorer`, the older browser that used to render here, is **deleted**. Header counts
are pinned to the import (chats and documents at 0, deliberately — see the comment at `:1384`).

**Populated:**

| band | element | content | states | actions |
|---|---|---|---|---|
| **mulberry band** (full-bleed, `bg-primary`) | `KnowledgeSummaryPanel` | narrative summary; ground truth / chat / import / doc counts; *"updates in N"*; sync line (*"Stack v3 · 4 added, 1 discarded since"*); 11 dimension rows each with a **Harvey ball**; **the ground truths themselves**, via `GroundTruthReview` | collapsed · expanded · busy (knowledge) · busy (strategy) · changed | expand · refresh/generate · dimension row → filters the list in place · **All / Changed since vN** chips (only when there is a diff) · discard / restore a ground truth · open the chat it came from |
| **body** — *"Your context"* | `ExploreNextSection` | deep dives + provocations + gaps, as action cards | populated · empty | click → chat seeded by origin · dismiss (persisted) · Add Deep Dive |
| | Chats card | conversation list | sub-tabs **Analysed / In Progress**, defaulting to In Progress when any exist | New · open · resume · star |
| | Documents card | filename + *"N ground truths"* or status | populated · empty · >10 → "show N more" | Upload |
| | Integrations card | Claude/Gemini/OpenAI logos → install guide | not shown in demo | Import context |

The Harvey ball reads **computed support** (`lib/support/dimension-support.ts`), five states —
`empty · quarter · half · three-quarter · full`. The sync line and the *changed* diff read
`stats.strategySync` (`addedIds` / `removedIds` against the latest snapshot's `fragmentIds`,
`api/project/[id]/route.ts:308-322`); a snapshot that predates `fragmentIds` says only when it was
built.

### 3.4 Mode: `review`

`?mode=review` renders `GroundTruthReviewScreen` **in place of the whole knowledgebase**
(`ProjectClient.tsx:1313`), only when `!isDemo && !hasStrategy` (`showReview`, `:497`). On a project
with a strategy, `?mode=review` falls through to the ordinary knowledgebase.

| element | action |
|---|---|
| *"Here are the N ground truths we found"*, scoped to `batch` when given | discard (one at a time, immediate, undoable) |
| **Build my strategy** — the primary exit | generate |
| Add more: chat · upload · import | same doors as the Launchpad; inside a deep dive, chat and upload add *into* it (a bundle cannot belong to a deep dive) |
| **Review these later** | writes the ingest's `ground_truth_review` dismissal → `knowledge`; hands back to the deep dive if there was one |

It is reached **only by address** — two ways: the landing table on arrival (rule 4), and
`presentIngestReview` in session (`ProjectClient.tsx:428`), which fires when a document finishes, a
bundle import closes, or a chat's extraction completes. Both are pre-strategy only; after a strategy
exists an ingest produces no review (a deep-dive ingest just reopens its deep dive).

**Being shown is reviewing.** Every `GroundTruthReview` mount — this screen *and* the knowledge
panel's list — stamps `reviewedAt` on the rows it **shows**: the batch, changed-id and dimension
filters applied, each row once per mount (`GroundTruthReview.tsx:313`). Until 2026-09-11
(`1076ea8`) it stamped every active fragment in the project on load, whatever the filter — a
3-row scoped review marked all 19 as reviewed.

---

## 4. Overlays — the right-hand surface

There is no sidebar; there are **three right-side sheets**, and they compete for the same space.

| overlay | width | content | governed by |
|---|---|---|---|
| **Chat sheet** | `sm:max-w-2xl` | the conversation — seeded by question, deep dive, gap, or nothing | `chat-sheet.tsx` (613 lines) |
| **Deep dive sheet** | `sm:w-[540px]` | one deep dive: its conversations and documents (not their ground truths) | `deep-dive-sheet.tsx` |
| **Version history sheet** | `sm:w-[450px]` | snapshot list + Strategic Brief export per version | `VersionHistorySheet.tsx` |

The Evidence sheet is gone (2026-09-08, tag `evidence-sheet-final`). All three remaining sheets are
**pure component state**: not linkable, not restorable on reload, not in browser history. The mode
became addressable; the overlays did not.

**Eleven dialogs** sit on top of that (`ProjectClient.tsx:1805-1967`): document upload · add deep
dive · synthesis progress · share · sign-in gate · import bundle · generation confirm · Pro
interstitial · upgrade success · Pro coming soon — plus Add Principle, owned by `PrinciplesSection`.

`GenerationConfirmDialog` fronts **two** actions (`GenerationAction = 'refresh' | 'opportunities'`),
and auto-confirms — no dialog shown — when it is a first-time opportunities run. It shows **no quality
signal**; see the blueprints, task 5. (`RefreshStrategyDialog.tsx`, imported by nothing, was deleted 2026-09-11.)

---

## 5. Where each object surfaces

Read against `prisma/schema.prisma`.

| object | surfaces | editable where | notes |
|---|---|---|---|
| `Project` | header switcher; every page | rename/delete in switcher | — |
| `Conversation` | Chats card; chat sheet; deep dive sheet; playback (dev) | — | Analysed vs In Progress is `status` |
| `Document` | Documents card; deep dive sheet | — | no detail view; a row and a count |
| `Fragment` | **`GroundTruthReview`** — in the knowledge panel, on the review screen, read-only on demos; counts in the tab nav, the panel and the Documents card | discard / restore | the list is on the page now, not behind a sheet |
| `Evidence` | the quote under each ground truth, with its verification state (`EvidenceQuote.tsx`) | — | `failed` spans never render as the user's own words |
| `Fragment.interpretationType` | **ordering** only — interpretations sort before verbatims (`ground-truth/derive.ts:325`) | — | never shown as a label |
| `Fragment.reviewedAt` | **nowhere** | — | written for the rows a `GroundTruthReview` shows; read by nothing |
| `Fragment.archivedReason` | nowhere | — | written (`'ground_truth_review'`); read by nothing |
| `FragmentDimensionTag` | dimension rows (as counts, and as the filter) | — | `reasoning` never shown |
| `DimensionalSynthesis` | `summary` → knowledge summary; `gaps` → Explore Next; `confidence` → Explore Next's gap filter and the (unrendered) coverage warnings | — | — |
| `DecisionStack` + components | the stack; share page; trace view | inline per card | vision/strategy are columns, not addressable rows |
| `DecisionStackSnapshot` | Version history sheet; **the sync line and the changed diff** (`fragmentIds`) | — | user edits are **not** snapshotted (blueprint task 8) |
| `DeepDive` | Explore Next; deep dive sheet; the review's hand-back | add via dialog | — |
| `UserDismissal` | invisibly removes Explore Next cards; **decides whether a review is pending** (per ingest); **whether the strategy-ready dot shows** (per trace) | dismiss / *Review these later* / viewing the stack | — |
| `Trace` | `/strategy/[traceId]` | — | reachable by direct link and the legacy `/project/[id]/strategy` redirect |

---

## 6. Page-state matrix

| axis | values | set by |
|---|---|---|
| mode | `stack` · `knowledge` · `review` | **`?mode=`**, resolved on the server when absent |
| context | none → cold start (no nav) · present | fragment/conv/doc counts; one-way by construction |
| strategy | none → signpost / review · present → the stack | `strategyData`; server uses `vision !== ''` |
| pending review | none · one ingest waiting (pre-strategy only) | `UserDismissal` per ingest, `review-batch.ts` |
| staleness | in sync · changed (`added` / `discarded` since vN) · not comparable (pre-`fragmentIds` snapshot) | `stats.strategySync`, `stats.strategyIsStale` |
| task | idle · extracting · generating · processing docs | `BackgroundTaskProvider` → `StatusBanner` + busy strings |
| identity | guest · signed-in · Pro | cookie / session / entitlement |
| access | owner · demo (read-only, always lands on `stack`) · share token (read-only, no KB) | `isDemo`, `/share` |

**The state that had no design now has one.** The 2026-09-07 map flagged `strategy: none` +
`knowledge: populated` as undesigned. It is now two designed surfaces: the **review** while an ingest
is pending, and the **signpost** on `stack` once it is not.

---

## 7. What the map exposes

Stated as observations, consistent with the blueprints' descriptive stance.

**The mode is addressable; almost nothing inside it is.** `?mode=`, `?filter=changed` and the review
`batch` are real addresses, and they are what the guidance register (design §6) needed to link to.
The three sheets, the dimension filter and the Archived list are still component state.

**`?dimension=` was a dead param for a day** — emitted by the legacy `/fragments` route, carried by
the redirect, read by nothing after `FragmentExplorer` went. Fixed 2026-09-11 (`f376a3d`): both
knowledge filters are now parsed by `parseKnowledgeFilter` and built by `knowledgeHref`
(`lib/navigation/knowledge-filter.ts`), so a link and its reader cannot drift apart again.

**`reviewedAt` means "was shown", not "was reviewed".** Every `GroundTruthReview` mount stamps
every row it shows, including the knowledge panel's list whenever it is expanded. So `reviewedAt IS
NULL` means *never displayed in any list* — narrower than register row 6's *"I never actually looked
at these"*. Worth knowing before building row 6 on it. (Only true since `1076ea8`, 2026-09-11: before
that a filtered list stamped the whole project, so older timestamps over-report.)

**One route still carries the whole product.** `ProjectClient.tsx` is 1,974 lines — larger than the
`page.tsx` it replaced ever was (1,799 at slice 2), because slice 2 moved the mode decision out
without splitting the client, and it has grown by ~175 lines since (much of it the comments that
carry its invariants).
Three modes, two knowledgebase states, three sheets and eleven dialogs.

**One memory of "last project"** since 2026-09-11 (`1e26c42`). `/`, `/project` and the header's
off-project fallback all read the `lunastak_last_project` cookie, written by the project page and
never for a demo. Until then `/project` and the header used `localStorage.lastProjectId`, which the
header also wrote for demos.

**The global overflow is gone; one contextual one came back.** The header `⋯` (ten items, nine
duplicates) was deleted. `Version N | ⋯` holds Export and Past versions, which have no other door —
same principle, different answer (`ProjectClient.tsx:1157` says so).

**Two paths to the same place — fewer than before.** Chat: Launchpad card, Chats card *New*, review
screen, every Explore Next card. Generation: the knowledge summary's refresh, the signpost's *Build*,
the review's *Build*. The fragment triple (sheet, chip, overflow) collapsed to one list.

**The demo path is still a fork, not a flag** — but a smaller one. `isDemo` still branches the
knowledgebase render tree, swaps the version pill for attribution, pins the header counts and no-ops
the handlers. Its ids are now in one registry rather than three places.

---

## 8. What changed since 2026-09-07

For anyone holding the old map. Every line of §3 was superseded; the substance:

| was | is | when |
|---|---|---|
| mode in `activeTab` state; reload → stack | `?mode=` from a server landing table; back undoes a toggle | 2026-09-10 (`714ef3f`) |
| header `⋯` with ten actions | gone; Export + Past versions in `Version N \| ⋯`, Share beside it, demos in the switcher | 2026-09-10 |
| `page.tsx`, one `'use client'` file | `page.tsx` server redirector + `ProjectClient.tsx` | 2026-09-10 |
| demo ids in three places | `lib/demos.ts` | 2026-09-10 |
| KB empty state | deleted; empty projects get the cold start with no nav | 2026-09-10 |
| pre-strategy stack = Launchpad | cold start (no context) vs signpost (context, no strategy) | 2026-09-10 |
| Evidence sheet + `FragmentExplorer` | `GroundTruthReview` inside the knowledge panel, everywhere incl. demos | 2026-09-08 / 09-10 |
| `Evidence`, `reviewedAt` surfaced nowhere | `Evidence` rendered; `reviewedAt` written, still unread | 2026-09-08 |
| one first look per project | one review per ingest — document, bundle **and** chat | 2.8.1 |
| `/` → oldest project | `/` → last project | 2026-09-10 (`8096a0b`) |
