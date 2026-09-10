---
doc: service-blueprints
version: 2
updated: 2026-09-11
phases: [ADMIT, GATHER, REASON, COMMIT, REVEAL]
# Every path below is referenced by at least one blueprint row. A checker can assert
# these still exist, and flag the blueprint stale when any of them changes.
governed_by:
  pipeline: [src/lib/pipeline/plan.ts, src/lib/pipeline/executor.ts, src/lib/pipeline/generation.ts]
  synthesis: [src/lib/synthesis/update-synthesis.ts, src/lib/synthesis/full-synthesis.ts, src/lib/synthesis/incremental-synthesis.ts, src/lib/knowledge-summary.ts]
  stack: [src/lib/decision-stack.ts]
  ingest: [src/lib/import/executor.ts, src/lib/import/transforms/context-bundle.ts, src/lib/fragments.ts, src/lib/document-processing.ts]
  evidence: [src/lib/evidence/parse.ts, src/lib/evidence/verify.ts, src/lib/ground-truth/derive.ts, src/lib/ground-truth/count.ts]
  navigation: [src/app/project/[id]/page.tsx, src/lib/navigation/resolve-mode.ts, src/lib/navigation/review-batch.ts]
  routes:
    - src/app/api/extract/route.ts
    - src/app/api/project/[id]/route.ts
    - src/app/api/documents/upload/route.ts
    - src/app/api/deep-dive/route.ts
    - src/app/api/project/[id]/import-bundle/route.ts
    - src/app/api/project/[id]/refresh-strategy/route.ts
    - src/app/api/project/[id]/generate-opportunities/route.ts
    - src/app/api/project/[id]/template-entry/route.ts
    - src/app/api/project/[id]/strategy-version/route.ts
    - src/app/api/project/[id]/fragments/route.ts
    - src/app/api/project/[id]/generate-strategy/route.ts
    - src/app/api/project/[id]/share/route.ts
  ui:
    - src/app/project/[id]/ProjectClient.tsx
    - src/components/chat-sheet.tsx
    - src/components/ChatInterface.tsx
    - src/components/StrategyDisplay.tsx
    - src/components/KnowledgeSummaryPanel.tsx
    - src/components/ExploreNextSection.tsx
    - src/components/ground-truth/GroundTruthReview.tsx
    - src/components/ground-truth/GroundTruthReviewScreen.tsx
    - src/components/OpportunitySection.tsx
    - src/components/GenerationConfirmDialog.tsx
# Disposition vocabulary for every called-out weakness:
#   by-design     deliberate; do NOT "fix" — rationale recorded
#   accepted-debt known, not worth it yet; revisit trigger noted
#   cheap-win     small, high-value, do it
#   fix           genuine defect
#   open          not yet ruled
# gates = user-facing decision points; quality_gate = does any gate assess output quality
tasks:
  - {id: 1,  name: Refresh strategy,               gates: 1, quality_gate: false, reveals_change: false}
  - {id: 2,  name: Conversation to first strategy, gates: 1, quality_gate: false, reveals_change: false}
  - {id: 3,  name: Upload a document,              gates: 1, quality_gate: false, reveals_change: false}  # the review — pre-strategy only
  - {id: 4,  name: Import a context bundle,        gates: 2, quality_gate: false, reveals_change: false}  # review is pre-strategy only
  - {id: 5,  name: Generate opportunities,         gates: 1, quality_gate: false, reveals_change: false}  # 0 on a first run
  - {id: 6,  name: Explore Next to deep dive,      gates: 0, quality_gate: false, reveals_change: false}
  - {id: 7,  name: Prune the Knowledgebase,        gates: 0, quality_gate: false, reveals_change: false}
  - {id: 8,  name: Edit a card,                    gates: 0, quality_gate: false, reveals_change: false}
  - {id: 9,  name: Fill in the template,           gates: 0, quality_gate: false, reveals_change: true}
  - {id: 10, name: Share a stack,                  gates: 1, quality_gate: false, reveals_change: false}
---

# Service blueprints — one user task at a time

**Last updated:** 2026-09-11 — refreshed against `052c3ce` (the navigation routing, 2.8.0 and 2.8.1).
Tasks 2 and 7 rewritten; tasks 1, 3, 4, 5, 6 amended; **task 5's quality gate corrected — it never
existed** (see task 5). What the page itself looks like now: [`screen-map.md`](screen-map.md).
**Companion to:** [`intelligence-pipeline-v2.md`](intelligence-pipeline-v2.md) — that doc describes
how *code* flows; this describes what happens when a **user** does something, and which code owns
each step. Supporting analysis (the knowledge-architecture diagram and the field-by-field
cross-reference audit) is kept locally in `docs/_plans/` and is referenced below by finding number.

The diagram answers *what knowledge exists and who reads it*. This answers **what happens, in
what order, when a user does something** — and which code owns each step.

Two lanes. **▲ above the line** = the user acts or sees something. **▼ below the line** = the
system does something the user cannot see. **⛔ gate** = the flow stops and waits for a decision.

Below-line steps are grouped by **purpose**, not by call order, using a fixed five-phase
vocabulary. Same names in every blueprint, so the set is machine-queryable as well as readable:

| phase | purpose | determinism |
|---|---|---|
| **ADMIT** | auth, guards, idempotency, plan selection — *whether this runs, and as what* | deterministic |
| **GATHER** | read the inputs the reasoning will use | deterministic |
| **REASON** | LLM calls — **the only phase that can invent** | **stochastic** |
| **COMMIT** | write, snapshot, version | deterministic |
| **REVEAL** | what actually surfaces back above the line | — |

Why these and not ETL: ETL buries the stochastic step inside "Transform", giving it the same
weight as a database write — when it is the only phase whose output cannot be predicted from its
input, and the source of every quality problem in this system. ETL also has no slot for guards or
for what surfaces back. The split earns its keep by making questions answerable across blueprints:
*which tasks COMMIT without REVEAL?* (dead fields, silent replacement) · *which REASON steps read
a field nothing consumes?* (audit Finding 1) · *where is the only gate, and does it gate cost or
quality?*

---

## Task 1 — Refresh strategy

*"I've added context since my strategy was written. Bring it up to date."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Stack shows as **changed** — the knowledge panel's sync line, *"Stack v3 · 4 added, 1 discarded since"*, from the latest snapshot's `fragmentIds` vs the active ground truths; **All / Changed since v3** chips filter the list to exactly those rows (`?filter=changed` opens it there) | `KnowledgeSummaryPanel` · `api/project/[id]/route.ts:308-322` |
| 2 | ▲ | — | Clicks **Refresh** on the knowledge summary | `ProjectClient.tsx:1403` |
| 3 | ⛔ | — | **Confirmation gate** — explains what will happen, asks to proceed | `GenerationConfirmDialog` (`action: 'refresh'`) |
| 4 | ▼ | **ADMIT** | `POST /refresh-strategy` — auth, project lookup, already-generating guard (409) | `refresh-strategy/route.ts` |
| 5 | ▼ | **ADMIT** | Returns immediately; work continues in `waitUntil` | `refresh-strategy/route.ts:80` |
| 6 | ▼ | **ADMIT** | `planPipeline('refresh_requested')` → synthesis ✓, summary ✓, generation `refresh`. Pure function | `pipeline/plan.ts:61` |
| 7 | ▲ | — | UI enters busy state, begins polling | `GET /generation-status` |
| 8 | ▼ | **GATHER** | Load fragments, existing syntheses, previous stack | `pipeline/generation.ts:87-100` |
| 9 | ▼ | **GATHER** | **Per dimension (×11)** decide full vs incremental: no summary · >30d stale · >50% new · <5 fragments | `synthesis/update-synthesis.ts:15` |
| 10 | ▼ | **REASON** | `full_synthesis` (asks 7 outputs) **or** `incremental_synthesis` (given summary + keyThemes + gaps + confidence only) | `synthesis/*.ts` · `prompts/stages/*` |
| 11 | ▼ | **REASON** | `generateKnowledgeSummary` — narrative + suggested questions | `lib/knowledge-summary.ts` |
| 12 | ▼ | **GATHER** | Compute **delta**: fragments after last snapshot = new; archived since = removed | `pipeline/generation.ts:127` |
| 13 | ▼ | **REASON** | Refresh call: previous stack + **synthesis `summary` only** + delta → updated stack | `pipeline/generation.ts` |
| 14 | ▼ | **COMMIT** | `captureSnapshot(pre_refresh)` — the rollback point | `lib/decision-stack.ts` |
| 15 | ▼ | **COMMIT** | Write syntheses; bump `knowledgeUpdatedAt` so the stale count resets even if generation fails | `update-synthesis.ts:138` · `executor.ts:96` |
| 16 | ▼ | **COMMIT** | `writeStrategyToStack` → `DecisionStack` + components; mirror to `Trace.output` | `lib/decision-stack.ts` |
| 17 | ▼ | **COMMIT** | `captureSnapshot(post_refresh, {model, tokens, latency})` | `lib/decision-stack.ts` |
| 18 | ▼ | **COMMIT** | Clear `generationStatus` | `executor.ts:186` |
| 19 | ▼ | **REVEAL** | Poll returns complete | `/generation-status` |
| 20 | ▲ | **REVEAL** | Strategy re-renders, replaced in place. Toast. | `StrategyDisplay` |
| 21 | ▲ | ⚠ **not revealed** | No diff of the **output**, no approval, no "what changed in the stack" — despite steps 14/17 having captured exactly that. The **input** diff of step 1 resets to *"built from these N ground truths"*, so after the run the user can no longer see what it was built on top of | — |

### What this blueprint exposes

- **COMMIT is five steps; REVEAL is two.** The task captures a rollback point, a delta, and full
  generation metadata — and reveals none of it. That asymmetry *is* the missing review gate, and
  the phase labels make it visible at a glance rather than by reading twenty rows.
- **The only gate sits before ADMIT, and it gates cost, not quality.** Nothing between REASON and
  COMMIT can stop a bad result landing.
- **Step 9 is a GATHER-phase fork with REASON-phase consequences.** Full vs incremental changes
  what the model is shown and therefore what it invents — and `<5 fragments → full` routes the
  thinnest projects down the highest-amplification path (audit Finding 1).
- **Step 13 reads `summary` only.** Everything else REASON produced in step 10 is written and not
  consulted.
- Steps 8–18 are ~2–3 minutes with exactly **one** user-visible state: busy.
- **Corrected 2026-09-11.** Step 1 used to be a count (`fragmentsSinceStrategy`) that only ever went
  up. It is now a two-sided diff — added *and* discarded, by id, filterable — so the *input* half of
  "what changed" is revealed before the run. The *output* half (step 21) is still not.

---

## Task 2 — Conversation → first strategy

*"I'll talk it through and get a strategy out."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Opens chat, converses. Messages persisted per turn | `chat-sheet.tsx` · `/api/conversation/*` |
| 2 | ▲ | — | Luna offers an early exit; clicks **Generate Strategy** (green, deliberately not mulberry — see the comment, inside the transcript) — or ends the chat, or it completes on its own | `ChatInterface.tsx:134` · `chat-sheet.tsx` (`extractContext`) |
| 3 | ▼ | **ADMIT** | `POST /api/extract {isInitial:true}` — auth; `setGenerationStatus('generating')`; conversation → `extracting`; returns immediately, work in `waitUntil`. **No confirmation gate** on this path | `extract/route.ts:286` |
| 4 | ▼ | **ADMIT** | `planPipeline({conversation_ended, isInitial:true})` → extraction ✓, persist ✓, **synthesis ✗**, **generation `null`** | `pipeline/plan.ts:14` |
| 5 | ▲ | — | Sheet closes; toast; task polling begins | `chat-sheet.tsx` |
| 6 | ▼ | **REASON** | Emergent extraction → 3–7 themes + dimension tags, each with a verbatim span and a self-reported `verbatim \| interpretation` type | `extract/route.ts` · `lib/evidence/parse.ts` |
| 7 | ▼ | **COMMIT** | `createFragmentsFromThemes` → `Fragment(contentType:'theme')` + tags + `Evidence` rows, one transaction; spans verified at ingest against the user's turns | `lib/fragments.ts` · `lib/evidence/verify.ts` |
| 8 | ▼ | **COMMIT** | Plan generated nothing, so the executor clears `generationStatus` — but only if this run set it (`ownsGenerationStatus`) | `executor.ts` |
| 9 | ▲ | **REVEAL** | Task completes → `presentIngestReview('conversation')` → `?mode=review&batch=chat:<id>`. Pre-strategy only. A user who left and comes back is sent to the same place by the landing table (rule 4) | `ProjectClient.tsx:392` · `project/[id]/page.tsx` · `navigation/resolve-mode.ts` |
| 10 | ⛔ | **REVEAL** | **Ground-truth review** — this chat's fragments, and the spans they rest on, shown before any strategy exists. One list, discard only | `GroundTruthReviewScreen.tsx` · `GroundTruthReview.tsx` · `ground-truth/derive.ts` |
| 11 | ▲ | — | Discards a wrong row → `PATCH /fragments {ids, status:'archived', archivedReason:'ground_truth_review'}`, one at a time, optimistically. Removal is the confirmation; an undo puts it back | `GroundTruthReview.tsx` · `project/[id]/fragments/route.ts` |
| 12 | ▲ | — | Being *shown* the list stamps `reviewedAt` (`PATCH {ids, reviewed:true}`) — reviewing is being shown something, not clicking it | `GroundTruthReview.tsx:165` |
| 13 | ▲ | — | Clicks **Build my strategy** — or **Review these later**, which writes `UserDismissal(ground_truth_review, chat:<id>)` and lands on `?mode=knowledge` | `GroundTruthReviewScreen.tsx` · `ProjectClient.tsx:1280` |
| 14 | ▼ | **ADMIT** | `POST /generate-strategy` — auth, fragment count > 0, guest quota, **409 `already_generating`** guard; `planPipeline('generate_from_knowledge')` → synthesis ✓ fg, summary ✓ fg, generation `initial` | `generate-strategy/route.ts` |
| 15 | ▼ | **GATHER** | Load active fragments with their evidence spans | `pipeline/generation.ts` |
| 16 | ▼ | **REASON** | Initial generation → vision, strategy, objectives | `prompts/stages/generation.ts` (`v4-pithy-statements`) |
| 17 | ▼ | **COMMIT** | `captureSnapshot(pre_generation)` → `writeStrategyToStack` → `captureSnapshot(post_generation)`; clear `generationStatus` | `lib/decision-stack.ts` · `executor.ts` |
| 18 | ▲ | **REVEAL** | Strategy renders | `StrategyDisplay` |
| 19 | ▼ | — | *Later:* synthesis runs only once **15** new fragments accumulate | `executor.ts` |

**Exposes.** *(disposition: `by-design` — see 2026-02-16 debounce decision.)* The first strategy a
user ever sees is still generated with **no dimensional synthesis in its payload** —
`generate_from_knowledge` runs synthesis, but `runInitialGeneration` does not read it. Gaps and
dimensional summaries only reach a stack at refresh.

**What changed 2026-09-08 (shipped v2.7.0).** This task used to be one call: extraction and
generation in a single `conversation_ended` plan, so the user never saw what was taken from their
own words before it became strategy. The wait is now **split, not added to** — ~29.5s to the review
(measured on preview, a short document), then generation's ~19–37s after the user's decision. Step
10 is the pruning surface the blueprint used to be missing: one list, discard only. Editing was
deliberately not built — it only ever wrote `Fragment.title`, which no downstream stage reads.
`ExtractionConfirm` was deleted.

**Corrected 2026-09-11.** Steps 2–4 described a path that no longer runs: a *Generate strategy* CTA
behind `GenerationConfirmDialog`, posting to `/api/generate`. The chat now posts to `/api/extract`
with no confirmation (`GenerationAction` is `refresh | opportunities` only), and `/api/generate` is
called by nothing but the dev pipeline harness. Two further changes since:

- **The chat gets its own review** (2.8.1, `c4a992f`). Until then a chat's ground truths arrived with
  a toast and no review, while a document and a bundle beside it each got one. Reviews are now **per
  ingest**, keyed `chat:<id>`, and one deferral no longer silences the next ingest's review.
- **The button's promise and its result differ.** It says *Generate Strategy*; what it delivers is
  the review, with Build one decision later. Observation, not a ruling.

---

## Task 3 — Upload a document

*"Here's a doc, take it into account."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Selects file (≤10MB, allowed types) | `DocumentUploadDialog` |
| 2 | ▼ | **ADMIT** | `POST /documents/upload` — auth, size/type guards, project check | `documents/upload/route.ts:25-67` |
| 3 | ▼ | **COMMIT** | `Document(status:'pending')` → `'processing'` | `upload/route.ts:79-89` |
| 4 | ▼ | **ADMIT** | Returns immediately; work in `waitUntil` | `upload/route.ts:93` |
| 5 | ▲ | — | Row appears with a processing spinner | `/documents/[id]/status` polling |
| 6 | ▼ | **REASON** | Text extraction, then document extraction → 3–10 themes, each with a verbatim span and a self-reported `verbatim \| interpretation` type | `lib/extract-text.ts` · `lib/document-processing.ts` · `lib/evidence/parse.ts` |
| 7 | ▼ | **COMMIT** | `createFragmentsFromDocument` → `Fragment(contentType:'theme', documentId)` + `Evidence` rows in the same transaction; spans verified at ingest against the document text | `lib/fragments.ts` · `lib/evidence/verify.ts` |
| 8 | ▼ | **ADMIT** | `planPipeline('document_uploaded')` → **generation: null** | `pipeline/plan.ts:37` |
| 9 | ▼ | **GATHER** | Count fragments since `knowledgeUpdatedAt`; if **≥15**, escalate | `executor.ts:65-86` |
| 10 | ▼ | **REASON** | *(only if escalated)* background `updateAllSyntheses` + knowledge summary | `executor.ts:106-127` |
| 11 | ▲ | **REVEAL** | Document marked complete, *"N ground truths"*; counts rise; with a strategy, the sync line reads *"N added since"* | `ProjectClient.tsx` Documents card · `KnowledgeSummaryPanel` |
| 12 | ⛔ | **REVEAL** | *Pre-strategy only:* `presentIngestReview('document')` → `?mode=review&batch=doc:<id>` — the review of this document's ground truths, as task 2 steps 10–13. Uploaded from inside a deep dive, leaving the review hands back to that deep dive | `ProjectClient.tsx:392` · `GroundTruthReviewScreen.tsx` |

**Exposes.** *(disposition: `by-design` — accepted.)* ~~**No gate anywhere** — the only task with
zero.~~ **Corrected 2026-09-11:** pre-strategy, every upload now lands on its own review (step 12,
2.8.1). After a strategy exists there is still no gate and no review screen — the new ground truths
join the panel's list and the *changed* diff. The upload itself passes no gate on the way in either
way. ~~whether it triggers meaning-making depends
on an invisible counter~~ **Corrected 2026-08-29:** the threshold *is* surfaced — the panel shows
it, now worded *"updates in N"* (`KnowledgeSummaryPanel.tsx:379`). The residual is that `15` is
hardcoded there, duplicating `SUMMARY_FRAGMENT_THRESHOLD`. ~~Nothing tells the user
what was taken from their document~~ **Corrected 2026-09-09:** the ground truths a document
produced — and the spans they rest on — are now on the page, in the Knowledge Summary panel's
`GroundTruthReview`, and can be discarded there. What remains true is that the upload itself passes
no gate on the way in: the review is after the fact, not before it.

---

## Task 4 — Import a context bundle

*"I did the thinking elsewhere; here's the JSON."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Pastes/uploads bundle JSON | `ImportBundleDialog` / `ImportBundleCard` |
| 2 | ⛔ | — | **Confirmation gate** — preview of what will import | `ImportBundleDialog` |
| 3 | ▼ | **ADMIT** | `POST /import-bundle` — auth, project check, plan the import (`direct` vs transformed) | `import-bundle/route.ts` · `lib/import/plan.ts` |
| 4 | ▼ | **GATHER** | Transform bundle → themes, carrying the bundle's verbatim spans structurally rather than flattening them into `content`; tensions become `contentType:'tension'`; mint `importBatchId` | `lib/import/executor.ts` · `lib/import/transforms/context-bundle.ts` |
| 5 | ▼ | **COMMIT** | Create `Fragment(contentType:**'insight'** or `'tension'`, sourceType:'import', **no conversationId/documentId**, confidence: MEDIUM if tagged else LOW, `interpretationType` as reported) + `Evidence(sourceRole:'bundle')` | `lib/fragments.ts` |
| 6 | ▼ | **COMMIT** | Add bundle open-questions to `suggestedQuestions` | `import/executor.ts` |
| 7 | ▼ | **REASON** | Threshold escalation as Task 3 (a bundle usually clears 15 in one go) | `executor.ts` |
| 8 | ▲ | **REVEAL** | Ground truths + questions appear; the count reported is ground truths, not rows written — tensions are excluded because the review never shows them | `KnowledgeSummaryPanel` · `ground-truth/count.ts` |
| 9 | ⛔ | **REVEAL** | *Pre-strategy only:* closing the import dialog → `presentIngestReview('bundle')` → `?mode=review&batch=bundle:<importBatchId>`, as task 2 steps 10–13. (Before 2.8.1 *"Show me"* only closed the dialog) | `ProjectClient.tsx:1858` · `GroundTruthReviewScreen.tsx` |

**Exposes.** **No REASON phase of its own.** The bundle's contents are inserted verbatim as
fragments — the interpretation was done upstream, in the skill, outside this system. These
fragments carry **no source link at all** (no conversation, no document), and they are **roughly
half of all fragments in production**. Audit fork #4: this is how the margin claim entered as
Fragment 2, pre-formed. ~~*"because you said…"* is unbuildable for them~~ **Corrected 2026-09-09:**
a bundle now carries the user's own spans, so the quote is there. What cannot be done is *check*
it — the source conversation happened outside this app, so `verifySpan(text, null)` returns
`unverifiable`, which is a property of the ingest path and is deliberately not counted against the
fragment.

---

## Task 5 — Generate opportunities

*"Turn this strategy into things I could actually do."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Clicks **Draft opportunities** | `StrategyDisplay` → `setGenerationDialogAction('opportunities')` |
| 2 | ⛔ | — | **Confirmation gate** — cost/intent only. **Skipped entirely on a first run** (`isFirstTime` auto-confirms: nothing to lose) | `GenerationConfirmDialog.tsx:98` |
| 3 | ▼ | **GATHER** | Compute **coverage warnings** (`confidence === 'LOW' \|\| fragmentCount < 3`) — *after* the gate, and returned in the response, where **nothing reads them** | `generate-opportunities/route.ts:74-80,122` |
| 4 | ▼ | **ADMIT** | `planPipeline('generate_opportunities')` → synthesis ✓, generation `opportunities` | `pipeline/plan.ts:73` |
| 5 | ▼ | **REASON** | `updateAllSyntheses` (foreground for this trigger's plan) | `executor.ts` |
| 6 | ▼ | **GATHER** | Load fragments, synthesis **`summary` only**, current stack | `pipeline/generation.ts:499-528` |
| 7 | ▼ | **REASON** | Opportunity generation — **where fabricated numbers are born** (`8–15 hours`, `Target: 50%`) | `pipeline/generation.ts:484+` |
| 8 | ▼ | **COMMIT** | `captureSnapshot(pre_opportunities)` → `DecisionStackComponent(componentType:'opportunity')` → `captureSnapshot(post_opportunities)` | `generation.ts:560-566` |
| 9 | ▲ | **REVEAL** | Opportunity cards render | `OpportunitySection` |

**Exposes.** ~~**The only gate in the product that shows a quality signal** (coverage warnings) —
and it's advisory: you can proceed over it.~~ **Corrected 2026-09-11 — this was never true.** The
coverage warnings are computed by the route *after* the user has confirmed, returned in its
response (`coverageWarnings`, typed in `contracts/opportunity-generation.ts`), and rendered by
nothing: `GenerationConfirmDialog` has no coverage code in its entire history, and the client
discards the field. **No gate in the product shows a quality signal.** The 2026-08-29 blueprint
read the route and inferred the dialog. Step 7 is still the one place fabricated metrics appear, and
there is no gate after it. This is the altitude the review-pass primitive was actually built for.

---

## Task 6 — Explore Next → deep dive

*"You said I'm missing something. Let's go into it."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▼ | **GATHER** | Filter syntheses to `confidence === 'LOW' && gaps.length > 0`; take `gaps[0]` | `ExploreNextSection.tsx:116-124` |
| 2 | ▲ | **REVEAL** | Gap title + description render as an **action card** | `ExploreNextSection` |
| 3 | ▲ | — | Clicks it (or dismisses — `UserDismissal`) | `/api/dismissal` |
| 4 | ▼ | **COMMIT** | `DeepDive(topic, origin, status:'pending')` | `deep-dive/route.ts:67` |
| 5 | ▲ | — | Chat opens seeded with the topic | `DeepDiveSheet` → `chat-sheet.tsx` |
| 6 | ▼ | — | From here it is task 2's extraction path (`isInitial:false`, no generation) — or task 3's, for a document uploaded into the deep dive | `extract/route.ts` |
| 7 | ▲ | **REVEAL** | *Pre-strategy:* the ingest's own review first, carrying `&deepDive=<id>`; leaving it reopens the deep dive. *With a strategy:* straight back to the deep dive, which lists the chat or document but **none of its ground truths** | `ProjectClient.tsx:392` · `deep-dive-sheet.tsx` |

**Exposes.** **No gate between the model's gap and the user's click — still the shortest path from
an LLM output to a user action in the whole product.** (Step 7's review gates what the deep dive
*produces*, not the premise that started it.) A `gap` goes from model output to a card the user clicks with nothing in
between — no grounding check, no confidence display, no provenance. It is also the *only* place
`gaps` surfaces, which is why audit Finding 2 concentrates here: the invented premise
(*"builders profit from keeping estimates opaque"*) becomes a deep-dive topic the user is invited
to explore, which then generates more fragments *about the invented premise*.

---

## Task 7 — Prune the Knowledgebase

*"Some of this is wrong. Let me clean it up."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
*Rewritten 2026-09-11.* The Evidence sheet and `FragmentExplorer` are deleted; pruning happens in the
one list the knowledge panel renders, and the ground truths are on the page (`screen-map.md` §3.3).

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Opens the knowledgebase (`?mode=knowledge`) and expands the knowledge panel | `ProjectClient.tsx` · `KnowledgeSummaryPanel` |
| 2 | ▼ | **GATHER** | Load active ground truths with their evidence; filter in place by dimension, or to the *changed since vN* ids | `/api/project/[id]/fragments` · `GroundTruthReview` |
| 3 | ▲ | **REVEAL** | Ground truths grouped by dimension, interpretations first, each with the quote it rests on and its verification state. Rendering stamps `reviewedAt` | `GroundTruthReview` · `ground-truth/derive.ts` · `EvidenceQuote` |
| 4 | ▲ | — | Discards one — a single click, optimistic; a failed write puts it back; undo restores | `GroundTruthReview` |
| 5 | ▼ | **COMMIT** | `PATCH /fragments` → `status:'archived'`, `archivedAt`, `archivedReason:'ground_truth_review'` | `fragments/route.ts:177-227` |
| 6 | ▲ | **REVEAL** | Row moves to the Archived list; counts update | `GroundTruthReview` |
| 7 | ▼ | **GATHER** | On the next project read, the discarded id is in the latest snapshot's `fragmentIds` but no longer active → `removedIds` → `strategyIsStale` | `api/project/[id]/route.ts:308-322` |
| 8 | ▲ | **REVEAL** | Sync line reads *"1 discarded since"*; the *Changed since vN* chip includes it | `KnowledgeSummaryPanel` |
| 9 | ▼ | — | No re-synthesis, no `knowledgeUpdatedAt` bump, no regeneration — **by ruling**, see Dispositions | — |

**Exposes.** *(disposition: `accepted-debt`, **partly paid** — see Dispositions.)* The 2026-08-29
finding was that the one curation affordance in the product **had no downstream effect
whatsoever** — no re-synthesis, no staleness, no change to any output — and that this, not a lack of
appetite, explained why archive had been used on **a single fragment, once, across the entire user
base**: curating visibly did nothing, so nobody did it twice.

The COMMIT→REVEAL link it asked for now exists (steps 7–8): a discard marks the stack as behind its
knowledge and names the row. What deliberately does *not* exist is anything automatic after that —
the user decides whether a discard is worth a refresh. Whether visible consequence changes curation
behaviour is now measurable (`archivedReason = 'ground_truth_review'`) and not yet measured.

---

## Task 8 — Edit a card

*"That's not quite how I'd say it."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Clicks **edit** on the card's disclosure strip | `StrategyDisplay` · `FlipCard` |
| 2 | ▲ | — | Edits text inline, saves | `ObjectiveInlineEditor` / `ObjectiveEditor` |
| 3 | ▼ | **ADMIT** | `POST /strategy-version` — auth, project check, `validateStrategyVersionInput` (**the only contract validator called in production**) | `strategy-version/route.ts:112` |
| 4 | ▼ | **COMMIT** | `updateSingleton` (vision/strategy) or `updateComponent` (objective) → `DecisionStack` | `strategy-version/route.ts:117-126` |
| 5 | ▼ | **COMMIT** | Mirror the same change into `Trace.output` so the admin trace view stays truthful | `strategy-version/route.ts:128-165` |
| 6 | ▲ | **REVEAL** | Optimistic local update | `StrategyDisplay` `onUpdate` |
| 7 | ▼ | ⚠ **no snapshot** | No `captureSnapshot`. A user edit is **not** versioned, though every AI generation is | — |

**Exposes.** *(disposition: `accepted-debt` — needs change-bundling; nobody edits today.)* Asymmetry: the machine's changes are snapshotted and appear in version history; the
human's are not. The user's own words — the highest-value content in the system by the preflight
design's own argument — are the only changes with no history. Also: the route comment claims it
"creates StrategyVersion for audit"; that model does not exist.

---

## Task 9 — Fill in the template

*"I already have a strategy. Just record it."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Fills vision / strategy / objectives by hand | `/project/[id]/template` |
| 2 | ▼ | **ADMIT** | `POST /template-entry` — requires `statements.vision` | `template-entry/route.ts:60-62` |
| 3 | ▼ | **ADMIT** | `planPipeline('template_submitted')` → **extraction: null, generation: `template`** — no LLM | `pipeline/plan.ts:49` |
| 4 | ▼ | **COMMIT** | `runTemplateGeneration` → writes stack directly; `claudeThoughts: 'User-provided template entry'` | `executor.ts:137,240` |
| 5 | ▲ | **REVEAL** | Strategy renders immediately | `StrategyDisplay` |
| 6 | ▼ | **REASON** | *Background:* `extractFromTemplate` — reverse-extracts fragments **from** the user's own strategy | `executor.ts:140-152` |

**Exposes.** The control case: a full task with **no REASON phase on the critical path**. Also the
only place the arrow runs backwards — strategy → fragments instead of fragments → strategy (step
6). Worth knowing when reasoning about provenance: some fragments are *derived from* the output
they will later be used to justify.

---

## Task 10 — Share a stack

*"Send it to someone."*

| # | | phase | Step | Governed by |
|---|---|---|---|---|
| 1 | ▲ | — | Opens Share dialog | `StrategyDisplay` |
| 2 | ⛔ | — | **Confirmation gate** — "anyone with the link" is explicit | Share dialog |
| 3 | ▼ | **COMMIT** | Mint 192-bit `shareToken`; set `shareEnabled`, `sharedAt` | `share/route.ts` |
| 4 | ▲ | **REVEAL** | Link shown, copyable | Share dialog |
| 5 | ▼ | **GATHER** | Visitor: token → project → stack + components | `/share/[token]` |
| 6 | ▲ | **REVEAL** | Read-only stack — **no Knowledgebase, no gaps, no confidence** | `share/[token]/page.tsx` · `StrategyDisplay readOnly` |

**Exposes.** *(disposition: `cheap-win` — add a light provenance line.)* The sharpest framing of the confidence problem: an outside reader sees the polished
output with **none of the signals that say how well-founded it is**. No fragment count, no
dimensional coverage, no gaps. A strategy built on 7 fragments and one built on 60 are
indistinguishable to the recipient.

---


## Dispositions — ruled 2026-08-29

**Read this before "fixing" anything above.** Several weaknesses named in the blueprints are
deliberate. The disposition is the decision; the rationale is why.

### No quality gate between REASON and COMMIT — `by-design`
**Applies to:** all ten tasks.
**The commit IS the gate.** Showing the user everything that changed buys nothing when there is no
mechanism to adjust or reject it; **version history is the escape hatch**. Detailed review-and-adjust
steps and rollback are weeks of work for a need nobody has demonstrated. Fine for MVP.
**Revisit if:** users start asking what changed, or version history / rollback starts getting used.
**Spun off:** the change-summary cheap-win below.

### Post-run change summary — `cheap-win`
**Applies to:** tasks 1, 2, 5.
Everything needed is already captured (`delta`, pre/post snapshots) and thrown away. Surface one
line after a run: *"12 new fragments processed → 3 opportunities adjusted, 1 added."* Cheap because
it is display over existing data. Doubles as the natural place to tell the user **what to do next**.

### Archiving a fragment has no downstream effect — `accepted-debt`
**Applies to:** task 7.
**Do NOT wire archive → staleness → auto-regenerate.** Regeneration is expensive in both tokens and
the user's time and attention; a few archived fragments must not trigger it.
The real issue is broader: **users are never told how to improve their strategy** — prune context,
confirm ground truths, have another conversation, upload more. Archive-with-no-effect is one symptom
of that missing guidance layer.
**Folds into:** the "how to improve your strategy" theme (with the confidence-score work). Deferred
until that is designed; do not solve it locally.
**Partly paid, 2026-09-08 → 09-10 — within the ruling, not against it.** A discard now reaches
staleness (`removedIds` → `strategyIsStale`) and is named in the *changed* diff; nothing regenerates.
The remaining half is exactly the theme this folds into: the **guidance register**
(`docs/_plans/2026-09-10-navigation-and-guidance-map-design.md` §6), whose row 4 — *"my stack is
behind my knowledge"* — is this signal turned into a prompt. Signal shipped, prompt not built.

### First strategy generated with no synthesis — `by-design`
**Applies to:** task 2.
Documented in `intelligence-pipeline-v2.md` §6, **2026-02-16**: synthesis was firing per-caller,
producing "up to 5 knowledge summaries in 2 minutes". The 15-fragment threshold is deliberate
debouncing, and the entry states plainly that *"single conversation (~5 frags) doesn't trigger
alone."*
**Caveat for the record:** the rationale was **cost**, not first-run quality. That the first
strategy a user ever sees is the least-grounded output the product produces was a side-effect, not
a weighed trade. Worth re-testing once the invention work lands — but it is not an accidental gap.

### `ExtractionConfirm` reachable only from a failed-generation `catch` — ~~`open`~~ → **RESOLVED: deleted**
**Applies to:** task 2.
Separate from the synthesis decision. It is either revived (a "here's what I understood" step) or
deleted. Leaving a component alive on one error path is the pattern that produced the dead fields.

### User edits not snapshotted — `accepted-debt`
**Applies to:** task 8.
Not as simple as adding one `captureSnapshot` call: if a user edits ten things, ten snapshots is the
wrong answer. Needs a **change-bundling** design (debounce, session-scoped, or explicit save).
Low urgency — **almost nobody edits anything today**.
**Revisit if:** edit volume rises, or bundling is solved for another reason.

### Shared stack carries no confidence signal — `cheap-win`
**Applies to:** task 10.
Add a light provenance line (built from N inputs, last updated X) without exposing the Knowledgebase.

### `gaps` open on a premise rather than naming an absence — `by-design`
**Applies to:** task 6; audit Finding 2.
A gap with no context is useless — *"what's the unit economics?"* needs the setup to land, and in
the UI a gap **is** a deep-dive question, an invitation for the user to supply more context. The
premise is what makes it land. Verified against the captures: most premises are faithful.

| premise | grounded in fragments? |
|---|---|
| "If architect, builder, and homeowner are all potential payers…" | ✅ |
| "If the original consumer self-service vision is abandoned…" | ✅ |
| "If installation is a key friction point…" | ✅ |
| "If builders deliberately keep joinery estimates opaque to protect margin…" | ❌ invented |

The earlier "48% assert rather than name an absence" framing was **wrong** — it counted the form,
not the fault. Premise-form is fine; the residue is sourcing (below).

### Gap titles instructed to be "punchy, attention-grabbing" — `by-design`
**Applies to:** audit Finding 2.
Gaps surface as deep-dive questions; they must be pithy and meaningful or they get ignored and the
gap never closes. **Punchy and honest are demonstrably compatible** — from the same capture set:
*"Cost to serve is a blank"* · *"Nobody has checked what competitors charge"* · *"No read on the
custom cabinet makers"*. Against one that is punchy and asserts an invention as settled:
*"How do we overcome builder margin protection behavior?"* Punchiness is not what separates them.

### Nothing requires a gap's premise to be traceable — `accepted-debt`
**Applies to:** task 6; audit Finding 2.
The one real residue. A grounded premise and an invented one are typographically identical on the
card. The fix is narrow — a line requiring a gap to condition only on something present in the
fragments.

**⚠ Measured 2026-08-29 — the prerequisite is done and the hypothesis was falsified.** This was
deferred on the theory that removing the four unread fields would narrow the ask and might reduce
premise invention on its own. A/B on the A-control captures (10 dimensions × 2 repeats × 2 arms,
field set the only variable) says otherwise:

| metric | BEFORE (7 outputs) | AFTER (3 outputs) |
|---|---|---|
| motive asserted in gaps | **3** | **3** |
| "margin" in gaps | 8 | 9 |
| total gaps | 76 | **87 (+14%)** |
| output tokens | 24,276 | 20,303 (−16%) |

Invention is unchanged, and **gap volume rose 14%** — removing outputs appears to redistribute
effort into the ones that remain, and what remains is the field that reaches the user as an action.

**This is now unblocked and un-self-resolved.** Needs its own ruling. Note the balloon-squeeze when
considering any further removal: narrowing the ask does not reduce what the model makes up, it
relocates where it puts it.

### Deep-dive card has no grounding check — `accepted-debt`
**Applies to:** task 6.
The deep-dive question is an invitation for the user to supply context; that conversation becomes
fragments later. A wrong premise gets corrected by the user in the conversation it provokes. Not a
quality issue in itself.
**Revisit if:** premise invention proves not to self-correct once the dead fields are removed.

### `keyQuotes`, `contradictions`, `subdimensions` — `fix`
**Applies to:** audit Finding 1.
Remove from the prompt, the parser, `SynthesisResult` and the schema. **26.5% of `full_synthesis`
output** with zero consumers anywhere — removal cannot regress a caller because there are none.
Also the prerequisite for the `gaps` sourcing question: it narrows the ask first, so any later
instruction is measured against a cleaner baseline.
**Sequenced first** of the code changes.

### `keyThemes` — `investigate`
**Applies to:** audit Finding 1.
Not a free removal: it is re-injected into the incremental synthesis prompt, so it is the
dimension's **memory** across updates. It is also the plausible mechanism by which an invented
theme, once emitted, persists into every subsequent synthesis of that dimension — a candidate
explanation for the margin motive re-deriving itself in 3 of 4 arms.
**Investigate before deciding:** does removing it from the incremental prompt reduce persistence of
invented themes, and at what cost to continuity? Behaviour change, not cleanup.

### Incremental synthesis destroys `keyQuotes` / `contradictions` — `investigate`
**Applies to:** audit Finding 1.
The prompt asks for *"existing + new"* and the payload never passes the existing ones; the result
overwrites the stored values. **Bundled with the `keyThemes` investigation** — the two share the
same prompt/payload seam, and the right fix depends on what that investigation shows about whether
carry-forward memory helps or harms. Decision deferred until then.
**Note:** if the three dead fields are removed first, this defect disappears for `keyQuotes` and
`contradictions` regardless — but the *shape* of the bug (asking for state you never supply) is
what the investigation should check for elsewhere.

### Contracts — `defer for systematic analysis`
**Applies to:** audit Finding 3.
Likely lands on *wire the validators in at the seams they name*, but **do not patch what happened
to surface here**. The findings (5 of 6 validators uncalled; no `DimensionalSynthesis` contract;
`FragmentContract` asserting `contentType:'theme'` while roughly half of production fragments are `insight`;
`strategy-version` named for a model deleted after 2026-02-15) are symptoms of one unexamined
question: **what are contracts for in this codebase, and where should they bind?**
Deserves its own pass across every boundary, not a fix-the-three-we-noticed.

### Full-vs-incremental synthesis fork is invisible — `investigate`
**Applies to:** task 1 step 9.
`<5 fragments → full synthesis` routes the thinnest projects down the highest-amplification path,
and nothing surfaces which path a dimension took. Not to be ruled flippantly — the four rules
interact with the invention work. Investigate alongside the `keyThemes` question.

### Document upload has no gates — `by-design`
**Applies to:** task 3. Accepted. Uploading is a low-stakes additive act; a gate would be friction
for no decision.

### The 15-fragment threshold — `resolved, not a finding`
**Applies to:** task 3.
**The blueprint was wrong.** The count *and* the threshold are both shown:
`KnowledgeSummaryPanel.tsx:379` renders it (worded *"updates in N"* since 2026-09). Blueprint
corrected.
**Residual (minor):** `15` is hardcoded in the component, duplicating `SUMMARY_FRAGMENT_THRESHOLD`
in `executor.ts:100`. Change the threshold and the UI lies. `cheap-win` when next in that file —
still open 2026-09-11.

### Bundle `insight` fragments carry no source link — `investigate`
**Applies to:** task 4.
A quick win in principle, but the fix probably belongs in the **plug-in / skill** that produces the
bundle, not in the app — the source material never crosses the boundary today. Investigate what the
skill can carry before designing the app side. 50% of prod fragments are affected.

### Coverage warning is advisory only — `accepted-debt` → ⚠ **re-open: the premise was false**
**Applies to:** task 5. Trivial. Accepted.
**Corrected 2026-09-11.** This ruled on a warning the user could proceed over. There is no such
warning: `coverageWarnings` is computed after the confirm, returned in the response, and rendered by
nothing — and a first run skips the dialog altogether. "Advisory" was generous; it is **invisible**.
The ruling was made on a misreading, so it needs making again: surface the warning in the dialog
(which a first run never shows), or delete the computation and the contract field.

### Fabricated numbers born at `opportunity_generation` — `investigate`
**Applies to:** task 5.
The `8–15 hours` / `Target: 50%` class appears **only** at this stage — not in extraction, not in
synthesis. Distinct mechanism from the `gaps` premise problem and unexamined. Investigate.

### Reverse extraction: template strategy → fragments — `investigate`
**Applies to:** task 9.
Some fragments are derived from the output they will later be used to justify. Provenance
implications unexamined.

### Zero-reader schema fields — `defer to a separate activity`
**Applies to:** audit Finding 4.
Probably delete — the 10-field abandoned review workflow (`reviewedAt`, `reviewedBy`,
`errorCategories`, `openCodingNotes`, `feedbackAt` on `Trace` — and, until it was dropped in
`caab4db`, on `ExtractionRun`; see `retired-extraction-run.md`),
`Fragment.softDeletedAt`/~~`archivedReason`~~ (**corrected 2026-09-09:** `archivedReason` is now
written — `'ground_truth_review'` on a discard — though still read by nothing),
`FragmentDimensionTag.subdimension`/`taggedAt`,
`DimensionalSynthesis.synthesisVersion`. **But it is a schema change**, and the schema is a
protected boundary requiring migrations applied per environment. Do it as its own careful activity,
not as a side-effect of this work. Verify `User.emailVerified` against NextAuth before touching it.

### Documentation corrections — `done 2026-08-29`
**Applies to:** audit Finding 5.
`intelligence-pipeline-v2.md` bumped to **v2.1**: ERD now shows `DecisionStack` /
`DecisionStackComponent` / `DecisionStackSnapshot`; §4 drops the removed "Key Themes (Strategy
Page)" surface and marks which synthesis fields are actually read; §5 names the real prompt
constants, adds the missing opportunity-generation and incremental-synthesis stages, and points at
`LLM_POLICY` (26 contexts) as authoritative. Decision-log entry added.
`ARCHITECTURE.md` (**2026-08-29**): §Data Contracts now carries a warning that contracts are
type-level only, with the three observed consequences.

---

### Still `open`
~~Nothing.~~ **One, as of 2026-09-11:** the coverage warning (task 5) — its ruling rested on a
warning that never rendered, so it is back to `open`. Everything else called out in the blueprints
and the audit has been ruled — see the register above. ~~`ExtractionConfirm` (task 2) is the one item still tagged `open`~~ —
**resolved 2026-09-08: deleted.** The ground-truth review superseded it on the happy path;
rather than revive a second surface doing the same job, it went. See
`retired-extraction-run.md`. Original wording: it is either
revived or deleted, and that is a small product call rather than an investigation.

## What the phase view shows across all ten

| observation | tasks affected |
|---|---|
| **COMMIT without REVEAL** — the system records something it never shows | 1 (output delta + snapshots), 5 (coverage warnings), 8 (no snapshot) — ~~7~~ |
| **No gate at all** | 6, 7, 8, 9 — and 3 once a strategy exists |
| **Gate exists but gates cost/intent, not quality** | 1, 4, 5 (not on a first run), 10 |
| **Gate reviews the model's input before it is used** | 2, and 3 / 4 / 6's ingests — **pre-strategy only** |
| **Gate shows a quality signal** | **none** — ~~5~~, corrected 2026-09-11 |
| **REASON with no user-visible input review** | 1, 5, and 3 / 4 / 6 once a strategy exists |
| **No REASON on the critical path** | 9 (template), 10 (share) |

**Corrected 2026-09-09 (v2.7.0).** Task 2 now has one: the ground-truth review sits between
extraction and generation, and it is the only place in the product where a user sees a model's
input before it is used. It reviews the *input* to generation, not generation's output — so
conclusion 1 below still stands for every task, task 2 included.

**Corrected 2026-09-11 (2.8.1).** The review is now **per ingest** — every document, bundle and chat
gets its own — but only **before a strategy exists**. After that, new context reaches the next
refresh with no review screen, visible only as a row in the *changed* diff. The asymmetry is
deliberate (the review is framed for first contact, Build is its primary exit) and it is the gap the
guidance register's rows 4 and 6 are aimed at.

Three structural conclusions:

1. **There is no quality gate anywhere between REASON and COMMIT.** ~~Task 5's warning is
   pre-REASON and advisory.~~ Task 5's warning is never shown (corrected 2026-09-11). Once the model
   has produced, nothing stands between output and store.
2. **REVEAL is systematically thinner than COMMIT.** Six of ten tasks record more than they show.
   That gap is where every "the product feels opaque" symptom lives, and it is mostly *display*
   work on data already captured — not new architecture.
   *2026-09-11:* **largely paid off on the input side** — the Evidence layer puts the spans on the
   page, the per-ingest review shows what each ingest produced, and the *changed* diff shows what a
   stack is behind. Still unpaid: the output side (what a refresh changed, task 1 step 21) and
   anything after a strategy exists. The remaining display work is enumerated as the guidance
   register, design §6 rows 4–8.
3. ~~**Task 7 is the cheapest high-value fix in the set.** The curation loop is built, shipped, and
   inert. Wiring archive → re-synthesis → staleness would make an existing surface real, and it is
   a far smaller change than any new adjudication UI.~~ **Done in the form the ruling allowed**
   (2026-09-08 → 09-10): archive → staleness → a named row in the diff, with no re-synthesis. See
   task 7.

## On the "retrospective PRD" question

Agreed it would be waste. A PRD argues for a decision that has already been made; this argues for
nothing. The distinction worth holding: **these blueprints are descriptive, not normative.** They
say what the system does today, accurately, so that the next change starts from fact instead of
from the architecture doc's stale ERD.

Two properties to keep, or they rot like the ERD did:

1. **Every row names the code that governs it.** A blueprint that drifts from the code is worse
   than none, and naming the file makes drift checkable.
2. **The ▲/▼ split is the point.** The interesting findings above all live at a lane boundary —
   step 20's missing gate, step 9's invisible fork, step 3 gating cost but not quality. A flat
   sequence diagram would have hidden all three.
