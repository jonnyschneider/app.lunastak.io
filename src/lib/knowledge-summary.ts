/**
 * Knowledge Summary Service
 * Generates human-readable summaries of accumulated project knowledge
 * and suggests questions based on coverage gaps.
 */

import { prisma } from '@/lib/db'
import { createMessage, CLAUDE_MODEL } from '@/lib/claude'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { extractXML } from '@/lib/utils'
import { StructuredProvocation } from '@/lib/types'

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

const KNOWLEDGE_SUMMARY_PROMPT = `You are summarizing accumulated strategic knowledge for a user named {userName} who is building their business strategy with an AI coach named Luna.

Here are the strategic fragments (insights) that have been extracted from their conversations and documents:

{fragments}

COVERED DIMENSIONS: {coveredDimensions}
GAP DIMENSIONS (not yet explored): {gapDimensions}

Write a warm, conversational summary of what Luna knows about their strategy so far. This summary will be displayed to the user and also used to give Luna context in future conversations.

Guidelines:
- Write in second person ("You've shared that...", "Your strategy focuses on...")
- Be specific - reference actual details from the fragments
- Organize by themes that emerged, not rigidly by dimensions
- Keep it concise (150-300 words)
- End on an encouraging note

Format your response:
<summary>
Your conversational summary here
</summary>

<suggested_questions>
For each question, provide a punchy title (max 60 chars) and fuller description:
<question>
<title>Short, attention-grabbing title</title>
<description>The full thought-provoking question about a gap or area to explore further</description>
</question>
<question>
<title>Another punchy title</title>
<description>Another question that could deepen their strategic thinking</description>
</question>
<question>
<title>Third provocative title</title>
<description>A third question connecting different aspects of their strategy</description>
</question>
</suggested_questions>

<dimension_gaps>
For each gap dimension listed above, generate ONE specific question that:
- References what you DO know about their business (from covered dimensions)
- Frames the gap in context of their specific situation
- Would help deepen understanding of that dimension

Format each with a punchy title and fuller description:
<gap dimension="DIMENSION_NAME">
<title>Short, attention-grabbing title (max 60 chars)</title>
<description>Your contextual question here as a fuller explanation</description>
</gap>
</dimension_gaps>`

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

  const prompt = KNOWLEDGE_SUMMARY_PROMPT
    .replace('{userName}', userName)
    .replace('{fragments}', fragmentsText)
    .replace('{coveredDimensions}', coveredDimensionsList)
    .replace('{gapDimensions}', gapDimensionsList)

  try {
    const response = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: 2000, // Increased for dimension gaps
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
    }, 'knowledge_summary')

    const responseText = response.content[0]?.type === 'text'
      ? response.content[0].text
      : ''

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
