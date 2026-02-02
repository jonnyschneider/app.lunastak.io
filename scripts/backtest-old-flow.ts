#!/usr/bin/env npx tsx
/**
 * Backtest: Old Flow (reflective_summary → v1-with-summary generation)
 *
 * Simulates the pre-optimization flow for A/B comparison.
 */

import * as fs from 'fs';
import { createMessage, CLAUDE_MODEL } from '../src/lib/claude';
import { getPrompt } from '../src/lib/prompts';
import { extractXML } from '../src/lib/utils';

function extractAllXML(text: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

async function main() {
  const input = JSON.parse(fs.readFileSync('/tmp/backtest-input.json', 'utf-8'));
  const startTotal = Date.now();

  console.log('=== OLD FLOW (with reflective_summary) ===\n');

  // Step 1: Generate reflective_summary
  console.log('Step 1: Generating reflective_summary...');
  const summaryPrompt = getPrompt('reflective-summary', 'v1');
  if (!summaryPrompt) throw new Error('Summary prompt not found');

  const summaryStart = Date.now();

  const summaryResponse = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: summaryPrompt.template.replace('{conversation}', input.conversationHistory)
    }],
    temperature: 0.5
  }, 'backtest_reflective_summary');

  const summaryTime = Date.now() - summaryStart;
  console.log(`  Reflective summary: ${summaryTime}ms`);

  const summaryContent = summaryResponse.content[0]?.type === 'text' ? summaryResponse.content[0].text : '';
  const summaryXML = extractXML(summaryContent, 'summary');

  const reflective_summary = {
    strengths: extractAllXML(summaryXML, 'strength'),
    emerging: extractAllXML(summaryXML, 'area'),
    opportunities_for_enrichment: extractAllXML(summaryXML, 'opportunity'),
  };

  console.log(`  Strengths: ${reflective_summary.strengths.length}`);
  console.log(`  Emerging: ${reflective_summary.emerging.length}`);
  console.log(`  Opportunities: ${reflective_summary.opportunities_for_enrichment.length}`);

  // Step 2: Generate strategy with v1-with-summary
  console.log('\nStep 2: Generating strategy (v1-with-summary)...');
  const genPrompt = getPrompt('generation', 'v1-with-summary');
  if (!genPrompt) throw new Error('Generation prompt not found');

  const genStart = Date.now();

  const themesText = input.themes
    .map((t: any) => `${t.theme_name}:\n${t.content}`)
    .join('\n\n');

  const strengthsText = reflective_summary.strengths.map(s => `- ${s}`).join('\n');
  const emergingText = reflective_summary.emerging.map(e => `- ${e}`).join('\n');
  const opportunitiesText = reflective_summary.opportunities_for_enrichment.map(o => `- ${o}`).join('\n');

  const filledPrompt = genPrompt.template
    .replace('{themes}', themesText)
    .replace('{strengths}', strengthsText || 'None identified')
    .replace('{emerging}', emergingText || 'None identified')
    .replace('{unexplored}', opportunitiesText || 'None identified');

  const genResponse = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    messages: [{ role: 'user', content: filledPrompt }],
    temperature: 0.7
  }, 'backtest_v1_generation');

  const genTime = Date.now() - genStart;
  const totalTime = Date.now() - startTotal;

  console.log(`  Generation: ${genTime}ms`);
  console.log('\n=== TIMING SUMMARY ===');
  console.log(`Reflective summary: ${summaryTime}ms`);
  console.log(`Strategy generation: ${genTime}ms`);
  console.log(`TOTAL (old flow): ${totalTime}ms`);

  // Extract and show the strategy
  const genContent = genResponse.content[0]?.type === 'text' ? genResponse.content[0].text : '';
  const statementsXML = extractXML(genContent, 'statements');
  const vision = extractXML(statementsXML, 'vision');
  const strategy = extractXML(statementsXML, 'strategy');

  console.log('\n=== GENERATED STRATEGY (OLD FLOW) ===');
  console.log(`Vision: ${vision.substring(0, 150)}...`);
  console.log(`Strategy: ${strategy.substring(0, 150)}...`);

  // Save full results
  fs.writeFileSync('/tmp/backtest-old-flow.json', JSON.stringify({
    flow: 'old (v1-with-summary)',
    timing: { summaryMs: summaryTime, generationMs: genTime, totalMs: totalTime },
    reflective_summary,
    output: genContent
  }, null, 2));

  console.log('\nFull results saved to /tmp/backtest-old-flow.json');
}

main().catch(console.error);
