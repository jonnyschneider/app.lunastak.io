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
  const pattern = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
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
 * Parse OKR-style objectives from XML.
 * Used by v3-okr-objectives prompt.
 */
export function parseOKRObjectives(objectivesXML: string): Objective[] {
  const objectiveBlocks = extractAllXML(objectivesXML, 'objective');

  return objectiveBlocks.map((block, index) => {
    const title = extractXML(block, 'title');
    const statement = extractXML(block, 'statement');
    const explanation = extractXML(block, 'explanation');
    const keyResultsXML = extractXML(block, 'key_results');
    const krBlocks = extractAllXML(keyResultsXML, 'kr');

    const keyResults: KeyResult[] = krBlocks.map((kr, krIndex) => ({
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

    return {
      id: `obj-${Date.now()}-${index}`,
      title: title || undefined,
      objective: statement,
      pithy: statement, // For backwards compat
      explanation,
      keyResults,
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
