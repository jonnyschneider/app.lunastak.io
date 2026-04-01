/**
 * Decision Stack Service
 *
 * Central read/write layer for the unified Decision Stack.
 * All access to DecisionStack, DecisionStackComponent, and DecisionStackSnapshot
 * goes through this module.
 */

import { prisma } from '@/lib/db'
import type { StrategyStatements, Objective, Opportunity, Principle } from '@/lib/types'

// --- Types ---

/** DecisionStack with included components (from Prisma query) */
export interface DecisionStackWithComponents {
  id: string
  projectId: string
  vision: string
  visionElaboration: string | null
  strategy: string
  strategyElaboration: string | null
  generationStatus: string | null
  generationStarted: Date | null
  components: Array<{
    id: string
    componentType: string
    componentId: string
    content: unknown
    sortOrder: number
    status: string
  }>
}

export type SnapshotTrigger =
  | 'pre_generation'
  | 'post_generation'
  | 'pre_refresh'
  | 'post_refresh'
  | 'pre_opportunities'
  | 'post_opportunities'

export interface SnapshotMetadata {
  modelUsed?: string
  promptTokens?: number
  completionTokens?: number
  latencyMs?: number
  changeSummary?: string
}

// --- Assembly ---

/**
 * Assemble a StrategyStatements object from a DecisionStack + components.
 * Pure function — no DB calls.
 */
export function assembleStrategyStatements(
  stack: DecisionStackWithComponents
): StrategyStatements {
  const activeComponents = stack.components.filter(c => c.status === 'active')

  return {
    vision: stack.vision,
    visionExplainer: stack.visionElaboration || undefined,
    strategy: stack.strategy,
    strategyExplainer: stack.strategyElaboration || undefined,
    objectives: activeComponents
      .filter(c => c.componentType === 'objective')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => c.content as Objective),
    opportunities: activeComponents
      .filter(c => c.componentType === 'opportunity')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => c.content as Opportunity),
    principles: activeComponents
      .filter(c => c.componentType === 'principle')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => c.content as Principle),
  }
}

// --- Reads ---

/**
 * Load the current Decision Stack for a project, with all active components.
 * Returns null if no stack exists yet.
 */
export async function getDecisionStack(projectId: string): Promise<DecisionStackWithComponents | null> {
  return prisma.decisionStack.findUnique({
    where: { projectId },
    include: {
      components: {
        where: { status: 'active' },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

/**
 * Load the current Decision Stack and assemble as StrategyStatements.
 * Returns null if no stack exists.
 */
export async function getStrategyStatements(projectId: string): Promise<StrategyStatements | null> {
  const stack = await getDecisionStack(projectId)
  if (!stack) return null
  return assembleStrategyStatements(stack)
}

/**
 * Check if a project has a Decision Stack with any content.
 */
export async function hasDecisionStack(projectId: string): Promise<boolean> {
  const stack = await prisma.decisionStack.findUnique({
    where: { projectId },
    select: { vision: true },
  })
  return !!stack && stack.vision !== ''
}

// --- Writes ---

/**
 * Write a complete StrategyStatements to the Decision Stack.
 * Creates the stack if it doesn't exist, replaces all components.
 * Used after AI generation — overwrites everything.
 */
export async function writeStrategyToStack(
  projectId: string,
  statements: StrategyStatements
): Promise<string> {
  // Upsert the stack (singleton fields)
  const stack = await prisma.decisionStack.upsert({
    where: { projectId },
    create: {
      projectId,
      vision: statements.vision,
      visionElaboration: statements.visionExplainer || null,
      strategy: statements.strategy,
      strategyElaboration: statements.strategyExplainer || null,
    },
    update: {
      vision: statements.vision,
      visionElaboration: statements.visionExplainer || null,
      strategy: statements.strategy,
      strategyElaboration: statements.strategyExplainer || null,
    },
  })

  // Replace all components: archive existing, create new
  await prisma.decisionStackComponent.updateMany({
    where: { decisionStackId: stack.id },
    data: { status: 'archived' },
  })

  const components: Array<{
    decisionStackId: string
    componentType: string
    componentId: string
    content: object
    sortOrder: number
  }> = []

  statements.objectives.forEach((obj, i) => {
    components.push({
      decisionStackId: stack.id,
      componentType: 'objective',
      componentId: obj.id,
      content: obj as object,
      sortOrder: i,
    })
  })

  statements.opportunities.forEach((opp, i) => {
    components.push({
      decisionStackId: stack.id,
      componentType: 'opportunity',
      componentId: opp.id,
      content: opp as object,
      sortOrder: i,
    })
  })

  statements.principles.forEach((prin, i) => {
    components.push({
      decisionStackId: stack.id,
      componentType: 'principle',
      componentId: prin.id,
      content: prin as object,
      sortOrder: i,
    })
  })

  if (components.length > 0) {
    await prisma.decisionStackComponent.createMany({ data: components })
  }

  return stack.id
}

/**
 * Write only opportunities to the Decision Stack (preserving V/S/O/P).
 * Archives existing opportunities and creates new ones.
 */
export async function writeOpportunitiesToStack(
  projectId: string,
  opportunities: Opportunity[]
): Promise<void> {
  const stack = await prisma.decisionStack.findUnique({
    where: { projectId },
    select: { id: true },
  })

  if (!stack) throw new Error('No Decision Stack found for project')

  // Archive existing opportunities
  await prisma.decisionStackComponent.updateMany({
    where: { decisionStackId: stack.id, componentType: 'opportunity' },
    data: { status: 'archived' },
  })

  // Create new
  if (opportunities.length > 0) {
    await prisma.decisionStackComponent.createMany({
      data: opportunities.map((opp, i) => ({
        decisionStackId: stack.id,
        componentType: 'opportunity',
        componentId: opp.id,
        content: opp as object,
        sortOrder: i,
      })),
    })
  }
}

/**
 * Update a single component (for user edits).
 */
export async function updateComponent(
  projectId: string,
  componentType: string,
  componentId: string,
  content: object
): Promise<void> {
  const stack = await prisma.decisionStack.findUnique({
    where: { projectId },
    select: { id: true },
  })

  if (!stack) throw new Error('No Decision Stack found for project')

  await prisma.decisionStackComponent.upsert({
    where: {
      decisionStackId_componentType_componentId: {
        decisionStackId: stack.id,
        componentType,
        componentId,
      },
    },
    create: {
      decisionStackId: stack.id,
      componentType,
      componentId,
      content,
    },
    update: { content },
  })
}

/**
 * Update vision or strategy text (for user edits).
 */
export async function updateSingleton(
  projectId: string,
  field: 'vision' | 'strategy',
  text: string,
  elaboration?: string | null
): Promise<void> {
  const data: Record<string, unknown> = { [field]: text }
  if (elaboration !== undefined) {
    data[field === 'vision' ? 'visionElaboration' : 'strategyElaboration'] = elaboration
  }

  await prisma.decisionStack.update({
    where: { projectId },
    data,
  })
}

/**
 * Delete a component (for user deletions).
 */
export async function deleteComponent(
  projectId: string,
  componentType: string,
  componentId: string
): Promise<void> {
  const stack = await prisma.decisionStack.findUnique({
    where: { projectId },
    select: { id: true },
  })

  if (!stack) throw new Error('No Decision Stack found for project')

  await prisma.decisionStackComponent.updateMany({
    where: {
      decisionStackId: stack.id,
      componentType,
      componentId,
    },
    data: { status: 'archived' },
  })
}

/**
 * Create a component (for user additions).
 */
export async function createComponent(
  projectId: string,
  componentType: string,
  componentId: string,
  content: object,
  sortOrder?: number
): Promise<string> {
  const stack = await prisma.decisionStack.findUnique({
    where: { projectId },
    select: { id: true },
  })

  if (!stack) throw new Error('No Decision Stack found for project')

  const component = await prisma.decisionStackComponent.create({
    data: {
      decisionStackId: stack.id,
      componentType,
      componentId,
      content,
      sortOrder: sortOrder ?? 0,
    },
  })

  return component.id
}

// --- Snapshots ---

/**
 * Capture a point-in-time snapshot of the current Decision Stack.
 */
export async function captureSnapshot(
  projectId: string,
  trigger: SnapshotTrigger,
  metadata?: SnapshotMetadata
): Promise<{ id: string; version: number }> {
  const stack = await getDecisionStack(projectId)

  // If no stack exists yet (pre-snapshot before first generation), create empty snapshot
  const content = stack
    ? {
        vision: stack.vision,
        visionElaboration: stack.visionElaboration,
        strategy: stack.strategy,
        strategyElaboration: stack.strategyElaboration,
        objectives: stack.components.filter(c => c.componentType === 'objective').map(c => c.content) as object[],
        opportunities: stack.components.filter(c => c.componentType === 'opportunity').map(c => c.content) as object[],
        principles: stack.components.filter(c => c.componentType === 'principle').map(c => c.content) as object[],
      }
    : {
        vision: '',
        visionElaboration: null,
        strategy: '',
        strategyElaboration: null,
        objectives: [],
        opportunities: [],
        principles: [],
      }

  const lastVersion = await prisma.decisionStackSnapshot.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  const version = (lastVersion?.version ?? 0) + 1

  const snapshot = await prisma.decisionStackSnapshot.create({
    data: {
      projectId,
      version,
      trigger,
      content,
      modelUsed: metadata?.modelUsed,
      promptTokens: metadata?.promptTokens,
      completionTokens: metadata?.completionTokens,
      latencyMs: metadata?.latencyMs,
      changeSummary: metadata?.changeSummary,
    },
  })

  return { id: snapshot.id, version }
}

/**
 * Get snapshot history for a project (for version history UI).
 */
export async function getSnapshots(projectId: string) {
  return prisma.decisionStackSnapshot.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      trigger: true,
      modelUsed: true,
      changeSummary: true,
      createdAt: true,
    },
  })
}

/**
 * Get a specific snapshot's full content.
 */
export async function getSnapshot(snapshotId: string) {
  return prisma.decisionStackSnapshot.findUnique({
    where: { id: snapshotId },
  })
}

// --- Generation Status ---

/**
 * Set generation status on the Decision Stack (for polling).
 */
export async function setGenerationStatus(
  projectId: string,
  status: string | null
): Promise<void> {
  await prisma.decisionStack.upsert({
    where: { projectId },
    create: {
      projectId,
      generationStatus: status,
      generationStarted: status ? new Date() : null,
    },
    update: {
      generationStatus: status,
      generationStarted: status ? new Date() : null,
    },
  })
}

/**
 * Get current generation status for a project.
 */
export async function getGenerationStatus(projectId: string): Promise<{
  status: string | null
  startedAt: Date | null
}> {
  const stack = await prisma.decisionStack.findUnique({
    where: { projectId },
    select: { generationStatus: true, generationStarted: true },
  })

  return {
    status: stack?.generationStatus ?? null,
    startedAt: stack?.generationStarted ?? null,
  }
}
