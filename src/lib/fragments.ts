/**
 * Fragment service - creates and manages extracted fragments
 */

import { prisma } from '@/lib/db'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { EmergentThemeContract } from '@/lib/contracts/extraction'

export interface FragmentInput {
  projectId: string
  conversationId?: string
  documentId?: string
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
      documentId: input.documentId,
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
 * Map from extraction dimension keys to Tier 1 dimension constants
 */
const EXTRACTION_DIMENSION_MAP: Record<string, Tier1Dimension> = {
  'customer_market': 'CUSTOMER_MARKET',
  'problem_opportunity': 'PROBLEM_OPPORTUNITY',
  'value_proposition': 'VALUE_PROPOSITION',
  'differentiation_advantage': 'DIFFERENTIATION_ADVANTAGE',
  'competitive_landscape': 'COMPETITIVE_LANDSCAPE',
  'business_model_economics': 'BUSINESS_MODEL_ECONOMICS',
  'go_to_market': 'GO_TO_MARKET',
  'product_experience': 'PRODUCT_EXPERIENCE',
  'capabilities_assets': 'CAPABILITIES_ASSETS',
  'risks_constraints': 'RISKS_CONSTRAINTS',
  'strategic_intent': 'STRATEGIC_INTENT',
}

/**
 * Theme with inline dimension tags from extraction
 * @deprecated Use EmergentThemeContract from '@/lib/contracts/extraction' directly
 */
export type ThemeWithDimensions = EmergentThemeContract

/**
 * Create multiple fragments from extraction themes with inline dimensions
 */
export async function createFragmentsFromThemes(
  projectId: string,
  conversationId: string,
  themes: ThemeWithDimensions[]
) {
  const fragments = await Promise.all(
    themes.map(theme => {
      // Convert inline dimensions to DimensionTagInput[]
      const tags: DimensionTagInput[] = (theme.dimensions || [])
        .map(dim => {
          const tier1Dimension = EXTRACTION_DIMENSION_MAP[dim.name]
          if (!tier1Dimension) {
            console.log(`[Fragments] Unknown dimension key: ${dim.name}`)
            return null
          }
          return {
            dimension: tier1Dimension,
            confidence: dim.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
            reasoning: 'Tagged during extraction',
          } as DimensionTagInput
        })
        .filter((tag): tag is DimensionTagInput => tag !== null)


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
 * Create multiple fragments from document themes with inline dimensions
 */
export async function createFragmentsFromDocument(
  projectId: string,
  documentId: string,
  themes: ThemeWithDimensions[]
) {
  const fragments = await Promise.all(
    themes.map(theme => {
      // Convert inline dimensions to DimensionTagInput[]
      const tags: DimensionTagInput[] = (theme.dimensions || [])
        .map(dim => {
          const tier1Dimension = EXTRACTION_DIMENSION_MAP[dim.name]
          if (!tier1Dimension) {
            console.log(`[Fragments] Unknown dimension key: ${dim.name}`)
            return null
          }
          return {
            dimension: tier1Dimension,
            confidence: dim.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
            reasoning: 'Tagged during document extraction',
          } as DimensionTagInput
        })
        .filter((tag): tag is DimensionTagInput => tag !== null)


      return createFragment({
        projectId,
        documentId,
        content: `**${theme.theme_name}**\n\n${theme.content}`,
        contentType: 'theme',
        confidence: tags.length > 0 ? 'MEDIUM' : 'LOW',
        extractedBy: 'claude-document-extraction',
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
