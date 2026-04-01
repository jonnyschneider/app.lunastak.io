/**
 * ExtractionRun service - tracks extraction+generation runs for evaluation
 */

import { prisma } from '@/lib/db'

export interface CreateExtractionRunInput {
  projectId: string
  conversationId: string
  experimentVariant?: string
  fragmentIds: string[]
  modelUsed: string
  promptTokens?: number
  completionTokens?: number
  latencyMs?: number
}

/**
 * Create an extraction run record
 */
export async function createExtractionRun(input: CreateExtractionRunInput) {
  // Capture synthesis state before (for A/B evaluation)
  const synthesesBefore = await prisma.dimensionalSynthesis.findMany({
    where: { projectId: input.projectId },
    select: {
      dimension: true,
      summary: true,
      confidence: true,
      fragmentCount: true
    }
  })

  const run = await prisma.extractionRun.create({
    data: {
      projectId: input.projectId,
      conversationId: input.conversationId,
      experimentVariant: input.experimentVariant,
      fragmentIds: input.fragmentIds,
      synthesesBefore: synthesesBefore,
      modelUsed: input.modelUsed,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      latencyMs: input.latencyMs,
    }
  })

  return run
}

/**
 * Update extraction run with synthesis results (after synthesis completes)
 */
export async function updateExtractionRunWithSyntheses(
  runId: string,
  projectId: string
) {
  const synthesesAfter = await prisma.dimensionalSynthesis.findMany({
    where: { projectId },
    select: {
      dimension: true,
      summary: true,
      confidence: true,
      fragmentCount: true
    }
  })

  await prisma.extractionRun.update({
    where: { id: runId },
    data: { synthesesAfter }
  })
}
