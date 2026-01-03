#!/usr/bin/env tsx
/**
 * Linear Setup Script
 *
 * Sets up Linear workspace for LunaStack backlog management:
 * - Creates projects for Infrastructure, Experiments, etc.
 * - Creates labels for categorizing issues
 * - Provides helpers for creating issues
 *
 * Usage:
 *   LINEAR_API_KEY=<key> npx tsx scripts/linear-setup.ts
 */

import { LinearClient } from '@linear/sdk';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable required');
  console.error('Usage: LINEAR_API_KEY=<key> npx tsx scripts/linear-setup.ts');
  process.exit(1);
}

const client = new LinearClient({ apiKey: LINEAR_API_KEY });

async function setup() {
  console.log('🚀 Setting up Linear workspace for LunaStack...\n');

  // Get team
  const teams = await client.teams();
  const team = teams.nodes[0];

  if (!team) {
    console.error('❌ No team found');
    process.exit(1);
  }

  console.log(`✅ Team: ${team.name} (${team.key})\n`);

  // Create labels
  console.log('📋 Creating labels...\n');

  const labelConfigs = [
    { name: 'chore', description: 'Technical tasks, refactoring, tests', color: '#95A2B3' },
    { name: 'experiment', description: 'Experiment implementation', color: '#5E6AD2' },
    { name: 'documentation', description: 'Documentation updates', color: '#46A758' },
    { name: 'automation', description: 'Deployment, CI/CD improvements', color: '#AB4ABA' },
  ];

  const existingLabels = await team.labels();
  const existingLabelNames = new Set(existingLabels.nodes.map(l => l.name.toLowerCase()));

  for (const config of labelConfigs) {
    if (existingLabelNames.has(config.name.toLowerCase())) {
      console.log(`  ⏭️  Label "${config.name}" already exists`);
      continue;
    }

    try {
      await client.createIssueLabel({
        teamId: team.id,
        name: config.name,
        description: config.description,
        color: config.color,
      });
      console.log(`  ✅ Created label: ${config.name}`);
    } catch (error) {
      const err = error as Error;
      console.log(`  ⚠️  Skipped label "${config.name}": ${err.message}`);
    }
  }

  // Create projects
  console.log('\n📦 Creating projects...\n');

  const projectConfigs = [
    {
      name: 'Infrastructure Backlog',
      description: 'Technical chores and infrastructure improvements',
    },
    {
      name: 'E3: Proactive Gap-Based Questioning',
      description: 'Experiment 3 - Use coverage gaps to guide conversation',
    },
    {
      name: 'E4: LLM-as-Judge Training',
      description: 'Experiment 4 - Use coverage data to train quality evaluation',
    },
  ];

  const existingProjects = await team.projects();
  const existingProjectNames = new Set(existingProjects.nodes.map(p => p.name));

  const createdProjects = [];

  for (const config of projectConfigs) {
    if (existingProjectNames.has(config.name)) {
      console.log(`  ⏭️  Project "${config.name}" already exists`);
      const existing = existingProjects.nodes.find(p => p.name === config.name);
      if (existing) {
        createdProjects.push(existing);
      }
      continue;
    }

    const projectResponse = await client.createProject({
      teamIds: [team.id],
      name: config.name,
      description: config.description,
    });

    console.log(`  ✅ Created project: ${config.name}`);

    // Fetch the created project to get full details
    const projectData = await projectResponse.project;
    if (projectData?.id) {
      const fullProject = await client.project(projectData.id);
      createdProjects.push(fullProject);
    }
  }

  // Create sample infrastructure issues
  console.log('\n🎯 Creating sample infrastructure issues...\n');

  const infrastructureProject = createdProjects.find(
    p => p?.name === 'Infrastructure Backlog'
  );

  if (infrastructureProject) {
    const choreLabel = (await team.labels()).nodes.find(l => l.name === 'chore');

    const sampleIssues = [
      {
        title: 'Complete full suite of unit tests',
        description: 'Expand test coverage to enable automated UAT testing.\n\n**Current state:**\n- 36 tests across 5 test suites\n- Missing: API route tests, component integration tests\n\n**Goal:**\n- 80%+ code coverage\n- All critical paths tested\n- Fast, reliable test suite',
        priority: 2, // Medium
        labelIds: choreLabel ? [choreLabel.id] : [],
      },
      {
        title: 'Automate VERSION_MAPPING.md updates in deployment scripts',
        description: 'VERSION_MAPPING.md is manually updated during releases. This should be automated in the deployment script to prevent it from being missed.\n\n**Tasks:**\n- Create script to update VERSION_MAPPING.md\n- Integrate into release workflow\n- Add validation check',
        priority: 3, // Low
        labelIds: choreLabel ? [choreLabel.id] : [],
      },
      {
        title: 'Set up GitHub Actions for automated testing',
        description: 'Run tests on every PR to catch issues early.\n\n**Requirements:**\n- Run TypeScript type check\n- Run Jest test suite\n- Block merge if tests fail',
        priority: 2, // Medium
        labelIds: choreLabel ? [choreLabel.id] : [],
      },
    ];

    const existingIssues = await infrastructureProject.issues();
    const existingIssueTitles = new Set(existingIssues.nodes.map(i => i.title));

    for (const issue of sampleIssues) {
      if (existingIssueTitles.has(issue.title)) {
        console.log(`  ⏭️  Issue "${issue.title}" already exists`);
        continue;
      }

      await client.createIssue({
        teamId: team.id,
        projectId: infrastructureProject.id,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        labelIds: issue.labelIds,
      });

      console.log(`  ✅ Created issue: ${issue.title}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Linear setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Visit: https://linear.app/humventures');
  console.log('  2. Review projects and issues');
  console.log('  3. Customize as needed');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

setup().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
