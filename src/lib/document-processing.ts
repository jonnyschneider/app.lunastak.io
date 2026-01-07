/**
 * Document processing pipeline
 * - Extracts text from documents using Unstructured API
 * - Extracts strategic themes using Claude
 * - Creates fragments with document lineage
 * - Triggers knowledge summary refresh
 */

import { prisma } from '@/lib/db'
import { anthropic, CLAUDE_MODEL } from '@/lib/claude'
import { UnstructuredClient } from 'unstructured-client'
import { Strategy } from 'unstructured-client/sdk/models/shared'
import { extractXML } from '@/lib/utils'
import { createFragmentsFromDocument } from '@/lib/fragments'
import { generateKnowledgeSummary } from '@/lib/knowledge-summary'
import { updateAllSyntheses } from '@/lib/synthesis'
import { EmergentThemeContract } from '@/lib/contracts/extraction'

const unstructured = new UnstructuredClient({
  security: {
    apiKeyAuth: process.env.UNSTRUCTURED_API_KEY || '',
  },
})

const DOCUMENT_EXTRACTION_PROMPT = `You are analyzing a business document. Extract the key strategic themes from this document, and tag each theme with the strategic dimensions it relates to.

Document content:
{documentContent}

User context about this document:
{uploadContext}

STRATEGIC DIMENSIONS (tag each theme with 1-3 relevant dimensions):
1. customer_market - Who we serve, their problems, buying behaviour, market dynamics
2. problem_opportunity - The problem space, opportunity size, why now, market need
3. value_proposition - What we offer, how it solves problems, why it matters
4. differentiation_advantage - What makes us unique, defensibility, moats
5. competitive_landscape - Who else plays, their strengths/weaknesses, positioning
6. business_model_economics - How we create/capture value, unit economics, pricing
7. go_to_market - Sales strategy, customer success, growth channels
8. product_experience - The experience we're creating, usability, customer journey
9. capabilities_assets - What we can do, team, technology, IP
10. risks_constraints - What could go wrong, dependencies, limitations
11. strategic_intent - Vision, mission, long-term goals, strategic direction

Extract 3-10 key themes that capture the strategic content of this document. Name each theme based on what it actually covers.

Format your extraction:

<extraction>
  <theme>
    <theme_name>Name that describes this theme</theme_name>
    <content>Detailed summary of what this theme covers from the document</content>
    <dimensions>
      <dimension name="dimension_key" confidence="high|medium|low"/>
      <!-- Include 1-3 most relevant dimensions per theme -->
    </dimensions>
  </theme>
  <!-- Repeat for each theme (3-10 themes) -->
</extraction>`

/**
 * Parse document themes from XML extraction output
 * Returns themes matching EmergentThemeContract from extraction contracts
 */
function parseDocumentThemes(xml: string): EmergentThemeContract[] {
  const themes: EmergentThemeContract[] = []
  const themeRegex = /<theme>([\s\S]*?)<\/theme>/g
  let match

  while ((match = themeRegex.exec(xml)) !== null) {
    const themeXML = match[1]
    const theme_name = extractXML(themeXML, 'theme_name')
    const content = extractXML(themeXML, 'content')

    // Parse inline dimensions
    const dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[] = []
    const dimensionRegex = /<dimension\s+name="([^"]+)"\s+confidence="([^"]+)"\s*\/>/g
    let dimMatch

    while ((dimMatch = dimensionRegex.exec(themeXML)) !== null) {
      const name = dimMatch[1]
      const confidence = dimMatch[2].toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW'
      if (['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) {
        dimensions.push({ name, confidence })
      }
    }

    if (theme_name && content) {
      themes.push({ theme_name, content, dimensions })
    }
  }

  return themes
}

/**
 * Process a document asynchronously
 * Called from the upload endpoint after the document record is created
 */
export async function processDocument(
  documentId: string,
  fileBuffer: Buffer,
  fileType: string,
  uploadContext?: string
): Promise<void> {
  console.log(`[DocumentProcessing] Starting processing for document ${documentId}`)

  try {
    // Update status to processing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    })

    // Get document with project info
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    })

    if (!document) {
      throw new Error('Document not found')
    }

    // Step 1: Extract text using Unstructured API
    console.log(`[DocumentProcessing] Extracting text from ${document.fileName}`)

    const extractionResult = await unstructured.general.partition({
      partitionParameters: {
        files: {
          content: fileBuffer,
          fileName: document.fileName,
        },
        strategy: Strategy.Auto,
      },
    })

    // Combine all elements into text
    const elements = typeof extractionResult === 'string'
      ? JSON.parse(extractionResult)
      : extractionResult

    const extractedText = elements
      ?.map((el: any) => el.text)
      .filter(Boolean)
      .join('\n\n') || ''

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract meaningful text from document')
    }

    console.log(`[DocumentProcessing] Extracted ${extractedText.length} characters`)

    // Step 2: Extract strategic themes using Claude
    console.log('[DocumentProcessing] Extracting strategic themes')

    // Truncate to avoid context limits (keep first 15000 chars)
    const truncatedContent = extractedText.slice(0, 15000)

    const prompt = DOCUMENT_EXTRACTION_PROMPT
      .replace('{documentContent}', truncatedContent)
      .replace('{uploadContext}', uploadContext || 'No additional context provided')

    const extractionResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const extractionContent = extractionResponse.content[0]?.type === 'text'
      ? extractionResponse.content[0].text
      : ''

    const extractionXML = extractXML(extractionContent, 'extraction')
    const themes = parseDocumentThemes(extractionXML)

    console.log(`[DocumentProcessing] Extracted ${themes.length} themes`)

    if (themes.length === 0) {
      throw new Error('Could not extract any themes from document')
    }

    // Step 3: Create fragments with document lineage
    console.log('[DocumentProcessing] Creating fragments')

    const fragments = await createFragmentsFromDocument(
      document.projectId,
      documentId,
      themes
    )

    console.log(`[DocumentProcessing] Created ${fragments.length} fragments`)

    // Step 4: Update document status to complete
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'complete',
        processedAt: new Date(),
      },
    })

    // Step 5: Trigger synthesis and knowledge summary refresh (async)
    updateAllSyntheses(document.projectId).catch(error => {
      console.error('[DocumentProcessing] Failed to update syntheses:', error)
    })

    generateKnowledgeSummary(document.projectId).catch(error => {
      console.error('[DocumentProcessing] Failed to generate knowledge summary:', error)
    })

    console.log(`[DocumentProcessing] Completed processing for document ${documentId}`)

  } catch (error) {
    console.error(`[DocumentProcessing] Error processing document ${documentId}:`, error)

    // Update document status to failed
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    throw error
  }
}
