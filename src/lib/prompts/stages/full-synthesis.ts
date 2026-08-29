/**
 * The STATIC half of the full-synthesis prompt — everything that does not vary
 * per call, so it can serve as a stable cache prefix.
 *
 * WHY THIS LIVES HERE. It is referenced by `LLM_POLICY.full_synthesis.system`,
 * and `policy.ts` cannot import from `synthesis/full-synthesis.ts` — that module
 * imports `claude.ts`, which imports `policy.ts`. This directory is a leaf: it
 * imports nothing but the shared guidance constants, so it can be pulled in from
 * either side without a cycle.
 *
 * `{guidance}` is substituted by `systemFor()`. It sits deliberately BEFORE the
 * JSON-format instruction so that instruction stays the last thing the model
 * reads before the payload — ~1200 tokens of guidance between the format rule
 * and the output is how format drift starts, and this stage's parser has already
 * had to be hardened once against exactly that (17.5% of responses, 2026-08-27).
 *
 * The dimension name and fragment count are NOT here. They used to open the
 * prompt — "for the dimension: **{dimension}**", "You have {count} fragments" —
 * which meant the first two lines varied on every call and no cache prefix was
 * possible. They now arrive in the user message. This is a real prompt rewrite:
 * the model loses the dimension name from its framing, and it gets the same
 * before/after treatment the voice arc got.
 */
export const FULL_SYNTHESIS_SYSTEM = `You are synthesizing strategic understanding for one strategic dimension of a business.

You will be given the name of the dimension and a set of fragments captured from conversations. Your task is to synthesize those fragments into a coherent understanding of that dimension.

## Your Task:

Synthesize these fragments into structured understanding:

1. **Summary** (2-3 paragraphs): What do we understand about this dimension? Use the leader's authentic voice where possible.

2. **Key Themes** (3-7 themes): What are the main ideas? Each theme should be a short phrase or sentence.

3. **Gaps** (list of objects): What's missing? Each gap should have:
   - "title": A punchy, attention-grabbing title (max 60 chars). A gap is something you don't yet know, so phrase it as a question. The title rules below apply.
   - "description": The full question or explanation of what's missing

4. **Confidence** (HIGH | MEDIUM | LOW): How comprehensive is this understanding?
   - HIGH: 5+ fragments, clear themes, few gaps
   - MEDIUM: 3-5 fragments, some gaps remain
   - LOW: <3 fragments or significant gaps

{guidance}

IMPORTANT: Respond with ONLY the JSON object below. No preamble, no explanation, no markdown - just the raw JSON starting with { and ending with }

{"summary": "...", "keyThemes": ["...", "..."], "gaps": [{"title": "Short title", "description": "Full question or explanation"}], "confidence": "MEDIUM"}`
