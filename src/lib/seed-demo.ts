// src/lib/seed-demo.ts
/**
 * Demo Project Seeding
 *
 * Loads demo-extended fixture and hydrates it for a specific user.
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { Fixture, FixtureProvocation } from '../../scripts/seed/types';

const FIXTURES_DIR = path.join(process.cwd(), 'scripts/seed/fixtures');
const DEMO_FIXTURE = 'demo-extended.json';

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

export async function loadDemoFixture(): Promise<Fixture> {
  const fixturePath = path.join(FIXTURES_DIR, DEMO_FIXTURE);
  const content = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(content);
}

export interface TransformedFixture {
  userId: string;
  projects: Array<{
    id: string;
    userId: string;
    name: string;
    status: string;
    isDemo: boolean;
    description?: string;
    knowledgeSummary?: string;
    suggestedQuestions?: FixtureProvocation[];
    conversations: Array<{
      id: string;
      title?: string;
      status: string;
      currentPhase: string;
      selectedLens?: string;
      questionCount: number;
      experimentVariant?: string;
      messages: Array<{
        role: string;
        content: string;
        stepNumber: number;
        confidenceScore?: string;
        confidenceReasoning?: string;
      }>;
      traces: Array<{
        extractedContext: Record<string, unknown>;
        dimensionalCoverage?: Record<string, unknown>;
        output: Record<string, unknown>;
        claudeThoughts?: string;
        modelUsed: string;
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
        latencyMs: number;
        starred?: boolean;
      }>;
    }>;
    fragments: Array<{
      id: string;
      content: string;
      contentType: string;
      status: string;
      confidence?: string;
      conversationId?: string;
      documentId?: string;
      dimensionTags: Array<{
        dimension: string;
        confidence?: string;
      }>;
    }>;
    deepDives: Array<{
      id: string;
      topic: string;
      notes?: string;
      status: string;
      origin: string;
    }>;
    documents: Array<{
      id: string;
      fileName: string;
      fileType: string;
      fileSizeBytes?: number;
      uploadContext?: string;
      status: string;
      deepDiveId?: string;
    }>;
    syntheses: Array<{
      dimension: string;
      summary?: string;
      keyThemes: string[];
      gaps: FixtureProvocation[];
      confidence: string;
      fragmentCount: number;
    }>;
  }>;
}

export function transformFixtureForUser(fixture: Fixture, userId: string): TransformedFixture {
  const idMap = new Map<string, string>();

  // Generate new IDs for all entities
  fixture.projects.forEach((p) => {
    idMap.set(p.id, generateCuid());
    p.conversations.forEach((c) => idMap.set(c.id, generateCuid()));
    p.fragments.forEach((f) => idMap.set(f.id, generateCuid()));
    p.deepDives?.forEach((dd) => idMap.set(dd.id, generateCuid()));
    p.documents?.forEach((d) => idMap.set(d.id, generateCuid()));
  });

  const resolveId = (id: string): string => idMap.get(id) || generateCuid();

  return {
    userId,
    projects: fixture.projects.map((p) => ({
      id: resolveId(p.id),
      userId,
      name: 'Demo: BuildFlow Strategy',
      status: p.status,
      isDemo: true,
      description: p.description,
      knowledgeSummary: p.knowledgeSummary,
      suggestedQuestions: p.suggestedQuestions,
      conversations: p.conversations.map((c) => ({
        ...c,
        id: resolveId(c.id),
      })),
      fragments: p.fragments.map((f) => ({
        ...f,
        id: resolveId(f.id),
        conversationId: f.conversationId ? resolveId(f.conversationId) : undefined,
        documentId: f.documentId ? resolveId(f.documentId) : undefined,
      })),
      deepDives: (p.deepDives || []).map((dd) => ({
        ...dd,
        id: resolveId(dd.id),
      })),
      documents: (p.documents || []).map((d) => ({
        ...d,
        id: resolveId(d.id),
        deepDiveId: d.deepDiveId ? resolveId(d.deepDiveId) : undefined,
      })),
      syntheses: (p.syntheses || []).map((s) => ({
        ...s,
      })),
    })),
  };
}

async function createSynthesisRecords(
  projectId: string,
  syntheses: Array<{
    dimension: string;
    summary?: string;
    keyThemes: string[];
    gaps: FixtureProvocation[];
    confidence: string;
    fragmentCount: number;
  }>
): Promise<void> {
  const records = syntheses.map((s) => ({
    projectId,
    dimension: s.dimension,
    summary: s.summary || null,
    keyThemes: s.keyThemes,
    keyQuotes: [],
    gaps: s.gaps as unknown as Prisma.InputJsonValue,
    contradictions: [],
    confidence: s.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
    fragmentCount: s.fragmentCount,
    lastSynthesizedAt: new Date(),
    synthesizedBy: 'demo-seed',
  }));

  await prisma.dimensionalSynthesis.createMany({
    data: records,
    skipDuplicates: true,
  });
}

export async function seedDemoProject(userId: string): Promise<string> {
  const fixture = await loadDemoFixture();
  const transformed = transformFixtureForUser(fixture, userId);

  for (const projectData of transformed.projects) {
    const project = await prisma.project.create({
      data: {
        id: projectData.id,
        userId: projectData.userId,
        name: projectData.name,
        status: projectData.status,
        isDemo: projectData.isDemo,
        description: projectData.description,
        knowledgeSummary: projectData.knowledgeSummary,
        suggestedQuestions: JSON.parse(JSON.stringify(projectData.suggestedQuestions || [])),
      },
    });

    // Create deep dives first
    for (const dd of projectData.deepDives) {
      await prisma.deepDive.create({
        data: {
          id: dd.id,
          projectId: project.id,
          topic: dd.topic,
          notes: dd.notes,
          status: dd.status,
          origin: dd.origin,
        },
      });
    }

    // Create documents
    for (const doc of projectData.documents) {
      await prisma.document.create({
        data: {
          id: doc.id,
          projectId: project.id,
          deepDiveId: doc.deepDiveId,
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSizeBytes: doc.fileSizeBytes,
          uploadContext: doc.uploadContext,
          status: doc.status,
        },
      });
    }

    // Create conversations
    for (const conv of projectData.conversations) {
      const conversation = await prisma.conversation.create({
        data: {
          id: conv.id,
          userId,
          projectId: project.id,
          title: conv.title,
          status: conv.status,
          currentPhase: conv.currentPhase,
          selectedLens: conv.selectedLens,
          questionCount: conv.questionCount,
          experimentVariant: conv.experimentVariant,
        },
      });

      // Create messages
      for (const msg of conv.messages) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: msg.role,
            content: msg.content,
            stepNumber: msg.stepNumber,
            confidenceScore: msg.confidenceScore,
            confidenceReasoning: msg.confidenceReasoning,
          },
        });
      }

      // Create traces
      for (const trace of conv.traces) {
        await prisma.trace.create({
          data: {
            conversationId: conversation.id,
            userId,
            extractedContext: trace.extractedContext as Prisma.InputJsonValue,
            dimensionalCoverage: trace.dimensionalCoverage as Prisma.InputJsonValue | undefined,
            output: trace.output as Prisma.InputJsonValue,
            claudeThoughts: trace.claudeThoughts,
            modelUsed: trace.modelUsed,
            totalTokens: trace.totalTokens,
            promptTokens: trace.promptTokens,
            completionTokens: trace.completionTokens,
            latencyMs: trace.latencyMs,
            starred: trace.starred,
            starredAt: trace.starred ? new Date() : undefined,
          },
        });
      }
    }

    // Create fragments
    for (const frag of projectData.fragments) {
      const fragment = await prisma.fragment.create({
        data: {
          id: frag.id,
          projectId: project.id,
          conversationId: frag.conversationId,
          documentId: frag.documentId,
          content: frag.content,
          contentType: frag.contentType,
          status: frag.status,
          confidence: frag.confidence,
        },
      });

      // Create dimension tags
      for (const tag of frag.dimensionTags || []) {
        await prisma.fragmentDimensionTag.create({
          data: {
            fragmentId: fragment.id,
            dimension: tag.dimension.toUpperCase(), // Normalize to uppercase
            confidence: tag.confidence,
          },
        });
      }
    }

    // Create synthesis records from fixture
    if (projectData.syntheses.length > 0) {
      await createSynthesisRecords(project.id, projectData.syntheses);
    }

    return project.id;
  }

  throw new Error('No projects in fixture');
}
