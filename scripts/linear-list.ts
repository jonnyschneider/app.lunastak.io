#!/usr/bin/env tsx
import { LinearClient } from '@linear/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/LINEAR_API_KEY=(.+)/);
const apiKey = apiKeyMatch?.[1]?.trim();

if (!apiKey) {
  console.error('LINEAR_API_KEY not found in .env.local');
  process.exit(1);
}

const client = new LinearClient({ apiKey });

// Parse CLI args
const args = process.argv.slice(2);
const statusFilter = args.find(a => a.startsWith('--status='))?.split('=')[1]?.toLowerCase();

async function listIssues() {
  const teams = await client.teams();
  const team = teams.nodes[0];

  // Build filter
  const filter: Record<string, unknown> = {
    team: { id: { eq: team.id } },
    state: { type: { nin: ['completed', 'canceled'] } }
  };

  // If status specified, filter by state name
  if (statusFilter) {
    filter.state = { name: { eqIgnoreCase: statusFilter } };
  }

  const issues = await client.issues({ filter });

  // Sort by priority (1=Urgent, 2=High, 3=Medium, 4=Low, 0=None)
  const sorted = [...issues.nodes].sort((a, b) => {
    const pa = a.priority === 0 ? 5 : a.priority;
    const pb = b.priority === 0 ? 5 : b.priority;
    return pa - pb;
  });

  const title = statusFilter
    ? `=== Linear Issues (Status: ${statusFilter}) ===`
    : '=== Linear Backlog (All Open) ===';
  console.log(title + '\n');

  for (const issue of sorted.slice(0, 20)) {
    const priority = ['None', 'Urgent', 'High', 'Medium', 'Low'][issue.priority] || 'None';
    const state = await issue.state;
    console.log(`[${priority}] ${issue.identifier}: ${issue.title}`);
    console.log(`   Status: ${state?.name || 'Unknown'}`);
    if (issue.description) {
      const desc = issue.description.split('\n')[0].substring(0, 80);
      console.log(`   ${desc}`);
    }
    console.log();
  }
}

listIssues().catch(e => console.error('Error:', e.message));
