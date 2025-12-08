import { StrategyLens } from './types';

export const LENS_DESCRIPTIONS = {
  A: 'Your customers - Who they are, what they need, jobs to be done',
  B: 'Your domain/operations - Your expertise, capabilities, how you work',
  C: 'Your industry/market - Competitive landscape, market dynamics, positioning',
  D: 'Your product/technology - Features, capabilities, technical approach',
  E: 'Let AI guide me - I\'ll choose the best path based on what you\'ve shared',
};

export const LENS_SELECTION_TEXT = `What do you know the most about?

A) Your customers
B) Your domain/operations
C) Your industry/market
D) Your product/technology
E) Let AI guide me

Type the letter of your choice (A, B, C, D, or E):`;

export function getLensFramingPrompt(lens: StrategyLens, conversationHistory: string): string {
  const baseInstruction = `You are a strategic consultant. Based on the conversation so far and the user's chosen lens, ask the next natural follow-up question.

Keep it conversational - reference something specific from their previous answer. Just ask the question, nothing else.

Conversation so far:
${conversationHistory}`;

  const lensSpecificFraming = {
    A: `
You're exploring their business through a CUSTOMER lens.

Frame questions around:
- Customer problems and opportunities
- Customer segments and needs
- Customer value and experience

First question should be: "What problem do you solve, or opportunity do you create for customers?"

Then build naturally from their responses using customer-centric language.`,

    B: `
You're exploring their business through a DOMAIN/OPERATIONS lens.

Frame questions around:
- Capabilities and domain knowledge
- Processes and delivery model
- Operational advantages
- What they do uniquely well

Build questions that explore their expertise and how they work.`,

    C: `
You're exploring their business through an INDUSTRY/MARKET lens.

Frame questions around:
- Competitive landscape and differentiation
- Market dynamics and trends
- Strategic positioning

First question should be: "What makes your product different and better than others?"

Then explore competitive context and market positioning.`,

    D: `
You're exploring their business through a PRODUCT/TECHNOLOGY lens.

Frame questions around:
- Product capabilities and features
- Technical approach and innovation
- Technology advantages
- Product roadmap

Explore what makes the product technically distinctive.`,

    E: `
Based on their initial response, choose the most natural framing.

Blend approaches as needed. Adapt to their language and mental model.
Use whichever lens (customer/domain/industry/product) feels most natural
given how they described their business.`,
  };

  return baseInstruction + '\n' + lensSpecificFraming[lens] + '\n\nAsk the next question:';
}

export function getAcknowledgmentPrompt(userResponse: string): string {
  return `You are a strategic consultant. The user just gave you this response:

"${userResponse}"

Acknowledge what they shared in 1-2 sentences, showing you understood. Be warm and conversational. Then you'll present lens options next.

Just write the acknowledgment, nothing else.`;
}
