// src/lib/prompts/shared/objectives.ts
/**
 * Shared objective format guidelines and XML templates.
 * Used by both generation and refresh-strategy prompts.
 */
import { PLAIN_LANGUAGE_TITLE_GUIDANCE, PLAIN_LANGUAGE_EXPLAINER_GUIDANCE } from './plain-language'

export const OBJECTIVE_GUIDELINES = `## Objectives Guidelines

Objectives describe the outcome or state you want to be true — not the action you're taking to get there.

They should be ambitious enough that 12-18 months isn't enough to fully achieve them. You make progress toward objectives; you don't "complete" them. They persist across quarters while the initiatives underneath change.

**Good objectives** (outcome-oriented, enduring):
- "Deliver strategy quality that rivals expert consultants"
- "Make the first experience so good it sells itself"
- "Become the tool founders recommend to each other"
- "Create a self-reinforcing loop between consulting and product"

**Bad objectives** (these are initiatives/projects, not objectives):
- "Validate consulting replacement threshold" — that's a project with an end date
- "Launch with meta-demo validation" — that's a milestone
- "Activate warm network for first customers" — that's a campaign

**Objective format:**
- Title: 3-8 words. The essence of the desired state.
- Statement: 1-2 sentences. The full objective — what will be true when you're succeeding.
- Explanation: Why this matters and connects to strategy.
- OMTM (One Metric That Matters): Just the metric NAME, not a full measurement. A north star you track, not a project KPI.
- Aspiration: Optional short directional goal (e.g., "Industry-leading", "Significant growth", "Best in class")

**OMTM examples:**
- Good: "Weekly Active Users" with aspiration "40% increase"
- Good: "Net Promoter Score" with aspiration "Best in class"
- Good: "Revenue" with aspiration "Sustainable growth"
- Bad: "Context relevance score (user-rated) and connection rate" - TOO VERBOSE
- Bad: "TBD - need to establish measurement → 8+ relevance score" - measurement detail, not a metric name

NOTE: Specific measurements (baseline → target) belong on Opportunities, not Objectives. Keep OMTM simple.

${PLAIN_LANGUAGE_TITLE_GUIDANCE}

${PLAIN_LANGUAGE_EXPLAINER_GUIDANCE}`

export const OBJECTIVE_XML_FORMAT = `<objectives>
    <objective>
      <title>Short Title (3-8 words)</title>
      <statement>The full objective statement</statement>
      <explanation>Why this matters and connects to strategy</explanation>
      <omtm>The Metric Name</omtm>
      <aspiration>Short directional goal (optional)</aspiration>
    </objective>
    <objective>
      <title>Second Objective</title>
      <statement>The second objective statement</statement>
      <explanation>Why this matters</explanation>
      <omtm>Another Metric</omtm>
      <aspiration>Target aspiration</aspiration>
    </objective>
    <objective>
      <title>Third Objective</title>
      <statement>The third objective statement</statement>
      <explanation>Why this matters</explanation>
      <omtm>Third Metric</omtm>
      <aspiration>Growth target</aspiration>
    </objective>
  </objectives>`
