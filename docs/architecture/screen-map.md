# Screen map — what exists, where it lives, and what state it can be in

**Date:** 2026-09-07
**Status:** Descriptive. Current state of `development` **before** the ground truth gate lands.
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
| left | Lunastak logo → current project (or `/`) | `app-layout.tsx:237` |
| centre | **`tabNav` — an empty slot the page fills** | `HeaderContext.tsx` · `app-layout.tsx:243` |
| right | `rightSlot` (demo mode injects here), else project switcher + account menu | `app-layout.tsx:250` |

Below the header, `StatusBanner` renders a single line of running-task text when any background task
is active, and nothing otherwise (`StatusBanner.tsx:31`).

**The header owns no navigation of its own.** `tabNav` and `rightSlot` are React nodes pushed up
from the page through `HeaderContext`. On mobile the tab nav moves to a second header row
(`app-layout.tsx:451`); on desktop it is `hidden md:flex`, so a narrow desktop window loses it.

**Project switcher** (popover, `app-layout.tsx:257`) — searchable project list, plus New Project,
Rename, Delete. This is the only cross-project navigation in the product.

**Account menu** (dropdown, `app-layout.tsx:325`) — upgrade prompt when not Pro, Account, external
links to docs and data-security, footer credits, sign out.

---

## 2. Every route

11 user-facing paths, of which **one is the product**. Derived from `src/app/**/page.tsx`.

| route | kind | what it is | governed by |
|---|---|---|---|
| `/` | redirect | Nobody sees a homepage. Mints a guest cookie if needed, lands on a project | `app/page.tsx` |
| `/project` | redirect | → last-used project (`localStorage.lastProjectId`) or the first one | `project/page.tsx` |
| **`/project/[id]`** | **the app** | Two modes in one page — see §3 | `project/[id]/page.tsx` (**1,539 lines**) |
| `/project/[id]/template` | page | 6-step manual Decision Stack builder | `template/page.tsx` (634 lines) |
| ~~`/project/[id]/outcomes`~~ | — | **deleted 2026-09-08** — see `retired-fake-doors.md` | — |
| `/project/[id]/fragments` | **legacy redirect** | → `/project/[id]?evidence=1`, preserving `?dimension=` | `fragments/page.tsx` |
| `/project/[id]/strategy` | **legacy redirect** | → latest trace view | `strategy/page.tsx` |
| `/share/[token]` | public | Read-only stack, server-rendered, `noindex`. No knowledgebase | `share/[token]/page.tsx` |
| `/strategy/[traceId]` | read-only | A single generation's output | `strategy/[traceId]/page.tsx` |
| ~~`/extraction/[id]`~~ | — | **deleted 2026-09-08** — see `retired-extraction-run.md` | — |
| `/account` | page | Account settings | `account/page.tsx` |
| `/auth/signin` · `/auth/verify-request` | auth | Sign-in, magic-link confirmation | `auth/*` |
| `/demo/strategy` | demo | Standalone demo page | `demo/*` |
| ~~`/demo/extraction`~~ | — | **deleted 2026-09-08** — see `retired-extraction-run.md` | — |
| `/admin/eval` · `/admin/eval/[evalId]` | admin | Evaluation runs | `admin/eval/*` |
| `/dev/playback` · `/dev/pipeline-test` | dev | Conversation playback, pipeline harness | `dev/*` |
| `/prototype/graph` · `/prototype/ground-truth` · `/prototype/ground-truth-check` · `/prototype/ground-truth-gate` | prototype | Disposable. Two are retired instruments (design §11, §16.5) | `prototype/*` |

**Demo projects are not a route.** Four hardcoded project ids (Nike, Costco, TSMC, Ferrari) render
through `/project/[id]` with `isDemo` flipping behaviour throughout — `DEMO_META` at
`project/[id]/page.tsx:80`, duplicated in `Launchpad.tsx` and again as episode URLs at `:912`.

---

## 3. `/project/[id]` — the single page

One route, two modes, switched by `activeTab` state — **not by URL.** Reload lands you back on
`decision-stack` regardless of where you were.

```
┌ header ─────────────────────────────────────────────────────────┐
│ logo   [ Decision Stack | Knowledgebase (n) | ⋯ ]   project  acct│
└─────────────────────────────────────────────────────────────────┘
  StatusBanner — only while a task runs
```

The mode switch and the `⋯` overflow are pushed into the header slot from the page
(`page.tsx:277-400`). The overflow menu is where surface pressure is most visible — **twelve actions
in four groups**, several of which are the primary path to their feature:

| group | items |
|---|---|
| Add Context | New Chat · Upload Document · Import Context Bundle · View all N fragments |
| Update Strategy | Refresh / Generate Decision Stack · Generate Opportunities |
| Export | Export Strategic Brief · Version History |
| Examples | Nike · Costco · TSMC · Ferrari |

### 3.1 Mode: Decision Stack

Governed by `page.tsx:898-1006`. Two states, forked on whether a strategy exists.

**State A — `strategyData === null` → Launchpad** (`Launchpad.tsx`)

| element | condition | action |
|---|---|---|
| "You have N fragments — generate now?" prompt card | `fragmentCount > 0` | generate |
| Talk to Luna card | always | opens chat sheet |
| Import context bundle card | always | opens import dialog |
| Examples strip — 4 demo cards | always | navigates to demo project |

**State B — strategy exists → the stack** (`StrategyDisplay.tsx`, 516 lines)

| element | states | actions | governed by |
|---|---|---|---|
| Demo logo | demo only | — | `page.tsx:902` |
| Version stamp `v{n}` + "view past revisions →" | real projects only; demo shows Acquired attribution instead | opens Version History sheet | `page.tsx:908` |
| Decision Stack logo + attribution popover | always | — | `page.tsx:944` |
| First-run guidance banner | `!isDemo && !vsoGuidanceDismissed` | dismiss (persisted) | `page.tsx:958` |
| **Vision** card | read · flipped-to-edit | edit inline | `FlipCard` · `StrategyDisplay:235` |
| **Strategy** card | read · flipped-to-edit | edit inline | `StrategyDisplay:278` |
| **Objectives** grid | read · flipped-to-edit · empty | edit inline, add | `StrategyDisplay:316` |
| **Opportunities** | populated · empty | Draft with Luna → confirm gate · Add manually · edit · delete | `OpportunitySection.tsx` |
| **Principles** | populated · empty | Add Principle (dialog) · edit | `PrinciplesSection.tsx` |

Every card uses `FlipCard` — the card flips to reveal its editor rather than opening a modal. `readOnly`
(demo and share) hides every edit affordance.

### 3.2 Mode: Knowledgebase

Governed by `page.tsx:1008-1360`. **Three states**, and the demo state is a separate branch rather
than a variation.

**State A — demo** (`page.tsx:1010`): coverage panel + `FragmentExplorer` inline, everything else
stripped, all handlers no-ops.

**State B — genuinely empty** (`fragmentCount === 0 && conversationCount === 0 && documents === 0`,
`page.tsx:1049`): a line of copy plus the same two Launchpad cards.

**State C — populated:**

| band | element | content | states | actions |
|---|---|---|---|---|
| **mulberry band** (full-bleed, `bg-primary`) | `KnowledgeSummaryPanel` | narrative summary, fragment/chat/doc counts, "N more insights 'til next auto-update", 11 dimension chips each with a **Harvey ball** | collapsed · expanded (takes both columns) · busy (knowledge) · busy (strategy) · stale | expand · refresh/generate · dimension chip → filters the ground truth list in place |
| **body** | `ExploreNextSection` | deep dives + provocations + gaps, as action cards | populated · empty | click → opens chat seeded by origin type · dismiss (persisted) · Add Deep Dive |
| | Chats card | conversation list | sub-tabs **Analysed / In Progress**, each with its own empty state | New · open · resume · star |
| | Documents card | filename + fragment count or status | populated · empty · >10 → "show N more" | Upload |
| | Integrations card | Claude/Gemini/OpenAI logos + install link | not shown in demo | Import context |

The Harvey ball reads **computed support** (`lib/support/dimension-support.ts`), five states —
`empty · quarter · half · three-quarter · full` — as of commit `226f71c` on this branch. Before that
it read the model's self-report.

---

## 4. Overlays — the right-hand surface

This is what Jonny means by "the sidebar is occupied". There is no sidebar; there are **three
right-side sheets**, and they compete for the same space.

| overlay | width | content | governed by |
|---|---|---|---|
| ~~**Evidence sheet**~~ | — | **deleted 2026-09-08** — the ground truths are on the page, in the Knowledge Summary. `EvidenceSheet` and `EvidencePanel` both go; recovery tag `evidence-sheet-final` | — |
| **Chat sheet** | `sm:max-w-2xl` | the conversation — seeded by question, deep dive, gap, or nothing | `chat-sheet.tsx` (655 lines) |
| **Deep dive sheet** | `sm:w-[540px]` | one deep dive: its conversations and documents | `deep-dive-sheet.tsx` |
| **Version history sheet** | `sm:w-[450px]` | snapshot list + Strategic Brief export per version | `VersionHistorySheet.tsx` |

**`?evidence=1&dimension=…` outlived the sheet it opened.** The legacy `/project/[id]/fragments`
route still redirects into it, and it keeps its meaning — "take me to what was extracted" — by
landing on the Knowledgebase tab and then clearing itself (`project/[id]/page.tsx:225-232`). The
three remaining sheets are pure component state: not linkable, not restorable on reload, not in
browser history.

**Eleven dialogs** sit on top of that (`page.tsx:1367-1536`): document upload · add deep dive ·
synthesis progress · share · sign-in gate · import bundle · generation confirm · Pro interstitial ·
upgrade success · Pro coming soon — plus Add Principle, owned by `PrinciplesSection`.

`GenerationConfirmDialog` is one component fronting **four** different actions (`GenerationAction`),
and is the only gate in the product that shows a quality signal (coverage warnings, advisory).

---

## 5. Where each object surfaces

Read against `prisma/schema.prisma`. This is the column that matters for the gate: several objects
have exactly one surface, and two have none.

| object | surfaces | editable where | notes |
|---|---|---|---|
| `Project` | header switcher; every page | rename/delete in switcher | — |
| `Conversation` | Chats card; chat sheet; playback (dev) | — | Analysed vs In Progress is `status` |
| `Document` | Documents card | — | no detail view; a row and a count |
| `Fragment` | Evidence sheet only; counts elsewhere | archive/restore only | **used once, ever, in production** |
| `Evidence` *(this branch)* | **nowhere** | — | returned by the fragments route, rendered by nothing |
| `Fragment.interpretationType`, `reviewedAt` *(this branch)* | **nowhere** | — | same |
| `FragmentDimensionTag` | dimension chips (as counts) | — | `reasoning` never shown |
| `DimensionalSynthesis` | `summary` → knowledge summary; `gaps` → Explore Next; `confidence` → *no longer* the ball | — | 4 fields written and never read |
| `DecisionStack` + components | the stack; share page; trace view | inline per card | vision/strategy are columns, not addressable rows |
| `DecisionStackSnapshot` | Version history sheet | — | user edits are **not** snapshotted (blueprint task 8) |
| `DeepDive` | Explore Next; deep dive sheet | add via dialog | — |
| `UserDismissal` | invisibly removes Explore Next cards | dismiss | — |
| `Trace` | `/strategy/[traceId]` | — | reachable only by direct link |

---

## 6. Page-state matrix

The states `/project/[id]` can actually be in, and which are reachable together.

| axis | values | set by |
|---|---|---|
| mode | `decision-stack` · `knowledgebase` | component state, **not URL** |
| strategy | none → Launchpad · present → stack | `strategyData` |
| knowledge | none → empty state · present → full KB · demo → stripped KB | fragment/conv/doc counts, `isDemo` |
| staleness | fresh · stale (`fragmentsSinceStrategy > 0`) | `stats.strategyIsStale` |
| task | idle · extracting · generating · processing docs | `BackgroundTaskProvider`, surfaces as `StatusBanner` + busy strings |
| identity | guest · signed-in · Pro | cookie / session / entitlement |
| access | owner · demo (read-only) · share token (read-only, no KB) | `isDemo`, `/share` |

**The combination with no design is `strategy: none` + `knowledge: populated`** — a project with
fragments and no stack. Today it renders the Launchpad with a "generate now?" nudge. The gate
creates this state deliberately and at scale (design §13: *"the one genuinely new state is a project
with fragments and no strategy, because the user walked away mid-gate"*).

---

## 7. What the map exposes

Stated as observations, consistent with the blueprints' descriptive stance.

**One route carries the whole product.** `/project/[id]` is 1,539 lines holding two modes, three
knowledgebase states, four sheets and eleven dialogs. Every other user-facing route is a redirect, a
fake door, a read-only view, or auth.

**Mode is not addressable.** `activeTab` lives in component state. You cannot link to the
knowledgebase, cannot back-button out of it, and a reload always returns to the stack. The one
overlay that *is* addressable (`?evidence=1`) got that way because a route had to be retired into it.

**The overflow menu is doing navigation's job.** Twelve actions in four groups, including the only
route to Version History, Export, and the demo projects. Three of the four "Add Context" items are
also reachable elsewhere; one — *View all N fragments* — competes with the Evidence panel for the
same destination.

**Four sheets, one surface.** They cannot coexist, none are addressable, and two of them (evidence,
version history) are the persistent reference views a sidebar would normally hold. That is the
"running out of surface" symptom precisely: reference material is being served through a modal
mechanism.

**Two paths to the same place, three times.** Fragments: Evidence panel, dimension chip, overflow
item. Generation: knowledge summary refresh button, overflow item. Chat: Launchpad card, Chats card
"New", overflow item, plus every Explore Next card.

**`Evidence` has no surface at all.** The whole backend arc of this branch — spans, verification
state, interpretation type, `reviewedAt` — is returned by `/api/project/[id]/fragments` and rendered
by nothing. `FragmentExplorer` still shows title, dimensions and content, exactly as before.

**The demo path is a fork, not a flag.** `isDemo` branches the knowledgebase into a separate render
tree, swaps the version stamp for attribution, hides the overflow menu, and rewrites four handlers to
no-ops. Its project ids are hardcoded in three places.

**Where the gate would have to go.** It needs a full-viewport moment between extraction and first
generation. Today that moment is the Launchpad — the Decision Stack tab's empty state — and the only
component built for it (`ExtractionConfirm`, 207 lines, tested — **deleted 2026-09-08**, see
`retired-extraction-run.md`) reached a real user only from the
`catch` block of a failed generation — `setFlowStep('extraction')` at `chat-sheet.tsx:482`, verified
still true. Its two other render sites were `/extraction/[id]` and `/demo/extraction`, neither on the
live path and both deleted with it. Blueprint task 2 tagged it `open` — revive or delete; it was
resolved as delete.
