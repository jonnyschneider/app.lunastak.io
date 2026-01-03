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
 * Normalize theme name for fuzzy matching
 * Handles variations like "The 6 PM Surge" vs "6 PM Surge" vs "6PM Surge"
 */
function normalizeThemeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, '') // Remove leading "The "
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim()
}

/**
 * Find dimension tags for a theme using fuzzy matching
 */
function findDimensionTags(
  themeName: string,
  dimensionMappings: Map<string, DimensionTagInput[]>
): DimensionTagInput[] {
  // Try exact match first
  const exactMatch = dimensionMappings.get(themeName)
  if (exactMatch) return exactMatch

  // Try normalized match
  const normalizedTheme = normalizeThemeName(themeName)

  const entries = Array.from(dimensionMappings.entries())
  for (const [mappedName, tags] of entries) {
    if (normalizeThemeName(mappedName) === normalizedTheme) {
      return tags
    }
    // Also check if one contains the other (partial match)
    const normalizedMapped = normalizeThemeName(mappedName)
    if (normalizedTheme.includes(normalizedMapped) || normalizedMapped.includes(normalizedTheme)) {
      return tags
    }
  }

  return []
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
      const tags = findDimensionTags(theme.theme_name, dimensionMappings)
      console.log(`[Fragments] Theme "${theme.theme_name}" matched ${tags.length} dimension tags`)
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
