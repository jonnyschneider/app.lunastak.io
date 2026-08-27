// src/lib/prompts/shared/question-titles.ts
/**
 * Title rules for QUESTIONS and GAPS.
 *
 * These are a different artefact from objectives and opportunities, and applying
 * `plain-language.ts`'s title guidance to them was a measured mistake
 * (2026-08-27, `voice-constraint-ab/`): that guidance asks "does it start with a
 * verb or an outcome?", which is right for a commitment and wrong for a
 * question — it converts one into an instruction.
 *
 *   "What would kill this fastest?"              -> "Test the smallest version first"
 *   "Who actually screws the kitchen to the wall?" -> "Decide who installs the kitchen"
 *
 * Titles also grew from 21-33 to 31-43 chars, which costs the scannability that
 * is the whole point of a title. The bodies genuinely improved by carrying more
 * context, so the fix keeps the richer body and scopes the title rule.
 */

export const QUESTION_TITLE_GUIDANCE = `## Titles for questions and gaps

The title is the line the user scans. It has to work at a glance, and it must still be a question.

1. **Keep it interrogative.** A question title asks something. It is not an instruction and not a statement of what is missing.
2. **Six words or fewer.** Shorter than the body deserves. The context goes in the description.
3. **Do NOT open with a verb or an outcome.** That rule is for objectives and opportunities. Applied here it turns questions into commands.
4. Plain language, and it should survive being read without the surrounding summary.

- ✓ "Who owns the install?"
- ✓ "What would kill this fastest?"
- ✓ "Where does the money come from?"
- ✗ "Test the smallest version first" — an instruction, not a question
- ✗ "Name the competitors above the flat-pack tier" — an instruction
- ✗ "Builders profit from opacity you'd remove" — a statement

Put the reasoning in the description, not the title. Three sentences there at most.`
