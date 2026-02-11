// src/lib/prompts/shared/objectives.ts
/**
 * Shared objective format guidelines and XML templates.
 * Used by both generation and refresh-strategy prompts.
 */

export const OBJECTIVE_GUIDELINES = `## Objectives Guidelines

Objectives are what you're trying to achieve NOW. Start with a verb. Be specific.

**Objective examples:**
- "Capture more data"
- "Improve relevance by understanding content"
- "Improve speed of search results"

**Objective format:**
- Title: 3-8 words. Just the essence.
- Statement: 1-2 sentences. The full objective.
- Explanation: Why this matters and connects to strategy.
- OMTM (One Metric That Matters): Just the metric NAME, not a full measurement. Keep it simple.
- Aspiration: Optional short directional goal (e.g., "40% increase", "Industry-leading", "Significant growth")

**OMTM examples:**
- Good: "Weekly Active Users" with aspiration "40% increase"
- Good: "Net Promoter Score" with aspiration "Best in class"
- Good: "Revenue" with aspiration "Sustainable growth"
- Bad: "Context relevance score (user-rated) and connection rate" - TOO VERBOSE
- Bad: "TBD - need to establish measurement → 8+ relevance score" - measurement detail, not a metric name

NOTE: Specific measurements (baseline → target) belong on Opportunities, not Objectives. Keep OMTM simple.`

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
