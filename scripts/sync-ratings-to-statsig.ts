/**
 * Sync quality ratings from Prisma to Statsig
 *
 * Use after manually rating traces in DBeaver/Prisma.
 * Sends Statsig events for experiment metrics.
 *
 * Usage: npx tsx scripts/sync-ratings-to-statsig.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import Statsig from 'statsig-node';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(isDryRun ? '🔍 DRY RUN - no events will be sent\n' : '🚀 Syncing ratings to Statsig\n');

  // Initialize Statsig
  if (!isDryRun) {
    if (!process.env.STATSIG_SERVER_SECRET_KEY) {
      console.error('❌ STATSIG_SERVER_SECRET_KEY not set');
      process.exit(1);
    }
    await Statsig.initialize(process.env.STATSIG_SERVER_SECRET_KEY);
  }

  // Find all traces with quality ratings that have conversations
  const traces = await prisma.trace.findMany({
    where: {
      qualityRating: { not: null },
    },
    include: {
      conversation: true,
    },
    orderBy: {
      qualityRatingTimestamp: 'desc',
    },
  });

  console.log(`Found ${traces.length} rated traces\n`);

  let synced = 0;
  let skipped = 0;

  for (const trace of traces) {
    const userId = trace.conversation?.userId;
    const variant = trace.conversation?.experimentVariant || 'unknown';
    const rating = trace.qualityRating;

    if (!userId) {
      console.log(`⏭️  Skipping trace ${trace.id} - no userId`);
      skipped++;
      continue;
    }

    console.log(`📊 Trace ${trace.id}`);
    console.log(`   User: ${userId}`);
    console.log(`   Variant: ${variant}`);
    console.log(`   Rating: ${rating}`);

    if (!isDryRun) {
      Statsig.logEvent(
        { userID: userId },
        'quality_rating',
        rating === 'good' ? 1 : 0,
        { rating: rating!, variant }
      );
      console.log(`   ✅ Event sent`);
    } else {
      console.log(`   (would send event)`);
    }

    synced++;
    console.log('');
  }

  // Shutdown Statsig to flush events
  if (!isDryRun) {
    Statsig.shutdown();
  }

  console.log(`\n✅ Done: ${synced} synced, ${skipped} skipped`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
