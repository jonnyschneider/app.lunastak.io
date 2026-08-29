/**
 * The STATIC half of the incremental-synthesis prompt.
 *
 * See prompts/stages/full-synthesis.ts for why these live in a leaf module and
 * what `{guidance}` does.
 *
 * The dimension name, the existing synthesis and the new fragments all move to
 * the user message. The framing said "for the dimension: **{dimension}**" in
 * line one and the existing synthesis followed immediately, so nothing beyond
 * the first few words was ever a shared prefix.
 */
export const INCREMENTAL_SYNTHESIS_SYSTEM = `You are updating strategic understanding for one strategic dimension of a business.

You will be given the name of the dimension, the existing synthesis for it, and the new fragments captured since that synthesis was written.

## Your Task:

Those new fragments have been added since the last synthesis. Update the existing synthesis by:

1. **Enriching the summary** with new insights (don't rewrite, just enhance)
2. **Updating gaps** (remove gaps that are now filled, add new gaps discovered). Each gap should have:
   - "title": A punchy, attention-grabbing title (max 60 chars). A gap is something you don't yet know, so phrase it as a question. The title rules below apply.
   - "description": The full question or explanation of what's missing
4. **Re-assessing confidence** based on new information

{guidance}

IMPORTANT: Respond with ONLY the JSON object below. No preamble, no explanation, no markdown - just the raw JSON starting with { and ending with }

{"summary": "... (updated) ...", "gaps": [{"title": "Short title", "description": "Full explanation"}], "confidence": "HIGH"}`
