import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

export const anthropic = new Anthropic({
  apiKey,
  maxRetries: 2,
  timeout: 60_000, // 1 minute timeout (was 3 min which caused 2+ min delays on retry)
});

export const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Wrapper for Claude API calls with automatic truncation detection.
 * Logs a warning if the response was truncated due to max_tokens.
 */
export async function createMessage(
  params: MessageCreateParamsNonStreaming,
  context?: string // Optional context for logging (e.g., 'reflective_summary', 'generation')
) {
  const response = await anthropic.messages.create(params);

  // Check for truncation
  if (response.stop_reason === 'max_tokens') {
    console.warn(
      `[Claude] Response truncated due to max_tokens limit`,
      context ? `(${context})` : '',
      {
        max_tokens: params.max_tokens,
        output_tokens: response.usage?.output_tokens,
        stop_reason: response.stop_reason,
      }
    );
  }

  return response;
} 