// src/lib/prompts/reflective-summary/v1.ts
import { PromptVersion } from '../types'

export const REFLECTIVE_SUMMARY_V1: PromptVersion = {
  id: 'v1',
  description: 'Reflective summary for Luna\'s Thinking tab - runs in background after extraction',
  current: true,
  createdAt: '2025-06-01',
  requiredInputs: ['conversation'],
  template: `Based on this business strategy conversation, provide a reflective summary to support strategy development.

Conversation:
{conversation}

Provide:

<summary>
  <title>Short descriptive title for this conversation (3-6 words, e.g. "Market expansion strategy", "Customer acquisition approach")</title>

  <strengths>
    <!-- 2-3 strongest anchors from conversation -->
    <strength>What's clearly articulated and solid</strength>
  </strengths>

  <emerging>
    <!-- 1-2 areas with some clarity but room to develop -->
    <area>Themes that started to surface</area>
  </emerging>

  <opportunities_for_enrichment>
    <!-- 1-2 opportunities for further exploration -->
    <opportunity>Areas that could benefit from deeper thinking</opportunity>
  </opportunities_for_enrichment>

  <thought_prompt>Optional open-ended question to spark reflection</thought_prompt>
</summary>`,
}
