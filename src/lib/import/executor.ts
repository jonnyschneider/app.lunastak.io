import { prisma } from '@/lib/db'
import { onlyGroundTruths } from '@/lib/ground-truth/count'
import { randomUUID } from 'crypto'
import type { ImportPlan, ImportTrigger, ImportResult } from './types'
import { transformContextBundle, transformContextBundleDirect } from './transforms'
import { createFragmentsFromImport } from '@/lib/fragments'
import { normaliseGeneratedBy } from './provenance'

/**
 * Execute an import plan.
 * Calls transform → fragmenter → persist questions.
 */
export async function executeImport(
  plan: ImportPlan,
  trigger: ImportTrigger
): Promise<ImportResult> {
  const importBatchId = randomUUID()
  const generatedBy = normaliseGeneratedBy(trigger.bundle.generatedBy)
  let fragmentsCreated = 0
  let questionsAdded = 0

  console.log(`[Import] Executing import: ${plan.trigger} mode=${plan.mode} from=${generatedBy ?? 'unstated'} batch=${importBatchId}`)

  // Step 1: Transform bundle to EmergentThemeContract[]
  const themes = plan.mode === 'direct'
    ? transformContextBundleDirect(trigger.bundle)
    : await transformContextBundle(trigger.bundle)

  console.log(`[Import] Transformed ${themes.length} themes`)

  // Step 2: Create fragments via fragmenter
  if (themes.length > 0) {
    const fragments = await createFragmentsFromImport(
      trigger.projectId,
      importBatchId,
      themes,
      // What the bundle CLAIMS (validated against a closed set), and what we DERIVED from its
      // shape. Storing both is the point: `importMode` cannot be spoofed by instruction text, so
      // a bundle claiming the plugin while arriving as `transform` means the plugin has drifted
      // from its own spec.
      { generatedBy, importMode: plan.mode }
    )
    /**
     * The number the user is told — ground truths, not rows written.
     *
     * A bundle's tensions become fragments and are deliberately never shown in the review (they
     * are the skill's reading across themes, not the user's words). Reporting them here promised
     * "20 ground truths" over a list of 14. See `lib/ground-truth/count.ts`.
     */
    fragmentsCreated = onlyGroundTruths(
      fragments.map(f => ({
        contentType: f.contentType,
        title: f.title,
        evidence: [] as { sourceRole: string | null }[],
      }))
    ).length
    console.log(`[Import] Created ${fragments.length} fragments (${fragmentsCreated} ground truths)`)
  }

  // Step 3: Store open questions as suggested questions
  const openQuestions = trigger.bundle.openQuestions || []
  if (openQuestions.length > 0) {
    const project = await prisma.project.findUnique({
      where: { id: trigger.projectId },
      select: { suggestedQuestions: true },
    })

    const existing = (project?.suggestedQuestions as any[]) || []
    const newQuestions = openQuestions.map(q => ({
      title: q.question.length > 60 ? q.question.slice(0, 57) + '...' : q.question,
      description: q.question + (q.why ? `\n\n${q.why}` : ''),
    }))
    const merged = [...existing, ...newQuestions]

    await prisma.project.update({
      where: { id: trigger.projectId },
      data: { suggestedQuestions: merged },
    })

    questionsAdded = newQuestions.length
    console.log(`[Import] Added ${questionsAdded} suggested questions`)
  }

  console.log(`[Import] Complete: ${fragmentsCreated} fragments, ${questionsAdded} questions (batch: ${importBatchId})`)

  return { fragmentsCreated, questionsAdded, importBatchId, generatedBy }
}
