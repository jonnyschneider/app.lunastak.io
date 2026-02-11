// src/lib/prompts/generation/v3-okr-objectives.ts
import { PromptVersion } from '../types'

export const GENERATION_OKR_OBJECTIVES_V3: PromptVersion = {
  id: 'v3-okr-objectives',
  description: 'Strategy generation with OKR-style objectives and hypothesis-driven Key Results',
  current: false,
  createdAt: '2026-02-10',
  requiredInputs: ['themes'],
  minTraceSchemaVersion: '2025-06',
  template: `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

Your task:
1. Analyze these themes to identify what's strong, what's emerging, and what needs exploration
2. Generate a cohesive strategy that builds on these themes
3. Create 3 OKR-style objectives with hypothesis-driven Key Results

Guidelines:
- Use the emergent themes as your foundation - these represent what actually matters to this business
- Vision: Aspirational future state. Describe the world you're creating, not the product. (3+ year horizon)
- Strategy: Coherent choices to achieve the vision. Focus on direction, not tactics. (12-18 month horizon)
- Objectives: What you're trying to achieve. Start with a verb. Be specific and measurable.
- Key Results: Hypothesis-driven. "We believe [action] will result in [outcome]"
- Use their language and themes - make it feel authentic to their business

For each objective, include:
- title: Short label (3-5 words) for lists and linking
- objective: The full objective statement (1-2 sentences)
- explanation: Why this matters and connects to the strategy
- keyResults: 1-3 hypothesis-driven Key Results

Each Key Result should have:
- belief_action: What action we're taking
- belief_outcome: What outcome we expect
- signal: The metric we'll observe
- baseline: Current state (use "TBD" if unknown)
- target: Target state
- timeframe: 3M, 6M, 9M, 12M, or 18M

Format your response as:
<thoughts>Your analysis of the themes - what's strong, what's emerging, what needs exploration. Reference specific themes.</thoughts>
<statements>
  <vision>The vision statement</vision>
  <strategy>The strategy statement</strategy>
  <objectives>
    <objective>
      <title>Short Title Here</title>
      <statement>The full objective statement</statement>
      <explanation>Why this matters</explanation>
      <key_results>
        <kr>
          <belief_action>improving onboarding flow</belief_action>
          <belief_outcome>increase user activation</belief_outcome>
          <signal>7-day active user rate</signal>
          <baseline>40%</baseline>
          <target>55%</target>
          <timeframe>6M</timeframe>
        </kr>
      </key_results>
    </objective>
    <objective>
      <title>Second Objective</title>
      <statement>The second objective statement</statement>
      <explanation>Why this matters</explanation>
      <key_results>
        <kr>
          <belief_action>action here</belief_action>
          <belief_outcome>expected outcome</belief_outcome>
          <signal>metric to observe</signal>
          <baseline>current state</baseline>
          <target>target state</target>
          <timeframe>6M</timeframe>
        </kr>
      </key_results>
    </objective>
    <objective>
      <title>Third Objective</title>
      <statement>The third objective statement</statement>
      <explanation>Why this matters</explanation>
      <key_results>
        <kr>
          <belief_action>action here</belief_action>
          <belief_outcome>expected outcome</belief_outcome>
          <signal>metric to observe</signal>
          <baseline>current state</baseline>
          <target>target state</target>
          <timeframe>6M</timeframe>
        </kr>
      </key_results>
    </objective>
  </objectives>
</statements>`,
}
