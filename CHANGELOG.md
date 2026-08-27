# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.6.0] - 2026-08-27

### Documented — the Generate Strategy CTA is green on purpose (2026-08-27)

The "Generate Strategy" button has carried a hardcoded `bg-green-600` since v1.4.2 — the
only green in a mulberry product. The 2026-04-02 preview UAT filed it as a FAIL ("green
instead of mulberry primary") and left it "investigating". Tonight's UAT hit it again, we
changed it to the `bg-primary` token, and looking at it on preview immediately showed why
it was green in the first place.

The button renders inside the chat transcript, where user messages are
`bg-primary text-primary-foreground`. In the token colour, the most important action in the
whole flow is the same colour as a user's own chat bubble — so it reads as part of the
conversation rather than as a control. Being the one thing in that column that is NOT
bubble-coloured is exactly what makes it legible as a button.

Reverted to green and the reason is now written at the call site, so it does not get
"fixed" a third time. Guarded by `cta-colour-tokens.test.ts`: no `<Button>` may carry a
hardcoded Tailwind palette background except the entries in a shrinking ALLOW set, each
carrying its reason. Two entries — this button, and the guest-banner "Create Account" CTA
whose orange sits inside a deliberate amber warning Alert.

The lesson is about the record, not the colour: "investigating" in a UAT is not a finding.
Had the original note named the constraint instead of the symptom, five months and two
sessions would not have gone into rediscovering it.

### Changed — edit moved onto the card disclosure strip (2026-08-27)

Editing a card meant pressing "See the thinking" and then pressing Edit on the back.
Backwards: editing is a front-face intent, and the flip exists for reading the reasoning,
not for acting on it. Edit now sits on the strip beside the disclosure label, one press
from either face.

The strip was a single `<button>`, so the edit control is a SIBLING of the flip control —
a button cannot nest inside a button — absolutely positioned so the page dots stay
optically centred. The dots are the only which-of-two signal on the card and must not
shift on every card that happens to allow editing. Edit carries its own hover chip so
hovering it reads as "edit" rather than as the strip previewing a flip it will not do.

FlipCard now owns the affordance instead of each caller rendering its own copy: the
`hideEditButton` prop is gone (every caller passed it, so FlipCard's built-in button was
dead code) and five duplicated Edit buttons collapsed into one. Net −20 lines with the
feature added. Read-only stacks are guarded by the presence of `onEditClick` rather than
by a `!readOnly` check inside each back face, so a caller cannot forget it.

Opportunity cards keep Delete on the back. A destructive action belongs one level deeper
than a corrective one, and promoting both would make deletion a peer of editing.

### Fixed — raw XML no longer leaks into generated prose (2026-08-27)

Found in the preview UAT of this branch: an objective rendered on the card front as
"…where we are going.`</explanation>`". The model emitted a stray, unmatched
`</explanation>` immediately before the true `</statement>`; `extractXML`'s strict
`<tag>(.*?)</tag>` match SUCCEEDED and returned the inner text verbatim, so the markup was
persisted into `objective` and `pithy` and shown to the user. Silent — no exception, no
warning, and the full 508-test suite passed with it live.

Third variant in a family: mis-closed tag (26 Aug) and missing `<objectives>` wrapper
(27 Aug) both make the strict match FAIL, so the tolerant recovery path caught them. This
one corrupts a match that succeeds, which is why the existing net missed it.

`extractXML` now drops closing tags with no matching opening tag inside the captured span,
and warns when it does. Legitimately nested markup survives — `extractObjectivesXML` reads
`<objective>` blocks out of an extracted `<objectives>` region. Fixed at the parser rather
than by leaning on prompt shape, same call as the objectives-parse fix.

Not a regression of this branch — `extractXML`'s strict path predates it — but unmasked by
it: before the objectives-parse fix, objective statements never persisted, so the leak had
no surface. Scanned before shipping: 0 leaks across 95 production stacks and 308 production
objectives, so no backfill is needed.

### Added — prompt caching on the six prose stages (2026-08-27)

Each stage's static prompt (task framing + output format) now lives in `prompts/stages/`
and is sent as its `system` block, byte-identical on every call, marked
`cache_control: {type:'ephemeral'}`. Call sites assemble only the variable payload.

Measured with `count_tokens`, system-only: `strategy_generation` 3365, `refresh_strategy_generation`
3226, `opportunity_generation` 2009, `knowledge_summary` 1935, `full_synthesis` 1858,
`incremental_synthesis` 1664 — all clear of Anthropic's 1024 floor. `refresh_strategy_summary`
and `reflective_summary_prescriptive` measure 835 and are deliberately left uncached.

On `full_synthesis` — 61% of workload cost, 10–21 calls per generation — the prefix is
written once and read 9–20 times at 0.1×: **~78% off the static half** of that stage.

**Verified hitting, not assumed.** All six write on the first call and read on the second.
That check exists because a cache that never hits is invisible from output — same text, same
latency profile, quietly full price — so `cached` / `cacheWriteTokens` / `cacheReadTokens`
ship on `llm_token_usage` alongside the feature rather than after it.

Two ratchets: a cacheable stage must carry a checked-in `count_tokens` measurement (an
estimate cannot back the flag), and its block cannot drift >5% without a re-measure.

A separate finding from the same work: splitting the prompt this way also **fixed**
`strategy_generation`'s objectives parse, below — the format spec now sits in a fixed
position rather than after a variable-length payload.

### Fixed — strategy generation was persisting ZERO objectives (2026-08-27)

Both initial and refresh generation parsed objectives through
`extractXML(statementsXML, 'objectives')`. Models routinely emit bare `<objective>`
siblings directly under `<statements>`, with **no `<objectives>` wrapper at all** — so that
returned empty, `isOKRFormat` went false, the legacy branch split an empty string, and the
Decision Stack persisted with an empty objectives layer while three to five complete
objectives sat in the response. No exception, no truncation, `stop_reason: end_turn`.

Measured on the shipped prompt: **0 of 16 responses parsed**, across BOTH `claude-opus-5`
@ `effort:low` and `claude-sonnet-4-5` — so not a property of the 2026-08-26 model bump,
and older than it.

Invisible to every previous measurement because they all scored the TEXT, not the parse: a
flat grep for `<objective>` finds the blocks wherever they sit, and a human reading raw XML
counts them fine. Only the nested parse sees none. This is why the CHANGELOG above records
strategy generation producing four objectives and then three — those observations were real,
and the objectives still never reached the database.

`extractObjectivesXML()` recovers the unwrapped shape. Against the real captured failures:
0/16 → 15/16, with correctly-wrapped responses unchanged. The remaining one omitted the
`<objective>` wrappers too; recovering that would mean inferring where each objective
begins, which fabricates commitments rather than reading them, so it is deliberately left
to the fallback and pinned by a test.

Sibling of the 2026-08-26 mis-closed-tag recovery and the synthesis JSON control-character
fix: three instances of the same family — malformed model output that degrades silently
instead of failing.

### Changed — voice is governed at the LLM call seam, not at 26 call sites (2026-08-27)

⚠ **Not yet measured against the voice harness. Do not release before Phase 1 findings.**

Language and voice guidance used to be pasted into prompt strings by hand. It reached 5 sites;
there are 26. A stage was governed only if its author remembered the guidance existed, and
nothing told them when they forgot — which is how `incremental-synthesis.ts` shipped
unconstrained, above.

Guidance now lives in one exhaustive stage table (`src/lib/llm/policy.ts`) and is injected as the
`system` block by `createMessage()`. **Call sites cannot pass `model`, `max_tokens` or `system`**
— those are stage decisions. That last one is the guarantee: there is no call-site expression
that produces an ungoverned request.

Two stages gain guidance for the first time: `refresh_strategy_summary` (which sat twenty lines
below governed refresh generation, in the same file, writing user-facing prose, carrying nothing)
and `reflective_summary_prescriptive` (Luna's Thinking tab).

Titleless prose summaries get their own `summary` bundle (explainer + voice, no title rules).
They started on `question-gap`, which handed `refresh_strategy_summary` 334 tokens of
interrogative-**title** rules against a 300-token output budget — telling a stage at length how to
write something it does not emit. Caught at the Phase 1 gate before it was baselined.

Conversational stages are classified onto an explicitly **empty** `chat` bundle, with the reason
recorded in code. The voice constraint was measured on prose artefacts, not on 30–300 token chat
turns; filling that slot needs its own A/B. Classified, not forgotten.

The enforcement changed shape too. The old ratchet listed four filenames and had never been
updated with `incremental-synthesis.ts` — the very file whose omission proved a list was the
wrong tool. The replacement iterates the policy table, so a stage is covered the moment it is
classified, and the type system already forces classification: an unclassified context is a
compile error, and so is a stage missing from the table.

### Added — prompt provenance on every LLM call (2026-08-27)

`promptHash` — sha256 of the resolved system block plus user content, first 16 hex chars —
stamped on `llm_token_usage` and on the local capture record. Answers "which prompt produced this
output" for all 20 stages. Because guidance is part of the system block, the hash moves when the
guidance moves, so a prompt change becomes visible in the cost data. Carries no user content.

Inherits the existing `llm_token_usage` coverage gap (10 of 26 sites pass no `userId`) —
documented in `docs/analytics/events.md` rather than quietly accepted.

### Removed — the versioned prompt registry, and four orphaned LLM call sites (2026-08-27)

The registry never had a consumer. It arrived as item 4 of 4 in a latency plan that specified
`scripts/backtest.ts` and `scripts/eval-report.ts`; neither was ever created, on any branch. At
retirement it had 1 adopter across 26 call sites, 3 dead versions, an entry flagged `current:
true` that was never called, and metadata read only by a module with zero importers.

Recovery tag `prompt-registry-final`; tombstone at
`docs/architecture/retired-prompt-registry.md`.

Deleted alongside it: `src/lib/extraction/v1/`, `src/lib/generation/v1/`, `src/lib/evaluation/`,
and `analyzeDimensionalCoverage()` — all without importers. `dimensional_analysis` is no longer a
stage. Removing the duplicate `strategy_generation` path made the refactor materially less risky.

Also removed 13 tests that asserted locally-defined literals and never called production code.

### Fixed — incremental synthesis was generating unconstrained prose (2026-08-27)

`update-synthesis.ts` chooses between `fullSynthesis` and `incrementalSynthesis`. Only the full
path carried the language and voice guidance. Both write the same user-facing `summary` and the
same `gaps[].title`, and full synthesis only runs when there is no existing summary, the synthesis
is 30+ days stale, or the fragment heuristic trips — so **for an established project the
incremental path is the common one**, and it was unconstrained.

Found by pricing the constraint rather than by a test: the ratchet added with it checks a
hard-coded list of four files, so a fifth prose stage was invisible to it. It was an inventory,
not an invariant.

### Removed — the "vary sentence length" rule (2026-08-27)

Cut from `VOICE_CONSTRAINT`. It did not work: sentence-length variance **fell in 7 of 10**
measured comparisons, the opposite of what the rule asked for. Most likely it was fighting the
em-dash rule, which removes exactly the long compound sentences that produced the variance.

It was also the wrong rule for this surface. Rhythm is a longform concern; almost every field
Lunastak generates is a few sentences at most, so the rule was paying tokens on every prose call
to ask for something the artefact has no room to express. A note in `voice.ts` records why, so it
does not get added back on intuition.

**Objectives, 4 → 3: accepted, not a regression.** The earlier pass flagged strategy generating
three objectives where it had generated four. Reviewed and kept — less is more, and a tighter
stack is the better artefact.

### Changed — question and gap titles get their own rules; thematic leads restored (2026-08-27)

Refinement of the voice constraint after reading the full before/after across all four prose
stages and both ingest paths (`voice-constraint-ab/` beside the model-bump experiment).

**Question and gap titles were taking the wrong rule.** `PLAIN_LANGUAGE_TITLE_GUIDANCE` was
applied wholesale to `suggested_questions` and synthesis `gaps`. It asks *"does it start with a
verb or an outcome?"*, which is right for a commitment and wrong for a question — it converted
`What would kill this fastest?` into `Test the smallest version first`, and
`Who actually screws the kitchen to the wall?` into `Decide who installs the kitchen`. Titles
also grew from 21–33 to 31–43 chars, costing the scannability that is a title's whole job.

New `QUESTION_TITLE_GUIDANCE` (`prompts/shared/question-titles.ts`) scopes the rule: stay
interrogative, six words or fewer, and explicitly **do not** open with a verb or an outcome.
Re-measured — 20 of 20 gap titles are questions again, question titles are back to 21–35 chars,
and the richer descriptions the voice constraint produced are kept. That was the point: the
before/after choice was a false one once the cause was found.

**Thematic leads restored to the knowledge summary.** The summary used to structure itself with
short bold leads (`**The problem you've zeroed in on.**`) and lost them when the inline guidance
was replaced. They are prompted back as a *shape*, not a fixed set — the model names the themes
the material actually has. Re-measured: bundle-import produced "The problem you've zeroed in
on. / Your answer, sketched. / What you've deliberately left open. / The tensions you've already
named."; doc-upload produced a different, equally apt set.

**Cost.** Dropping the title guidance from `full_synthesis` also trims the prompt on the stage
that runs ten times per generation, where it had more than doubled.

Em-dashes stayed at zero across all six re-run stages. Ratchet extended: the question/gap prompts
must not import `PLAIN_LANGUAGE_TITLE_GUIDANCE`, and must interpolate `QUESTION_TITLE_GUIDANCE`.
Verified to fail on reintroduction.

### Added — a voice constraint on generated prose (2026-08-27)

Every prompt that generates prose now carries `VOICE_CONSTRAINT`
(`prompts/shared/voice.ts`). It targets **cadence**, which is a different category from the
vocabulary rules in `plain-language.ts`, and both now apply.

**Why this was missing.** The model-bump experiment measured the Claude-ish register as a
*constant* across all four model arms: em-dash density 10.9–15.4 per 1k words, comparable
rule-of-three and sentence-length variance. Constant across models means it is a property of the
prompt layer. Everything that had shipped on language targeted jargon ("paradox", "wallet
share"); nothing anywhere constrained voice. Vision and Strategy carried no language rule at all,
deliberately, on a rationale about jargon that was never a decision about tone — and they are the
artefacts where the voice read worst. They are not exempt from this one.

Named tics, each with a rewrite pair: em-dash asides, the rule of three, balanced "not X, but Y"
and "either X or Y" framing, sentimental closers, hedges, abstract nouns doing a verb's job, and
uniform sentence length.

**Measured, not argued.** The shipping arm's captured `strategy_generation` and
`opportunity_generation` requests were re-sent with the same model, effort, `max_tokens` and
input, changing only the prompt (two independent runs):

| | before | after |
|---|---|---|
| em-dashes per 1k words | 14.0 (13 total) | **0.0 (0 total)** |
| "not X, but Y" | 1 | 0 |
| sentence-length sd | 11.3 | 10.2–12.0 |
| rule-of-three | 5 | 5–6 |

Em-dashes went to zero on both runs and output quality held. **The rule of three did not
move** — and on reading, the remaining matches are genuine enumerations of three real parties
("the architect, the builder and the homeowner"), not rhetorical triads, which did drop. The
regex cannot tell the two apart, so that row is not evidence either way.

Cost: ~+600 input tokens per generation call. Latency unchanged.

**Also fixed: two drifted copy-pastes.** `knowledge-summary.ts` and `synthesis/full-synthesis.ts`
each carried an inlined, shortened paraphrase of the plain-language guidance instead of importing
it. Both now import the shared constants, so the guidance has one definition again.
### Changed — the card explainers got an affordance (2026-08-27)

The best prose in a Decision Stack lives on the back of each card, and nothing on the front
ever said so. The whole card was the button, so no part of it looked like one, and the back
was labelled **"Explainer"** — a word naming the mechanism rather than promising anything
worth reading.

Every card (vision, strategy, objective, opportunity, principle) now ends in a **cordoned
disclosure strip**, full-bleed to the card edges. **The strip is the only click target** — the
card surface is no longer a button, which also means the prose can finally be selected and
copied.

Three signals do the work, each carrying something the others do not:

- **The label names the destination, with a verb.** `See the thinking` on the front,
  `Back to the vision` (`…the strategy`, `…the objective`, …) on the back. A bare noun was
  tried and failed: `The vision` on the back reads as a *caption for the face you are already
  looking at*, which is the exact opposite of an invitation.
- **Colour is the state.** The back sits a step lighter than the front, so you can never be
  unsure which face you are on — and the strip's hover **previews the destination's colour**:
  light from the dark front, dark from the lighter back.
- **Dots say which of two.** `●○` / `○●`, centred under the label. Filled vs hollow, so the
  signal is shape rather than a dimmed tint.

The strip is **not** neon. Neon is the heading colour, and a neon strip competed with the very
headings it sits under. It steps down by **size and weight only** — full-strength white at
12px medium — because greying text out to signal hierarchy is a house no.

A rotate icon was tried and **removed**: once colour carries state and the label names the
destination, a glyph is a third signal saying nothing the other two do not.

Consequences worth knowing:

- **`FlipCard` now owns the card shell** (background, radius, shadow, padding via a `size`
  token). Chrome used to be duplicated inside every `front`/`back` node at each call site,
  which is why the strip could not be full-bleed until it moved. All five call sites pass
  content only.
- **Backs carry their card's identity, where identity is ambiguous.** A flipped card used to
  render an anonymous paragraph — in the objectives grid you could not tell which objective
  you were reading while its siblings still showed their numbers. Objectives repeat number +
  title, opportunities the title, principles the priority. **Vision and Strategy do not**: the
  strip already names the layer, so a heading there was pure repetition.
- **Card height still tracks the visible face**, so a flip inside a grid reflows its row.
  Deliberate: sizing every card to its taller face costs more whitespace than the jump costs
  in stability.

### Removed — the second flip component, which was dead (2026-08-27)

`src/components/ObjectiveCard.tsx` was **orphaned** — nothing imported it — and it was the
only consumer of `src/components/ui/flip-card.tsx`. Both deleted; git history is the archive.

That dead pair is where the mobile story was worst: `ui/flip-card.tsx` flipped on
`onMouseEnter`/`onMouseLeave` (no hover on touch) and pinned cards to a fixed `h-80`, clipping
long explainers. None of it ever reached a user.

How it got there: the 2026-03-26 Decision Stack rendering design introduced
`components/FlipCard.tsx` as "the shared component used by all stack layers", but its
files-affected list never named `ObjectiveCard.tsx`, so that one card was left behind on the
December 2025 component and the duplication went unnoticed for five months. The crossfade
itself was deliberate and stays.

### Added — `card_thinking_viewed` (2026-08-27)

Flips were **completely uninstrumented**, so the discovery rate for this prose has never been
known. The strip now fires `card_thinking_viewed` on the reveal only (flipping back is not a
second read), with the stack layer as `value`. Catalogued in `docs/analytics/events.md`.

**There is no before-number.** This measures the new affordance, not the improvement over the
old one — that comparison is unavailable and will stay unavailable.


### Fixed — model provenance recorded the plan's model, not the model that answered (2026-08-27)

`pipeline/generation.ts` recorded `modelUsed: model` at **six** sites, where `model` is a
parameter carrying `CLAUDE_MODEL` down from `planPipeline()`. The model that actually serves a
request is resolved per stage inside `createMessage()`, so the plan's value is only ever the
*intended* model. Result: `Trace` and `DecisionStackSnapshot` rows named the wrong model.

Caught by a deployed-preview smoke — the trace said `claude-sonnet-5` while `claude-opus-5` had
served the request (proved by output tokens and latency matching the measured Opus-low profile,
not Sonnet 5's). All six now record `<response>.model`.

**The ratchet that should have caught this is also fixed.** The previous version forbade the
literal `modelUsed: CLAUDE_MODEL`; these six spelled the same bug as `modelUsed: model` and
sailed past. It now checks the **property** — `modelUsed` must be assigned from something ending
in `.model`, an explicit non-LLM marker, or a checked pass-through — rather than blacklisting a
name. Verified to fail on reintroduction.

This is the provenance any future model comparison depends on, and it would have poisoned it
silently.


### Consolidation — model-bump experiment closed out (2026-08-27)

The Phase 4 revisit trigger fired and was actioned; the design doc is now closed.

- **Phase 2 (replay pass) closed as moot** and `tools/experiment/replay.ts` **deleted**. It was
  scoped for "n=3 on close calls"; Phase 3 produced no reliable quality signal, so there were no
  close calls to resolve. Built and dry-run tested, never executed live. Git history is the
  recovery path.
- **`src/lib/model-config.ts` promoted out of provisional.** `modelFor()`, `effortFor()`,
  `timeoutFor()` and `stripUnsupportedParams()` are permanent. `maxTokensFor()` remains the one
  open workaround, now tracked on its own ARCHITECTURE Known Compromise carrying the measured
  ceilings that would retire it (`continue_questioning` ~459 vs shipped 200;
  `continue_confidence` ~765 vs 300).
- **`src/lib/experiment/` kept deliberately.** `capture.ts` earned its place — it is what made a
  production-shaped parse bug diagnosable from real traffic — and `pricing.ts` is useful
  independent of the experiment. Containment ratchet retained: exactly one production import.


### Phase 4 — model ruling shipped (2026-08-26)

The model-bump experiment closed with its pre-registered decision rule **inconclusive** (premise
falsified, deciding instrument failed calibration). Full record: Drive
`05-Initiatives/Lunastak/Test-Data/20260826-model-upgrade/decision.md`.

### Changed

- **Per-stage model map.** `strategy_generation`, `refresh_strategy_generation` and
  `opportunity_generation` now run on **`claude-opus-5` at `effort: low`**; everything else runs
  on **`claude-sonnet-5`** (`DEFAULT_MODEL`, changed from `claude-sonnet-4-5-20250929`).
  Measured projection: **1.49× prior cost at LOWER latency** (706s vs 791s on the reference
  workload); a live check put `strategy_generation` at 29s against the previous 172s.
  `full_synthesis` deliberately stays on Sonnet 5 — moving it takes the map to 2.14×.
- Env overrides are unchanged and still take precedence, so any experiment arm — including the
  previous incumbent — is reproducible without a code change.

### Fixed

- **`extractXML` no longer discards content over a mis-closed tag.** A model closed `<strategy>`
  with `</objectives>`; the strict `<tag>…</tag>` match returned `''` and the app persisted an
  **empty strategy** while the complete, correct content sat in the response — silent, no
  exception, `stop_reason: end_turn` at 26% of the token ceiling. Tag imbalance occurred in **8
  of 40** XML-bearing responses across **all four** model arms, so this is a property of
  prompting for XML rather than of any model. The parser now recovers by walking nesting depth to
  the first unmatched closing tag, warns with the exact malformation, and never swallows the
  following section or invents absent content. Verified against the real failed response: 693
  characters of strategy recovered. Prod impact checked read-only — ~1–2 stacks of 95, none
  recent.


### Phase 0 — model-bump groundwork (2026-08-26)

Prerequisite for the three-arm model comparison (desk #15). Behaviour-preserving
for the shipping model; see `docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md`.

### Added

- **`src/lib/model-config.ts`** — per-context model resolution (`modelFor`), sampling-param
  compatibility (`supportsSamplingParams` / `stripUnsupportedParams`), and thinking-aware
  request shaping (`maxTokensFor` / `timeoutFor` / `effortFor`). Any pipeline stage can be
  pointed at any model via `LUNASTAK_MODEL` or `LUNASTAK_MODEL_<CONTEXT>` with no code change.
- **Three ratchet tests** — `model-resolution` (17 cases), `model-provenance` (persisted
  `modelUsed` must come from `response.model`, never the `CLAUDE_MODEL` constant), and
  `model-literals` (model IDs confined to `model-config.ts`).

### Changed

- `@anthropic-ai/sdk` 0.17.2 → 0.120.0.
- `createMessage()` now resolves the model per context, strips sampling params the resolved
  model would reject (the Claude 5 family 400s on `temperature`/`top_p`/`top_k`), adds
  reasoning headroom to `max_tokens` for models where thinking is adaptive by default, and
  raises the request timeout for those models above the 60s client default.
- `modelUsed` provenance now records `response.model` at all five persistence sites.

### Fixed

- **`docs/analytics/events.md` corrected** — the `llm_token_usage` row documented `value` as
  `<model>` and metadata as `inputTokens`/`outputTokens`; the code emits a *number* (input +
  output) and `promptTokens`/`completionTokens`. Pre-existing drift; a dashboard built from the
  old description would have filtered on fields that were never emitted. Also documents a
  coverage gap found while correcting it: the event sits inside `if (userId)` and **10 of 26
  `createMessage` call sites pass no `userId`**, so token-burn dashboards and `User` counters
  understate real usage — unevenly, since several unmetered stages are the expensive ones.
- **`suggest-opposite` was pinned to `claude-sonnet-4-20250514`** — a hardcoded literal that
  bypassed `CLAUDE_MODEL`, leaving that endpoint a model generation behind the rest of the app.
  Now routed through the resolver; the `model-literals` ratchet prevents a recurrence.

## [2.5.1] - 2026-07-05

**Public share links — read-only Decision Stack via unguessable URL.**

Google-pattern "anyone with the link" sharing. One rolling link per project backed by a 192-bit random base64url token — the URL itself is the security mechanism, no password. Owner toggles sharing on/off from a Share dialog in the project header; off kills the link instantly, and the token survives re-enable so previously sent links keep working.

### Added

- **`/share/[token]`** — server-rendered public read-only Decision Stack page: project name, knowledge-summary context paragraph (no harvey balls, no source counts), full stack via `StrategyDisplay` in read-only mode, signup CTA footer, `noindex`. Deliberately NOT the demo middleware-rewrite pattern — the public attack surface is a single DB read; the page makes zero client API calls. Dead/disabled links get a branded 404 ("This link is no longer active").
- **`GET`/`POST /api/project/[id]/share`** — strict owner-only share management (session auth only; guests get the sign-in gate as a signup nudge). Mints the token on first enable.
- **Share button** in the project header (hidden on demos and pre-strategy projects) opening a Google-style dialog: "Anyone with the link can view" switch + link + copy button.
- **Schema:** `shareToken String? @unique`, `shareEnabled Boolean @default(false)`, `sharedAt DateTime?` on `Project` (additive; see `prisma/SCHEMA_CHANGELOG.md`).
- **Component library:** `Switch` (new `@radix-ui/react-switch` dep), `CopyButton` (first clipboard utility), `InlineMarkdown` (extracted from `KnowledgeSummaryPanel`).
- **`StrategyDisplay` `staticContent` mode** — opportunities/principles render from server-passed props instead of self-fetching the content API (which 401s for anonymous visitors); empty sections hide entirely.
- **Analytics:** `cta_share`, `share_link_enabled`, `share_link_disabled`, `share_link_copied` (client) and `share_page_view` (server, attributed to owner). Catalogued in `docs/analytics/events.md`.

### Fixed

- Objectives without an `id` (hand-crafted/imported bundles) were misclassified as legacy strings and crashed `parseObjectiveText` — format detection now keys on type. Previously 500'd the owner view of such projects too.

## [2.5.0] - 2026-05-23

**Signup orchestrator + transactional email infrastructure.**

### Added

- Signup orchestrator (`src/lib/signup-orchestrator.ts`) consolidating audience add, admin email, welcome email, Slack, Statsig, and pending guest transfer recovery into one module (`onSubscribe` / `onSignup` / `onSignIn`).
- React Email component library at `src/emails/components/` (Button, Heading, Paragraph, Divider, List, CalloutBox, ContentSection, EmailLayout) with Lunastak theme.
- Transactional templates: magic-link sign-in, welcome (first-signup), waitlist confirmation. Subscribe-confirm refactored onto shared components.
- Broadcast pipeline mirroring humventures.com.au — `npm run email` (preview), `send-newsletter`, `check-subscribers`, `unsubscribe-bounced`, and `src/emails/content/` directory pattern. Scripts live under `tools/email/` (the `scripts/` dir is gitignored).
- `/api/email/webhook` for automatic unsubscribing on hard bounces and spam complaints (svix signature verification).
- `tools/email/backfill-resend-audience.ts` — one-off backfill of existing users into the Resend audience.
- New env var: `RESEND_WEBHOOK_SECRET`.

### Changed

- NextAuth `events.signIn` now delegates to the signup orchestrator instead of running side-effects inline. New users now receive a welcome email + audience-add on first sign-in, and Slack is pinged once (previously double-pinged via both `createUser` and `signIn`).
- Magic-link sign-in email migrated from inline HTML to React Email template.

### Fixed

- `/api/email/webhook` now inspects Resend's `{ error }` return values instead of swallowing them. Bounce/complaint unsubscribe failures (e.g. a contact not in the audience → 404) are logged with the `audienceId` and reflected honestly in the admin notification, rather than silently reported as a successful unsubscribe.

### Removed

- Dead `/api/subscribe` and `/api/subscribe/confirm` endpoints. Their only caller (`RegistrationBanner`) was removed previously; live guest→signup now goes through NextAuth `signIn()`. The orchestrator's `onSubscribe` is retained for a future pre-auth email-capture surface.

### Notes

- Schema unchanged. Password authentication (Phase 2) is a separate release.

## [2.4.5] - 2026-04-26

**Analytics rebuild: split paywall from fake-door, add userType, server-side signin tracking, dead-code sweep.**

Disambiguates real-feature paywall signal (unlimited projects) from fake-door demand signal (features that don't exist yet) — they were conflated under shared `pro_*` event names. Adds a `userType` (`guest` | `signed_up` | `unknown`) dimension to every client-side event so funnels can be segmented by account state. Adds true signup-completion events from NextAuth callbacks (vs. inferring from CTA clicks). Removes two low-signal fake-door surfaces with a wiring bug.

### Added

- **`paywall_prompt_view`** / **`paywall_upgrade_click`** — fired only for the real `unlimited-projects` gate. Clean funnel for the one shipped Pro feature.
- **`fake_door_view`** — fired for any unbuilt Pro feature interstitial. Carries `state: "interstitial" | "pro_coming_soon"` to distinguish free-user prompt from Pro-user "coming soon".
- **`userType` metadata** auto-attached to every event via `logAndFlush` in `StatsigProvider`. Resolved from NextAuth session for signed-up users, from the `guestUserId` cookie via `/api/user/account` for guests.
- **`account_created`** / **`account_signed_in`** server-side events from NextAuth `events.signIn` — captures real signup completion (not just CTA clicks). Carries `provider` (`google` | `email`) for magic-link vs OAuth attribution. `account_signed_in` also gives returning-user activity.
- **Guest support in `GET /api/user/account`** — endpoint now resolves identity for cookie-based guest users (returns `userId`, `userType`, `isPro: false`) instead of 401-ing. Same cookie pattern as `/api/projects`.
- **`docs/analytics/events.md`** — single events catalog grouped by purpose. Replaces the older implementation-spec dashboard doc.
- Launchpad demo cards now emit `cta_view_demo` (was missing).

### Changed

- **`fake_door_click`** now also fires from the Pro-upgrade interstitial CTA (was previously only from direct fake-door buttons).
- Account-menu "Upgrade to Pro" item renamed to **"Use Claude Opus 4.7"** for the `model-selection` trigger — the interstitial is specifically about model upgrade, not generic Pro.
- Removed redundant `pro_upgrade_click` calls on the knowledge-chat / knowledge-edit chips in `KnowledgeSummaryPanel` — the downstream interstitial already fires `fake_door_view`.

### Removed

- **`pro_interstitial_view`**, **`pro_upgrade_click`**, **`pro_coming_soon_view`** — replaced by the new taxonomy. Hard cutover; no dual-fire window.
- **"Improve with AI" muted button** on `OpportunityEditor` Initiative Title — low-signal, almost invisible. Pruned the dead `onImproveWithAI` prop chain through `OpportunityCard`, `OpportunitySection`, `StrategyDisplay`.
- **"+ Add Metric (Pro)" button** on `OpportunityEditor` (multi-metric path) — had a wiring bug (double-fired `fake_door_click` + `fake_door_view` with mismatched feature labels). Multi-metric per opportunity was deprecated previously; this surface was orphaned.
- **`docs/analytics/statsig-dashboards.md`** — stale implementation spec, replaced by `events.md`. Dashboards live in Statsig itself.

## [2.4.4] - 2026-04-17

**Plain-language prompts, project-bundle boundary, Ferrari demo.**

Prompts across the intelligence pipeline now enforce plain-language constraints on operational outputs (objectives, opportunities, principles, syntheses, knowledge summary). Titles must survive being shared out of context — no more "Defend the Scarcity-Awareness Paradox" or "Pyramid Ascension at Scale." Also introduces the project-bundle egress/ingress boundary — a Zod-schema-validated format for moving project data between environments and external tools.

### Added

- **Ferrari demo project** — fourth Acquired episode demo alongside Nike, Costco, TSMC. Launchpad grid widens to 4 columns. Data replicated to dev, preview, and prod.
- **`tools/project-bundle/`** — canonical egress/ingress format for Lunastak project data. Zod schema (`ProjectBundleSchema`), `BUNDLE_VERSION` sentinel, and CLI entrypoints (`export.ts`, `restore.ts`, `validate.ts`). All external tooling that produces or consumes project data must conform to this schema.
- **npm scripts** `bundle:export`, `bundle:restore`, `bundle:validate` (replace broken `seed:hydrate` / `seed:export` / `seed:validate`).
- **Contract test** `src/lib/__tests__/contracts/project-bundle-contracts.test.ts` — validates every `src/data/demos/*.json` against the schema; snapshots the JSON Schema so structural drift fails the test loudly.
- **Shared plain-language module** `src/lib/prompts/shared/plain-language.ts` — title and explainer guidance constants reused across prompt surfaces.
- **"Good vs good" principle rule** in `suggest-opposite` API — deprioritised side must be a legitimate virtue another company would choose, not a pejorative framing. Includes calibrated examples from the demo set.
- **Data security notice** in overflow menu and Launchpad.
- **Dismissable VSO guidance callout** with per-project localStorage persistence.

### Changed

- **Objective titles** now constrained to ≤8 words, operational language, verb-or-outcome-first. Framework vocabulary ("paradox", "apex", "cornered resource", "wallet share") blocked from titles; permitted in explainer fields.
- **Opportunity titles and descriptions** carry the same plain-language constraints.
- **Full synthesis** gap titles get the plain-language constraint.
- **Knowledge summary** picks up jargon-avoidance + "define specialist terms on first use" rule.
- **Import → strategy flow** — clearer next-step CTAs; import success state stays alive until dialog dismissed; inline callout above StrategyDisplay.
- **Demo bundle JSONs** re-exported under v1 schema (picks up `bundleVersion`, `demoSlug`, `description`, `knowledgeSummary`, `suggestedQuestions`, `keyQuotes`, `contradictions`, `subdimensions`, `synthesisVersion` — fields the prior ad-hoc export was missing).

### Fixed

- **Vision/Strategy elaboration parse-but-drop bug** — `runInitialGeneration` and `runRefreshGeneration` parsed `<elaboration>` tags from the LLM response but never assigned the values to the `StrategyStatements` object (field name mismatch: parser used `visionElaboration`; persistence reads `visionExplainer`). Result: `visionElaboration` / `strategyElaboration` were always null after generation. Now wired through in both generation paths.
- **Import success state torn down by parent re-render** — deferred `onImported` callback until dialog dismissal.

### Infrastructure

- Unified env-file convention (`prisma/env.ts`) and centralised DB credential loading.
- Schema drift check across all environments (`npm run db:check-drift`).
- Docs restructure: rewritten README, removed AGENTS.md, excluded db dumps from repo.

## [2.4.3] - 2026-04-07

**Cross-site analytics, demo access, pretty demo URLs.**

This release closes the loop on the marketing-site → app activation funnel. Demo projects can now be deep-linked from anywhere without an auth gate, demo URLs are short and shareable, and Statsig events on both sites are reconciled into a single end-to-end funnel spec.

### Added

- **Pretty demo URLs via `/demo/<slug>`** — Next.js middleware rewrites `/demo/nike` (and `/costco`, `/tsmc`) to the underlying project IDs at runtime. New `Project.demoSlug` column (nullable, unique). Adding or changing a demo only needs a DB update — no deploy. Includes `scripts/set-demo-slugs.ts` to backfill slugs. Schema change requires `npm run prisma:push` against each environment.
- **Cross-site Statsig dashboard spec** at `docs/analytics/statsig-dashboards.md` — moved from Drive into the repo so it travels with the code. Covers all 6 dashboards (Activation, Engagement, Demo, Pro Demand, Account Conversion, Token Usage) with full event reference, cross-site funnel definitions, and notes on the deprecated `cta_view_fragments` event.
- **Architecture decision: Cross-Site Statsig Identity Stitching (2026-04-07)** — captured in `docs/architecture/ARCHITECTURE.md` as both a "Known Compromises" row and a full ADR. Documents why marketing-site and app events are siloed for anonymous users (Statsig stableID is per-origin), why we're accepting the gap (aggregate funnels are sufficient), and the implementation recipe (~3hrs work) for when we want to fix it.
- **`source: 'app'` metadata** on the in-app `cta_view_demo` events (Nike/Costco/TSMC overflow menu items), to disambiguate from the marketing-site `cta_view_demo` of the same name (which carries `source: 'marketing'`).
- **Tests for `/api/project/[id]`** covering the unauthenticated demo deep-link flow (`src/app/api/project/[id]/__tests__/route.test.ts`).

### Changed

- **Demo project deep-links no longer 401 for unauthenticated visitors.** `/api/project/[id]/route.ts` now mints a guest session inline when an unauth visitor requests a demo project, mirroring the pattern used by `/api/guest/init`. This is the server-side counterpart to the cross-site activation funnel — marketing CTAs that lead to demos now work for cold visitors without requiring sign-in.

### Notes

- Companion changes shipped to the marketing site (`humventures/lunastak/lunastak.io` v1.1.1): instruments four previously-untracked CTAs (`cta_create_account` on Hero + Header, `cta_sign_in` on desktop + mobile menu) and adds `source: 'marketing'` to the AcquiredShowcase `cta_view_demo` event. These feed the cross-site funnels documented in the analytics spec.
- The deprecated `cta_view_fragments` event remains unused as of v2.4.2; any dashboards still referencing it should be pointed at `cta_open_evidence` filtered by `source=overflow-menu`.

## [2.4.2] - 2026-04-07

**Knowledge Summary + Evidence panel redesign.**

Restructures the Knowledgebase tab into two peer summary panels and moves the Fragments viewer into a sheet, so users never lose top-level navigation. Decision driven by Jonny/Martin Monthly 2026-04-06 — supersedes the original 3-tab proposal.

### Added

- **`KnowledgeSummaryPanel` + `EvidencePanel`** — two peer summary panels at the top of the Knowledgebase tab, sitting on a full-viewport-width brand-coloured band. Knowledge Summary expands inline; Evidence is a clickable card that opens the Evidence sheet.
- **`EvidenceSheet`** — right-side sheet (`sm:max-w-3xl`) wrapping `FragmentExplorer`. Constrained line length, white data-grid card on a tinted body, intro sentence explaining fragments and pruning. Mobile-friendly explicit close button in the sticky header.
- **Compass icon** on the Explore Next card title.
- **e2e regression test** (`e2e/evidence-sheet.spec.ts`) covering nav persistence, sheet open/close, deep-link redirect, and dimension filter survival.

### Changed

- **Top-tab nav (Decision Stack / Knowledgebase) is now persistent on every project surface.** The legacy `/project/[id]/fragments` route used to inject a breadcrumb that wiped the tabs — that route is now a redirect to `/project/[id]?evidence=1` (preserving any `?dimension=…` filter), so external links from the book and marketing site still work.
- **Content container widened** from `max-w-4xl` (896px) to `max-w-7xl` (1280px). Affects both Decision Stack and Knowledgebase tabs.
- **`KnowledgebaseHeader` renamed to `KnowledgeSummaryPanel`** (file + component). The "View all N fragments" link inside the panel was removed — Evidence is now the canonical surface.
- **Overflow menu's "View all N fragments"** now opens the Evidence sheet instead of navigating to the legacy route.
- **`cta_view_fragments` Statsig event consolidated into `cta_open_evidence`** with a `source` field (`evidence-panel` / `dimension-chip` / `overflow-menu`). Dimension chip clicks now emit a real Statsig event (was previously a dead `console.log`).

### Removed

- Aigon workflow tooling (`.aigon/`, `.claude/commands/aigon`, `.claude/skills/aigon`, `docs/agents`, `docs/specs`, settings hooks). Aigon CLI remains installed globally for use in other repos; this repo no longer participates in the Aigon workflow.

## [2.4.1] - 2026-04-05

**Statsig instrumentation, token tracking, UX polish.**

### Added

- **LLM token tracking** — `totalPromptTokens`, `totalCompletionTokens`, `lastLlmCallAt` on User, wired through all 15 `createMessage` call sites
- **`llm_token_usage` Statsig event** — server-side token burn tracking per LLM call with context and model metadata
- **`bundle_imported` / `bundle_import_failed`** — server-side events for import pipeline success/failure
- **`version_history_downloaded`** — tracks brief exports from version history
- **`kb_summary_viewed`** — tracks knowledgebase accordion opens
- **`logAndFlush()` helper** — ensures Statsig events are delivered before Radix UI transitions

### Fixed

- **Statsig event loss** — events fired before Radix dropdown close were being dropped; all 19 call sites now flush immediately
- **Missing `cta_import_bundle`** from launchpad and KB empty state (only overflow menu was logging)
- **"Draft First Strategy" button** — now uses gold accent colour (`--luna`) instead of default primary
- **First-time opportunity guard** — auto-confirms when no existing opportunities (nothing to snapshot)
- **Removed `overflow_menu_open`** — unreliable on Radix trigger, individual menu item events sufficient

---

## [2.4.0] - 2026-04-02

**Unified Decision Stack, production launch.**

### Added

- **Unified DecisionStack schema** — V/S/O/O/P stored in `DecisionStack` + `DecisionStackComponent` + `DecisionStackSnapshot`, replacing `GeneratedOutput`, `UserContent`, `StrategyVersion`
- **Point-in-time snapshots** — full stack captured before and after every AI action (generation, refresh, opportunities)
- **Generation confirmation dialog** — unified dialog for refresh + opportunities with fragment count context and snapshot reassurance
- **Principles** — full support in Decision Stack; demo principles for Nike (5), Costco (5), TSMC (4)
- **Static demo data** — `src/data/demos/` with `scripts/restore-demos.ts` replaces seed fixtures
- **Slack notification** on opportunity generation
- **"Improve with AI" Pro fake door** — gated on opportunity editor with statsig tracking
- **"Add Metric" Pro gate** — second metric gated behind Pro upgrade
- **`from=marketing` sign-in** — contextual messaging from marketing site
- **App footer** — About, Feedback, Privacy links
- **Demo company logos** at top of Decision Stack
- **Context bundle batching** — chunks tagged in groups of 20 with scaled max_tokens

### Changed

- **Opportunity cards** — 2-column layout, draft badge removed, baseline/target overflow fixed
- **Version history** — sequential numbering, expandable summaries, markdown stripped
- **Integration card** — grayscale logos, "Installation guide" link
- **Fragment explorer** — responsive title layout on mobile
- **Import dialog** — "How to create your bundle" link to docs/install

### Fixed

- **Component data loss on refresh** — atomic delete + recreate, guarded on objectives
- **Empty Decision Stack flash** — hidden during background generation
- **Context bundle tagging truncation** — was truncating at 2000 tokens
- **Tension field name variants** — handles tension/description/tensionTitle
- **Change summary markdown** — plain text prompt, client-side strip

### Schema

- Added: `DecisionStack`, `DecisionStackComponent`, `DecisionStackSnapshot`
- Added: `Project.directionStatus`, `Fragment.title/sourceType/importBatchId`, `Conversation.originType/originText`
- Dropped: `GeneratedOutput`, `UserContent`, `StrategyVersion`

---

## [2.3.1] - 2026-03-30

**Demo polish, homepage redesign, opportunity generation fixes.**

### Fixed

- **Opportunity rendering** — `OpportunitySection` now re-fetches after generation via `refreshKey` prop
- **`waitUntil` local dev** — `generate-opportunities` and `generate-strategy` routes await inline locally (Vercel-only `waitUntil` was silently dropping background work)
- **Silent coverage gate** — removed unbuilt coverage warning dialog that blocked "Draft with Luna" without feedback
- **Fragments API demo access** — added `isDemo: true` to project access check

### Changed

- **Homepage** — Acquired.fm × Lunastak banner, strapline ("Because every company has a story. And every strategy is a Decision Stack."), highlight-style onboarding cards (Talk to Luna / Import a context bundle with dropdown)
- **Demo project pages** — plum banner with "Listen on Acquired.fm →" episode links, simplified KB tab (coverage grid + inline FragmentExplorer, no chats/docs/explore-next)
- **Demo version stamp** — "Extracted and generated by Luna from podcast transcript" replaces v1 date stamp
- **OpportunityCard** — standardised `text-sm` throughout, weight-based differentiation (was mixed 10/13/15px)
- **Opportunity generation prompt** — single metric per opportunity, concise belief format (8-20 word continuations of "We believe…will…")
- **KB empty state** — same onboarding cards as homepage launchpad
- **Generate Strategy** — disabled in overflow menu when no fragments exist
- **Auth strapline** — "Your second brain for strategic clarity"
- **KnowledgebaseHeader** — `readOnly` prop hides "View all N fragments" link for demos

### Updated

- Acquired demo fixtures rebuilt from automated pipeline output + manual principles (Nike 33 frags, TSMC 28 frags, Costco 36 frags)
- Company logos (Nike, Costco, TSMC) cropped and added to public assets
- AI platform logos (Claude, Gemini, OpenAI) added for import CTA

## [2.3.0] - 2026-03-29

**Interaction architecture overhaul: two-tab layout, Import Service, fragment explorer, Strategic Brief export.**

### Added

- **Two-tab layout** — Decision Stack + Knowledgebase replace the old vertical scroll project page
- **Launchpad** — Three onboarding paths (Start conversation, Import bundle, See examples) when no strategy exists
- **Import Service** — `planImport()` / `executeImport()` orchestration with LLM dimensional tagging for context bundles from Decision Stack skill
- **Fragment explorer** — Full-page datagrid at `/project/[id]/fragments` with dimension filtering, search, archive/restore, conversation source links
- **Fragment title field** — Structured `title` on Fragment model; migration script backfills from legacy `**bold**` markdown format
- **Strategic Brief export** — Markdown export of full Decision Stack via `/api/project/[id]/export-brief`
- **Version history sheet** — View + export past strategy versions from Decision Stack tab
- **Opportunity generation pipeline** — Separate `generate_opportunities` trigger with coverage check UI
- **Generate from knowledge** — `generate_from_knowledge` pipeline trigger for import-then-generate flow
- **Context bundle import** — `/api/project/[id]/import-bundle` with direct (v1) and transform (v2/LLM tagging) modes
- **Conversation origin tracking** — `originType`/`originText` fields on Conversation for reliable provocation resume matching
- **Login telemetry** — Slack notification on user sign-in
- **Demo mode redesign** — Header tint, readOnly threading, persistent example projects (Lunastak, Nike, Costco, TSMC)
- **Button group + overflow menu** — Unified navigation replacing tabs, consolidating all actions (chat, upload, import, generate, export, history)
- **Import CTA** — Knowledgebase tab promotes Decision Stack skill import alongside documents

### Changed

- **Sidebar** — Stripped to account-level (project picker + settings), collapsed by default
- **Knowledgebase layout** — Coverage hero, Explore Next + Conversations side-by-side, Documents + Import CTA side-by-side
- **Fragment extraction** — Writes `title` separately instead of embedding `**bold**` markdown in content
- **Chat sheet** — Simplified guards, removed isInitialConversation blocking
- **Project API** — Returns `isDemo`, `originType`, `originText`; demo projects accessible to any authenticated user

### Schema

- `Fragment.title` (String?) — short display name
- `Fragment.sourceType` (String, default "extraction") — extraction | import | manual
- `Fragment.importBatchId` (String?) — groups fragments from a single import
- `Project.directionStatus` (String, default "drafting") — drafting | settled
- `Conversation.originType` (String?) — provocation | gap | deep_dive | organic
- `Conversation.originText` (String?) — source text for origin matching

### Infrastructure

- Import Service at `src/lib/import/` — types, planner, transforms, executor
- Fragment title migration: `scripts/migrate-fragment-titles.ts` (dry-run + apply)
- Opportunity generation contract: `src/lib/contracts/opportunity-generation.ts`
- Strategic Brief template: `src/lib/strategic-brief.ts`

## [2.2.1] - 2026-03-27

**Read-only demo mode and Acquired Decision Stack showcases.**

### Added

- **Read-only mode** — `isDemo` flag on Project model suppresses all edit/add affordances; also available via `?readonly=true` query param
- **Vision/strategy explainers** — Card backs now render elaboration text from generatedOutput when available
- **Opportunity hypothesis template** — Card back shows example hypothesis format when no structured metrics exist
- **Plain text content parsing** — PrinciplesSection handles "Prioritise X even over Y" format from bridge fixtures; OpportunityCard shows description on front when no structured metrics

### Fixed

- **Opportunity heading colour** — Always lunastak-mid regardless of readOnly state
- **Secondary metrics** — Displayed as dashed list under italic Plex Mono heading on objective front

### Infrastructure

- Acquired demo fixtures (Costco, TSMC, Nike) hydrated into prod with `isDemo=true`
- Production URLs: Costco `/strategy/cmn8dmqd8000212zat6shsdo6`, TSMC `/strategy/cmn8dnpii0002akzp235vpbkp`, Nike `/strategy/cmn8dodot0002j4emgjfhzoqc`

## [2.2.0] - 2026-03-26

**Decision Stack flip card UI, strategy card typography overhaul, and Socratic principle flow.**

### Added

- **FlipCard component** — Crossfade flip cards for all Decision Stack elements (vision, strategy, objectives, opportunities, principles) with front/back views, edit, and delete actions
- **Opportunity flip cards** — Belief-driven metrics with boxes-and-arrow layout (From → To), numbered objective linking, and "Success is when..." label
- **Principle flip cards** — "X even over Y" front display with context on back, restructured edit form
- **Socratic principle add flow** — Moved into dialog behind Add button on Principles heading
- **Outline Add buttons** — Replaced dashed placeholder boxes with styled Add buttons next to section headings

### Changed

- **Typography system** — IBM Plex Mono italic for OMTM aspirations, metric headings, and "We believe / will" labels; normalised all card body text to 13px baseline with weight/opacity differentiation
- **Card back styling** — All text white/90, Edit as solid white button, Delete as ghost across all card backs
- **Objective cards** — Statement + OMTM with Flag icon on front, TrendingUp icon on opportunity metric headings
- **Principles styling** — Deprioritised text at /90 opacity, "even over" at /70, back context at /90
- **Metric boxes** — Centre-aligned values, bold neon arrow with "to" label, no outlines
- **Section spacing** — Explicit mt-12 between sections, Add buttons in lunastak-mid with ds-teal outline

### Fixed

- **Principles data fetch** — Always fetch from UserContent on mount, removing stale initialPrinciples fallback
- **Card edit flow** — Return to front after edit save, show supporting metrics with "Related to" divider
- **Provocation conversations** — Resume support and bumped doc extraction limits
- **Print styles** — Cleaned up for strategy export
- Removed unused Inter font import and PrincipleChip component

### Infrastructure

- Public repo readiness — removed hardcoded secrets, added architecture docs
- Added `docs/backtest-sessions.md` to .gitignore

## [2.1.0] - 2026-02-25

**Auth reliability, pipeline race condition fix, conversation coaching, and E2E regression suite.**

### Added

- **Conversation coaching** — Prominent "Draft First Strategy" button, "Finish" flow with confirmation dialogs, keyboard hint hiding on mobile, coaching copy for first-time users
- **E2E regression suite** — Playwright tests covering four critical first-time user flows: guest conversation → strategy, document upload → conversation, guest-to-auth session transfer, and demo restore navigation. Runs against preview with real pipeline (no mocking)
- **Test seed endpoint** — Preview-only `/api/test/seed-user` for E2E auth bypass
- **Analytics** — `cta_start_initial_conversation` Statsig event for funnel analysis
- **Navigation persistence** — Active project remembered across navigation via localStorage

### Fixed

- **Pipeline race condition (HUM-81)** — Fire-and-forget path pre-created GeneratedOutput before extraction, so `startedAt` predated all fragments. Strategy showed as stale immediately after generation. Fixed by bumping `startedAt` after fragments load and stamping `knowledgeUpdatedAt` after initial generation
- **Auth transfer: server-side fallback** — Magic link opening in a different browser lost the guest cookie. Added `PendingGuestTransfer` table with email→guestUserId mapping as cross-browser fallback
- **Auth transfer: verification timing** — signIn callback was firing during the magic link send phase (before user existed). Skipped transfer during `verificationRequest=true`
- **Auth transfer: FK ordering** — `callbacks.signIn` fires before user is persisted for new signups. Moved transfer to `events.signIn` which fires after user creation
- **Header collapse animation** — Header now animates closed on first chat turn instead of jumping
- **Mobile alignment** — Send and Start Over buttons aligned to RHS on mobile
- **Knowledge Snapshot** — Nav card truncation and grid alignment fixes

## [2.0.5] - 2026-02-20

**Demo discoverability and dashboard layout fixes.**

### Fixed

- **Demo lands on strategy view** — Demo creation and restore now redirect to `/strategy/{traceId}` instead of "Your Thinking", so users immediately see the output
- **Dashboard module order** — Reordered to Strategy (1), Chats (2), Explore Next (3), Documents & Memos (4)
- **GoToStrategyCard** — Replaced placeholder with real CTA linking to latest strategy, with empty state when no strategy exists
- **KB header mobile overflow** — On mobile, collapsed stats to show only insight count; chat/doc counts and timestamps hidden below `md` breakpoint
- **Strategy page** — Removed "Learn more →" link, kept Decision Stack logo

### Changed

- `/api/demo/create` and `/api/projects/restore-demo` now return `latestTraceId` in response
- `useProjectActions.restoreDemo()` returns `{ projectId, latestTraceId }` instead of plain string

## [2.0.4] - 2026-02-19

**Pre-launch analytics, Slack notifications, and UX fixes.**

### Added

- **Slack notifications** — Shared `notifySlack` utility with wrappers for signup and strategy generation events
  - `notifySlackNewUser` fires on NextAuth and marketing-site signups
  - `notifySlackStrategyGenerated` fires on initial and refresh generation (fire-and-forget)
- **Statsig CTA events** — 12 event types wired across all major buttons (`cta_generate_strategy`, `cta_new_chat`, `cta_upload_doc`, `cta_create_project`, `cta_restore_demo`, `cta_build_strategy`, `cta_demo_peek`, `cta_demo_confirm`, `cta_complete_template`, `cta_refresh_strategy`, `cta_create_account`, `cta_add_deep_dive`)
  - Value field differentiates button location (e.g. `sidebar` vs `project-page`)
- **ProUpgradeFlow Statsig events** — `pro_interstitial_view`, `pro_upgrade_click`, `pro_coming_soon_view`
- **Fake door tracking** — `fake_door_click` event via Statsig (replaces broken `console.log`)
- **Vercel Analytics** — `<Analytics />` mounted in root layout
- **Statsig environment tiers** — Client SDK now tagged with `development`/`preview`/`production` via `NEXT_PUBLIC_VERCEL_ENV`

### Fixed

- **Missing favicon** — Added `src/app/icon.svg` (gold circle matching brand)
- **SheetTitle accessibility warning** — Added visually-hidden `SheetTitle` to chat-sheet
- **Dead FakeDoorDialog code** — Removed unused component and dead references from StrategyDisplay and project page
- **OpportunityEditor fake door** — "AI Rewrite" now routes through ProUpgradeFlow instead of deleted FakeDoorDialog
- **`outputFileTracingIncludes` deprecation** — Moved under `experimental` in `next.config.js`

### Removed

- **`FakeDoorDialog.tsx`** — Replaced by ProUpgradeFlow pattern; no remaining callers

## [2.0.3] - 2026-02-16

**Knowledge panel polish, objectives prompt overhaul, Luna demo fixture and "see demo" button refresh.**

### Changed

- **Knowledge panel summary** - "Refine this summary" is now the heading (pencil icon + popover), replaces separate Summary/Refine labels
- **Summary countdown** - "N more insights 'til next auto-update" replaces generic "next update" label
- **Markdown in summary** - `**bold**` text in knowledge summary now renders correctly
- **Objectives prompts** - Rewritten to generate outcome-oriented objectives ("state you want to be true") instead of action-oriented ones that read like initiatives
- **Objectives UI copy** - Template entry and inline editor guidance updated to match new prompt direction
- **Demo fixture** - Replaced BuildFlow demo with Lunastak's own strategy ("Lunastak's Strategy")
  - 5 conversations, 42 fragments, 11 syntheses, 3 strategy versions, 5 principles, 5 opportunities
  - V3 vision/strategy/principles populated in starred trace so strategy page renders correctly
  - Name redactions applied (company names replaced with generic descriptors)
- **"See demo" button** - Redesigned with luna gold background, KeySquare icon, "Peek into Luna's Strategy" label, tooltip
- **"I have a strategy" button** - Renamed to "Build my Decision Stack" with Blocks icon and tooltip
- **Demo confirmation dialog** - Updated copy to reference Lunastak's real Decision Stack, CTA changed to "Let me in"
- **Seed timestamps** - Trace timestamps now jittered 20-32 min apart (was fixed 1-hour intervals); strategy versions spaced 25 min apart

### Fixed

- **Strategy page showing V1 instead of V3** - Trace timestamps were assigned in reverse order (first conversation got newest timestamp); fixed to chronological
- **Principles missing from demo** - Strategy page reads principles from trace output, which was empty; V3 trace now includes all 5 principles
- **No starred trace** - Strategy redirect requires a starred trace; V3 trace now marked as starred

## [2.0.2] - 2026-02-16

**Pipeline orchestrator, fire-and-forget UX, knowledge panel redesign, and fragment snapshots.**

### Added

- **Pipeline Orchestrator** - All business logic flows through `planPipeline()` → `executePipeline()`
  - Pure-function decision matrix determines extraction, persistence, synthesis, and generation steps
  - Routes are now thin HTTP wrappers — `/extract`, `/generate`, `/refresh-strategy`, `/template-entry`, `/doc-upload` all delegate to orchestrator
  - Exhaustiveness tests ensure all trigger types are handled
  - Dev pipeline testing UI with fixture index and snapshot save-to-disk

- **Fire-and-Forget Initial Conversation** - Sheet closes instantly (~1s) for first conversation
  - Extraction + generation runs entirely in background via single `/api/extract?isInitial=true` call
  - `GeneratedOutput` created upfront with `status: 'extracting'` for immediate polling
  - Progress transitions: extracting → generating → complete
  - Dynamic progress labels ("Extracting themes" → "Crafting strategy") in KnowledgebaseHeader and sidebar
  - `progressLabel` added to `GenerationStatusResponseContract`

- **Background Extraction** - Follow-up conversations extract in background
  - Sheet closes immediately after conversation ends — no more locked UI
  - Extraction runs via `waitUntil()` with status polling
  - New `/api/extraction-status/[conversationId]` polling endpoint
  - Extraction status contract (`ExtractionStatusResponseContract`)
  - Toast notification when extraction completes with fragment count
  - InlineChat also uses fire-and-forget extraction (no more streaming)

- **BackgroundTaskProvider** - Unified provider for all background tasks
  - Replaces `GenerationStatusProvider` with generic task tracking
  - Supports `extraction`, `generation`, and `refresh` task types
  - Per-type toast messages and completion handling
  - Tracks `progressLabel` from polling responses, exposes `getProgressLabel(projectId)`
  - Legacy aliases maintain backward compatibility (`useGenerationStatusContext`)

- **Refresh Strategy Overhaul** - Fire-and-forget with foreground synthesis
  - Quick-prep dialog with immediate hand-off to background polling
  - Synthesis runs in foreground (required before generation reads syntheses)
  - Accepts pre-created `generatedOutputId` for reliable status tracking
  - Generation status includes `traceId` for "View" action in toast

- **Knowledge Panel Redesign** - Notion-style collapsible header
  - Fragment countdown with knowledge/strategy split stats
  - Separate busy messages for knowledge processing vs strategy generation
  - "Refine" popover replaces Chat/Edit fake door buttons
  - Knowledge summary timestamp display
  - Chat and Edit features gated behind Pro upgrade flow

- **Fragment Snapshot** - Full knowledge base snapshot with structured storage
  - Fragments grouped by dimension with markdown parsing
  - Structured JSON storage for snapshot data
  - Snapshot delta tracking for refresh generation

### Changed

- **Initial generation** now reads from fragments (DB) instead of `extractedContext` passed through the pipeline
- **Neon connection pool** limited to `max: 10` to prevent connection exhaustion
- **Strategy staleness** derived from fragment timestamps vs last strategy, not `knowledgeUpdatedAt`
- **Synthesis + knowledge summary** now deferred for document uploads (runs after processing completes)
- **Synthesis threshold** — only runs when fragment count warrants it

### Fixed

- **Strategy refresh concatenation** - Refresh output was appending to previous strategy text instead of replacing
- **Side chat triggering generation** - Follow-up conversations no longer trigger strategy generation
- **Double generation bug** - Extract route no longer triggers generation for streaming path
- **Query flood on project page** - `fetchProjectData` debounced at 500ms, `extractionComplete` event listener added
- **Delayed refetch cascade** - Removed unnecessary 5s/15s/30s refetch timers on generation complete
- **Refresh strategy** - Fixed 4 issues from testing (status tracking, toast messaging, sidebar refresh, knowledgeUpdatedAt)
- **Synthesis upsert** - Missing dimensional synthesis records now created instead of silently skipping
- **isExplicitEnd timing** - Fixed React state timing bug by passing `explicitEnd` as function parameter
- **Polling reliability** - `force-dynamic` on status endpoints, `no-store` on client fetch
- **Fragment grouping** - Fixed stat ordering and fragment group assignment
- **Hydrate script** - `knowledgeUpdatedAt` now set correctly in `--projectId` path

## [2.0.1] - 2026-02-12

**Template flow overhaul and Strategy page enhancements.**

### Added

- **Decision Stack Template Flow** - Restored and overhauled "I have a strategy" entry
  - Decision Stack branding, logo, and "Learn more" link
  - Progressive disclosure vision examples ("Need inspiration?")
  - "Improve with AI" Pro upgrade gates on all steps (Vision, Strategy, Objectives, Opportunities)
  - Opportunities step using existing OpportunitySection component
  - "I'm done for now" escape hatch — submit partial Decision Stack from any step
  - Relaxed validation: only Vision required, all other steps optional
  - Review step with full summary including opportunities

- **Add Objectives on Strategy Page** - Plus card to append new objectives to generated set

- **Pro Feature: AI Improve** - Added `ai-improve` to Pro features registry with upgrade interstitial

### Changed

- **First-time UX copy** - Better description for three entry paths (chat, doc upload, template); improved chat placeholder for coldstart
- **Template coaching tips** - "What matters right NOW" for objectives; generic example placeholders (removed Lunastak-specific text); OMTM description simplified
- **Opportunity cards** - `compact` mode for simplified display (title + description only); `readOnly` mode for review contexts

### Fixed

- **Template strategy persistence** - Added GeneratedOutput record and `generationComplete` event so template-created strategies appear in sidebar
- **Template objective persistence** - Broadened filter to include objectives with title or OMTM (not just statement); fixed StrategyVersion field mapping (`omtm`/`aspiration` instead of legacy `metric`/`successCriteria`)
- **ProComingSoonDialog missing** - Pro users clicking "Improve with AI" now see "Coming soon" dialog (was silently failing)
- **Strategy-version append** - New objectives now append to Trace.output instead of being silently dropped

## [2.0.0] - 2026-02-11

**Production Customer Beta.** First release to real customers.

### Added

- **Pro Upgrade Flow** - Admin-initiated upgrade with sidebar integration
  - Pro users bypass paywall for multi-project creation
  - "Coming Soon" dialog for unreleased Pro features (Outcomes)
  - Sidebar hides "Upgrade to Pro" for already-Pro users
  - `isUserPro()` helper centralizes Pro status checks

- **Account Page** - User details and session management
  - Displays name, email, account status
  - Clean settings entry point from sidebar

- **Early Access Waitlist** - Email capture for upcoming features
  - Waitlist signup with pre-populated email from session
  - Gold/accent CTA styling for visibility

- **Project Auto-Numbering** - New projects get sequential names
  - "My Strategy 2", "My Strategy 3", etc.
  - Inline rename capability from project switcher

### Changed

- **Schema Rationalization** - Pre-beta cleanup of 9 dead fields
  - Removed early eval infrastructure: `confidenceScore`, `confidenceReasoning`, `annotations` (Message), `extractedBy` (Fragment), `taggedBy` (FragmentDimensionTag), `synthesizedBy`, `coverage` (DimensionalSynthesis), `sourceMessageId`, `sourceDocumentId` (DeepDive)
  - Added `Trace.projectId` denormalization for direct project access (eliminates 2-join through Conversation)
  - Fixed `Conversation.Project` → `project` relation naming
  - Deleted dead `/api/conversation/assess-confidence` route (LLM-as-judge eval infra, now handled off-app via backtesting APIs)

- **Decision Stack Visual Identity** - Bold dark teal branding
  - Compact sidebar header
  - Removed gold hover states

- **Template Entry Flow** - Hidden for beta launch (fast-follow)

### Fixed

- **Waitlist Email** - Pre-populates from session, shows change link
- **Sidebar Dropdown** - Uses `onSelect` for dropdown items

---

## [1.7.9] - 2026-02-11

### Added

- **Google OAuth Sign-In** - One-click authentication with fallback
  - Google OAuth provider integrated with NextAuth
  - Magic link email fallback for users without Google
  - Account linking for existing email users
  - Signed-out redirect handling

- **Simplified OMTM Model** - Cleaner objective metrics
  - Objectives now use simple `omtm` (metric name) + `aspiration` format
  - Example: "Session 2 return rate" with aspiration "↑ 50%"
  - Removed verbose baseline/target/timeframe from display
  - Backward compatible with legacy primaryMetric and keyResults formats
  - Generation prompt updated for new format

- **Improved Opportunity-Objective Linking** - Cleaner UX
  - Simple checkbox linking (removed confusing contribution text)
  - Reordered editor: Title → Objective links → Description → Success Metrics
  - Success metrics can optionally tag specific objectives
  - Linked objectives display as clean chips

- **Pithy Vision/Strategy Generation** - Radical brevity for memorability
  - New v4 prompt (`v4-pithy-statements`) with Decision Stack guidance
  - Vision: 4-15 words (headline) + elaboration
  - Strategy: 15-25 words (headline) + elaboration
  - Real examples (IKEA, Nike, Oxfam, Google) in prompt
  - Good/bad criteria: customer-centric, aspirational, NOT "to be the leading..."
  - Tone guidance: "Write like a manifesto, not a business plan"
  - Auto-detects headline/elaboration format in responses

- **Eval Index Page** - Browse all evaluations at `/admin/eval`
  - Shows date, purpose, summary preview, outcome badge
  - Links directly to individual eval pages
  - No more typing timestamped URLs

- **Backtesting Infrastructure** - Frozen v1 generation prompt
  - v1 module now uses frozen v2 prompt for emergent extraction
  - Enables proper comparison across prompt versions
  - 4PL fixture traces: baseline-v2, v3-okr, v4-pithy

- **Click-to-Edit Pattern** - Consistent editing UX across Decision Stack
  - Vision, Strategy, Objectives all clickable to enter edit mode
  - Removed hover edit icons and info icons
  - Embedded coaching callouts appear during editing (subtle amber left-border style)
  - Coaching tips guide users on best practices without being intrusive

- **OKR-Style Objectives Generation** - Hypothesis-driven Key Results
  - New v3 prompt (`v3-okr-objectives`) generates structured objectives
  - Each objective includes: title, statement, explanation, keyResults[]
  - Key Results follow belief/signal/baseline/target/timeframe format
  - Backwards compatible: auto-detects OKR vs legacy format in responses
  - `parseOKRObjectives()` utility for XML parsing

- **Socratic Principles UX** - LLM-powered trade-off suggestions
  - Replaced curated trade-off selection with open question flow
  - User types what matters most, LLM suggests the opposite
  - `/api/suggest-opposite` endpoint for quick LLM responses
  - Editable suggestions before confirmation
  - Vertical stacked chip layout with flip/remove actions

### Changed

- **VisionContent/StrategyContent Types** - Support for elaboration
  - Added optional `elaboration` field for unpacking pithy headlines
  - StrategyVersion records now store elaboration from generation

- **Eval API** - Enhanced metadata
  - Returns purpose, summary, outcome, baseline fields
  - Supports richer eval index display

- **Coaching Callout Styling** - Refined visual treatment
  - Warm amber/beige background (`bg-amber-50/50`)
  - Left border accent (`border-l-2 border-l-amber-200/80`)
  - Italic text for "aside" quality
  - Applied consistently across InlineTextEditor and ObjectiveInlineEditor

- **Prompt Versioning** - v4-pithy-statements now current
  - v2, v3 preserved for back-testing
  - Registry updated in `src/lib/prompts/index.ts`

---
## [1.7.8] - 2026-02-08

### Added

- **First-Time Experience Resume** - Users who leave mid-conversation can resume
  - `isInitialConversation` flag tracks conversations leading to first strategy
  - Incomplete initial conversations detected and routed to InlineChat
  - Full message history restored on resume

- **Start Over Action** - Escape hatch for first-time flow
  - "Start over" button with confirmation dialog
  - Abandons conversation and resets to fresh start
  - Prevents users from getting stuck in loop

- **Finish Confirmation** - Turn-aware prompts before extraction
  - Early finish (≤2 turns): "Finish so soon?" - encourages more input
  - Later finish (>2 turns): "Ready to generate?" - confirms extraction
  - Goes straight to extraction, no redundant prompts

- **ChatSheet Blocking** - Prevents confusion during first-time flow
  - ChatSheet detects active initial conversation
  - Shows amber warning directing user to complete first-time flow
  - Race condition fix with `hasCheckedForInitial` gate

- **Dogfood Fixture** - Preserved real conversation for testing
  - `dogfood-first-time-conversation.json` extracted from PROD
  - `extract-conversation-fixture.ts` script for future extractions

### Fixed

- **Redirect After Generation** - Dashboard now shows after first strategy
  - Removed `router.push()` that was interfering with state updates
  - Event listener properly triggers refetch and re-render

---
## [1.7.7] - 2026-02-02

### Added

- **Eval UI Enhancements** - Richer trace comparison for backtesting
  - Pipeline metadata in trace headers (pipelineVersion, promptVersions, experimentVariant)
  - Full objective details: metrics, targets, timeframes, explanations, success criteria
  - Tag persistence and notes editing for evaluation workflow

- **Fixture Naming Convention** - Clearer fixture organization
  - `conversation-*` = messages only (for testing extraction → generation)
  - `extracted-*` = messages + fragments (extraction done, no generation)
  - `complete-*` = full pipeline output (messages + fragments + traces)
  - `context-*` = pre-built extraction context (for testing generation only)

- **Conversation-Only Fixture** - `conversation-lunastak-2026-02-02.json`
  - Messages-only fixture with `status: in_progress`
  - Enables full extract→generate flow testing via UI

### Changed

- **Pipeline Runner Simplified** - Removed `--version=current` support
  - V1 archived pipeline only (current API tested via app directly)
  - Cleaner backtesting workflow

### Fixed

- **Fixture Status for Testing** - Conversations hydrated with `in_progress` status
  - UI now shows "Create my strategy" button when expected
  - Enables full pipeline testing via browser

---
## [1.7.6] - 2026-02-01

### Added

- **Background Strategy Generation** - Fire-and-forget with polling
  - `/api/generate` returns immediately with `generationId`
  - Generation runs in background via Vercel `waitUntil()`
  - Client polls `/api/generation-status/[id]` every 2 seconds
  - Toast notification when strategy is ready with "View" action
  - User can navigate freely during generation (~15-30s wait eliminated)

- **Generation Status Indicators** - Visual feedback during processing
  - Sidebar shows Luna logomark + "generating..." during strategy generation
  - Knowledgebase status bar shows "adding knowledge and drafting strategy..."
  - Post-generation "updating..." state while knowledgebase syncs
  - Luna SVG replaces sparkles icons for brand consistency

- **Generation Status Context** - Centralized state management
  - `GenerationStatusProvider` tracks active generation across app
  - `useGenerationStatusContext` hook for components
  - `hasActiveGeneration()` for UI elements that should stay hidden until complete

### Fixed

- **Strategy Content Empty** - Increased `max_tokens` from 1000 to 4000
  - Claude response was being truncated mid-XML
  - `extractXML` returned empty strings for vision/strategy/objectives

- **Navigation After Generate** - Project page now listens for events
  - `strategySaved` event triggers data refetch
  - `generationComplete` event triggers delayed refetches (5s, 15s, 30s)
  - Ensures knowledgebase data catches up after strategy generation

- **Generate Button Timing** - Hidden during entire generation lifecycle
  - Button hidden while generating AND while knowledgebase syncs
  - 30-second grace period after generation for synthesis to complete

---
## [1.7.5] - 2026-01-31

### Changed

- **Skip Extraction Confirmation** - Go straight from extraction to generation
  - Removes interstitial "Here's what I understood" screen
  - Extraction completes → immediately triggers strategy generation
  - Reduces clicks but total wait time still needs background generation (see docs/in-progress)

### Fixed

- **Null Safety in ExtractionConfirm** - Handle missing reflective_summary
  - Emergent extraction no longer includes reflective_summary in response
  - Component now guards against undefined fields

### Added

- **New Seed Fixtures** - For UAT and testing
  - `demo-4pl.json` - 4PL logistics retention strategy conversation
  - `pre-generate-4pl.json` - Pre-extracted context for testing generate API
  - `pre-generate.ts` - Script to test generation with pre-extracted context

- **Updated Scripts Documentation** - Expanded scripts/README.md
  - Hydrating into existing projects (`--projectId`)
  - Pre-generate testing workflow
  - API flow reference section

---
## [1.7.4] - 2026-01-28

### Added

- **Strategy History Submenu** - Browse past strategies from sidebar collapsible menu

- **Deep Dive Topic Linking** - Conversations linked to topics
  - Chats started from deep dives auto-link to that topic
  - Topic chip in chat header shows current assignment
  - "Part of:" indicator in chat list with clickable chip

### Fixed

- **Guest Session Transfer** - Prevents duplicate projects on re-login
  - Empty guest projects deleted instead of transferred
  - Only projects with actual content merge into authenticated account
  - Root page defers project creation when guest cookie exists

- **Strategy Menu Stability** - Eliminates layout jank in sidebar
  - Consistent Collapsible structure with internal loading/empty states
  - Strategy labels now show date + time for uniqueness
  - Demo fixture traces offset by 1 hour for unique timestamps

- **GoToStrategyCard** - Simplified to static empty state ("More features shipping weekly")

### Improved

- **Opportunity Editor UX** - Better feedback and objective linking
  - Positive feedback when all coaching criteria pass
  - Inline contribution inputs below linked objectives
  - "Coaching" → "Suggested improvements"

- **Dashboard UX** - Simplified headers and clearer CTAs
  - Page heading simplified to "Your Thinking"
  - Orange "Generate new strategy" button with fragment count
  - Guest banner moved above tabs with orange CTA

- **Sidebar Navigation** - Cleaner icons and labels
  - "Current Strategy" → "Your Strategy" (Atom icon)
  - "Your Thinking" (Glasses icon) reordered above strategy

---
## [1.7.3] - 2026-01-24

### Fixed

- **Neon Database Cold Starts** - Serverless adapter for reliable connections
  - Added `@neondatabase/serverless` and `@prisma/adapter-neon` for HTTP-based queries
  - Eliminates `Error { kind: Closed, cause: None }` on cold starts

- **Demo Auto-Seeding Removed** - New users start with empty project
  - Removed demo seeding from NextAuth `createUser` event
  - Users now land in first-time experience, not demo project

- **Chat Counter After Strategy** - Correct "first strategy" banner logic
  - Added `hasStrategy` field to projects API response
  - Sidebar chat now correctly hides first-time banner after strategy generation

- **Sidebar Upload First-Time UX** - Launch chat after first document
  - When uploading first document via sidebar, inline chat auto-opens

### Changed

- **Beta Preview** - Sidebar label changed from "Early Access Preview" to "Beta Preview"

- **Timeouts & Reliability** - Prevent long hangs
  - Statsig initialization timeout reduced to 5 seconds
  - Claude API timeout reduced to 60 seconds (from 180s)

---
## [1.7.2] - 2026-01-24

### Added

- **Dashboard Progressive Disclosure** - Cleaner information architecture
  - **Luna's Memory Header** - Collapsed bar showing insights, chats, coverage stats
    - Expands to reveal full knowledge summary and 10 strategic dimensions
    - "X new to include" action opens synthesis dialog directly
  - **Layout Reorder** - Deep Dives moved up after action row (Docs/Chats/Strategies)
  - **Provocations Limit** - Shows 3 items with "Show X more" button (matches Gaps pattern)

- **Decision Stack Branding** - Strategy view visual refresh
  - Branded header with bottle green (#0A2933) background and logo
  - "Learn more about The Decision Stack" link to thedecisionstack.com
  - Strategy cards with white backgrounds, bottle green borders
  - Neon (#E0FF4F) timeframe badges and CTA buttons
  - Aubergine (#7F556D) metric text
  - Hint of teal (#EEF8FC) content area background

- **Streaming Generation Progress** - Consistent progress UI
  - `/api/generate` now streams progress updates (preparing → generating → saving → complete)
  - `ExtractionProgress` component supports both extraction and generation modes
  - `chat-sheet.tsx` and `InlineChat.tsx` consume streaming responses

- **Luna's Thinking Tab** - Redesigned insights display
  - Themes as full cards in 2-column grid (not hidden behind pills)
  - Reflection accordion with 3-card layout (Strengths, Emerging, Opportunities)
  - Reasoning accordion for Claude's strategic thinking
  - Monotone design matching app visual language

### Changed

- **Strategy Page Tabs** - Line-style tabs with centered layout
- **StrategyDisplay** - Removed internal max-width (parent container controls)

### Fixed

- **Synthesis Loop** - Fixed dialog re-triggering on complete
  - Removed automatic `onComplete` call during dialog open state
  - Data refresh now only happens when user clicks "Done"
  - Prevents component remount/re-trigger race condition

- **Unnecessary Synthesis Runs** - Skip dimensions with no new fragments
  - Added early exit when existing synthesis exists and no new data
  - Prevents redundant LLM calls during synthesis

---
## [1.7.1] - 2026-01-15

### Added
- **Refresh Strategy Feature** - Regenerate strategy with new knowledge
  - Compare existing vs new fragments using `knowledgeUpdatedAt` timestamp
  - Generate change summary highlighting what's new
  - Version chain via `GeneratedOutput.previousOutputId`

- **Deep Dive Document Linking** - Documents uploaded from deep dive sheet are linked
  - `deepDiveId` passed through upload flow
  - Documents show in deep dive sheet's "Docs & Memos" tab

- **View-Only Initial Conversations** - Original strategy conversation is read-only
  - Prevents overwriting decision stack by continuing initial conversation
  - Identified by: no deepDiveId, extracted status, oldest createdAt

- **Early Access Preview Label** - Version badge in sidebar footer
  - Shows "Early Access Preview v1.7.x" for all users
  - Replaced demo mode badge

### Changed
- **Deep Dive Sheet Refactor** - Tabbed layout with Chats and Docs tabs
  - Removed resolve/dismiss buttons (redundant stubs)
  - ItemGroup pattern with "show more" for long lists
  - Consistent styling with Chats module tabs

- **Chat Scroll Anchoring** - Messages container auto-scrolls to latest

### Fixed
- **Guest User API Routes** - All deep dive and strategy routes now support guest cookies
- **Demo Seeding in Vercel** - Fixture files bundled via `outputFileTracingIncludes`
- **Insights Counter** - Fixed "all fragments new" by setting `knowledgeUpdatedAt` after fragment creation
- **Schema Sync** - `previousOutputId` column added to production database

---
## [1.7.0] - 2026-01-14

### Added
- **Structured Provocations** - Suggested questions and strategic gaps now have title + description
  - Schema: `suggestedQuestions` and `gaps` changed from `String[]` to `Json` (structured objects)
  - Generation prompts updated to output `{title, description}` format
  - UI displays title prominently with description below
  - Removes `parseProvocation()` hack that split strings on delimiters

- **Slack Signup Notifications** - Get notified when new users create accounts
  - Set `SLACK_WEBHOOK_URL` environment variable to enable
  - Fires on NextAuth `createUser` event

- **Project Page UI Polish**
  - "Unfinished" badge now navigates to Chats with "In Progress" tab open
  - "New to include" badge always visible (gray when 0, green when >0)
  - Chats module uses controlled tabs for programmatic navigation

### Changed
- **Seed Fixtures** - All demo fixtures updated with structured provocation format
  - `demo-extended.json`, `demo-dogfood.json`, `demo-simulated.json`, `test-minimal.json`

### Fixed
- **Prisma JSON Serialization** - Workaround for Prisma treating parsed JSON as text[]
  - JSON round-trip (`JSON.parse(JSON.stringify())`) in seed scripts

---
## [1.6.1] - 2026-01-14

### Added
- **useProjectActions Hook** - Consolidated project action logic into reusable hook
  - `createProject()`, `restoreDemo()`, `deleteProject()` with loading states
  - Optional paywall integration for create action
  - Used by HomePage, AppSidebar, and EmptyProjectState

- **Syntheses Support in Fixtures** - Fixture hydration now creates DimensionalSynthesis records
  - `FixtureSynthesis` type added to fixture schema
  - Demo fixtures can specify coverage levels and gaps per dimension
  - Enables "Close Gaps" section to work with demo data

### Changed
- **Project Combobox Reorganized** - All project actions now in one place
  - Add Project, Restore Demo, Delete Current Project moved from Settings menu
  - Cleaner separation: projects list above, actions below

- **Page Headings Updated**
  - Strategy page: "Current Strategy: Decision Stack"
  - Historical strategy view: "Decision Stack" with generated date
  - Thinking page: "Refine Your Strategic Direction" (unchanged)

- **New User Demo Fixture** - Switched from `demo-simulated` to `demo-extended`
  - BuildFlow construction project management scenario
  - Richer content: 2 conversations, 3 documents, 2 deep dives, 12 fragments
  - Includes dimensional syntheses with intentional gaps (GO_TO_MARKET, RISKS_CONSTRAINTS)

---
## [1.6.0] - 2026-01-14

### Added - Project Navigation Restructure

**Sidebar Improvements:**
- **Project Switcher Combobox** - Searchable dropdown replaces logo in sidebar header
  - Quick project switching without navigating away
  - Search filter for users with many projects
- **Fixed Action Buttons** - "New Chat" and "Upload Document" always visible in sidebar
  - Context-aware: actions apply to currently selected project
- **Cleaner Menu Design** - Removed chevrons from all collapsible sections
  - Reduces visual clutter, avoids clash with context menus

**Thinking Page Enhancements:**
- **Section Reordering** - Documents/Chats/Generated Strategies now above "What Luna Knows"
  - Prioritizes user content over system analysis
- **Gap Summaries** - "Close Gaps" section now displays dimension summaries and up to 3 specific gaps
- **Updated Heading** - Page heading changed to "Refine Your Strategic Direction"

**Strategy View Improvements:**
- **Project Context Header** - Strategy view now shows project name and description
- **Trace API Enhancement** - Returns `projectId` and `projectName` for better context

### Changed
- **Sidebar Labels** - "Strategy" → "Current Strategy" for clarity
- **Module Labels** - "Generated Strategy" → "Generated Strategies"
- **Simplified Strategy Route** - `/project/[id]/strategy` now redirects to latest trace

### Dependencies
- Added `@radix-ui/react-popover` for popover component
- Added `cmdk` for command palette component

---
## [1.5.2] - 2026-01-07

### Added
- **Project Empty State** - Focused "Get Started" view for empty projects
  - Two CTAs: "Start a Conversation" and "Upload a Document"
  - Shown when project has no fragments AND no conversations
  - CTA also added to empty "What Luna Knows" section

### Changed
- **Homepage Cleanup** - Simplified for guest-only flow
  - Removed `isAuthenticated` prop from `EntryPointSelector` and `IntroCard`
  - Gated features now always show lock icon (guests see sign-in gate)
  - Authenticated users auto-redirected to Project view

### Fixed
- **New Chat Navigation** - Authed users now go straight to conversation
  - Previously showed IntroCard entry point selector
  - Now auto-starts conversation when clicking "New Chat" from project
- **Long Filename Overflow** - Fixed document upload dialog overflow
  - Added proper overflow handling to truncate long filenames

---
## [1.5.1] - 2026-01-07

### Added
- **Universal Claude Truncation Detection** - All Claude API calls now use `createMessage()` wrapper
  - Automatic warning logs when responses hit `max_tokens` limit
  - Enforcement test prevents bypassing wrapper (`claude-wrapper.test.ts`)
  - Documented in `docs/ARCHITECTURE.md`

- **Contextual Gap Questions** - "Worth Exploring" items now show meaningful questions
  - Questions reference what Luna already knows about the business
  - Generated during `generateKnowledgeSummary` from full project context
  - Stored in `DimensionalSynthesis.gaps` for dimensions without fragments

- **Sign-In Gate for Premium Features** - Document upload and canvas gated behind auth
  - `SignInGateDialog` component prompts sign-in for gated features
  - Lock icon indicator on gated entry point cards
  - Guided Conversation remains available for guests

### Fixed
- **Guest-to-Auth Project Merge** - Fixed duplicate project issue during authentication
  - Previously: guest + existing user projects both transferred → 2 projects
  - Now: guest project data merged into existing project, "Guest Strategy" deleted
  - Prevents confusing "Guest Strategy" + "My Strategy" scenario

- **Knowledge Summary Race Condition** - Fixed missing gaps and "What Luna knows" summary
  - Both synthesis and knowledge summary were triggered in parallel after extraction
  - Knowledge summary now runs AFTER synthesis completes (sequential, not parallel)
  - Ensures `fragmentCount` is accurate when generating dimension-specific gap questions

- **Fire-and-Forget Serverless Issue** - Fixed background tasks not completing on Vercel
  - Document uploads stuck in "processing" - now awaits `processDocument()`
  - Extraction synthesis not completing - now awaits `updateAllSyntheses()`
  - All async operations properly awaited before response completes

- **Slow Extraction Performance** - Parallelized dimension syntheses
  - Dimension syntheses now run in parallel (was sequential)
  - Knowledge summary still runs after all syntheses complete

- **Jarring Page Reloads** - Smoother UX after authentication
  - Disabled NextAuth `refetchOnWindowFocus` to prevent reload on tab switch
  - Session transfer uses `router.refresh()` instead of `window.location.reload()`

### Removed
- **Deprecated Document Upload Flow** - Removed old home page document upload
  - Deleted `/api/upload-document` route (used wrong pipeline)
  - Deleted `DocumentUpload.tsx` and `DocumentSummary.tsx` components
  - Authenticated users should use project dashboard for document upload

---
## [1.5.0] - 2026-01-07

### Added - Project-Centric Navigation & Multi-Session Polish

**Project-First Navigation:**
- **Homepage Redirect** - Authenticated users now redirected to project dashboard
  - Redirect skipped if URL has `question`, `deepDiveId`, or `projectId` params
  - Unauthenticated users see intro flow as before
- **Sidebar Restructure** - Removed conversations section, added quick actions
  - New Chat and Upload buttons in sidebar body
  - Lunastak logo in sidebar header
  - Projects and Your Lunastak sections remain

**Project View Enhancements:**
- **Conversation Starring** - Star conversations directly from project view
  - Starred (3) and Recent (3) sections with expand/collapse
  - Star persists via Trace model (leverages existing infrastructure)
  - New API: `POST /api/conversation/[id]/star`
- **Conversation Titles** - Generated during extraction, shown in lists
  - Titles like "Market expansion strategy", "B2B pricing model"
  - Backfill script for existing conversations
  - Date format: "13 Jan '26"
- **Deep Dives Polish** - Consistent dismissal UX
  - Whole item clickable to open sheet
  - X button and dropdown dismiss option
  - Dismiss button in sheet alongside Resolve
  - Status badges: "In progress", "Ready to explore", "Resolved"

**UI Polish:**
- **Layout** - Knowledge Base card combines stats + dimensional coverage
- **Luna Wonders** - Renamed from "Opportunities to Enrich"
- **Worth Exploring** - Renamed from "Areas of Focus" with better positioning
- **Deep Dives** - Renamed to "Your Deep Dives" for personalization

### Changed
- Sidebar truncation: Recent conversations limited to 5 with "See more"
- Project view conversations limited to 3+3 (starred + recent)

### Fixed
- Deep dive dismissal wired to UserDismissal API
- Conversation-level deferral controls visibility

---
## [1.4.4] - 2026-01-06

### Added
- **Data Contracts** - TypeScript contracts for extraction/generation/persistence boundaries
  - `src/lib/contracts/` - Contract type definitions
  - Extraction contracts: EmergentExtractionContract, PrescriptiveExtractionContract
  - Persistence contracts: FragmentContract, FragmentDimensionTagContract
  - Generation contracts: GenerationInputContract, GenerationOutputContract
  - Validation functions for runtime checking

- **Contract Tests** - Integration tests verifying contracts at seams
  - `src/lib/__tests__/contracts/extraction-contracts.test.ts`
  - `src/lib/__tests__/contracts/generation-contracts.test.ts`
  - `src/lib/__tests__/contracts/persistence-contracts.test.ts`

- **Smoke Test** - End-to-end verification of critical path
  - `src/lib/__tests__/smoke.test.ts`
  - Tests extraction → fragment persistence → generation flow
  - Mocked AI responses for determinism

- **Verification Scripts**
  - `npm run smoke` - Run smoke tests only
  - `npm run verify` - Full verification (type-check + tests + smoke)

- **Pre-Push Hook** - Enforces verification before push
  - Runs `npm run verify` automatically
  - Blocks push on failure
  - Bypass with `--no-verify` when needed

### Documentation
- Added `src/lib/contracts/README.md` explaining contract usage
- Updated `.claude/architecture.md` with contracts documentation
- Added Schema Change Policy to protect Prisma schema

---
## [1.4.3] - 2026-01-06

### Changed
** Migrated to Sonnet 4.5 Model for Claude API, as Opus 3 has been retired. This should have been done a while ago!

### Added
** New API endpoint `/extraction` that displays synthesis, reflective summary, and fragment extraction for evals (not user facing)

## [1.4.2] - 2026-01-05

### Added - E3: Dimension-Guided Questioning + Auth Flow + Statsig Experiments

**E3 Experiment Implementation:**
- **Dimension-Guided Questioning** - Questions explicitly guided toward uncovered dimensions
  - New variant: `dimension-guided-e3` (running parallel with E2's emergent approach)
  - Updated `src/app/api/conversation/continue/route.ts` with variant-aware prompts
  - E3 prompt includes 11 Tier 1 strategic dimensions for Claude's awareness
  - E3 uses emergent theme extraction (same as E1a), not baseline prescriptive format
- **Experiment Documentation**
  - One-pager: `docs/experiments/one-pagers/E3-dimension-guided.md`
  - Statsig experiments guide: `docs/STATSIG_EXPERIMENTS.md`
  - Updated experiment register with E2/E3 parallel testing

**Statsig A/B Experiments:**
- **Proper Experiment Setup** - Migrated from feature gates to Statsig experiments
  - Experiment ID: `questioning_approach` with `variant` parameter
  - Valid variants: `baseline-v1`, `emergent-extraction-e1a`, `dimension-guided-e3`
  - Uses `VERCEL_ENV` for environment tier (production/preview/development)
- **Custom Event Logging** - Key metrics for experiment analysis
  - `dimensional_coverage` - Logged after extraction (0-100%)
  - `quality_rating` - Logged when user rates output (1=good, 0=bad)
  - `strategy_generated` - Logged after generation
  - Events flushed immediately in serverless environment
- **Helper Scripts**
  - `scripts/sync-ratings-to-statsig.ts` - Batch sync ratings from DB to Statsig
  - Manual override via `?variant=dimension-guided-e3` URL param

**Double Opt-In Auth Flow:**
- **Subscribe Endpoints** - Guest-to-auth conversion without upfront friction
  - `POST /api/subscribe` - Captures email, sends confirmation email
  - `GET /api/subscribe/confirm` - Confirms email, redirects to sign-in
  - Supports `conversationId` param for session transfer after auth
- **Global Session Transfer** - Reliable guest-to-auth data migration
  - `SessionTransferProvider` - Runs on any page, not just homepage
  - Triggers page reload after transfer to refresh UI state
  - Dispatches `strategySaved` event to update sidebar
- **Email Infrastructure**
  - `src/emails/` - Email components and templates (EmailLayout, SubscribeConfirmEmail)
  - `src/lib/resend.ts` - Shared Resend client with EMAIL_CONFIG
  - `src/lib/crypto.ts` - Token encryption for confirmation links
  - `src/lib/render-email.ts` - Email rendering utility
- **Note:** Duplicates infrastructure from marketing site (lunastak.io) for self-contained operation

**UI Refinements:**
- **Extraction Summary Redesign**
  - Main card: muted green background (`bg-primary/5`)
  - Theme cards: white background with shadow for visual pop
  - OR divider between "Generate" and "Continue" options
  - Quote-style follow-up question display in refine card
- **Intro Card Refresh**
  - Added Luna avatar (animated-logo-glitch.svg)
  - Playful copy: "I ask great questions, and I'm a really good listener"
  - Removed fast-track entry point, horizontal 3-column layout
- **Early Exit UX** - Improved flow when confidence is high
  - Green "Generate Strategy" button instead of "Type A or B"
  - OR divider with contextual follow-up question below
  - User can click button or reply to continue conversation
- **Sidebar Enhancements**
  - Version and variant indicator (only shown during active conversation)
  - Format: `v1.4.2 · dimension-guided-e3`
- **Statsig Client Integration**
  - Added `StatsigProvider.tsx` with session replay and web analytics autocapture
  - Client key configured via `NEXT_PUBLIC_STATSIG_CLIENT_KEY`

**Developer Tools:**
- **Stub Mode** for UI development
  - `GET /api/conversation/[id]/stub` - Loads real extraction data from DB
  - Use `?stub=conversationId` URL param to bypass API calls
  - Documentation in `.claude/README.md`
- **Trace API** - New endpoint for strategy page
  - `GET /api/trace/[traceId]` - Fetches trace data with ownership check

### Changed
- Removed `onFlagForLater` and `onDismiss` props from ExtractionConfirm (unused)
- RegistrationBanner now uses double opt-in flow instead of direct NextAuth

### Fixed
- E3 variant now uses emergent theme extraction (was incorrectly using baseline format)
- Subscribe confirm route uses `force-dynamic` for Next.js serverless
- Session transfer works regardless of which page magic link returns to

### Dependencies
- Added `@react-email/components` for email templating

### Environment Variables
- `RESEND_AUDIENCE_ID` - Resend audience ID for contact management
- `ENCRYPTION_KEY` - 32-byte hex key for token encryption (must match lunastak.io)
- `NEXT_PUBLIC_APP_URL` - App URL for confirmation links (must include https://)
- `NEXT_PUBLIC_STATSIG_CLIENT_KEY` - Statsig client SDK key
- `NEXTAUTH_URL` - Must be set to `https://app.lunastak.io` for production

---

## [1.4.1] - 2026-01-04

### Changed
- **Sidebar UX Improvements**
  - Added prominent "New Conversation" button in sidebar header with primary green styling
  - Increased sidebar width from 16rem to 21rem for better content display
  - Sidebar now closed by default
  - Added margin above "Starred" section for better visual spacing
  - Made logo clickable (navigates to home) and brand-colored (green)

- **Loading Indicator Refinements**
  - Simplified `ExtractionProgress.tsx`: removed animated dots and spinner, slowed pulse animation to 3s
  - Added consistent animated ellipsis loading indicator to `ChatInterface.tsx` and `IntroCard.tsx`
  - Unified loading state styling across all conversation components

---

## [1.4.0] - 2026-01-04

### Added - Fragment Extraction & Synthesis Implementation

**Overview:** Populates the new Schema V1 tables (Fragment, FragmentDimensionTag, DimensionalSynthesis, GeneratedOutput, ExtractionRun) by updating the extraction and generation flows.

**Core Features:**
- **Fragment Creation from Extraction** - Creates Fragment records from emergent themes during extraction
  - `src/lib/fragments.ts` - Fragment service with `createFragment`, `createFragmentsFromThemes`, `getActiveFragments`
  - `src/lib/dimensional-analysis.ts` - Added `convertCoverageToDimensionTags` function
  - Fragments tagged with Tier 1 dimensions via `FragmentDimensionTag` records
  - Extraction route (`/api/extract`) now creates fragments for project-linked conversations

- **Synthesis Algorithm** - Full and incremental synthesis for dimensional understanding
  - `src/lib/synthesis/types.ts` - `SynthesisResult`, `FragmentForSynthesis` types
  - `src/lib/synthesis/full-synthesis.ts` - Synthesizes all fragments into coherent understanding
  - `src/lib/synthesis/incremental-synthesis.ts` - Merges new fragments into existing synthesis
  - `src/lib/synthesis/update-synthesis.ts` - Orchestrates full vs incremental based on staleness, fragment count
  - Synthesis triggered asynchronously after fragment creation (doesn't block extraction response)

- **GeneratedOutput & ExtractionRun Tracking** - Evaluation infrastructure
  - `src/lib/extraction-runs.ts` - Creates ExtractionRun records with synthesis snapshots
  - Generation route (`/api/generate`) now creates GeneratedOutput and ExtractionRun records
  - Captures syntheses before/after for A/B evaluation

- **Guest User Isolation (HUM-49)** - Full data tracking for unauthenticated users
  - Guest sessions now create real User + Project records (`guest_<id>@guest.lunastak.io`)
  - Enables fragment tracking and ExtractionRun creation for all users
  - Session transfer moves all data (Projects, Conversations, Traces) when guest authenticates
  - `src/lib/projects.ts` - `createGuestUser`, `isGuestUser`, updated `getOrCreateDefaultProject`
  - `src/lib/transferSession.ts` - Now transfers Projects in addition to Conversations and Traces

- **Inline Dimension Tagging (HUM-47)** - More reliable dimension extraction
  - Dimensions tagged during theme extraction, not post-hoc matching
  - Extraction prompt includes dimension definitions for Claude
  - Eliminates fuzzy matching failures between theme names

- **Streaming Extraction Progress** - Better UX during long operations
  - `src/components/ExtractionProgress.tsx` - Step-by-step status display
  - Extract API streams JSON progress updates
  - Steps: extracting_themes → analyzing_dimensions → generating_summary → saving_insights

**Testing & Verification:**
- `scripts/test-fragment-flow.ts` - Integration test for fragment creation and synthesis
- Updated `scripts/migrations/verify-migration.ts` with checks 5-8 (fragments, syntheses, outputs, runs)
- `src/lib/__tests__/projects.test.ts` - 12 tests for guest user isolation
- `src/lib/__tests__/dimensional-analysis.test.ts` - 7 tests for inline dimension coverage
- All 55 tests pass, no TypeScript errors

**Documentation:**
- Updated `.claude/architecture.md` with Extraction → Fragment → Synthesis flow

### Changed
- **Documentation Consolidation** - Streamlined Linear integration documentation
  - Consolidated 5 separate Linear docs into `.claude/README.md` backlog management section
  - Migrated feature backlog to Linear issues (HUM-26 through HUM-31)
  - Keep only `linear-create-issue.ts` for ongoing use
- **Release Workflow Enhancement** - Added mandatory pre-release checklist to `CONTRIBUTING.md`
  - Ensures CHANGELOG.md, VERSION_MAPPING.md, and .claude/README.md are updated before release
  - 8-point checklist to prevent missing version documentation

### Removed
- **One-time Linear Scripts** - Removed setup and testing scripts after completion
  - Deleted `linear-setup.ts`, `linear-import-history.ts`, `linear-find-duplicates.ts`
  - Deleted `linear-check-team-repos.ts`, `test-linear-github.ts`
  - Removed corresponding npm scripts: `linear:setup`, `linear:import`, `linear:test`
- **Obsolete Test Folder** - Removed `/tests` directory
  - Contained only E1a manual test checklist (released in v1.1.0, Dec 2025)
  - UAT/testing now handled in implementation plans and PR descriptions
- **Redundant Claude API Call** - Removed `analyzeDimensionalCoverage` from extraction
  - Dimensional coverage now computed from inline dimensions (no separate Claude call)
  - Reduces extraction time by ~15-20 seconds

### Fixed
- **Extraction Timeout (HUM-48)** - Fixed 60s Vercel timeout during extraction
  - Increased `max_tokens` from 800 to 2000 for inline dimension prompt
  - Removed redundant dimensional analysis Claude call
  - Added EXTRACTION phase recovery handler in continue API
- **v1.3.0 Release Documentation** - Added missing release notes from 2026-01-03
  - Added v1.3.0 entry to CHANGELOG.md (E2 Dimensional Coverage Tracking)
  - Updated VERSION_MAPPING.md status: "Pending UAT" → "Production"
  - Updated .claude/README.md current version and date

---

## [1.3.0] - 2026-01-03

### Added - Experiment 2: Dimensional Coverage Tracking

**Overview:** Post-extraction dimensional analysis for emergent extraction (E1a), mapping emergent themes to 10 strategic dimensions for coverage validation and gap identification.

**Core Features:**
- **Dimensional Coverage Analysis** - Automated mapping of emergent themes to strategic dimensions
  - 10 Tier 1 strategic dimensions (Customer & Market, Strategic Intent, Differentiation & Advantage, etc.)
  - Claude API integration for theme-to-dimension mapping
  - Coverage percentage calculation (themes matched / total dimensions)
  - Dimension tags stored in database for querying and analysis
- **Backfill Script** - Apply dimensional coverage to existing traces
  - `scripts/backfill-dimensional-coverage.ts` - Processes historical data
  - Updates all emergent extraction traces with dimensional analysis
  - Batch processing with rate limiting
- **Analysis Tools** - Python functions and Jupyter notebooks
  - `scripts/dimensional_coverage_analysis.py` - Load and analyze coverage patterns
  - `notebooks/dimensional_coverage_analysis.ipynb` - Interactive exploration
  - Coverage distribution analysis, gap identification, theme mapping insights

**Technical Implementation:**
- New field: `Trace.dimensionalCoverage Json?` in Prisma schema
- `src/lib/dimensional-analysis.ts` - Core analysis logic
- API integration: extract → analyze dimensions → store → query
- TypeScript type definitions for dimensional coverage data
- Unit tests for dimension mapping logic

**Documentation:**
- Experiment one-pager: `docs/experiments/one-pagers/E2-dimensional-coverage.md`
- Implementation plan with UAT checklist
- Deployment strategy and rollback procedures

---

## [1.2.2] - 2025-12-30

### Fixed
- **React Hydration Error** - Fixed server/client mismatch in authentication state
  - Fetch session server-side in layout.tsx using `getServerSession()`
  - Pass session to SessionProvider to ensure consistent SSR/client rendering
  - Removed `suppressHydrationWarning` workaround
- **Foreign Key Constraint Error** - Fixed event logging timing issue
  - Event logging now waits for conversation creation before attempting to log
  - Prevents `'no-conversation-yet'` string from violating FK constraint
- **Conversation Not Loading** - Fixed missing flowStep state transition
  - Added `setFlowStep('chat')` when conversation starts
  - Chat interface now renders correctly after conversation creation
- **Defensive Error Handling** - Added validation for extractedContext structure
  - Type guard checks for prescriptive vs emergent extraction formats
  - User-friendly error message if invalid data structure received
  - Diagnostic logging for debugging extraction issues

### Technical
- Enhanced logging in extract API and frontend for debugging
- Improved type safety with runtime validation checks

---

## [1.2.0] - 2025-12-22

### Added - Cold Start Entry Points
- **Four Entry Point Options** - Multiple on-ramps to solve cold start problem
  - Guided Conversation (live) - Traditional Q&A flow
  - Upload Document (live) - Extract from PDFs, DOCX, TXT, MD files
  - Start from Canvas (fake door) - Visual strategy builder validation
  - Fast Track (fake door) - Quick multiple choice validation
- **Document Upload & Extraction** - unstructured.io integration
  - Drag-and-drop file upload with validation (10MB max)
  - AI-generated document summary before starting
  - Context-aware first question based on uploaded content
  - Document stored as system message for continuous reference
- **Redesigned Objective Cards** - Cleaner, more engaging SMART goals
  - Timeframe badge in top-left corner (3M/6M/9M/12M/18M)
  - Objective text decoupled from metrics and timeframes
  - Metric display: `↑ Market share | from 20% to 35%`
  - Intelligent parser extracts metrics from Claude-generated text
  - Supports flexible formats: percentages, currency, counts, qualitative
- **Info Dialog Component** - Separated educational content from fake doors
  - Bold text formatting support for markdown-style `**text**`
  - Real Google Decision Stack examples
  - No voting buttons (distinct from FakeDoorDialog)
- **Regeneration Tools** - Developer productivity for testing
  - Local script: `npm run regen <traceId>` for direct DB access
  - Remote API: `npm run regen:remote <traceId> [baseUrl]` for preview/prod
  - `/api/admin/regenerate` endpoint works on any deployment
  - Perfect for testing prompt changes without redoing Q&A

### Changed
- **Terminology Correction** - Renamed "Mission" to "Strategy" throughout
  - More accurate reflection of coherent choices concept
  - Updated types, UI labels, API prompts, XML tags
- **Enhanced Info Popovers** - Better examples and formatting
  - "Like this..." and "Not this..." headings (was "Good/Wooden")
  - Real-world Google examples for all Decision Stack elements

### Technical
- New dependencies: `unstructured-client`, `react-dropzone`, `tsx`
- New components: EntryPointSelector, DocumentUpload, DocumentSummary, FakeDoorDialog, InfoDialog
- New API routes: `/api/upload-document`, `/api/admin/regenerate`
- Event tracking: `entry_point_selected`, `document_uploaded`
- Environment: `UNSTRUCTURED_API_KEY` required for document upload
- Type updates: Added `direction`, `metricName`, `metricValue`, `timeframe` to ObjectiveMetric

---

## [1.1.0] - 2025-12-17

### Added - E1a: Emergent Extraction

**Experiment:** E1a (`emergent-extraction-e1a`)
**Hypothesis:** Completely freeform extraction (no prescribed fields) will produce less "wooden" outputs while maintaining dimensional coverage
**Status:** Implementation complete, ready for data collection

#### Features
- **Statsig SDK Integration** - Feature flag system for dynamic A/B testing
  - Server-side feature gates via `statsig-node`
  - Environment-based configuration
  - Graceful fallback to baseline when unavailable

- **Emergent Extraction Logic** - Extract 3-7 themes that emerge naturally from conversation
  - No prescribed fields (industry, target_market, unique_value)
  - Theme names generated by Claude based on actual conversation
  - Adaptive prompting based on variant

- **Dual Schema Support** - Type-safe handling of both extraction approaches
  - `EmergentExtractedContext` - Themes-based extraction
  - `PrescriptiveExtractedContext` - Field-based extraction (baseline)
  - Union types with type guards for safe discrimination

- **Adaptive Confidence Assessment** - Different evaluation criteria per variant
  - Emergent: "Do I understand this business strategically?"
  - Prescriptive: "Do I have enough for prescribed fields?"

- **Adaptive Generation** - Strategy generation uses appropriate context
  - Emergent: Generates from emergent themes
  - Prescriptive: Generates from core fields + enrichment

- **Dynamic UI** - ExtractionConfirm component adapts to schema
  - Emergent: Displays themes in card format
  - Prescriptive: Displays labeled fields
  - Shared reflective summary section

#### Testing & Analysis Tools
- **Variant Display** - Shows active variant in sidebar for easy verification
- **Variant Override** - URL parameter `?variant=X` for controlled testing
- **Dimensional Coverage Analyzer** (`scripts/dimensional_coverage.py`)
  - Retrospective analysis tool
  - Codes emergent themes to strategic dimensions
  - Validates E1a captures critical dimensions (>80% coverage target)
- **Test Plan** (`tests/e1a-test-plan.md`) - Complete manual testing checklist

#### Documentation
- **One-Pager** - `docs/experiments/one-pagers/E1a-emergent-extraction.md`
- **Deployment Guide** - `docs/deployment/E1A_DEPLOYMENT_GUIDE.md`
- **Updated Experiment Register** - Tracks E1a status and metrics
- **Implementation Plan** - Preserved in `docs/plans/`

#### Technical Details
- Feature flag: `emergent_extraction_e1a`
- Variant assignment: Dynamic via Statsig per user
- Database: `experimentVariant` field tracks variant per conversation
- Backwards compatible: Baseline-v1 unchanged, runs in parallel

### Changed
- `ExtractedContext` types now support variant discrimination
- API routes (`/api/extract`, `/api/generate`) handle both schemas
- Page state management updated for variant tracking

### Fixed
- Added debug logging for Statsig initialization and gate checks
- Environment variable validation for Statsig configuration

---

## [1.0.0] - 2025-12-13

### Added - E0: Baseline-v1

**Experiment:** E0 (`baseline-v1`)
**Purpose:** Establishes normalized control for all future experiments
**Status:** Complete and stable

#### Features
- **Adaptive Conversation Flow** - 3-10 questions based on confidence assessment
- **Prescriptive Extraction** - Structured extraction with core + enrichment fields
  - Core: industry, target_market, unique_value
  - Enrichment: competitive_context, customer_segments, operational_capabilities, technical_advantages
- **Reflective Summary** - Identifies strengths, emerging areas, and opportunities
- **Confidence-Gated Generation** - Only generates when confidence is HIGH/MEDIUM
- **Complete Strategy Output** - Vision, Mission, Objectives, Initiatives, Principles
- **Event Logging** - Comprehensive tracking for analysis
- **Quality Rating System** - Researcher can rate output quality (good/bad)
- **User Feedback** - Users can mark outputs as helpful/not_helpful

#### Infrastructure
- Next.js 14 app router
- Prisma ORM with PostgreSQL
- Claude API integration (Sonnet 3.5)
- TypeScript throughout
- Tailwind CSS + Catalyst UI

---

## Version-to-Experiment Mapping

| Version | Experiment | Variant ID | Description |
|---------|------------|------------|-------------|
| v1.0.0  | E0         | `baseline-v1` | Prescriptive extraction baseline |
| v1.1.0  | E1a        | `emergent-extraction-e1a` | Emergent theme extraction |

Future releases will increment according to semantic versioning:
- **Major (2.0.0):** Breaking changes, incompatible API changes
- **Minor (1.x.0):** New features, backward compatible
- **Patch (1.1.x):** Bug fixes, backward compatible

---

## Deployment Notes

### v1.1.0 Deployment

**Prerequisites:**
1. Statsig account with server secret key
2. Feature gate `emergent_extraction_e1a` created in Statsig dashboard
3. Environment variable `STATSIG_SERVER_SECRET_KEY` set in production

**Rollout Strategy:**
1. Deploy to production with gate at 0%
2. Enable for 2-3 test users via Statsig targeting
3. Gradual rollout: 10% → 25% → 50%
4. Target: 10-15 participants per variant
5. Analyze results before full rollout

**Rollback Plan:**
- Set Statsig gate to 0% (instant rollback, no code deployment needed)
- All users automatically revert to baseline-v1

See `docs/deployment/E1A_DEPLOYMENT_GUIDE.md` for full details.
