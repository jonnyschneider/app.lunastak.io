// src/lib/prompts/generation/v4-pithy-statements.ts
import { PromptVersion } from '../types'
import { OBJECTIVE_GUIDELINES, OBJECTIVE_XML_FORMAT } from '../shared/objectives'

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

## Vision Guidelines

**Good vision:**
- Is UNIQUE to this business - why does this matter to THEM?
- Is CUSTOMER-CENTRIC - how does this change customers' lives?
- Is ASPIRATIONAL - lofty enough you may never fully achieve it
- Uses their language - feels authentic, not templated

**Bad vision:**
- Cookie-cutter, fill-in-the-blank statements
- Anything starting with "to be the leading/best" - no one cares about your company
- Too short-term or too detailed
- Clinical MBA-speak that no one remembers

**Vision examples (notice the brevity and emotional resonance):**
- IKEA: "To create a better everyday life for many people"
- Nike: "Bring inspiration and innovation to every athlete in the world"
- Kickstarter: "To help bring creative projects to life"
- Oxfam: "A world without poverty"
- Google: "To organize the world's information and make it universally accessible and useful"

**Vision format:**
- Headline: 4-15 words. Pithy. Memorable. Something to grab onto.
- Elaboration: 1-2 sentences explaining why this matters and what it means for customers.

## Strategy Guidelines

Strategy describes the coherent "how" - the key choices that will get you to the vision.

**Strategy example (Google):**
"To capture an unrivalled store of data, understand it, and leverage it to better deliver what users want, when they want it."

**Strategy format:**
- Headline: 15-25 words. The mechanism. The coherent choices.
- Elaboration: 2-3 sentences unpacking how this plays out.

${OBJECTIVE_GUIDELINES}

## Tone

Write like a manifesto, not a business plan.
Make it human. Make it feel something.
Better to be disagreeable and memorable than safe and forgotten.
Use THEIR words from the themes - make it feel like them, not like a consultant wrote it.

## Output Format

<thoughts>Your analysis of the themes - what's strong, what's emerging, what to build on. Reference specific themes.</thoughts>
<statements>
  <vision>
    <headline>The pithy vision (4-15 words)</headline>
    <elaboration>Why this matters. What it means for customers. (1-2 sentences)</elaboration>
  </vision>
  <strategy>
    <headline>The coherent choices (15-25 words)</headline>
    <elaboration>How this plays out. The mechanism. (2-3 sentences)</elaboration>
  </strategy>
  ${OBJECTIVE_XML_FORMAT}
</statements>`,
}
