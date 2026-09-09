# Retired: `ExtractionRun` and the extraction-eval viewers

**Retired:** 2026-09-08 · **Recovery tag:** `extraction-run-final` (`2812f38`)
**Schema drop:** deferred to deploy — see `prisma/SCHEMA_CHANGELOG.md`

```bash
git checkout extraction-run-final -- src/lib/extraction-runs.ts   # or any path below
```

## What it was

`ExtractionRun` tracked extraction+generation runs "for evaluation": model used, token counts,
latency, experiment variant, the fragment ids produced, and `synthesesBefore`/`synthesesAfter`
JSON snapshots. Written on every generation. Three UI surfaces displayed it:

- `src/components/ExtractionConfirm.tsx` — "here's what was extracted, confirm before generating"
- `src/app/extraction/[id]/` + `src/app/api/extraction/[id]/` — inspect one run by id
- `src/app/demo/extraction/` + `src/app/api/demo/extraction/` — the same view, pinned to one
  hardcoded conversation

## Why it was retired — the honest version

**It was write-only.** Rows accumulated on every generation for months, and nothing read them
except viewers nobody could reach:

- neither page was linked from anywhere in the app
- `/demo/extraction` was shadowed by the demo-slug middleware (`matcher: '/demo/:path*'`) and
  resolved only because no project happened to carry `demoSlug: 'extraction'`
- its buttons called `alert('Demo mode - Generate disabled')`
- **no experiment or evaluation tooling ever consumed it** — no reference in
  `src/lib/experiment/`, `src/lib/evaluation/`, `scripts/` or `tools/`
- `scripts/one-offs/gate-fixture.ts:13` had already classified it as telemetry and excluded it

`ExtractionConfirm` was separately carried as an `open` disposition in `service-blueprints.md`
— reachable only from a failed-generation `catch`, ruled "revive or delete". The ground-truth
review then added `GroundTruthReview`, doing materially the same job on the happy path, without
resolving the old surface. Two overlapping surfaces, one of them unreachable.

## The failure mode worth remembering

Evaluation infrastructure was built write-first: the table and the write path shipped, the
consumer never did. Nothing failed, so nothing surfaced it — a write with no reader is silent by
construction. It took an architecture conformance review (2026-09-08) asking *"does the code
match the documented design?"* rather than *"does it break a rule?"* to find it. The conventions
audit run the same day passed it clean, because no written rule was broken.

The corollary: **a table nothing reads is a cost with no benefit, and it will not announce
itself.** If evaluation data is worth capturing, the consumer ships with the producer or the
capture is deferred.

## What stayed

- **`Trace`** — live, and not related despite appearances. Read by `/api/trace/[traceId]`,
  `/api/quality-rating`, `/api/strategies`, `/api/demo/strategy`. The deleted
  `/api/extraction/[id]` fell back to `Trace.id`, which is the only reason they looked connected.
- **`DecisionStackSnapshot`** — the live generation-metadata record, unaffected.
- **`ExtractionConfirm`'s namesakes** — `ChatInterface`'s `onGenerateStrategy` and
  `isFirstStrategy` props are unrelated chat affordances that share a name.

## Deleted

| path | lines |
|---|---|
| `src/components/ExtractionConfirm.tsx` + its test | ~250 |
| `src/app/demo/extraction/page.tsx` + `src/app/api/demo/extraction/route.ts` | ~470 |
| `src/app/extraction/[id]/page.tsx` + `src/app/api/extraction/[id]/route.ts` | ~570 |
| `src/lib/extraction-runs.ts` | ~75 |
| the write path in `src/lib/pipeline/generation.ts`, the `deleteMany` cleanup in `src/app/api/projects/[id]/route.ts`, and two dead test mocks | ~30 |
