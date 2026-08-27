# Retired — the prompt registry (`src/lib/prompts/index.ts`)

**Retired:** 2026-08-27 · **Recovery tag:** `prompt-registry-final`
**Replaced by:** the LLM stage policy table (`src/lib/llm/policy.ts`) + `promptHash` provenance
**Design:** `docs/_plans/2026-08-27-llm-seam-consolidation-design.md` §5 (local, R&D record)

Recovery is one command:

```bash
git checkout prompt-registry-final -- src/lib/prompts
```

## What it was

A registry of versioned prompt templates — `PROMPT_REGISTRY`, `getCurrentPrompt()`,
`getPrompt()`, `listPromptVersions()` — with per-version metadata (`requiredInputs`,
`optionalInputs`, `minTraceSchemaVersion`, `deprecatedAt`) intended to support prompt
A/B testing and replay.

## Why it was retired

**Its consumer was never built.** The registry arrived as item 4 of 4 in
`docs/_plans/2026-01-31-extraction-api-optimisation.md` — *"Introducing prompt registry for
versioning and future experimentation"* — which specified a backtest harness:

```
scripts/
├── backtest.ts      # Replay traces through prompt versions
└── eval-report.ts   # Generate comparison report
```

`git log --diff-filter=A` across all branches returns nothing for either file. Neither was
ever created.

The contemporaneous record says so directly. Drive `Repo-Archive/R&D-LOG.md`, 2026-02-02,
*"Eval infrastructure over formal backtesting"*:

> Qualitative comparison possible, but **proper backtesting needs versioned API archival
> (future work)**.

What *was* built instead — the eval harness — did real work for about six weeks (four version
comparisons, 2026-01-31 to 2026-02-13). Then `5df8f6a` (2026-04-07) untracked `/e2e`, `/evals`
and `/scripts` from the public repo. **The half of this system outside the codebase was already
decommissioned. The registry was the last piece standing, and the piece that never had a
consumer.**

State at retirement:

- 1 adopter across 26 LLM call sites (`v4-pithy-statements`, via `pipeline/generation.ts`)
- 3 dead generation versions (v1, v2, v3)
- 1 entry flagged `current: true` that was never called (`reflective-summary/v1`)
- 1 extraction entry with no importers outside the registry (`extraction/v1-emergent`) — the
  live extract route uses its own local `EMERGENT_EXTRACTION_PROMPT` const
- `minTraceSchemaVersion` and `requiredInputs` read solely by `src/lib/evaluation/compatibility.ts`,
  **which itself had zero importers** (deleted in the same branch)
- `optionalInputs`, `deprecatedAt`, `listPromptVersions()`, `getPrompt()`: zero uses anywhere

## Impact outside the codebase: none

Every external artefact bakes the version in **as a data string**, not as a call into the registry.

| Artefact | Impact |
|---|---|
| Drive `Repo-Archive/evals/snapshots/` (4 JSONs) | none — self-contained exports |
| Drive `Prod-Traces/*.eval.json`, `2026-02-23-strategy-eval.ipynb` | none — reads exported JSON |
| `src/app/admin/eval/[evalId]/page.tsx` | survives — renders `trace.promptVersions.*`, a string on the trace |
| R&D tax evidence | none — the design docs are the record |

The only genuine loss is re-running an old prompt version in-process, which was not possible
today either: the inputs, model, effort and `max_tokens` have all moved underneath those
templates.

## What replaced it

**The principle: preserve evidence, not templates.** A template cannot be replayed faithfully
once everything around it has moved.

1. **`promptHash` at the seam** — sha256 of the resolved `system` + user content, computed in
   `createMessage()`, stamped on `llm_token_usage` and `captureCall()`. It answers "which prompt
   produced this output" for **all 20 stages**, not the three the registry knew about. This is
   the "versioned API archival" the 2026-02-02 entry said was missing, done cheaply. A hash
   carries no user content, so it is production-safe.
   *Known limit, stated rather than hidden:* `llm_token_usage` fires only when `userId` is
   present, and 10 of 26 sites pass none — the durable hash inherits that existing telemetry gap.
   `captureCall` records it regardless, locally.
2. **Contemporaneous evidence on Drive, per arc** — `Test-Data/20260826-model-upgrade/` is the
   working pattern. The entire voice arc (a real prompt A/B, 16 calls, em-dash density 64 → 2,
   a shipped decision) ran **without touching the registry once**.
3. **The policy table** (`src/lib/llm/policy.ts`) — where per-stage prompt configuration lives
   now, exhaustive by type and testable.

## What was kept

`src/lib/prompts/shared/*` — voice, plain-language, question-titles, objectives,
vision-strategy. These are real, load-bearing, and now composed into guidance bundles by the
policy table. `generation/v4-pithy-statements` was inlined at its single call site as
`GENERATION_PROMPT` in `src/lib/pipeline/generation.ts`.
