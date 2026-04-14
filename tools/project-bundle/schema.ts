/**
 * Project Bundle — canonical egress/ingress format for Lunastak project data.
 *
 * Used for:
 *   - Persisting demo projects to version control (src/data/demos/*.json)
 *   - Replicating projects across env DBs (dev → preview → prod)
 *   - External modify-then-reimport workflow (manual editing in JSON, re-hydrate)
 *
 * This is the only supported format. External tools (LLM connectors, analysis
 * scripts, etc.) must produce bundles that conform to this schema.
 *
 * Bumping BUNDLE_VERSION is an intentional act — the contract test snapshots
 * the JSON Schema and fails loudly when the shape changes without a version bump.
 */
import { z } from 'zod'

export const BUNDLE_VERSION = 1 as const

const ConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])

const ComponentSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough() // component shape varies by type and may evolve; preserve unknown fields

const FragmentSchema = z.object({
  title: z.string().nullable(),
  content: z.string(),
  contentType: z.string(), // theme | insight | quote | stat | principle (free-form for forward-compat)
  confidence: ConfidenceSchema.nullable(),
  sourceType: z.string(), // extraction | import | manual
})

const GapSchema = z.object({
  title: z.string(),
  description: z.string(),
})

const SynthesisSchema = z.object({
  dimension: z.string(),
  summary: z.string().nullable(),
  keyThemes: z.array(z.string()),
  keyQuotes: z.array(z.string()),
  gaps: z.array(GapSchema),
  contradictions: z.array(z.string()),
  subdimensions: z.unknown().nullable(), // JSON for emergent Tier 2
  confidence: z.string(), // HIGH | MEDIUM | LOW (kept loose: prisma stores as String)
  fragmentCount: z.number().int().nonnegative(),
  synthesisVersion: z.string(),
})

const SuggestedQuestionSchema = z.object({
  title: z.string(),
  description: z.string(),
})

export const ProjectBundleSchema = z.object({
  bundleVersion: z.literal(BUNDLE_VERSION),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  isDemo: z.boolean(),
  demoSlug: z.string().min(1).nullable(),
  description: z.string().nullable(),
  exportedAt: z.string().datetime(),
  knowledgeSummary: z.string().nullable(),
  suggestedQuestions: z.array(SuggestedQuestionSchema),
  decisionStack: z.object({
    vision: z.string(),
    visionElaboration: z.string().nullable(),
    strategy: z.string(),
    strategyElaboration: z.string().nullable(),
    objectives: z.array(ComponentSchema),
    opportunities: z.array(ComponentSchema),
    principles: z.array(ComponentSchema),
  }),
  fragments: z.array(FragmentSchema),
  syntheses: z.array(SynthesisSchema),
})

export type ProjectBundle = z.infer<typeof ProjectBundleSchema>
export type BundleComponent = z.infer<typeof ComponentSchema>
export type BundleFragment = z.infer<typeof FragmentSchema>
export type BundleSynthesis = z.infer<typeof SynthesisSchema>

export function parseBundle(raw: unknown): ProjectBundle {
  return ProjectBundleSchema.parse(raw)
}

export function safeParseBundle(raw: unknown) {
  return ProjectBundleSchema.safeParse(raw)
}
