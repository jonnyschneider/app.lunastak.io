/**
 * Pre-generate script: Test generation with pre-extracted context
 *
 * Usage:
 *   npx tsx scripts/pre-generate.ts
 *   npx tsx scripts/pre-generate.ts --dry-run  # Just show what would be sent
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'seed/fixtures/pre-generate-4pl.json'), 'utf-8')
);

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const payload = {
    conversationId: fixture.conversationId,
    extractedContext: fixture.extractedContext,
    dimensionalCoverage: fixture.dimensionalCoverage,
  };

  console.log('=== Pre-Generate Test ===');
  console.log('Project:', fixture.projectId);
  console.log('Conversation:', fixture.conversationId);
  console.log('Themes:', fixture.extractedContext.themes.length);
  console.log('Coverage:', fixture.dimensionalCoverage.summary.coveragePercentage + '%');
  console.log('');

  if (isDryRun) {
    console.log('DRY RUN - Would send:');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('Calling POST /api/generate...');

  const response = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Error:', response.status, error);
    return;
  }

  // Stream the response
  const reader = response.body?.getReader();
  if (!reader) {
    console.error('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const update = JSON.parse(line);
          console.log(`[${update.step}]`, update.data ? JSON.stringify(update.data).substring(0, 200) : '');

          if (update.step === 'complete' && update.data?.statements) {
            console.log('\n=== GENERATED STRATEGY ===');
            console.log('\nVISION:', update.data.statements.vision);
            console.log('\nSTRATEGY:', update.data.statements.strategy);
            console.log('\nOBJECTIVES:');
            for (const obj of update.data.statements.objectives) {
              console.log(`  - ${obj.pithy}`);
              if (obj.metric) {
                console.log(`    Metric: ${obj.metric.full}`);
              }
            }
          }
        } catch (e) {
          // Not JSON, just print
          console.log(line);
        }
      }
    }
  }
}

main().catch(console.error);
