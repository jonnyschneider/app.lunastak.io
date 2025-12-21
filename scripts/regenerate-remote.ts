#!/usr/bin/env tsx
/**
 * Regenerate strategy from existing trace via API endpoint
 *
 * Usage:
 *   npm run regen:remote <traceId> [baseUrl]
 *
 * Examples:
 *   npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4
 *   npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4 https://dc-agent-v4.vercel.app
 *   npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4 http://localhost:3000
 */

async function regenerateRemote(traceId: string, baseUrl: string = 'http://localhost:3000') {
  // Ensure URL has protocol
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }

  console.log(`\n🔄 Regenerating strategy from trace: ${traceId}`);
  console.log(`📡 Using endpoint: ${baseUrl}/api/admin/regenerate\n`);

  try {
    const response = await fetch(`${baseUrl}/api/admin/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ traceId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('✅ Regeneration complete\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Results:\n');
    console.log(`  Original trace: ${data.originalTraceId}`);
    console.log(`  New trace:      ${data.newTraceId}`);
    console.log(`\n  View at: ${baseUrl}${data.url}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Vision:');
    console.log(`  ${data.statements.vision}\n`);
    console.log('🎯 Strategy:');
    console.log(`  ${data.statements.strategy}\n`);
    console.log('📈 Objectives:');
    data.statements.objectives.forEach((obj: any, i: number) => {
      console.log(`  ${i + 1}. ${obj.pithy}`);
      if (obj.metric.metricValue) {
        console.log(`     ${obj.metric.direction === 'increase' ? '↑' : '↓'} ${obj.metric.metricName} | ${obj.metric.metricValue}`);
      }
    });
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Main
const traceId = process.argv[2];
const baseUrl = process.argv[3];

if (!traceId) {
  console.error('\n❌ Error: Trace ID required\n');
  console.log('Usage:');
  console.log('  npm run regen:remote <traceId> [baseUrl]\n');
  console.log('Examples:');
  console.log('  npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4');
  console.log('  npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4 https://dc-agent-v4.vercel.app');
  console.log('  npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4 http://localhost:3000\n');
  process.exit(1);
}

regenerateRemote(traceId, baseUrl)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
