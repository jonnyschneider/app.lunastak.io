import { BusinessContext } from './types';

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
