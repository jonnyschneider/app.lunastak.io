// src/lib/prompts/shared/vision-strategy.ts
/**
 * Shared vision/strategy format guidelines and XML templates.
 * Used by both generation (v4-pithy-statements) and refresh-strategy prompts.
 */

export const VISION_GUIDELINES = `## Vision Guidelines

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
- Elaboration: 1-2 sentences explaining why this matters and what it means for customers.`

export const VISION_XML_FORMAT = `<vision>
    <headline>The pithy vision (4-15 words)</headline>
    <elaboration>Why this matters. What it means for customers. (1-2 sentences)</elaboration>
  </vision>`

export const STRATEGY_GUIDELINES = `## Strategy Guidelines

Strategy describes the coherent "how" - the key choices that will get you to the vision.

**Strategy example (Google):**
"To capture an unrivalled store of data, understand it, and leverage it to better deliver what users want, when they want it."

**Strategy format:**
- Headline: 15-25 words. The mechanism. The coherent choices.
- Elaboration: 2-3 sentences unpacking how this plays out.`

export const STRATEGY_XML_FORMAT = `<strategy>
    <headline>The coherent choices (15-25 words)</headline>
    <elaboration>How this plays out. The mechanism. (2-3 sentences)</elaboration>
  </strategy>`
