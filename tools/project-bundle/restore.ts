/**
 * Restore (hydrate) a project from a Project Bundle JSON file into a target DB env.
 *
 *   npm run bundle:restore -- --env preview --file src/data/demos/ferrari.json
 *   npm run bundle:restore -- --env prod    --file src/data/demos/ferrari.json
 *
 * Pass --dry to validate + preview without writing.
 *
 * Idempotent: upserts the Project under the bundle's projectId, then wipes
 * and recreates DecisionStack components, Fragments, and DimensionalSyntheses.
 *
 * The bundle is parsed through ProjectBundleSchema before any DB work — a
 * malformed bundle never reaches the database.
 */
import { readFileSync } from 'node:fs'
import { loadDbEnv, EnvName } from '../../prisma/env'
import { parseBundle } from './schema'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main() {
  const envName = (arg('env') ?? 'dev') as EnvName
  const file = arg('file')
  const dry = flag('dry')
  if (!file) throw new Error('Provide --file <path-to-bundle.json>')

  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const bundle = parseBundle(raw) // throws ZodError with full path on schema violation

  const db = loadDbEnv(envName)
  process.env.DATABASE_URL = db.unpooled
  process.env.DATABASE_URL_UNPOOLED = db.unpooled
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const demoUser = await prisma.user.findUnique({ where: { email: 'demo@lunastak.io' }, select: { id: true } })
    if (!demoUser) throw new Error(`demo@lunastak.io user not found in ${envName}`)

    console.log(`Restoring ${bundle.projectName} (${bundle.projectId}) into ${envName}`)
    console.log(`  bundleVersion=${bundle.bundleVersion}, exportedAt=${bundle.exportedAt}`)
    console.log(`  ${bundle.decisionStack.objectives.length} obj, ${bundle.decisionStack.opportunities.length} opp, ${bundle.decisionStack.principles.length} prin`)
    console.log(`  ${bundle.fragments.length} fragments, ${bundle.syntheses.length} syntheses`)
    if (dry) {
      console.log('--dry: not writing.')
      return
    }

    if (bundle.demoSlug) {
      const slugOwner = await prisma.project.findUnique({ where: { demoSlug: bundle.demoSlug }, select: { id: true } })
      if (slugOwner && slugOwner.id !== bundle.projectId) {
        throw new Error(
          `demoSlug "${bundle.demoSlug}" is already in use in ${envName} by project ${slugOwner.id} — ` +
          `expected ${bundle.projectId}. Resolve manually before re-running.`,
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.upsert({
        where: { id: bundle.projectId },
        create: {
          id: bundle.projectId,
          userId: demoUser.id,
          name: bundle.projectName,
          description: bundle.description,
          status: 'active',
          isDemo: bundle.isDemo,
          demoSlug: bundle.demoSlug,
          directionStatus: 'settled',
          knowledgeSummary: bundle.knowledgeSummary,
          suggestedQuestions: bundle.suggestedQuestions as never,
        },
        update: {
          userId: demoUser.id,
          name: bundle.projectName,
          description: bundle.description,
          status: 'active',
          isDemo: bundle.isDemo,
          demoSlug: bundle.demoSlug,
          directionStatus: 'settled',
          knowledgeSummary: bundle.knowledgeSummary,
          suggestedQuestions: bundle.suggestedQuestions as never,
        },
      })

      const stack = await tx.decisionStack.upsert({
        where: { projectId: bundle.projectId },
        create: {
          projectId: bundle.projectId,
          vision: bundle.decisionStack.vision,
          visionElaboration: bundle.decisionStack.visionElaboration,
          strategy: bundle.decisionStack.strategy,
          strategyElaboration: bundle.decisionStack.strategyElaboration,
        },
        update: {
          vision: bundle.decisionStack.vision,
          visionElaboration: bundle.decisionStack.visionElaboration,
          strategy: bundle.decisionStack.strategy,
          strategyElaboration: bundle.decisionStack.strategyElaboration,
        },
      })

      await tx.decisionStackComponent.deleteMany({ where: { decisionStackId: stack.id } })
      const componentRows: { decisionStackId: string; componentType: string; componentId: string; content: never; sortOrder: number }[] = []
      bundle.decisionStack.objectives.forEach((c, i) => componentRows.push({ decisionStackId: stack.id, componentType: 'objective', componentId: c.id, content: c as never, sortOrder: i }))
      bundle.decisionStack.opportunities.forEach((c, i) => componentRows.push({ decisionStackId: stack.id, componentType: 'opportunity', componentId: c.id, content: c as never, sortOrder: i }))
      bundle.decisionStack.principles.forEach((c, i) => componentRows.push({ decisionStackId: stack.id, componentType: 'principle', componentId: c.id, content: c as never, sortOrder: i }))
      if (componentRows.length > 0) {
        await tx.decisionStackComponent.createMany({ data: componentRows })
      }

      const oldFragIds = (await tx.fragment.findMany({ where: { projectId: bundle.projectId }, select: { id: true } })).map((f) => f.id)
      if (oldFragIds.length > 0) {
        await tx.fragmentDimensionTag.deleteMany({ where: { fragmentId: { in: oldFragIds } } })
        await tx.fragment.deleteMany({ where: { id: { in: oldFragIds } } })
      }
      if (bundle.fragments.length > 0) {
        await tx.fragment.createMany({
          data: bundle.fragments.map((f) => ({
            projectId: bundle.projectId,
            title: f.title,
            content: f.content,
            contentType: f.contentType,
            confidence: f.confidence,
            sourceType: f.sourceType,
            status: 'active',
          })),
        })
      }

      await tx.dimensionalSynthesis.deleteMany({ where: { projectId: bundle.projectId } })
      if (bundle.syntheses.length > 0) {
        await tx.dimensionalSynthesis.createMany({
          data: bundle.syntheses.map((s) => ({
            projectId: bundle.projectId,
            dimension: s.dimension,
            summary: s.summary,
            keyThemes: s.keyThemes,
            keyQuotes: s.keyQuotes,
            gaps: s.gaps as never,
            contradictions: s.contradictions,
            subdimensions: s.subdimensions as never,
            confidence: s.confidence,
            fragmentCount: s.fragmentCount,
            synthesisVersion: s.synthesisVersion,
          })),
        })
      }
    })

    console.log(`Done — ${bundle.projectName} restored into ${envName}.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
