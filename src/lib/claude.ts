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
 * The default model. Call sites still pass `model: CLAUDE_MODEL`, but the value
 * that actually reaches the API is resolved per-context inside createMessage()
 * — see `@/lib/model-config`. For provenance, record `response.model`, never
 * this constant (enforced by tests/model-provenance).
 */
export const CLAUDE_MODEL = DEFAULT_MODEL;

/**
 * Wrapper for Claude API calls with automatic truncation detection.
 * Logs a warning if the response was truncated due to max_tokens.
 */
export async function createMessage(
  params: MessageCreateParamsNonStreaming,
  context?: string, // Optional context for logging (e.g., 'reflective_summary', 'generation')
  userId?: string | null // Optional userId for token tracking
) {
  // Resolve the model for this pipeline stage, then drop any sampling params
  // the resolved model would reject. Doing this at the single wrapper seam
  // means no call site can escape the per-stage model map, and the control arm
  // keeps sending exactly what production sends today.
  const model = modelFor(context);
  const effort = effortFor(model);

  const resolved = stripUnsupportedParams({
    ...params,
    model,
    // Thinking models spend reasoning tokens out of max_tokens, so the stage's
    // configured ceiling is treated as the visible-output budget and headroom
    // is added on top. The control model is untouched.
    max_tokens: maxTokensFor(model, params.max_tokens),
    ...(effort ? { output_config: { effort } } : {}),
  });

  // Adaptive thinking can exceed the 60s client default on the heavy stages.
  const response = await anthropic.messages.create(resolved, {
    timeout: timeoutFor(model),
  });

  // Check for truncation
  if (response.stop_reason === 'max_tokens') {
    console.warn(
      `[Claude] Response truncated due to max_tokens limit`,
      context ? `(${context})` : '',
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
        context: context || 'unknown',
        promptTokens: String(response.usage.input_tokens),
        completionTokens: String(response.usage.output_tokens),
        model: response.model || resolved.model,
      })
    }).catch(() => {})
  }

  return response;
} 