#!/usr/bin/env tsx
/**
 * Export User Data to Fixture
 *
 * Usage:
 *   npx tsx scripts/seed/export.ts --email jonny@example.com --output demo-dogfood.json
 *   npx tsx scripts/seed/export.ts --conversation clxyz123 --output baseline-conversation.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../../src/lib/db';
import type { Fixture, ExportOptions } from './types';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function parseArgs(): ExportOptions {
  const args = process.argv.slice(2);
  const options: Partial<ExportOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
        options.email = args[++i];
        break;
      case '--conversation':
        options.conversationId = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
    }
  }

  if (!options.output) {
    console.error('\n[ERROR] Missing --output argument\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/seed/export.ts --email <email> --output <file.json>');
    console.log('  npx tsx scripts/seed/export.ts --conversation <id> --output <file.json>\n');
    process.exit(1);
  }

  if (!options.email && !options.conversationId) {
    console.error('\n[ERROR] Must specify --email or --conversation\n');
    process.exit(1);
  }

  return options as ExportOptions;
}

function createPlaceholder(type: string, index: number): string {
  const typeMap: Record<string, string> = {
    project: 'PROJECT',
    conversation: 'CONV',
    fragment: 'FRAG',
    deepDive: 'DD',
    document: 'DOC',
  };
  const prefix = typeMap[type] || type.toUpperCase();
  return index === 0 ? `{{${prefix}_ID}}` : `{{${prefix}_${index}_ID}}`;
}

async function exportByEmail(email: string): Promise<Fixture> {
  console.log(`\n[INFO] Exporting user: ${email}\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      projects: {
        include: {
          conversations: {
            include: {
              messages: { orderBy: { stepNumber: 'asc' } },
              traces: { orderBy: { timestamp: 'asc' } },
            },
          },
          fragments: {
            include: {
              dimensionTags: true,
            },
          },
          deepDives: true,
          documents: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  // Create ID mappings
  const idMap = new Map<string, string>();
  let convIndex = 0;
  let fragIndex = 0;
  let ddIndex = 0;
  let docIndex = 0;

  user.projects.forEach((p, pIdx) => {
    idMap.set(p.id, createPlaceholder('project', pIdx));
    p.conversations.forEach(() => {
      idMap.set(p.conversations[convIndex - (convIndex - p.conversations.indexOf(p.conversations[0]))]?.id || '', '');
    });
  });

  // Reset and properly map all IDs
  convIndex = 0;
  fragIndex = 0;
  ddIndex = 0;
  docIndex = 0;

  user.projects.forEach((p, pIdx) => {
    idMap.set(p.id, createPlaceholder('project', pIdx));
    p.conversations.forEach(c => {
      idMap.set(c.id, createPlaceholder('conversation', convIndex++));
    });
    p.fragments.forEach(f => {
      idMap.set(f.id, createPlaceholder('fragment', fragIndex++));
    });
    p.deepDives.forEach(dd => {
      idMap.set(dd.id, createPlaceholder('deepDive', ddIndex++));
    });
    p.documents.forEach(d => {
      idMap.set(d.id, createPlaceholder('document', docIndex++));
    });
  });

  const resolveId = (id: string | null): string | undefined =>
    id ? (idMap.get(id) || id) : undefined;

  const fixture: Fixture = {
    template: {
      name: `export-${email.split('@')[0]}`,
      description: `Exported from ${email} on ${new Date().toISOString().split('T')[0]}`,
    },
    user: {
      name: user.name || '',
      email: '{{EMAIL}}',
    },
    projects: user.projects.map((project, pIdx) => ({
      id: idMap.get(project.id)!,
      name: project.name,
      description: project.description || undefined,
      status: project.status as 'active' | 'archived' | 'deleted',
      knowledgeSummary: project.knowledgeSummary || undefined,
      suggestedQuestions: project.suggestedQuestions,
      conversations: project.conversations.map(conv => ({
        id: idMap.get(conv.id)!,
        title: conv.title || undefined,
        status: conv.status as 'in_progress' | 'completed' | 'abandoned',
        currentPhase: conv.currentPhase,
        selectedLens: conv.selectedLens || undefined,
        questionCount: conv.questionCount,
        experimentVariant: conv.experimentVariant || undefined,
        messages: conv.messages.map(msg => ({
          role: msg.role as 'assistant' | 'user',
          content: msg.content,
          stepNumber: msg.stepNumber,
          confidenceScore: msg.confidenceScore as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
          confidenceReasoning: msg.confidenceReasoning || undefined,
        })),
        traces: conv.traces.map(trace => ({
          extractedContext: trace.extractedContext as Record<string, unknown>,
          dimensionalCoverage: trace.dimensionalCoverage as Record<string, unknown> | undefined,
          output: trace.output as Record<string, unknown>,
          claudeThoughts: trace.claudeThoughts || undefined,
          modelUsed: trace.modelUsed,
          totalTokens: trace.totalTokens,
          promptTokens: trace.promptTokens,
          completionTokens: trace.completionTokens,
          latencyMs: trace.latencyMs,
          starred: trace.starred || undefined,
        })),
      })),
      fragments: project.fragments.map(frag => ({
        id: idMap.get(frag.id)!,
        content: frag.content,
        contentType: frag.contentType as 'theme' | 'insight' | 'quote' | 'stat' | 'principle',
        status: frag.status as 'active' | 'archived' | 'soft_deleted',
        confidence: frag.confidence as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
        conversationId: resolveId(frag.conversationId),
        documentId: resolveId(frag.documentId),
        dimensionTags: frag.dimensionTags.map(tag => ({
          dimension: tag.dimension,
          confidence: tag.confidence as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
        })),
      })),
      deepDives: project.deepDives.map(dd => ({
        id: idMap.get(dd.id)!,
        topic: dd.topic,
        notes: dd.notes || undefined,
        status: dd.status as 'pending' | 'active' | 'resolved',
        origin: dd.origin as 'manual' | 'message' | 'document',
      })),
      documents: project.documents.map(doc => ({
        id: idMap.get(doc.id)!,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSizeBytes: doc.fileSizeBytes || undefined,
        uploadContext: doc.uploadContext || undefined,
        status: doc.status as 'pending' | 'processing' | 'complete' | 'failed',
        deepDiveId: resolveId(doc.deepDiveId),
      })),
    })),
  };

  return fixture;
}

async function exportByConversation(conversationId: string): Promise<Fixture> {
  console.log(`\n[INFO] Exporting conversation: ${conversationId}\n`);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      user: true,
      messages: { orderBy: { stepNumber: 'asc' } },
      traces: { orderBy: { timestamp: 'asc' } },
      Project: true,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const fixture: Fixture = {
    template: {
      name: `conversation-${conversationId.slice(-8)}`,
      description: `Single conversation export on ${new Date().toISOString().split('T')[0]}`,
    },
    user: {
      name: conversation.user?.name || '',
      email: '{{EMAIL}}',
    },
    projects: [{
      id: '{{PROJECT_ID}}',
      name: conversation.Project?.name || 'Imported Project',
      status: 'active',
      suggestedQuestions: [],
      conversations: [{
        id: '{{CONV_ID}}',
        title: conversation.title || undefined,
        status: conversation.status as 'in_progress' | 'completed' | 'abandoned',
        currentPhase: conversation.currentPhase,
        selectedLens: conversation.selectedLens || undefined,
        questionCount: conversation.questionCount,
        experimentVariant: conversation.experimentVariant || undefined,
        messages: conversation.messages.map(msg => ({
          role: msg.role as 'assistant' | 'user',
          content: msg.content,
          stepNumber: msg.stepNumber,
          confidenceScore: msg.confidenceScore as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
          confidenceReasoning: msg.confidenceReasoning || undefined,
        })),
        traces: conversation.traces.map(trace => ({
          extractedContext: trace.extractedContext as Record<string, unknown>,
          dimensionalCoverage: trace.dimensionalCoverage as Record<string, unknown> | undefined,
          output: trace.output as Record<string, unknown>,
          claudeThoughts: trace.claudeThoughts || undefined,
          modelUsed: trace.modelUsed,
          totalTokens: trace.totalTokens,
          promptTokens: trace.promptTokens,
          completionTokens: trace.completionTokens,
          latencyMs: trace.latencyMs,
          starred: trace.starred || undefined,
        })),
      }],
      fragments: [],
      deepDives: [],
      documents: [],
    }],
  };

  return fixture;
}

async function main(): Promise<void> {
  const options = parseArgs();

  let fixture: Fixture;

  if (options.email) {
    fixture = await exportByEmail(options.email);
  } else if (options.conversationId) {
    fixture = await exportByConversation(options.conversationId);
  } else {
    throw new Error('Must specify --email or --conversation');
  }

  // Ensure output has .json extension
  const outputFile = options.output.endsWith('.json')
    ? options.output
    : `${options.output}.json`;

  const outputPath = path.join(FIXTURES_DIR, outputFile);

  // Ensure fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(fixture, null, 2));

  console.log(`[OK] Exported to: ${outputPath}\n`);

  // Summary
  console.log('Summary:');
  console.log(`  Projects: ${fixture.projects.length}`);
  fixture.projects.forEach(p => {
    console.log(`    - ${p.name}: ${p.conversations.length} convs, ${p.fragments.length} frags`);
  });
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n[ERROR]:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
