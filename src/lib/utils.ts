import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BusinessContext, Objective, KeyResult } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get display title for an objective.
 * Uses title if present, otherwise truncates objective/pithy to ~5 words.
 */
export function getObjectiveTitle(objective: Pick<Objective, 'title' | 'objective' | 'pithy'>): string {
  if (objective.title) return objective.title;
  // Fallback: first 5 words of objective or pithy
  const text = objective.objective || objective.pithy || '';
  const words = text.split(/\s+/);
  if (words.length <= 5) return text;
  return words.slice(0, 5).join(' ') + '...';
}

export function extractXML(text: string, tag: string): string {
  // Fast path: well-formed <tag>…</tag>. Unchanged behaviour.
  const pattern = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = text.match(pattern);
  if (match) return match[1].trim();

  // Tolerant path: the opening tag is present but its closing tag is missing or WRONG.
  //
  // Real failure 2026-08-26 (model-bump experiment): a model closed <strategy> with
  // </objectives>. The strict match returned '' and the app persisted an empty strategy while
  // the complete, correct content sat in the response — silent, no exception, not a truncation.
  // Tag imbalance occurred in 8 of 40 XML-bearing responses across ALL model arms, so this is a
  // property of prompting an LLM for XML, not of any one model.
  //
  // Recovery: walk forward from the opening tag tracking nesting depth, and stop at the first
  // closing tag that has no matching opening inside the region — that is the mis-closer. Never
  // invent content, and never swallow the following section.
  const openTag = `<${tag}>`;
  const openAt = text.indexOf(openTag);
  if (openAt === -1) return '';

  const rest = text.slice(openAt + openTag.length);
  const tagRe = /<(\/?)[a-zA-Z_][\w-]*>/g;
  let depth = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(rest)) !== null) {
    if (m[1] === '/') {
      if (depth === 0) {
        const recovered = rest.slice(0, m.index).trim();
        console.warn(`[extractXML] recovered <${tag}> from a mis-closed tag (${recovered.length} chars) — model emitted "${m[0]}" where "</${tag}>" was expected`);
        return recovered;
      }
      depth--;
    } else {
      depth++;
    }
  }

  const tail = rest.trim();
  if (tail) console.warn(`[extractXML] recovered <${tag}> with no closing tag (${tail.length} chars)`);
  return tail;
}

/**
 * Extract all matches for a tag (for multiple objectives, KRs, etc.)
 */
export function extractAllXML(text: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gs');
  const matches: string[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

/**
 * Parse objectives from XML.
 * Supports both:
 * - New simplified OMTM format (omtm + aspiration)
 * - Legacy key_results format (for backwards compatibility)
 */
/**
 * The objectives section of a <statements> block, tolerating a missing wrapper.
 *
 * Measured 2026-08-27: models routinely emit bare <objective> siblings directly
 * under <statements>, with no <objectives> element at all — on the pre-split
 * generation prompt, 0 of 16 responses carried the wrapper, across BOTH
 * claude-opus-5 @ effort:low and claude-sonnet-4-5. Not a property of one model.
 *
 * `extractXML(statements,'objectives')` is right to return '' — the element is
 * genuinely absent. The bug was downstream: callers read that '' as "legacy
 * format", split it on newlines, and produced ZERO objectives while three to
 * five complete ones sat in the response. Silent, every time.
 *
 * Sibling of the 2026-08-26 mis-closed-tag recovery in extractXML: same family
 * (malformed structure the app must survive), different malformation.
 *
 * Returns '' when there are genuinely no objectives — never invents one.
 */
export function extractObjectivesXML(statementsXML: string): string {
  const wrapped = extractXML(statementsXML, 'objectives')
  if (wrapped.includes('<objective>')) return wrapped
  // No usable wrapper. parseOKRObjectives reads <objective> blocks and ignores
  // everything else, so handing it the statements block cannot pull vision or
  // strategy prose into an objective.
  return statementsXML.includes('<objective>') ? statementsXML : ''
}

export function parseOKRObjectives(objectivesXML: string): Objective[] {
  const objectiveBlocks = extractAllXML(objectivesXML, 'objective');

  return objectiveBlocks.map((block, index) => {
    const title = extractXML(block, 'title');
    const statement = extractXML(block, 'statement');
    const explanation = extractXML(block, 'explanation');

    // New simplified OMTM format
    const omtm = extractXML(block, 'omtm');
    const aspiration = extractXML(block, 'aspiration');

    // Legacy key_results format (for backwards compat)
    const keyResultsXML = extractXML(block, 'key_results');
    const krBlocks = extractAllXML(keyResultsXML, 'kr');

    let keyResults: KeyResult[] | undefined;
    if (krBlocks.length > 0) {
      keyResults = krBlocks.map((kr, krIndex) => ({
        id: `kr-${Date.now()}-${index}-${krIndex}`,
        belief: {
          action: extractXML(kr, 'belief_action'),
          outcome: extractXML(kr, 'belief_outcome'),
        },
        signal: extractXML(kr, 'signal'),
        baseline: extractXML(kr, 'baseline'),
        target: extractXML(kr, 'target'),
        timeframe: (extractXML(kr, 'timeframe') || '6M') as KeyResult['timeframe'],
      }));
    }

    return {
      id: `obj-${Date.now()}-${index}`,
      title: title || undefined,
      objective: statement,
      pithy: statement, // For backwards compat
      explanation,
      // New simplified OMTM
      omtm: omtm || undefined,
      aspiration: aspiration || undefined,
      // Legacy (only if present)
      keyResults: keyResults?.length ? keyResults : undefined,
    };
  });
}

export function buildPrompt(
  prompt: string,
  context: BusinessContext,
  feedback?: string
): string {
  let fullPrompt = `${prompt}\nContext:\n`;
  fullPrompt += `Industry: ${context.industry}\n`;
  fullPrompt += `Target Market: ${context.targetMarket}\n`;
  fullPrompt += `Unique Value: ${context.uniqueValue}\n`;

  if (feedback) {
    fullPrompt += `\nPrevious Feedback: ${feedback}`;
  }

  return fullPrompt;
}
