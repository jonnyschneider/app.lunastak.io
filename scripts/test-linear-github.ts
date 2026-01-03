#!/usr/bin/env tsx
/**
 * Test Linear + GitHub Integration
 *
 * Creates a test issue and branch to verify the integration is working.
 *
 * Usage:
 *   LINEAR_API_KEY=<key> npx tsx scripts/test-linear-github.ts
 */

import { LinearClient } from '@linear/sdk';
import { execSync } from 'child_process';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable required');
  process.exit(1);
}

const client = new LinearClient({ apiKey: LINEAR_API_KEY });

async function testIntegration() {
  console.log('🧪 Testing Linear + GitHub Integration\n');

  // Get team
  const teams = await client.teams();
  const team = teams.nodes[0];

  if (!team) {
    console.error('❌ No team found');
    process.exit(1);
  }

  // Create test issue
  console.log('1️⃣  Creating test issue...');
  const issue = await client.createIssue({
    teamId: team.id,
    title: 'Test: GitHub Integration',
    description: `This is a test issue to verify Linear + GitHub integration.

**Test Steps:**
1. Create this issue ✅
2. Create branch with issue identifier
3. Push branch to GitHub
4. Verify branch appears in Linear
5. Create commit referencing issue
6. Verify commit appears in Linear
7. Clean up test artifacts

**Created:** ${new Date().toISOString()}`,
    priority: 0, // None
  });

  const issueData = await issue.issue;

  if (!issueData) {
    console.error('❌ Failed to create issue');
    process.exit(1);
  }

  console.log(`   ✅ Created issue: ${issueData.identifier} - ${issueData.title}`);
  console.log(`   URL: ${issueData.url}\n`);

  // Generate branch name
  const branchName = `test/${issueData.identifier.toLowerCase()}-github-integration`;
  console.log(`2️⃣  Creating test branch: ${branchName}`);

  try {
    // Check if we're on a clean working directory
    try {
      execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
    } catch {
      console.log('   ⚠️  Working directory has uncommitted changes');
      console.log('   Please commit or stash changes before running this test\n');
      console.log(`   Issue created: ${issueData.url}`);
      console.log('   You can manually test by creating branch:', branchName);
      process.exit(0);
    }

    // Create branch
    execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' });
    console.log('   ✅ Branch created locally\n');

    console.log('3️⃣  Pushing branch to GitHub...');
    execSync(`git push -u origin ${branchName}`, { stdio: 'pipe' });
    console.log('   ✅ Branch pushed\n');

    console.log('4️⃣  Creating test commit...');
    const testFile = 'test-linear-github-integration.txt';
    execSync(`echo "Test file for Linear + GitHub integration ${issueData.identifier}" > ${testFile}`);
    execSync(`git add ${testFile}`);
    execSync(`git commit -m "test: verify Linear + GitHub integration ${issueData.identifier}"`, { stdio: 'pipe' });
    console.log('   ✅ Commit created\n');

    console.log('5️⃣  Pushing commit...');
    execSync('git push', { stdio: 'pipe' });
    console.log('   ✅ Commit pushed\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Test artifacts created!\n');
    console.log('**Next steps:**\n');
    console.log(`1. Open Linear issue: ${issueData.url}`);
    console.log('2. Verify branch badge appears on the issue');
    console.log('3. Verify commit appears in activity feed\n');
    console.log('**Cleanup:**\n');
    console.log('   git checkout development');
    console.log(`   git branch -D ${branchName}`);
    console.log(`   git push origin --delete ${branchName}`);
    console.log(`   rm ${testFile}`);
    console.log(`   # Then close issue ${issueData.identifier} in Linear\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    const err = error as Error;
    console.error('❌ Error:', err.message);
    console.log(`\nIssue created: ${issueData.url}`);
    console.log('You can manually complete the test using the issue URL above.');
    process.exit(1);
  }
}

testIntegration().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
