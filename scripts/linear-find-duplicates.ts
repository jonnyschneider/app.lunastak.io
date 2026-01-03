#!/usr/bin/env tsx
/**
 * Find duplicate issues in Linear
 *
 * Helps identify issues that reference the same GitHub PR
 */

import { LinearClient } from '@linear/sdk';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable required');
  process.exit(1);
}

const client = new LinearClient({ apiKey: LINEAR_API_KEY });

async function findDuplicates() {
  console.log('🔍 Searching for duplicate issues...\n');

  const teams = await client.teams();
  const team = teams.nodes[0];

  if (!team) {
    console.error('❌ No team found');
    process.exit(1);
  }

  // Get all issues
  const issues = await team.issues({ first: 100 });

  // Group by title similarity (looking for PR references)
  const prPattern = /#(\d+)/;
  const prGroups = new Map<number, any[]>();

  for (const issue of issues.nodes) {
    const match = issue.title.match(prPattern) || issue.description?.match(prPattern);
    if (match) {
      const prNumber = parseInt(match[1]);
      if (!prGroups.has(prNumber)) {
        prGroups.set(prNumber, []);
      }
      prGroups.get(prNumber)!.push(issue);
    }
  }

  // Find duplicates
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('DUPLICATE ISSUES (same PR referenced)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let duplicatesFound = false;

  for (const [prNumber, group] of prGroups) {
    if (group.length > 1) {
      duplicatesFound = true;
      console.log(`\nPR #${prNumber} - ${group.length} issues:\n`);

      for (const issue of group) {
        const state = await issue.state;
        const project = await issue.project;

        console.log(`  ${issue.identifier} - ${issue.title}`);
        console.log(`    State: ${state?.name}`);
        console.log(`    Project: ${project?.name || 'None'}`);
        console.log(`    URL: ${issue.url}`);
        console.log();
      }

      console.log(`  💡 Suggestion: Keep the one in "Done" state (if it exists),`);
      console.log(`     delete the others. Archive or delete via Linear UI.\n`);
      console.log(`  ─────────────────────────────────────────────────\n`);
    }
  }

  if (!duplicatesFound) {
    console.log('✅ No duplicates found!\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

findDuplicates().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
