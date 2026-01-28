#!/usr/bin/env tsx
/**
 * Add a comment to a Linear issue
 * Usage: npx tsx scripts/linear-comment.ts HUM-79 "Comment text"
 */
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

const [issueId, ...commentParts] = process.argv.slice(2);
const comment = commentParts.join(' ');

if (!issueId || !comment) {
  console.log('Usage: npx tsx scripts/linear-comment.ts HUM-79 "Comment text"');
  process.exit(1);
}

async function main() {
  try {
    const issue = await client.issue(issueId);
    await client.createComment({
      issueId: issue.id,
      body: comment,
    });
    console.log(`✓ Added comment to ${issueId}`);
  } catch (e) {
    console.error(`Failed to comment on ${issueId}:`, e);
    process.exit(1);
  }
}

main();
