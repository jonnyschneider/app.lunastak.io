#!/usr/bin/env tsx
import { LinearClient } from '@linear/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/LINEAR_API_KEY=(.+)/);
const apiKey = apiKeyMatch?.[1]?.trim();

if (!apiKey) {
  console.error('LINEAR_API_KEY not found');
  process.exit(1);
}

const client = new LinearClient({ apiKey });

const issueIds = process.argv.slice(2);
if (issueIds.length === 0) {
  console.log('Usage: npx tsx scripts/linear-get-issues.ts HUM-28 HUM-32 ...');
  process.exit(1);
}

async function main() {
  for (const id of issueIds) {
    try {
      const issue = await client.issue(id);
      console.log('='.repeat(60));
      console.log(`## ${issue.identifier}: ${issue.title}`);
      console.log('');
      console.log(issue.description || '(no description)');
      console.log('');
    } catch (e) {
      console.log(`Failed to fetch ${id}`);
    }
  }
}

main();
