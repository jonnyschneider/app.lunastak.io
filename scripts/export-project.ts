#!/usr/bin/env npx tsx
/**
 * Export a full project to fixture JSON format.
 * Usage: npx tsx scripts/export-project.ts --projectId <id> [--out <path>]
 */

import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  let projectId = '';
  let out = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--projectId' && args[i + 1]) projectId = args[++i];
    if (args[i] === '--out' && args[i + 1]) out = args[++i];
  }
  if (!projectId) {
    console.error('Usage: npx tsx scripts/export-project.ts --projectId <id> [--out <path>]');
    process.exit(1);
  }
  return { projectId, out };
}

async function main() {
  const { projectId, out } = parseArgs();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project === null) {
    console.error('Project not found:', projectId);
    process.exit(1);
  }

  const conversations = await prisma.conversation.findMany({
    where: { projectId },
    include: { messages: { orderBy: { stepNumber: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });

  const traces = await prisma.trace.findMany({
    where: { projectId },
    orderBy: { timestamp: 'asc' },
  });

  const fragments = await prisma.fragment.findMany({
    where: { projectId },
    include: { dimensionTags: true },
    orderBy: { createdAt: 'asc' },
  });

  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  const snapshots = await prisma.decisionStackSnapshot.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  const deepDives = await prisma.deepDive.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  const documents = await prisma.document.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  const decisionStack = await prisma.decisionStack.findUnique({
    where: { projectId },
  });
  const stackComponents = decisionStack
    ? await prisma.decisionStackComponent.findMany({
        where: { decisionStackId: decisionStack.id },
        orderBy: { sortOrder: 'asc' },
      })
    : [];

  const fixture = {
    template: {
      name: 'demo-lunastak',
      description: `Exported from production project ${projectId}`,
    },
    user: {
      name: 'Demo User',
      email: '{{EMAIL}}',
    },
    projects: [
      {
        id: '{{PROJECT_ID}}',
        name: project.name,
        description: project.description,
        status: project.status,
        knowledgeSummary: project.knowledgeSummary,
        suggestedQuestions: project.suggestedQuestions || [],
        conversations: conversations.map((c) => {
          const convTraces = traces.filter((t) => t.conversationId === c.id);
          return {
            id: c.id,
            title: c.title,
            status: c.status,
            currentPhase: c.currentPhase,
            selectedLens: c.selectedLens,
            questionCount: c.questionCount,
            experimentVariant: c.experimentVariant,
            isInitialConversation: c.isInitialConversation,
            messages: c.messages.map((m) => ({
              role: m.role,
              content: m.content,
              stepNumber: m.stepNumber,
            })),
            traces: convTraces.map((t) => ({
              extractedContext: t.extractedContext,
              dimensionalCoverage: t.dimensionalCoverage,
              output: t.output,
              claudeThoughts: t.claudeThoughts,
              modelUsed: t.modelUsed,
              totalTokens: t.totalTokens,
              promptTokens: t.promptTokens,
              completionTokens: t.completionTokens,
              latencyMs: t.latencyMs,
              starred: t.starred,
            })),
          };
        }),
        fragments: fragments.map((f) => ({
          id: f.id,
          conversationId: f.conversationId,
          documentId: f.documentId,
          content: f.content,
          contentType: f.contentType,
          status: f.status,
          confidence: f.confidence,
          dimensionTags: f.dimensionTags.map((dt) => ({
            dimension: dt.dimension,
            confidence: dt.confidence,
          })),
        })),
        deepDives: deepDives.map((dd) => ({
          id: dd.id,
          topic: dd.topic,
          notes: dd.notes,
          status: dd.status,
          origin: dd.origin,
        })),
        documents: documents.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileType: d.fileType,
          fileSizeBytes: d.fileSizeBytes,
          uploadContext: d.uploadContext,
          status: d.status,
          deepDiveId: d.deepDiveId,
        })),
        syntheses: syntheses.map((s) => ({
          dimension: s.dimension,
          summary: s.summary,
          keyThemes: s.keyThemes,
          gaps: s.gaps,
          confidence: s.confidence,
          fragmentCount: s.fragmentCount,
        })),
        generatedOutputs: snapshots.map((s) => ({
          outputType: 'full_decision_stack',
          version: s.version,
          content: s.content,
          modelUsed: s.modelUsed,
          changeSummary: s.changeSummary,
        })),
        decisionStack: decisionStack ? {
          vision: decisionStack.vision,
          visionElaboration: decisionStack.visionElaboration,
          strategy: decisionStack.strategy,
          strategyElaboration: decisionStack.strategyElaboration,
          components: stackComponents.map((c) => ({
            componentType: c.componentType,
            componentId: c.componentId,
            content: c.content,
            sortOrder: c.sortOrder,
          })),
        } : null,
      },
    ],
  };

  const outPath = out || `/Users/Jonny/Downloads/demo-lunastak-export.json`;
  fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2));

  console.log(`\nProject: ${project.name}`);
  console.log(`Conversations: ${conversations.length}`);
  console.log(`Messages: ${conversations.reduce((sum, c) => sum + c.messages.length, 0)}`);
  console.log(`Traces: ${traces.length}`);
  console.log(`Fragments: ${fragments.length}`);
  console.log(`Syntheses: ${syntheses.length}`);
  console.log(`Snapshots: ${snapshots.length}`);
  console.log(`Stack Components: ${stackComponents.length}`);
  console.log(`Deep Dives: ${deepDives.length}`);
  console.log(`Documents: ${documents.length}`);
  console.log(`\nWritten to: ${outPath}`);

  await prisma.$disconnect();
}

main().catch(console.error);
