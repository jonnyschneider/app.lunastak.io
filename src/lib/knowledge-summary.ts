/**
 * Knowledge Summary Service
 * Generates human-readable summaries of accumulated project knowledge
 * and suggests questions based on coverage gaps.
 */

import { prisma } from '@/lib/db'
import { createMessage } from '@/lib/claude'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { extractXML } from '@/lib/utils'
import { StructuredProvocation } from '@/lib/types'
import { extractText } from '@/lib/extract-text';

// Dimension display names for prompts
const DIMENSION_NAMES: Record<Tier1Dimension, string> = {
  CUSTOMER_MARKET: 'Customer & Market',
  PROBLEM_OPPORTUNITY: 'Problem & Opportunity',
  VALUE_PROPOSITION: 'Value Proposition',
  DIFFERENTIATION_ADVANTAGE: 'Differentiation & Competitive Advantage',
  COMPETITIVE_LANDSCAPE: 'Competitive Landscape',
  BUSINESS_MODEL_ECONOMICS: 'Business Model & Economics',
  GO_TO_MARKET: 'Go-to-Market Strategy',
  PRODUCT_EXPERIENCE: 'Product & Experience',
  CAPABILITIES_ASSETS: 'Capabilities & Assets',
  RISKS_CONSTRAINTS: 'Risks & Constraints',
  STRATEGIC_INTENT: 'Strategic Intent',
}

interface KnowledgeSummaryResult {
  summary: string
  suggestedQuestions: StructuredProvocation[]
  dimensionGaps: Record<string, StructuredProvocation> // dimension -> structured gap
}

/**
 * Generate a knowledge summary for a project
 * Called after extraction runs or document processing
 */
export async function generateKnowledgeSummary(
  projectId: string
): Promise<KnowledgeSummaryResult | null> {
  // Get project with user info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      user: { select: { name: true, email: true } },
      fragments: {
        where: { status: 'active' },
        include: { dimensionTags: true },
        orderBy: { capturedAt: 'desc' },
        take: 50, // Limit to most recent fragments for token budget
      },
    },
  })

  if (!project) {
    console.error('[KnowledgeSummary] Project not found:', projectId)
    return null
  }

  if (project.fragments.length === 0) {
    console.log('[KnowledgeSummary] No fragments to summarize')
    return null
  }

  // Calculate dimensional coverage
  const coveredDimensions = new Set<string>()
  for (const fragment of project.fragments) {
    for (const tag of fragment.dimensionTags) {
      coveredDimensions.add(tag.dimension)
    }
  }

  const gapDimensions = TIER_1_DIMENSIONS.filter(d => !coveredDimensions.has(d))

  // Format fragments for prompt
  const fragmentsText = project.fragments
    .map((f, i) => {
      const dimensions = f.dimensionTags.map(t => DIMENSION_NAMES[t.dimension as Tier1Dimension]).join(', ')
      return `[${i + 1}] ${f.content}${dimensions ? ` (relates to: ${dimensions})` : ''}`
    })
    .join('\n\n')

  // Build prompt
  const userName = project.user?.name || project.user?.email?.split('@')[0] || 'the user'
  const coveredDimensionsList = Array.from(coveredDimensions)
    .map(d => DIMENSION_NAMES[d as Tier1Dimension])
    .join(', ') || 'None yet'
  // Include both key and display name so Claude uses the key in dimension_gaps
  const gapDimensionsList = gapDimensions
    .map(d => `${d} (${DIMENSION_NAMES[d]})`)
    .join(', ') || 'None - great coverage!'

  // Payload only — guidelines and output format are the stage's system block
  // (prompts/stages/knowledge-summary.ts), identical on every call.
  const prompt = [
    `User: ${userName}`,
    '',
    'Strategic fragments extracted from their conversations and documents:',
    '',
    fragmentsText,
    '',
    `COVERED DIMENSIONS: ${coveredDimensionsList}`,
    `GAP DIMENSIONS (not yet explored): ${gapDimensionsList}`,
  ].join('\n')

  try {
    const response = await createMessage({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
    }, 'knowledge_summary')

    const responseText = extractText(response)

    // Parse response
    const summary = extractXML(responseText, 'summary')?.trim() || ''
    const suggestedQuestions: StructuredProvocation[] = []

    // Parse structured questions with title/description
    const questionRegex = /<question>([\s\S]*?)<\/question>/g
    let match
    while ((match = questionRegex.exec(responseText)) !== null) {
      const questionContent = match[1]
      const title = extractXML(questionContent, 'title')?.trim() || ''
      const description = extractXML(questionContent, 'description')?.trim() || ''
      if (title && description) {
        suggestedQuestions.push({ title, description })
      }
    }

    // Parse dimension-specific gaps with structured format
    const dimensionGaps: Record<string, StructuredProvocation> = {}
    const gapRegex = /<gap dimension="([^"]+)">([\s\S]*?)<\/gap>/g
    while ((match = gapRegex.exec(responseText)) !== null) {
      const dimension = match[1].trim()
      const gapContent = match[2]
      const title = extractXML(gapContent, 'title')?.trim() || ''
      const description = extractXML(gapContent, 'description')?.trim() || ''
      if (dimension && title && description) {
        dimensionGaps[dimension] = { title, description }
      }
    }

    // Update project with new summary
    await prisma.project.update({
      where: { id: projectId },
      data: {
        knowledgeSummary: summary,
        knowledgeUpdatedAt: new Date(),
        suggestedQuestions: suggestedQuestions as unknown as Parameters<typeof prisma.project.update>[0]['data']['suggestedQuestions'],
      },
    })

    // Update DimensionalSynthesis records with contextual gaps
    if (Object.keys(dimensionGaps).length > 0) {
      for (const [dimension, gap] of Object.entries(dimensionGaps)) {
        await prisma.dimensionalSynthesis.updateMany({
          where: {
            projectId,
            dimension,
            fragmentCount: 0, // Only update dimensions with no fragments
          },
          data: {
            gaps: [gap] as unknown as Parameters<typeof prisma.dimensionalSynthesis.updateMany>[0]['data']['gaps'],
          },
        })
      }
      console.log('[KnowledgeSummary] Updated dimension gaps:', Object.keys(dimensionGaps))
    }

    console.log('[KnowledgeSummary] Updated project knowledge:', {
      projectId,
      summaryLength: summary.length,
      questionCount: suggestedQuestions.length,
      dimensionGapCount: Object.keys(dimensionGaps).length,
    })

    return { summary, suggestedQuestions, dimensionGaps }
  } catch (error) {
    console.error('[KnowledgeSummary] Failed to generate summary:', error)
    return null
  }
}

/**
 * Get project knowledge for system prompt injection
 * Returns a formatted string suitable for including in Luna's system prompt
 */
export async function getProjectKnowledgeForPrompt(
  projectId: string,
  options: { maxFragments?: number; maxTokens?: number } = {}
): Promise<string | null> {
  const { maxFragments = 20 } = options

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      fragments: {
        where: { status: 'active' },
        include: { dimensionTags: true },
        orderBy: [
          { capturedAt: 'desc' },
        ],
        take: maxFragments,
      },
    },
  })

  if (!project) return null

  // If no knowledge summary yet, return minimal context
  if (!project.knowledgeSummary && project.fragments.length === 0) {
    return null
  }

  // Build context string
  const parts: string[] = []

  // Add knowledge summary if available
  if (project.knowledgeSummary) {
    parts.push(`## What You Know About Their Project\n\n${project.knowledgeSummary}`)
  }

  // Add key fragments (summarized)
  if (project.fragments.length > 0) {
    const fragmentSummaries = project.fragments
      .slice(0, 10) // Limit for token budget
      .map(f => {
        // Extract first line or first 100 chars as summary
        const firstLine = f.content.split('\n')[0]
        const summary = firstLine.length > 100
          ? firstLine.substring(0, 100) + '...'
          : firstLine
        return `- ${summary}`
      })
      .join('\n')

    parts.push(`## Key Insights (${project.fragments.length} total)\n\n${fragmentSummaries}`)
  }

  // Add suggested exploration areas based on gaps
  const suggestedQuestions = project.suggestedQuestions as StructuredProvocation[] | null
  if (suggestedQuestions && suggestedQuestions.length > 0) {
    const questions = suggestedQuestions
      .slice(0, 3)
      .map(q => `- ${q.title}: ${q.description}`)
      .join('\n')

    parts.push(`## Suggested Areas to Explore\n\n${questions}`)
  }

  return parts.join('\n\n')
}
