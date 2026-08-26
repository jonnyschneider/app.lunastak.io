# `src/lib/experiment/` — disposable eval scaffolding

**This is not application code.** It is the instrument for the model-bump comparison
(`docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md`, desk thread #15).

It lives under `src/lib/` only because `tools/experiment/replay.ts` and the `createMessage()`
wrapper both need to import it. Treat everything here as **provisional until the Phase 4
decision**, at which point it is either promoted deliberately or deleted.

| File | What | Fate after the decision |
|---|---|---|
| `capture.ts` | Records resolved requests + responses to disk for replay | Keep only if we want a standing eval capability. Otherwise delete. |
| `pricing.ts` | $/MTok rate table + `costUsd()` | Keep — useful independent of this experiment — but it belongs somewhere better than `experiment/`. |

## Rules while it exists

1. **Exactly one production import.** `createMessage()` calls `captureCall()`. Nothing else in
   the app may import from this directory — if that changes, this stopped being scaffolding and
   needs a real design.
2. **Hard off in production.** `isCaptureEnabled()` returns false when `NODE_ENV === 'production'`
   regardless of `LUNASTAK_CAPTURE_DIR`. Payloads are user content.
3. **Never throws.** A measurement failure must never cost a user's generation.

## Why it is marked rather than designed

The final shape depends on answers the experiment exists to produce — whether the winning
configuration is one model or a per-stage map, and whether per-stage `max_tokens` ceilings need
re-tuning. Designing this surface now would be guessing. See ARCHITECTURE.md → Known
Compromises → "Provisional surface".
