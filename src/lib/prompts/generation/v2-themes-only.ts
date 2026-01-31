// src/lib/prompts/generation/v2-themes-only.ts
import { PromptVersion } from '../types'

export const GENERATION_THEMES_ONLY_V2: PromptVersion = {
  id: 'v2-themes-only',
  description: 'Strategy generation from themes only - no reflective summary dependency',
  current: true,
  createdAt: '2026-01-31',
  requiredInputs: ['themes'],
  minTraceSchemaVersion: '2025-06',
  template: `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

Your task:
1. Analyze these themes to identify what's strong, what's emerging, and what needs exploration
2. Generate a cohesive strategy that builds on these themes

Guidelines:
- Use the emergent themes as your foundation - these represent what actually matters to this business
- Vision: Should be aspirational, future-focused, and memorable
- Strategy: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Use their language and themes - make it feel authentic to their business, not generic corporate speak

Format your response as:
<thoughts>Your analysis of the themes - what's strong, what's emerging, what needs exploration. Reference specific themes.</thoughts>
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
