#!/usr/bin/env tsx
/**
 * Hydrate Database from Fixture
 *
 * Usage:
 *   npx tsx scripts/seed/hydrate.ts --fixture demo-dogfood --email demo@example.com
 *   npx tsx scripts/seed/hydrate.ts --fixture demo-dogfood --email demo@example.com --reset
 *   npx tsx scripts/seed/hydrate.ts --fixture demo-dogfood --email demo@example.com --dry-run
 *
 * For existing guest projects (use projectId from URL):
 *   npx tsx scripts/seed/hydrate.ts --fixture demo-pre-generate --projectId cml1l8inw0002cz9evme0t2mr
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../../src/lib/db';
import type { Prisma } from '@prisma/client';
import type { Fixture, HydrateOptions } from './types';
import { TIER_1_DIMENSIONS } from '../../src/lib/constants/dimensions';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function generateCuid(): string {
  // Simple CUID-like generator for placeholders
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

function parseArgs(): HydrateOptions {
  const args = process.argv.slice(2);
  const options: Partial<HydrateOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--fixture':
        options.fixture = args[++i];
        break;
      case '--email':
        options.email = args[++i];
        break;
      case '--variant':
        options.variantOverride = args[++i];
        break;
      case '--reset':
        options.reset = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--production':
        options.production = true;
        break;
      case '--projectId':
        options.projectId = args[++i];
        break;
      case '--userId':
        options.userId = args[++i];
        break;
    }
  }

  // Validate: need either --email OR --projectId
  if (!options.fixture || (!options.email && !options.projectId)) {
    console.error('\n[ERROR] Missing required arguments\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/seed/hydrate.ts --fixture <name> --email <email>');
    console.log('  npx tsx scripts/seed/hydrate.ts --fixture <name> --projectId <id>\n');
    console.log('Options:');
    console.log('  --fixture <name>    Fixture name (without .json)');
    console.log('  --email <email>     Email for new user account');
    console.log('  --projectId <id>    Hydrate into existing project (from URL)');
    console.log('  --userId <id>       Use existing user (optional with --projectId)');
    console.log('  --variant <variant> Override experiment variant');
    console.log('  --reset             Delete existing data first');
    console.log('  --dry-run           Preview without writing');
    console.log('  --production        Allow running against production DB\n');
    process.exit(1);
  }

  return options as HydrateOptions;
}

// Helper to hydrate data into an existing project
async function hydrateProjectData(
  projectId: string,
  userId: string | null,
  projectFixture: Fixture['projects'][0],
  resolveId: (id: string) => string,
  options: HydrateOptions
): Promise<void> {
  // Create deep dives first (conversations may reference them)
  for (const ddFixture of projectFixture.deepDives || []) {
    const ddId = resolveId(ddFixture.id);
    await prisma.deepDive.create({
      data: {
        id: ddId,
        projectId,
        topic: ddFixture.topic,
        notes: ddFixture.notes,
        status: ddFixture.status,
        origin: ddFixture.origin,
      },
    });
  }

  // Create documents
  for (const docFixture of projectFixture.documents || []) {
    const docId = resolveId(docFixture.id);
    await prisma.document.create({
      data: {
        id: docId,
        projectId,
        fileName: docFixture.fileName,
        fileType: docFixture.fileType,
        fileSizeBytes: docFixture.fileSizeBytes,
        uploadContext: docFixture.uploadContext,
        status: docFixture.status,
        deepDiveId: docFixture.deepDiveId ? resolveId(docFixture.deepDiveId) : undefined,
      },
    });
  }

  // Create conversations
  for (const convFixture of projectFixture.conversations) {
    const convId = resolveId(convFixture.id);
    const variant = options.variantOverride || convFixture.experimentVariant;

    console.log(`  [INFO] Creating conversation: ${convFixture.title || 'Untitled'}`);

    const conversation = await prisma.conversation.create({
      data: {
        id: convId,
        userId,
        projectId,
        title: convFixture.title,
        status: convFixture.status,
        currentPhase: convFixture.currentPhase,
        selectedLens: convFixture.selectedLens,
        questionCount: convFixture.questionCount,
        experimentVariant: variant,
        isInitialConversation: convFixture.isInitialConversation ?? false,
      },
    });

    // Create messages
    for (const msgFixture of convFixture.messages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: msgFixture.role,
          content: msgFixture.content,
          stepNumber: msgFixture.stepNumber,
        },
      });
    }

    // Create traces
    for (const traceFixture of convFixture.traces) {
      await prisma.trace.create({
        data: {
          conversationId: conversation.id,
          projectId,
          userId,
          extractedContext: traceFixture.extractedContext as Prisma.InputJsonValue,
          dimensionalCoverage: traceFixture.dimensionalCoverage as Prisma.InputJsonValue | undefined,
          output: traceFixture.output as Prisma.InputJsonValue,
          claudeThoughts: traceFixture.claudeThoughts,
          modelUsed: traceFixture.modelUsed,
          totalTokens: traceFixture.totalTokens,
          promptTokens: traceFixture.promptTokens,
          completionTokens: traceFixture.completionTokens,
          latencyMs: traceFixture.latencyMs,
          starred: traceFixture.starred,
          starredAt: traceFixture.starred ? new Date() : undefined,
        },
      });
    }
  }

  // Create fragments
  for (const fragFixture of projectFixture.fragments) {
    const fragId = resolveId(fragFixture.id);
    const convId = fragFixture.conversationId ? resolveId(fragFixture.conversationId) : undefined;
    const docId = fragFixture.documentId ? resolveId(fragFixture.documentId) : undefined;

    const fragment = await prisma.fragment.create({
      data: {
        id: fragId,
        projectId,
        conversationId: convId,
        documentId: docId,
        content: fragFixture.content,
        contentType: fragFixture.contentType,
        status: fragFixture.status,
        confidence: fragFixture.confidence,
      },
    });

    // Create dimension tags
    for (const tagFixture of fragFixture.dimensionTags || []) {
      await prisma.fragmentDimensionTag.create({
        data: {
          fragmentId: fragment.id,
          dimension: tagFixture.dimension,
          confidence: tagFixture.confidence,
        },
      });
    }
  }

  // Upsert dimensional syntheses (may already exist from previous hydration)
  for (const synthFixture of projectFixture.syntheses || []) {
    await prisma.dimensionalSynthesis.upsert({
      where: {
        projectId_dimension: { projectId, dimension: synthFixture.dimension },
      },
      update: {
        summary: synthFixture.summary,
        keyThemes: synthFixture.keyThemes,
        gaps: JSON.parse(JSON.stringify(synthFixture.gaps || [])),
        confidence: synthFixture.confidence,
        fragmentCount: synthFixture.fragmentCount,
      },
      create: {
        projectId,
        dimension: synthFixture.dimension,
        summary: synthFixture.summary,
        keyThemes: synthFixture.keyThemes,
        gaps: JSON.parse(JSON.stringify(synthFixture.gaps || [])),
        confidence: synthFixture.confidence,
        fragmentCount: synthFixture.fragmentCount,
      },
    });
  }

  // Create user content (opportunities, principles)
  for (const ucFixture of projectFixture.userContent || []) {
    const ucId = resolveId(ucFixture.id);
    await prisma.userContent.create({
      data: {
        id: ucId,
        projectId,
        type: ucFixture.type,
        content: ucFixture.content,
        status: ucFixture.status,
        metadata: ucFixture.metadata ? JSON.parse(JSON.stringify(ucFixture.metadata)) : undefined,
      },
    });
  }

  // Set knowledgeUpdatedAt AFTER all fragments are created
  // This ensures existing fragments don't count as "new"
  if (projectFixture.fragments.length > 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        knowledgeUpdatedAt: new Date(),
        knowledgeSummary: projectFixture.knowledgeSummary ?? undefined,
        suggestedQuestions: projectFixture.suggestedQuestions
          ? JSON.parse(JSON.stringify(projectFixture.suggestedQuestions))
          : undefined,
      },
    });
  }

  // Create generated outputs AFTER knowledgeUpdatedAt so startedAt > knowledgeUpdatedAt
  // This ensures strategy shows as "in sync" for complete fixtures
  for (const outputFixture of projectFixture.generatedOutputs || []) {
    await prisma.generatedOutput.create({
      data: {
        projectId,
        userId,
        outputType: outputFixture.outputType,
        version: outputFixture.version,
        content: outputFixture.content as Prisma.InputJsonValue,
        generatedFrom: outputFixture.generatedFrom,
        modelUsed: outputFixture.modelUsed,
        changeSummary: outputFixture.changeSummary,
        status: 'complete',
        startedAt: new Date(),
      },
    });
  }

  const convCount = projectFixture.conversations.length;
  const fragCount = projectFixture.fragments.length;
  console.log(`  [OK] Hydrated: ${convCount} conversations, ${fragCount} fragments`);
}

async function checkEnvironment(options: HydrateOptions): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || '';
  const isProduction = dbUrl.includes('lunastak-prod') ||
                       process.env.VERCEL_ENV === 'production';

  if (isProduction && !options.production) {
    console.error('\n[ERROR] Refusing to run against production database');
    console.error('Use --production flag if you really mean it\n');
    process.exit(1);
  }

  if (isProduction && options.production) {
    console.log('\n[WARNING] Running against PRODUCTION database\n');
  }
}

async function hydrate(options: HydrateOptions): Promise<void> {
  const fixturePath = path.join(FIXTURES_DIR, `${options.fixture}.json`);

  if (!fs.existsSync(fixturePath)) {
    console.error(`\n[ERROR] Fixture not found: ${fixturePath}\n`);
    process.exit(1);
  }

  console.log(`\n[INFO] Loading fixture: ${options.fixture}\n`);

  const fixture: Fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  // Generate ID mappings
  const idMap = new Map<string, string>();

  // If projectId provided, use it instead of generating
  if (options.projectId) {
    fixture.projects.forEach((p) => {
      idMap.set(p.id, options.projectId!);
    });
  } else {
    fixture.projects.forEach((p) => {
      idMap.set(p.id, generateCuid());
    });
  }

  // Map conversation IDs
  fixture.projects.forEach(p => {
    p.conversations.forEach((c) => {
      idMap.set(c.id, generateCuid());
    });
  });

  // Map fragment IDs
  fixture.projects.forEach(p => {
    p.fragments.forEach((f) => {
      idMap.set(f.id, generateCuid());
    });
  });

  // Map deep dive IDs
  fixture.projects.forEach(p => {
    p.deepDives?.forEach((dd) => {
      idMap.set(dd.id, generateCuid());
    });
  });

  // Map document IDs
  fixture.projects.forEach(p => {
    p.documents?.forEach((d) => {
      idMap.set(d.id, generateCuid());
    });
  });

  // Map user content IDs
  fixture.projects.forEach(p => {
    p.userContent?.forEach((uc) => {
      idMap.set(uc.id, generateCuid());
    });
  });

  const resolveId = (id: string): string => idMap.get(id) || id;

  // Mode 1: Hydrate into existing project (--projectId)
  if (options.projectId) {
    const existingProject = await prisma.project.findUnique({
      where: { id: options.projectId },
    });

    if (!existingProject) {
      console.error(`\n[ERROR] Project not found: ${options.projectId}\n`);
      process.exit(1);
    }

    const userId = options.userId || existingProject.userId;
    console.log(`[INFO] Hydrating into existing project: ${existingProject.name}`);
    console.log(`[INFO] Project ID: ${options.projectId}`);
    console.log(`[INFO] User ID: ${userId}`);

    if (options.dryRun) {
      console.log('\n[DRY RUN] No changes will be made\n');
      fixture.projects.forEach(p => {
        console.log(`Would add: ${p.conversations.length} conversations, ${p.fragments.length} fragments`);
      });
      console.log('\n[OK] Dry run complete\n');
      return;
    }

    // Reset: delete existing data in project
    if (options.reset) {
      console.log(`[INFO] Deleting existing data in project...`);
      await prisma.userContent.deleteMany({ where: { projectId: options.projectId } });
      await prisma.generatedOutput.deleteMany({ where: { projectId: options.projectId } });
      await prisma.dimensionalSynthesis.deleteMany({ where: { projectId: options.projectId } });
      await prisma.fragment.deleteMany({ where: { projectId: options.projectId } });
      await prisma.conversation.deleteMany({ where: { projectId: options.projectId } });
      // Recreate empty synthesis records (synthesis code requires them)
      await prisma.dimensionalSynthesis.createMany({
        data: TIER_1_DIMENSIONS.map(dimension => ({
          projectId: options.projectId!,
          dimension,
          confidence: 'LOW',
          fragmentCount: 0,
        })),
        skipDuplicates: true,
      });
      console.log(`[INFO] Existing data deleted`);
    }

    // Hydrate the first project's data into the existing project
    const projectFixture = fixture.projects[0];
    await hydrateProjectData(options.projectId, userId, projectFixture, resolveId, options);

    console.log(`\n[OK] Hydration complete for project ${options.projectId}\n`);
    return;
  }

  // Mode 2: Create new user and project (--email)
  const existingUser = await prisma.user.findUnique({
    where: { email: options.email },
  });

  if (existingUser && !options.reset) {
    console.error(`\n[ERROR] User already exists: ${options.email}`);
    console.error('Use --reset flag to delete and recreate\n');
    process.exit(1);
  }

  if (options.dryRun) {
    console.log('[DRY RUN] No changes will be made\n');
    console.log(`Would create user: ${options.email}`);
    console.log(`Would create ${fixture.projects.length} project(s)`);
    fixture.projects.forEach(p => {
      console.log(`  - ${p.name}: ${p.conversations.length} conversations, ${p.fragments.length} fragments`);
    });
    console.log('\n[OK] Dry run complete\n');
    return;
  }

  // Delete existing user if reset
  if (existingUser && options.reset) {
    console.log(`[INFO] Deleting existing user: ${options.email}`);
    await prisma.user.delete({ where: { email: options.email } });
  }

  // Create user
  console.log(`[INFO] Creating user: ${options.email}`);
  const user = await prisma.user.create({
    data: {
      email: options.email!,
      name: fixture.user.name,
      emailVerified: new Date(), // Required for NextAuth magic link login
    },
  });

  // Create projects
  for (const projectFixture of fixture.projects) {
    const projectId = resolveId(projectFixture.id);
    console.log(`[INFO] Creating project: ${projectFixture.name}`);

    const project = await prisma.project.create({
      data: {
        id: projectId,
        userId: user.id,
        name: projectFixture.name,
        description: projectFixture.description,
        status: projectFixture.status,
        knowledgeSummary: projectFixture.knowledgeSummary,
        suggestedQuestions: JSON.parse(JSON.stringify(projectFixture.suggestedQuestions || [])),
      },
    });

    // Create deep dives first (conversations may reference them)
    for (const ddFixture of projectFixture.deepDives || []) {
      const ddId = resolveId(ddFixture.id);
      await prisma.deepDive.create({
        data: {
          id: ddId,
          projectId: project.id,
          topic: ddFixture.topic,
          notes: ddFixture.notes,
          status: ddFixture.status,
          origin: ddFixture.origin,
        },
      });
    }

    // Create documents
    for (const docFixture of projectFixture.documents || []) {
      const docId = resolveId(docFixture.id);
      await prisma.document.create({
        data: {
          id: docId,
          projectId: project.id,
          fileName: docFixture.fileName,
          fileType: docFixture.fileType,
          fileSizeBytes: docFixture.fileSizeBytes,
          uploadContext: docFixture.uploadContext,
          status: docFixture.status,
          deepDiveId: docFixture.deepDiveId ? resolveId(docFixture.deepDiveId) : undefined,
        },
      });
    }

    // Create conversations
    for (const convFixture of projectFixture.conversations) {
      const convId = resolveId(convFixture.id);
      const variant = options.variantOverride || convFixture.experimentVariant;

      console.log(`  [INFO] Creating conversation: ${convFixture.title || 'Untitled'}`);

      const conversation = await prisma.conversation.create({
        data: {
          id: convId,
          userId: user.id,
          projectId: project.id,
          title: convFixture.title,
          status: convFixture.status,
          currentPhase: convFixture.currentPhase,
          selectedLens: convFixture.selectedLens,
          questionCount: convFixture.questionCount,
          experimentVariant: variant,
        },
      });

      // Create messages
      for (const msgFixture of convFixture.messages) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: msgFixture.role,
            content: msgFixture.content,
            stepNumber: msgFixture.stepNumber,
          },
        });
      }

      // Create traces
      for (const traceFixture of convFixture.traces) {
        await prisma.trace.create({
          data: {
            conversationId: conversation.id,
            projectId: project.id,
            userId: user.id,
            extractedContext: traceFixture.extractedContext as Prisma.InputJsonValue,
            dimensionalCoverage: traceFixture.dimensionalCoverage as Prisma.InputJsonValue | undefined,
            output: traceFixture.output as Prisma.InputJsonValue,
            claudeThoughts: traceFixture.claudeThoughts,
            modelUsed: traceFixture.modelUsed,
            totalTokens: traceFixture.totalTokens,
            promptTokens: traceFixture.promptTokens,
            completionTokens: traceFixture.completionTokens,
            latencyMs: traceFixture.latencyMs,
            starred: traceFixture.starred,
            starredAt: traceFixture.starred ? new Date() : undefined,
          },
        });
      }
    }

    // Create fragments
    for (const fragFixture of projectFixture.fragments) {
      const fragId = resolveId(fragFixture.id);
      const convId = fragFixture.conversationId ? resolveId(fragFixture.conversationId) : undefined;
      const docId = fragFixture.documentId ? resolveId(fragFixture.documentId) : undefined;

      const fragment = await prisma.fragment.create({
        data: {
          id: fragId,
          projectId: project.id,
          conversationId: convId,
          documentId: docId,
          content: fragFixture.content,
          contentType: fragFixture.contentType,
          status: fragFixture.status,
          confidence: fragFixture.confidence,
        },
      });

      // Create dimension tags
      for (const tagFixture of fragFixture.dimensionTags || []) {
        await prisma.fragmentDimensionTag.create({
          data: {
            fragmentId: fragment.id,
            dimension: tagFixture.dimension,
            confidence: tagFixture.confidence,
          },
        });
      }
    }

    // Create dimensional syntheses
    for (const synthFixture of projectFixture.syntheses || []) {
      await prisma.dimensionalSynthesis.create({
        data: {
          projectId: project.id,
          dimension: synthFixture.dimension,
          summary: synthFixture.summary,
          keyThemes: synthFixture.keyThemes,
          gaps: JSON.parse(JSON.stringify(synthFixture.gaps || [])),
          confidence: synthFixture.confidence,
          fragmentCount: synthFixture.fragmentCount,
        },
      });
    }

    // Create user content (opportunities, principles)
    for (const ucFixture of projectFixture.userContent || []) {
      const ucId = resolveId(ucFixture.id);
      await prisma.userContent.create({
        data: {
          id: ucId,
          projectId: project.id,
          type: ucFixture.type,
          content: ucFixture.content,
          status: ucFixture.status,
          metadata: ucFixture.metadata ? JSON.parse(JSON.stringify(ucFixture.metadata)) : undefined,
        },
      });
    }

    // Set knowledgeUpdatedAt AFTER all fragments are created
    // This ensures existing fragments don't count as "new"
    await prisma.project.update({
      where: { id: project.id },
      data: { knowledgeUpdatedAt: new Date() },
    });

    // Create generated outputs AFTER knowledgeUpdatedAt so startedAt > knowledgeUpdatedAt
    // This ensures strategy shows as "in sync" for complete fixtures
    for (const outputFixture of projectFixture.generatedOutputs || []) {
      await prisma.generatedOutput.create({
        data: {
          projectId: project.id,
          userId: user.id,
          outputType: outputFixture.outputType,
          version: outputFixture.version,
          content: outputFixture.content as Prisma.InputJsonValue,
          generatedFrom: outputFixture.generatedFrom,
          modelUsed: outputFixture.modelUsed,
          changeSummary: outputFixture.changeSummary,
          status: 'complete',
          startedAt: new Date(),
        },
      });
    }

    const synthCount = projectFixture.syntheses?.length || 0;
    const outputCount = projectFixture.generatedOutputs?.length || 0;
    const ucCount = projectFixture.userContent?.length || 0;
    console.log(`  [OK] Project complete: ${projectFixture.conversations.length} conversations, ${projectFixture.fragments.length} fragments, ${synthCount} syntheses, ${outputCount} outputs, ${ucCount} user content`);
  }

  console.log(`\n[OK] Hydration complete for ${options.email}\n`);
}

// Main
const options = parseArgs();

checkEnvironment(options)
  .then(() => hydrate(options))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n[ERROR]:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
