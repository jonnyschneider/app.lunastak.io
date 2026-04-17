/**
 * Export a project from a target DB env to a Project Bundle JSON file.
 *
 *   npm run bundle:export -- --env dev --slug ferrari
 *   npm run bundle:export -- --env dev --id <projectId> --out path/to/bundle.json
 *
 * The output is validated against ProjectBundleSchema before writing —
 * malformed bundles never reach disk.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadDbEnv, EnvName } from '../../prisma/env'
import { BUNDLE_VERSION, parseBundle } from './schema'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const envName = (arg('env') ?? 'dev') as EnvName
  const slug = arg('slug')
  const id = arg('id')
  const out = arg('out')

  if (!slug && !id) {
    throw new Error('Provide --slug <demoSlug> or --id <projectId>')
  }

  const db = loadDbEnv(envName)
  process.env.DATABASE_URL = db.unpooled
  process.env.DATABASE_URL_UNPOOLED = db.unpooled
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const project = await prisma.project.findFirst({
      where: slug ? { demoSlug: slug, isDemo: true } : { id: id! },
      include: {
        decisionStack: { include: { components: { where: { status: 'active' }, orderBy: { sortOrder: 'asc' } } } },
        fragments: { where: { status: 'active' }, orderBy: { capturedAt: 'asc' } },
        dimensionalSyntheses: { orderBy: { dimension: 'asc' } },
      },
    })
    if (!project) throw new Error(`project not found in ${envName} (slug=${slug ?? '-'}, id=${id ?? '-'})`)

    const objectives = project.decisionStack?.components.filter((c) => c.componentType === 'objective').map((c) => c.content) ?? []
    const opportunities = project.decisionStack?.components.filter((c) => c.componentType === 'opportunity').map((c) => c.content) ?? []
    const principles = project.decisionStack?.components.filter((c) => c.componentType === 'principle').map((c) => c.content) ?? []

    const raw = {
      bundleVersion: BUNDLE_VERSION,
      projectId: project.id,
      projectName: project.name,
      isDemo: project.isDemo,
      demoSlug: project.demoSlug,
      description: project.description ?? null,
      exportedAt: new Date().toISOString(),
      knowledgeSummary: project.knowledgeSummary ?? null,
      suggestedQuestions: project.suggestedQuestions ?? [],
      decisionStack: {
        vision: project.decisionStack?.vision ?? '',
        visionElaboration: project.decisionStack?.visionElaboration ?? null,
        strategy: project.decisionStack?.strategy ?? '',
        strategyElaboration: project.decisionStack?.strategyElaboration ?? null,
        objectives,
        opportunities,
        principles,
      },
      fragments: project.fragments.map((f) => ({
        title: f.title,
        content: f.content,
        contentType: f.contentType,
        confidence: f.confidence,
        sourceType: f.sourceType,
      })),
      syntheses: project.dimensionalSyntheses.map((s) => ({
        dimension: s.dimension,
        summary: s.summary,
        keyThemes: s.keyThemes,
        keyQuotes: s.keyQuotes,
        gaps: s.gaps,
        contradictions: s.contradictions,
        subdimensions: s.subdimensions,
        confidence: s.confidence,
        fragmentCount: s.fragmentCount,
        synthesisVersion: s.synthesisVersion,
      })),
    }

    // Validate before writing — fail loud if export shape drifts from schema.
    const bundle = parseBundle(raw)

    const outPath = out ?? join('src/data/demos', `${bundle.demoSlug ?? bundle.projectId}.json`)
    writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8')
    console.log(`Exported project ${bundle.projectId} (${bundle.projectName}) from ${envName} → ${outPath}`)
    console.log(`  bundleVersion=${bundle.bundleVersion}`)
    console.log(`  ${objectives.length} objectives, ${opportunities.length} opportunities, ${principles.length} principles`)
    console.log(`  ${bundle.fragments.length} fragments, ${bundle.syntheses.length} syntheses`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
