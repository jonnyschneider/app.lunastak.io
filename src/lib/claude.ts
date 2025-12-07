import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

export const anthropic = new Anthropic({
  apiKey,
  maxRetries: 3,
  timeout: 180_000, // 3 minute timeout
});

export const CLAUDE_MODEL = 'claude-3-opus-20240229'; // Using Opus temporarily to test API key
