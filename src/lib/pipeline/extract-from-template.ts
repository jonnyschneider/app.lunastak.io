import { prisma } from '@/lib/db'
import { createMessage } from '@/lib/claude'
import { createFragmentsFromThemes, type ThemeWithDimensions } from '@/lib/fragments'
import type { StrategyStatements } from '@/lib/types'
import { extractText } from '@/lib/extract-text'

/**
 * Post-hoc extraction from user-entered Decision Stack content — the `extractFromTemplate`
 * background step of a `template_submitted` plan.
 *
 * This was a route (`/api/project/[id]/extract-from-template`) the executor `fetch`ed
 * server-to-server. That hop carried no cookies, so the route could not be put behind the auth
 * guard without silently breaking its only caller — and unguarded, anyone could POST a strategy at
 * any project and have fragments written into it. Pipeline behaviour lives in the pipeline; the
 * executor now calls this directly.
 *
 * Errors are NOT caught here. `runBackgroundTasks` already wraps each task in its own try/catch,
 * logs the failure by task name and carries on with the next task. Catching here would report a
 * failed extraction as "Completed" — which is what the old fetch did, since a 500 still resolves.
 */
export async function extractFromTemplate(input: {
  projectId: string
  traceId: string
  statements: StrategyStatements
}): Promise<{ fragmentsCreated: number }> {
  const { projectId, traceId, statements } = input

  // Build content for extraction
  const principlesText = statements.principles.length > 0
    ? statements.principles.map((p) => `- ${p.priority} even over ${p.deprioritized}`).join('\n')
    : 'None specified'

  const content = `
Vision: ${statements.vision}

Strategy: ${statements.strategy}

Objectives:
${statements.objectives.map((o) => `- ${o.pithy}${o.metric?.summary ? ` (${o.metric.summary})` : ''}`).join('\n')}

Principles:
${principlesText}
`.trim()

  console.log('[Extract Template] Extracting themes from template entry:', projectId)

  // No userId, on purpose: `createMessage` meters a guest's QUOTA against it, and this call was
  // never metered. Passing one would be a product change, not a refactor (plan D4).
  const response = await createMessage({
    messages: [
      {
        role: 'user',
        content: `Extract strategic themes from this Decision Stack. Return as JSON array with format:
[{
  "theme_name": "Theme title",
  "content": "Key insight or context extracted from the Decision Stack",
  "dimensions": [{ "name": "dimension_name", "confidence": "HIGH" | "MEDIUM" | "LOW" }]
}]

Valid dimension names:
- customer_market
- problem_opportunity
- value_proposition
- differentiation_advantage
- competitive_landscape
- business_model_economics
- go_to_market
- product_experience
- capabilities_assets
- risks_constraints
- strategic_intent

Extract 3-6 meaningful themes that capture the strategic essence. Focus on:
- Market positioning and target segments
- Key differentiators and value proposition
- Strategic priorities and trade-offs
- Success metrics and goals

Decision Stack:
${content}`,
      },
    ],
  }, 'template_extraction')

  // Parse themes from JSON in response
  const text = extractText(response)
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  let themes: ThemeWithDimensions[] = []
  if (jsonMatch) {
    try {
      themes = JSON.parse(jsonMatch[0])
    } catch {
      console.log('[Extract Template] Failed to parse JSON from response')
    }
  }

  if (themes.length === 0) {
    console.log('[Extract Template] No themes extracted')
    return { fragmentsCreated: 0 }
  }

  // Create a synthetic conversation ID for template entries
  const syntheticConversationId = `template-${traceId}`

  // Verify the conversation exists (created by template-entry)
  const conversation = await prisma.conversation.findFirst({
    where: {
      projectId,
      id: syntheticConversationId,
    },
  })

  // If no synthetic conversation, find the actual one from the trace
  let conversationId = syntheticConversationId
  if (!conversation) {
    const trace = await prisma.trace.findUnique({
      where: { id: traceId },
      select: { conversationId: true },
    })
    if (trace) {
      conversationId = trace.conversationId
    }
  }

  const fragments = await createFragmentsFromThemes(projectId, conversationId, themes)

  console.log(`[Extract Template] Created ${fragments.length} fragments from template`)

  return { fragmentsCreated: fragments.length }
}
