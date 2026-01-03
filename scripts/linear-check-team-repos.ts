#!/usr/bin/env tsx
/**
 * Check team-level GitHub repository settings in Linear
 */

import { LinearClient } from '@linear/sdk';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable required');
  process.exit(1);
}

const client = new LinearClient({ apiKey: LINEAR_API_KEY });

async function checkTeamRepos() {
  console.log('🔍 Checking team GitHub repository settings...\n');

  const teams = await client.teams();
  const team = teams.nodes[0];

  if (!team) {
    console.error('❌ No team found');
    process.exit(1);
  }

  console.log(`Team: ${team.name} (${team.key})\n`);

  // Check for integration resources
  const integrations = await client.integrationResources({
    filter: {
      team: { id: { eq: team.id } }
    }
  });

  console.log(`Integration resources found: ${integrations.nodes.length}\n`);

  for (const resource of integrations.nodes) {
    const integration = await resource.integration;
    console.log(`- ${integration.service}: ${resource.resourceId}`);
  }

  // Check organization integration
  const org = await client.organization;
  console.log(`\nOrganization: ${org.name}`);

  const orgIntegrations = await org.integrations();
  console.log(`\nOrganization integrations: ${orgIntegrations.nodes.length}`);

  for (const integration of orgIntegrations.nodes) {
    console.log(`- ${integration.service}`);

    if (integration.service === 'github') {
      // Try to get settings
      console.log(`  GitHub integration ID: ${integration.id}`);
    }
  }
}

checkTeamRepos().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
