#!/usr/bin/env tsx
/**
 * Create a Linear issue from the command line
 *
 * Usage:
 *   npm run linear:issue -- --title "Issue title" --description "Description" [options]
 *
 * Options:
 *   --title        Issue title (required)
 *   --description  Issue description (required)
 *   --project      Project name (default: "Infrastructure Backlog")
 *   --priority     Priority: urgent(1), high(2), medium(3), low(4), none(0) (default: 3)
 *   --label        Label name (can specify multiple: --label chore --label automation)
 */

import { LinearClient } from '@linear/sdk';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable required');
  console.error('Add to .env.local: LINEAR_API_KEY=<your-key>');
  process.exit(1);
}

interface Args {
  title?: string;
  description?: string;
  project?: string;
  priority?: string;
  labels: string[];
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = {
    project: 'Infrastructure Backlog',
    priority: '3', // medium
    labels: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--title') {
      parsed.title = args[++i];
    } else if (arg === '--description') {
      parsed.description = args[++i];
    } else if (arg === '--project') {
      parsed.project = args[++i];
    } else if (arg === '--priority') {
      parsed.priority = args[++i];
    } else if (arg === '--label') {
      parsed.labels.push(args[++i]);
    }
  }

  if (!parsed.title || !parsed.description) {
    console.error('Error: --title and --description are required\n');
    console.error('Usage: npm run linear:issue -- --title "Title" --description "Description" [options]\n');
    console.error('Options:');
    console.error('  --project      Project name (default: "Infrastructure Backlog")');
    console.error('  --priority     Priority: urgent(1), high(2), medium(3), low(4), none(0)');
    console.error('  --label        Label name (can specify multiple)');
    process.exit(1);
  }

  return parsed;
}

async function createIssue() {
  const args = parseArgs();
  const client = new LinearClient({ apiKey: LINEAR_API_KEY });

  // Get team
  const teams = await client.teams();
  const team = teams.nodes[0];

  if (!team) {
    console.error('❌ No team found');
    process.exit(1);
  }

  // Find project
  const projects = await team.projects();
  const project = projects.nodes.find(p => p.name === args.project);

  if (!project) {
    console.error(`❌ Project "${args.project}" not found`);
    console.error('\nAvailable projects:');
    for (const p of projects.nodes) {
      console.error(`  - ${p.name}`);
    }
    process.exit(1);
  }

  // Find labels
  const labelIds: string[] = [];
  if (args.labels.length > 0) {
    const allLabels = await team.labels();
    for (const labelName of args.labels) {
      const label = allLabels.nodes.find(l => l.name.toLowerCase() === labelName.toLowerCase());
      if (label) {
        labelIds.push(label.id);
      } else {
        console.warn(`⚠️  Label "${labelName}" not found, skipping`);
      }
    }
  }

  // Parse priority
  const priorityMap: Record<string, number> = {
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
    none: 0,
  };
  const priority = priorityMap[args.priority?.toLowerCase() || ''] || parseInt(args.priority || '3');

  // Create issue
  const issue = await client.createIssue({
    teamId: team.id,
    projectId: project.id,
    title: args.title!,
    description: args.description!,
    priority,
    labelIds,
  });

  const issueData = await issue.issue;
  console.log(`✅ Created issue: ${issueData?.title}`);
  console.log(`   URL: ${issueData?.url}`);
  console.log(`   ID: ${issueData?.identifier}`);
}

createIssue().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
