/**
 * Stage capture for the model-bump experiment (Phase 1).
 *
 * Records each pipeline stage's RESOLVED request and its response, so Phase 2
 * can replay the identical payload against the other arms in isolation — the
 * only way to attribute a quality difference to a stage rather than to better
 * input arriving from upstream.
 *
 * Two hard rules, both tested:
 *   1. OFF unless LUNASTAK_CAPTURE_DIR is set. This writes prompts — and
 *      therefore user content — to disk.
 *   2. It NEVER throws. Losing a user's paid generation to a capture failure
 *      would be far worse than losing the measurement.
 *
 * Design: docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md
 */

import * as fs from 'fs'
import * as path from 'path'
import { extractText } from '@/lib/extract-text'

export interface CaptureInput {
  context: string
  /** The request as actually sent, post-resolution — replayable verbatim. */
  request: unknown
  response: unknown
  latencyMs: number
}

/**
 * Payload capture is a LOCAL-DEVELOPMENT instrument and refuses to run in
 * production — the gate is structural, not documentary.
 *
 * Two reasons it could never be useful deployed: a serverless invocation's
 * filesystem is ephemeral (the captures vanish, unreadable), and the payloads
 * are user content. Whoever sets this env var on a deployed environment in six
 * months will not have read the warning comment; this makes that harmless.
 *
 * The metrics that ARE valuable in production (context, model, tokens, latency,
 * truncation) carry no user content and flow through the Statsig
 * `llm_token_usage` event in createMessage() instead.
 */
export function isCaptureEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return Boolean(process.env.LUNASTAK_CAPTURE_DIR)
}

/** Monotonic suffix so two calls in the same millisecond can't collide. */
let seq = 0

export function captureCall(input: CaptureInput): void {
  try {
    if (!isCaptureEnabled()) return
    const dir = process.env.LUNASTAK_CAPTURE_DIR
    if (!dir) return

    const res = (input.response ?? {}) as {
      model?: string
      stop_reason?: string
      usage?: { input_tokens?: number; output_tokens?: number }
      content?: Array<{ type?: string; text?: string }>
    }

    const text = extractText(input.response)

    const record = {
      capturedAt: new Date().toISOString(),
      context: input.context,
      model: res.model ?? null,
      request: input.request,
      text,
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
      latencyMs: input.latencyMs,
      stopReason: res.stop_reason ?? null,
      // A truncated output is not a quality signal — it's a config failure, and
      // the protocol says such a stage is invalid for that arm.
      truncated: res.stop_reason === 'max_tokens',
    }

    fs.mkdirSync(dir, { recursive: true })

    seq += 1
    const name = `${Date.now()}-${String(seq).padStart(4, '0')}-${input.context}.json`
    fs.writeFileSync(path.join(dir, name), JSON.stringify(record, null, 2))
  } catch (err) {
    // Best-effort by contract. Never let measurement break the product.
    console.warn('[capture] failed, continuing:', err instanceof Error ? err.message : err)
  }
}
