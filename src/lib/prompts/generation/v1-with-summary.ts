// src/lib/prompts/generation/v1-with-summary.ts
import { PromptVersion } from '../types'

export const GENERATION_WITH_SUMMARY_V1: PromptVersion = {
  id: 'v1-with-summary',
  description: 'Strategy generation from themes with reflective summary - original approach',
  current: false,
  deprecated: true,
  deprecatedAt: '2026-01-31',
  createdAt: '2025-06-01',
  requiredInputs: ['themes', 'reflective_summary'],
  minTraceSchemaVersion: '2025-06',
  template: `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

INSIGHTS FROM CONVERSATION:
Strengths identified:
{strengths}

Emerging patterns:
{emerging}

Areas to explore further:
{unexplored}

Guidelines:
- Use the emergent themes as your foundation - these represent what actually matters to this business
- Vision: Should be aspirational, future-focused, and memorable
- Strategy: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Use their language and themes - make it feel authentic to their business, not generic corporate speak

Format your response as:
<thoughts>Your reasoning about the strategy, referencing specific themes that emerged</thoughts>
<statements>
  <vision>The vision statement</vision>
  <strategy>The strategy statement</strategy>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`,
}
