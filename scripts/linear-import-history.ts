#!/usr/bin/env tsx
/**
 * Import GitHub project history into Linear
 *
 * This script imports closed PRs and releases as Linear issues
 * to provide historical context in your backlog.
 *
 * Usage:
 *   LINEAR_API_KEY=<key> npx tsx scripts/linear-import-history.ts [--dry-run]
 */

import { LinearClient } from '@linear/sdk';
import { execSync } from 'child_process';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable required');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

interface GitHubPR {
  number: number;
  title: string;
  state: string;
  mergedAt: string | null;
  createdAt: string;
  author: { login: string };
  labels: Array<{ name: string }>;
}

const client = new LinearClient({ apiKey: LINEAR_API_KEY });

async function getGitHubPRs(): Promise<GitHubPR[]> {
  const output = execSync(
    'gh pr list --repo jonnyschneider/app.lunastak.io --state all --limit 100 --json number,title,state,mergedAt,createdAt,author,labels',
    { encoding: 'utf-8' }
  );
  return JSON.parse(output);
}

async function importHistory() {
  console.log('🔍 Fetching GitHub PR history...\n');

  const prs = await getGitHubPRs();
  console.log(`Found ${prs.length} PRs\n`);

  // Get Linear team and project
  const teams = await client.teams();
  const team = teams.nodes[0];

  if (!team) {
    console.error('❌ No team found');
    process.exit(1);
  }

  // Find or create "Project History" project
  const projects = await team.projects();
  let historyProject = projects.nodes.find(p => p.name === 'Project History');

  if (!historyProject && !DRY_RUN) {
    console.log('📦 Creating "Project History" project...\n');
    const projectResponse = await client.createProject({
      teamIds: [team.id],
      name: 'Project History',
      description: 'Imported GitHub PRs and releases for historical context',
    });
    const projectData = await projectResponse.project;
    if (projectData?.id) {
      historyProject = await client.project(projectData.id);
    }
  }

  if (!historyProject) {
    console.log('ℹ️  "Project History" project would be created\n');
  }

  // Get labels
  const allLabels = await team.labels();
  const experimentLabel = allLabels.nodes.find(l => l.name === 'experiment');

  console.log('📋 Importing PRs as Linear issues...\n');

  let importedCount = 0;
  let skippedCount = 0;

  // Import merged PRs (most recent first, limit to last 20 for initial import)
  const mergedPRs = prs
    .filter(pr => pr.state === 'MERGED' && pr.mergedAt)
    .sort((a, b) => new Date(b.mergedAt!).getTime() - new Date(a.mergedAt!).getTime())
    .slice(0, 20);

  for (const pr of mergedPRs) {
    const isExperiment = pr.title.toLowerCase().includes('experiment') ||
                          pr.title.toLowerCase().includes('e1') ||
                          pr.title.toLowerCase().includes('e2');

    const description = `Imported from GitHub PR #${pr.number}

**Merged:** ${new Date(pr.mergedAt!).toLocaleDateString()}
**Author:** @${pr.author.login}
**State:** ${pr.state}

**GitHub PR:** https://github.com/jonnyschneider/app.lunastak.io/pull/${pr.number}

---

${pr.title}`;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would import: PR #${pr.number} - ${pr.title}`);
      importedCount++;
      continue;
    }

    try {
      const issue = await client.createIssue({
        teamId: team.id,
        projectId: historyProject?.id,
        title: `[Imported] ${pr.title}`,
        description,
        priority: 0, // None - historical context
        labelIds: isExperiment && experimentLabel ? [experimentLabel.id] : [],
      });

      const issueData = await issue.issue;

      // Mark as completed
      const workflow = await team.states();
      const completedState = workflow.nodes.find(s => s.type === 'completed');

      if (completedState && issueData?.id) {
        await client.updateIssue(issueData.id, {
          stateId: completedState.id,
          completedAt: new Date(pr.mergedAt!),
        });
      }

      console.log(`  ✅ Imported PR #${pr.number}: ${pr.title}`);
      importedCount++;
    } catch (error) {
      const err = error as Error;
      console.log(`  ⚠️  Skipped PR #${pr.number}: ${err.message}`);
      skippedCount++;
    }

    // Rate limiting - wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Import Summary:\n');
  console.log(`  PRs found:        ${prs.length}`);
  console.log(`  Merged PRs:       ${mergedPRs.length}`);
  console.log(`  Imported:         ${importedCount}`);
  console.log(`  Skipped:          ${skippedCount}`);

  if (DRY_RUN) {
    console.log('\n  ℹ️  DRY RUN - No issues were actually created');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!DRY_RUN && historyProject) {
    console.log('✅ History import complete!');
    console.log(`\nView in Linear: https://linear.app/humventures/project/${historyProject.id}\n`);
  }
}

importHistory().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
