/**
 * Fragment service - creates and manages extracted fragments
 */

import { prisma } from '@/lib/db'
import { Tier1Dimension } from '@/lib/constants/dimensions'

export interface FragmentInput {
  projectId: string
  conversationId: string
  messageId?: string
  content: string
  contentType: 'theme' | 'insight' | 'quote' | 'stat' | 'principle'
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  extractedBy?: string
}

export interface DimensionTagInput {
  dimension: Tier1Dimension
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  reasoning?: string
}

/**
 * Create a fragment with optional dimension tags
 */
export async function createFragment(
  input: FragmentInput,
  dimensionTags?: DimensionTagInput[]
) {
  const fragment = await prisma.fragment.create({
    data: {
      projectId: input.projectId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      content: input.content,
      contentType: input.contentType,
      confidence: input.confidence,
      extractedBy: input.extractedBy || 'claude-extraction',
      status: 'active',
      dimensionTags: dimensionTags ? {
        create: dimensionTags.map(tag => ({
          dimension: tag.dimension,
          confidence: tag.confidence,
          reasoning: tag.reasoning,
          taggedBy: 'claude-dimensional-analysis',
        }))
      } : undefined
    },
    include: {
      dimensionTags: true
    }
  })

  return fragment
}

/**
 * Create multiple fragments from extraction themes
 */
export async function createFragmentsFromThemes(
  projectId: string,
  conversationId: string,
  themes: { theme_name: string; content: string }[],
  dimensionMappings: Map<string, DimensionTagInput[]>
) {
  const fragments = await Promise.all(
    themes.map(theme => {
      const tags = dimensionMappings.get(theme.theme_name) || []
      return createFragment({
        projectId,
        conversationId,
        content: `**${theme.theme_name}**\n\n${theme.content}`,
        contentType: 'theme',
        confidence: tags.length > 0 ? 'MEDIUM' : 'LOW',
      }, tags)
    })
  )

  return fragments
}

/**
 * Get active fragments for a project and dimension
 */
export async function getActiveFragments(
  projectId: string,
  dimension?: Tier1Dimension
) {
  return prisma.fragment.findMany({
    where: {
      projectId,
      status: 'active',
      ...(dimension && {
        dimensionTags: {
          some: { dimension }
        }
      })
    },
    include: {
      dimensionTags: true
    },
    orderBy: { capturedAt: 'desc' }
  })
}
