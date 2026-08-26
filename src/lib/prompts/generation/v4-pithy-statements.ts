// src/lib/prompts/generation/v4-pithy-statements.ts
import { PromptVersion } from '../types'
import { OBJECTIVE_GUIDELINES, OBJECTIVE_XML_FORMAT } from '../shared/objectives'
import { VISION_GUIDELINES, VISION_XML_FORMAT, STRATEGY_GUIDELINES, STRATEGY_XML_FORMAT } from '../shared/vision-strategy'
import { VOICE_CONSTRAINT } from '../shared/voice'

export const GENERATION_PITHY_STATEMENTS_V4: PromptVersion = {
  id: 'v4-pithy-statements',
  description: 'Strategy generation with pithy, memorable headlines and elaborations',
  current: true,
  createdAt: '2026-02-11',
  requiredInputs: ['themes'],
  minTraceSchemaVersion: '2025-06',
  template: `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

## The Decision Stack

Each layer answers a different question:
- **Vision:** "Where are we going?" - Aspirational, customer-centric, future-focused
- **Strategy:** "How will we get there?" - Coherent set of choices to achieve the vision
- **Objectives:** "What matters now?" - SMART, outcome-focused, balanced

## Your Task

1. Analyze the themes to identify what's strong, what's emerging, what needs exploration
2. Generate a Decision Stack that feels authentic to this business

${VISION_GUIDELINES}

${STRATEGY_GUIDELINES}

${OBJECTIVE_GUIDELINES}

${VOICE_CONSTRAINT}

## Tone

Write with conviction. A statement becomes memorable by naming a real choice this business has made. It never becomes memorable by reaching for a flourish. Use THEIR words from the themes so the statements sound like this business talking.

## Output Format

<thoughts>Your analysis of the themes - what's strong, what's emerging, what to build on. Reference specific themes.</thoughts>
<statements>
  ${VISION_XML_FORMAT}
  ${STRATEGY_XML_FORMAT}
  ${OBJECTIVE_XML_FORMAT}
</statements>`,
}
