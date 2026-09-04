/**
 * Fragment service - creates and manages extracted fragments
 */

import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { EmergentThemeContract } from '@/lib/contracts/extraction'
import { verifySpan, type Verification } from '@/lib/evidence/verify'

/** Where the span came from — the ingest path, not the model's opinion. */
export type EvidenceSourceRole = 'user' | 'assistant' | 'document' | 'bundle'

export interface EvidenceInput {
  text: string
  verification: Verification
  sourceRole?: EvidenceSourceRole
}

export interface FragmentInput {
  projectId: string
  conversationId?: string
  documentId?: string
  messageId?: string
  title?: string
  content: string
  contentType: 'theme' | 'insight' | 'quote' | 'stat' | 'principle'
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  /** Verbatim spans the fragment rests on, in the order the extractor emitted them. */
  evidence?: EvidenceInput[]
  /** Self-reported by the extractor: verbatim | interpretation. */
  interpretationType?: string
}

/**
 * Verify a theme's spans against the source it claims to come from.
 *
 * `source === null` means there is no source to check against — every bundle import — so the spans
 * store as `unverifiable`, never `failed`. `verifySpan` encodes that; this just fans it out and
 * preserves emission order as `ordinal`.
 */
function buildEvidence(
  spans: string[] | undefined,
  source: string | null | undefined,
  sourceRole: EvidenceSourceRole
): EvidenceInput[] | undefined {
  if (!spans || spans.length === 0) return undefined
  return spans.map(text => ({
    text,
    verification: verifySpan(text, source),
    sourceRole,
  }))
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
      title: input.title,
      content: input.content,
      contentType: input.contentType,
      confidence: input.confidence,
      status: 'active',
      interpretationType: input.interpretationType,
      dimensionTags: dimensionTags ? {
        create: dimensionTags.map(tag => ({
          dimension: tag.dimension,
          confidence: tag.confidence,
          reasoning: tag.reasoning,
        }))
      } : undefined,
      // Same nested write as the tags: one statement, one transaction.
      evidence: input.evidence && input.evidence.length > 0 ? {
        create: input.evidence.map((span, ordinal) => ({
          text: span.text,
          verification: span.verification,
          sourceRole: span.sourceRole,
          ordinal,
        }))
      } : undefined
    },
    include: {
      dimensionTags: true,
      evidence: true
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
  themes: ThemeWithDimensions[],
  /**
   * The conversation text the themes were extracted from. Verification runs here, at ingest —
   * pass `null` when the caller has no source in hand and the spans store as `unverifiable`.
   */
  sourceText?: string | null
) {
  console.log(`[Fragments] Creating ${themes.length} fragments via Promise.all...`)
  const fragments = await Promise.all(
    themes.map(async (theme, i) => {
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

      const fragment = await createFragment({
        projectId,
        conversationId,
        title: theme.theme_name,
        content: theme.content,
        contentType: 'theme',
        confidence: tags.length > 0 ? 'MEDIUM' : 'LOW',
        evidence: buildEvidence(theme.evidence, sourceText, 'user'),
        interpretationType: theme.type,
      }, tags)
      console.log(`[Fragments] Fragment ${i + 1}/${themes.length} created: ${fragment.id}`)
      return fragment
    })
  )
  console.log(`[Fragments] All ${fragments.length} fragments created`)

  return fragments
}

/**
 * Create multiple fragments from document themes with inline dimensions
 */
export async function createFragmentsFromDocument(
  projectId: string,
  documentId: string,
  themes: ThemeWithDimensions[],
  /** The uploaded document's text. It is never persisted, so this is the only moment it can be checked. */
  documentText?: string | null
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
        title: theme.theme_name,
        content: theme.content,
        contentType: 'theme',
        confidence: tags.length > 0 ? 'MEDIUM' : 'LOW',
        evidence: buildEvidence(theme.evidence, documentText, 'document'),
        interpretationType: theme.type,
      }, tags)
    })
  )

  return fragments
}

/**
 * Create multiple fragments from imported themes (context bundles).
 *
 * Uses bulk createMany for fragments and dimension tags — 2 INSERT
 * statements instead of N individual transactions. This keeps import
 * fast even for large bundles (60+ chunks).
 */
export async function createFragmentsFromImport(
  projectId: string,
  importBatchId: string,
  themes: ThemeWithDimensions[]
) {
  // Pre-assign IDs so we can bulk-create fragments and tags in one pass
  const fragmentRows = themes.map(theme => {
    const hasTags = (theme.dimensions || []).some(
      dim => EXTRACTION_DIMENSION_MAP[dim.name]
    )
    return {
      id: randomUUID(),
      projectId,
      title: theme.theme_name || null,
      content: theme.content,
      contentType: 'insight',
      status: 'active',
      confidence: hasTags ? 'MEDIUM' : 'LOW',
      sourceType: 'import',
      importBatchId,
      interpretationType: theme.type ?? null,
    }
  })

  // A bundle is produced in a conversation this app never sees: there is no source here to check
  // against, ever. `verifySpan(span, null)` returns `unverifiable` — "could not be checked" — and
  // NOT `failed`, which would wrongly penalise every imported fragment for evidence quality.
  const evidenceRows = themes.flatMap((theme, i) =>
    (theme.evidence || []).map((text, ordinal) => ({
      id: randomUUID(),
      fragmentId: fragmentRows[i].id,
      text,
      verification: verifySpan(text, null),
      sourceRole: 'bundle',
      ordinal,
    }))
  )

  // Build all dimension tag rows
  const tagRows = themes.flatMap((theme, i) =>
    (theme.dimensions || [])
      .map(dim => {
        const tier1Dimension = EXTRACTION_DIMENSION_MAP[dim.name]
        if (!tier1Dimension) return null
        return {
          id: randomUUID(),
          fragmentId: fragmentRows[i].id,
          dimension: tier1Dimension,
          confidence: (dim.confidence as string) || 'MEDIUM',
          reasoning: 'Tagged during import',
        }
      })
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
  )

  // Two bulk inserts in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.fragment.createMany({ data: fragmentRows })
    if (tagRows.length > 0) {
      await tx.fragmentDimensionTag.createMany({ data: tagRows })
    }
    if (evidenceRows.length > 0) {
      await tx.evidence.createMany({ data: evidenceRows })
    }
  })

  console.log(`[Fragments] Bulk created ${fragmentRows.length} fragments with ${tagRows.length} dimension tags and ${evidenceRows.length} evidence spans`)

  // Return created fragments with tags for caller
  return prisma.fragment.findMany({
    where: { importBatchId },
    include: { dimensionTags: true, evidence: true },
    orderBy: { capturedAt: 'asc' },
  })
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
