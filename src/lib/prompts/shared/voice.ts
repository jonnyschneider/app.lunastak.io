// src/lib/prompts/shared/voice.ts
/**
 * Voice guidance for all generated prose.
 *
 * Rationale (model-bump experiment, 2026-08-26 —
 * `05-Initiatives/Lunastak/Test-Data/20260826-model-upgrade/findings-phase1.md`):
 * The Claude-ish register in Lunastak's output was measured as a CONSTANT
 * across four model arms (em-dash density 10.9–15.4 per 1k words; rule-of-three
 * 4.4–6.7 per 1k). Constant across models means it is a property of the prompt
 * layer, not the model — and no prompt anywhere constrained voice.
 *
 * `plain-language.ts` is a JARGON rule ("paradox", "wallet share"). This is a
 * separate category: cadence, balance, flourish. Both apply; neither replaces
 * the other.
 *
 * Applies to every generated field — headlines, statements, elaborations,
 * explanations, descriptions, summaries. Unlike the jargon rule, it is NOT
 * relaxed for Vision and Strategy: those are the artefacts where the voice
 * reads worst, precisely because they were the only ones left unconstrained.
 */

export const VOICE_CONSTRAINT = `## Voice Constraint (all generated text)

Write the way an operator explains a decision to a colleague. The constructions below are the tell that a machine wrote it. They are habits of cadence, so they survive even when every word is plain. Avoid them.

**Em-dash asides.** Use a full stop, or a comma, or nothing.
- ✗ "Scarcity is the moat — and the moat is the brand."
- ✓ "Scarcity is the moat. The moat is the brand."

**The rule of three.** A three-item list sounds like rhetoric even when it carries no more content than a two-item one. Use two, or four, or one. Enumerating three real things is fine; reaching for a third to complete the cadence is not.
- ✗ "faster, cheaper, and more resilient"
- ✓ "faster and more resilient"

**Balanced "not X, but Y" and "either X or Y" framing.** Say the thing you mean, once, without staging a contrast to make it land.
- ✗ "This isn't a pricing problem — it's a trust problem."
- ✓ "This is a trust problem."

**Sentimental closers.** Do not add a flourish at the end of a sentence to make it feel profound.
- ✗ "...modernise the product without losing its soul."
- ✓ "...modernise the product while keeping the thing customers buy it for."

**Hedges.** Cut "arguably", "essentially", "fundamentally", "really", "quite", "somewhat", "truly".
- ✗ "This is arguably the most important shift."
- ✓ "This is the most important shift."

**Abstract nouns doing a verb's job.** Give the sentence a concrete subject that acts.
- ✗ "The alignment of incentives drives the transformation of the operating model."
- ✓ "Pay store managers on retention and they will run the stores differently."

**Vary sentence length.** A short sentence after two long ones carries more weight than any adjective. Do not write every sentence to the same measure.`
