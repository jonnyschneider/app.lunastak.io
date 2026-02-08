/**
 * Extract a conversation and related data from database for fixture creation
 *
 * Usage:
 *   DATABASE_URL=<prod-url> npx tsx scripts/extract-conversation-fixture.ts <conversationId>
 *
 * Output: JSON fixture to stdout (pipe to file)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function extractConversation(conversationId: string) {
  console.error(`Extracting conversation: ${conversationId}`)

  // Use raw query for conversation to handle schema differences between local/prod
  const conversations = await prisma.$queryRaw<any[]>`
    SELECT id, status, "currentPhase", "experimentVariant", "questionCount",
           "createdAt", "updatedAt", "projectId", "deepDiveId"
    FROM "Conversation"
    WHERE id = ${conversationId}
  `

  if (conversations.length === 0) {
    console.error('Conversation not found')
    process.exit(1)
  }

  const conversationBase = conversations[0]

  // Fetch related data separately
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { stepNumber: 'asc' },
  })

  const traces = await prisma.trace.findMany({
    where: { conversationId },
  })

  const fragments = await prisma.fragment.findMany({
    where: { conversationId },
    include: { dimensionTags: true },
  })

  const conversation = {
    ...conversationBase,
    messages,
    traces,
    fragments,
    projectId: conversationBase.projectId,
  }

  // Also fetch related project data
  const project = conversationBase.projectId
    ? await prisma.project.findUnique({
        where: { id: conversation.projectId },
        select: {
          id: true,
          name: true,
          knowledgeSummary: true,
          suggestedQuestions: true,
        },
      })
    : null

  // Skip generatedOutputs - schema may differ between local and prod
  const generatedOutputs: any[] = []

  const fixture = {
    _meta: {
      extractedAt: new Date().toISOString(),
      conversationId,
      description: 'Dogfood conversation - first-time experience flow',
    },
    conversation: {
      id: conversationBase.id,
      status: conversationBase.status,
      currentPhase: conversationBase.currentPhase,
      experimentVariant: conversationBase.experimentVariant,
      questionCount: conversationBase.questionCount,
      createdAt: conversationBase.createdAt instanceof Date
        ? conversationBase.createdAt.toISOString()
        : conversationBase.createdAt,
      updatedAt: conversationBase.updatedAt instanceof Date
        ? conversationBase.updatedAt.toISOString()
        : conversationBase.updatedAt,
    },
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      stepNumber: m.stepNumber,
      timestamp: m.timestamp.toISOString(),
    })),
    traces: traces.map(t => ({
      id: t.id,
      timestamp: t.timestamp.toISOString(),
      extractedContext: t.extractedContext,
      dimensionalCoverage: t.dimensionalCoverage,
      output: t.output,
      modelUsed: t.modelUsed,
      totalTokens: t.totalTokens,
    })),
    fragments: fragments.map(f => ({
      id: f.id,
      content: f.content,
      contentType: f.contentType,
      status: f.status,
      confidence: f.confidence,
      dimensionTags: f.dimensionTags.map(dt => ({
        dimension: dt.dimension,
        confidence: dt.confidence,
        subdimension: dt.subdimension,
      })),
    })),
    project: project ? {
      id: project.id,
      name: project.name,
      knowledgeSummary: project.knowledgeSummary,
      suggestedQuestions: project.suggestedQuestions,
    } : null,
    generatedOutputs: generatedOutputs.map(go => ({
      id: go.id,
      outputType: go.outputType,
      status: go.status,
      content: go.content,
      createdAt: go.createdAt.toISOString(),
    })),
  }

  // Output to stdout as JSON
  console.log(JSON.stringify(fixture, null, 2))
}

const conversationId = process.argv[2]
if (!conversationId) {
  console.error('Usage: npx tsx scripts/extract-conversation-fixture.ts <conversationId>')
  process.exit(1)
}

extractConversation(conversationId)
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
