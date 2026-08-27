import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { prisma } from '@/lib/db';
import {
  DEFAULT_MODEL,
  modelFor,
  stripUnsupportedParams,
  maxTokensFor,
  timeoutFor,
  effortFor,
} from '@/lib/model-config';
import { captureCall } from '@/lib/experiment/capture';
import { extractText } from '@/lib/extract-text';
import { LLM_POLICY, systemFor, isCacheable, type LlmContext } from '@/lib/llm/policy';

export { extractText };

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

export const anthropic = new Anthropic({
  apiKey,
  maxRetries: 2,
  timeout: 60_000, // 1 minute timeout (was 3 min which caused 2+ min delays on retry)
});

/**
 * The default model.
 *
 * Call sites no longer pass a model at all — `createMessage()` resolves it
 * per-stage from `LLM_POLICY`. This survives only as the value `PipelinePlan`
 * stamps on its steps (`lib/pipeline/plan.ts`), which is descriptive metadata,
 * not a request parameter.
 *
 * For provenance, record `response.model`, never this constant (enforced by
 * tests/model-provenance).
 */
export const CLAUDE_MODEL = DEFAULT_MODEL;


/**
 * The single seam every Claude API call passes through.
 *
 * Everything about a request that is a STAGE decision — model, reasoning
 * effort, visible-output budget, and the voice/language guidance governing the
 * output — is resolved here from `LLM_POLICY`, not supplied by the caller.
 * Call sites pass the payload (`messages`) and name their stage; they cannot
 * pass `model`, `max_tokens` or `system`, because those are not theirs to
 * choose.
 *
 * That last one is the point of the whole exercise. `system` being
 * seam-assembled and not settable by callers is what makes the guarantee hold:
 * **there is no call-site expression that produces an ungoverned request.**
 * Guidance used to be pasted into prompt strings by hand and reached 5 of 26
 * sites; a stage was governed only if its author remembered. Now a stage is
 * governed because it was classified, and it cannot compile unclassified.
 *
 * Also detects and logs truncation.
 */
export async function createMessage(
  params: Omit<MessageCreateParamsNonStreaming, 'model' | 'max_tokens' | 'system'>
    & { max_tokens?: number }, // only honoured when policy.maxTokens === 'per-call'
  context: LlmContext,
  userId?: string | null // Optional userId for token tracking
) {
  const policy = LLM_POLICY[context];

  // Visible-output budget. A 'per-call' stage computes its own and MUST pass
  // one — falling back to a default here would silently truncate a batch sized
  // for more. Exactly one stage (import_dimension_tagging) is 'per-call'.
  let maxTokens: number;
  if (policy.maxTokens === 'per-call') {
    if (params.max_tokens === undefined) {
      throw new Error(
        `[Claude] context "${context}" is declared maxTokens: 'per-call' but no max_tokens was passed`
      );
    }
    maxTokens = params.max_tokens;
  } else {
    // Not 'per-call': the policy is the authority and any passed value is ignored.
    maxTokens = policy.maxTokens;
  }

  // Resolve the model for this pipeline stage, then drop any sampling params
  // the resolved model would reject. Doing this at the single wrapper seam
  // means no call site can escape the per-stage model map, and the control arm
  // keeps sending exactly what production sends today.
  const model = modelFor(context);
  const effort = effortFor(model, context);

  // The governed guidance. Omitted entirely when empty — an empty `system`
  // string is not the same request as no system block.
  const system = systemFor(context);

  // Cached prefix. The system block is identical on every call to a stage, so
  // on full_synthesis (10-21 calls per generation) all but the first read it at
  // 0.1x instead of paying 1x. Only set where the block was MEASURED >= 1024
  // tokens — see LLM_POLICY.
  const cached = isCacheable(context);

  const resolved = stripUnsupportedParams({
    ...params,
    model,
    // Thinking models spend reasoning tokens out of max_tokens, so the stage's
    // configured ceiling is treated as the visible-output budget and headroom
    // is added on top. The control model is untouched.
    max_tokens: maxTokensFor(model, maxTokens),
    ...(system
      ? {
          system: cached
            ? [{ type: 'text' as const, text: system, cache_control: { type: 'ephemeral' as const } }]
            : system,
        }
      : {}),
    ...(effort ? { output_config: { effort } } : {}),
  });

  // Prompt provenance. Answers "which prompt produced this output" for all 20
  // stages — the retired prompt registry promised that for three and never
  // delivered it (docs/architecture/retired-prompt-registry.md). A hash carries
  // no user content, so it is safe to ship to production telemetry.
  // Hashed from the system TEXT, not the resolved field — that field becomes a
  // block array when caching is on, and provenance must not shift just because
  // a stage flipped `cacheable`. The same prompt hashes the same either way.
  const promptHash = createHash('sha256')
    .update((system ?? '') + JSON.stringify(resolved.messages))
    .digest('hex')
    .slice(0, 16);

  // Adaptive thinking can exceed the 60s client default on the heavy stages.
  const startedAt = Date.now();
  const response = await anthropic.messages.create(resolved, {
    timeout: timeoutFor(model),
  });
  const latencyMs = Date.now() - startedAt;

  // Experiment capture — no-op unless LUNASTAK_CAPTURE_DIR is set, and never throws.
  captureCall({ context, request: resolved, response, latencyMs, promptHash });

  // Check for truncation
  if (response.stop_reason === 'max_tokens') {
    console.warn(
      `[Claude] Response truncated due to max_tokens limit`,
      `(${context})`,
      {
        max_tokens: resolved.max_tokens,
        output_tokens: response.usage?.output_tokens,
        stop_reason: response.stop_reason,
      }
    );
  }

  // Track token usage per user (fire-and-forget)
  if (userId && response.usage) {
    prisma.user.update({
      where: { id: userId },
      data: {
        apiCallCount: { increment: 1 },
        totalPromptTokens: { increment: response.usage.input_tokens },
        totalCompletionTokens: { increment: response.usage.output_tokens },
        lastLlmCallAt: new Date(),
      },
    }).catch(err => console.error('[Claude] Token tracking failed:', err))

    // Statsig event for token burn dashboards
    import('@/lib/statsig').then(({ logStatsigEvent }) => {
      logStatsigEvent(userId, 'llm_token_usage', response.usage.input_tokens + response.usage.output_tokens, {
        context,
        // Known limit, stated rather than hidden: this event fires only inside
        // `if (userId && response.usage)`, and 10 of 26 call sites pass no
        // userId — so the durable hash inherits the existing telemetry gap.
        // captureCall() records it regardless, locally.
        promptHash,
        promptTokens: String(response.usage.input_tokens),
        completionTokens: String(response.usage.output_tokens),
        model: response.model || resolved.model,
        // Added 2026-08-26: the metrics half of experiment capture, which is
        // safe in production because it carries no user content. Real
        // per-stage volumes turn the model-bump cost projection into a real
        // number rather than an extrapolation, and `truncated` is a permanent
        // canary — it matters most immediately after a model change, when a
        // max_tokens ceiling tuned for the old model starts cutting answers off.
        latencyMs: String(latencyMs),
        maxTokens: String(resolved.max_tokens),
        truncated: String(response.stop_reason === 'max_tokens'),
        // Added 2026-08-27 with prompt caching. A cache that silently never
        // hits looks EXACTLY like one that works — same output, same latency
        // profile, quietly full price. These two fields are the only way to
        // tell from outside, so they ship with the feature rather than after it.
        cached: String(cached),
        cacheWriteTokens: String(response.usage.cache_creation_input_tokens ?? 0),
        cacheReadTokens: String(response.usage.cache_read_input_tokens ?? 0),
      })
    }).catch(() => {})
  }

  return response;
} 