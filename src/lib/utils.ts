import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BusinessContext, Objective } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get display title for an objective.
 * Uses title if present, otherwise truncates pithy to ~5 words.
 */
export function getObjectiveTitle(objective: Pick<Objective, 'title' | 'pithy'>): string {
  if (objective.title) return objective.title;
  // Fallback: first 5 words of pithy
  const words = objective.pithy.split(/\s+/);
  if (words.length <= 5) return objective.pithy;
  return words.slice(0, 5).join(' ') + '...';
}

export function extractXML(text: string, tag: string): string {
  const pattern = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
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
