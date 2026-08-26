# `src/lib/experiment/`

**Kept deliberately after the Phase 4 decision (2026-08-26).** This began as disposable
scaffolding for the model-bump comparison; two of its three pieces earned a permanent place and
the third was deleted. Decision record: Drive
`05-Initiatives/Lunastak/Test-Data/20260826-model-upgrade/decision.md`.

| File | Status | Why |
|---|---|---|
| `capture.ts` | **Kept** | It is the only reason a production-shaped parse bug could be diagnosed from real traffic. `extractXML` was silently discarding a complete strategy; the captured request/response pair is what proved the cause and verified the fix. That capability is worth more than the experiment it was built for. |
| `pricing.ts` | **Kept** | $/MTok rates + `costUsd()`. Useful independent of any experiment — and the experiment showed rate cards do not predict cost, so having the arithmetic in one tested place matters. |
| `replay.ts` (was in `tools/`) | **Deleted** | Built for the Phase 2 replay pass, which never ran and was closed as moot. Never executed live. Recoverable from git history if a future model bump wants it. |

## Rules that still bind

1. **Exactly one production import.** `createMessage()` calls `captureCall()`. Nothing else in
   the app may import from here — ratcheted by `experiment-containment.test.ts`. If a second
   importer appears, this stopped being an instrument and needs a real design.
2. **Hard off in production.** `isCaptureEnabled()` returns false when `NODE_ENV === 'production'`
   regardless of `LUNASTAK_CAPTURE_DIR`. Payloads are user content, and a serverless filesystem
   is ephemeral anyway.
3. **Never throws.** A measurement failure must never cost a user's generation.

## Using capture

```bash
LUNASTAK_CAPTURE_DIR=/tmp/capture npm run dev
```

One JSON file per LLM call: the resolved request, the response text, model, tokens, latency,
`stopReason`, and a `truncated` flag. This is the fastest route to diagnosing "the model did
something odd" — it records what was actually sent, not what we think was sent.
