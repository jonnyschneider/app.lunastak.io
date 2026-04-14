// src/lib/prompts/shared/plain-language.ts
/**
 * Plain-language guidance for operational outputs.
 *
 * Rationale (see docs/plans for full brief):
 * Vision/Strategy are board-facing, low-frequency, high-context — they can
 * carry conceptual vocabulary. Objectives, opportunities, and principles are
 * operational, high-frequency, low-context — they get screenshotted, pinned,
 * quoted in standups. They must survive being shared without their parent
 * frame.
 *
 * If a smart non-specialist can't read the title once and know what it means,
 * it has failed at its job.
 */

export const PLAIN_LANGUAGE_TITLE_GUIDANCE = `## Plain-Language Constraint (for titles)

Titles must be operational, not academic. Use words an operator would say in a standup, not words from a strategy paper.

**Three tests for any title:**
1. Could a smart non-specialist read it once and know what it means?
2. Does it start with a verb or an outcome (not a concept)?
3. Is it ≤8 words?

**Avoid framework vocabulary lifted from the source material** — words like "paradox", "apex", "counter-positioning", "cornered resource", "pyramid", "moat", "cohort", "wallet share", "lifecycle", "gravitational pull". These belong in the explanation field, not the title.

**Define specialist terms on first use.** Not "the Purosangue at 20% cap" but "the Purosangue SUV at 20% of output." Not "Classiche alone" but "Classiche, our certification program for older Ferraris."

**Examples (academic → plain):**
- "Defend the Scarcity-Awareness Paradox" → "Keep Ferraris rare in every market"
- "Pyramid Ascension at Scale" → "Sell collectors their next Ferrari"
- "Make the Technology Transition Without Losing the Soul" → "Make an electric car worth wanting"
- "Deepen Wallet Share at Every Tier" → "Sell more to existing customers"
- "Geographic Scarcity Rebalancing" → "Grow in new markets without diluting old ones"`

export const PLAIN_LANGUAGE_EXPLAINER_GUIDANCE = `## Plain-Language Constraint (for explainers)

Simplify, don't decimate. Explanations and descriptions can carry load-bearing expert concepts (scarcity-as-moat, counter-positioning, public market tension) — but drop pure consulting filler.

**Avoid:** "job-to-be-done", "wallet share", "lifecycle infrastructure", "retention cohort", "gravitational pull", "margin-smoothing function", "structured framework", "cross-contamination". These add nothing a plainer phrase wouldn't carry.

**Define specialist terms on first use** with a short appositive: "Classiche, our certification program for older Ferraris" rather than "Classiche".`
