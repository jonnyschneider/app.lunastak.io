#!/usr/bin/env tsx
/**
 * Quick check to see if dimensional coverage exists in the database
 */

import { prisma } from '../src/lib/db';

async function checkCoverage() {
  const tracesWithCoverage = await prisma.trace.findMany({
    where: {
      dimensionalCoverage: {
        not: { equals: null }
      }
    },
    select: {
      id: true,
      timestamp: true,
      dimensionalCoverage: true,
      conversation: {
        select: {
          experimentVariant: true
        }
      }
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: 5
  });

  console.log(`\nFound ${tracesWithCoverage.length} traces with dimensional coverage\n`);

  for (const trace of tracesWithCoverage) {
    const coverage = trace.dimensionalCoverage as any;
    console.log(`Trace: ${trace.id}`);
    console.log(`  Variant: ${trace.conversation.experimentVariant}`);
    console.log(`  Timestamp: ${trace.timestamp.toISOString()}`);
    console.log(`  Coverage: ${coverage?.summary?.dimensionsCovered}/10 (${coverage?.summary?.coveragePercentage}%)`);
    console.log(`  Gaps: ${coverage?.summary?.gaps?.length || 0}`);
    console.log();
  }

  process.exit(0);
}

checkCoverage().catch(console.error);
