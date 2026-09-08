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

export const BUNDLE_VERSION = 3 as const

const ConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])

const ComponentSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough() // component shape varies by type and may evolve; preserve unknown fields

/**
 * The verbatim span a fragment rests on. Three verification states, not a
 * boolean: `unverifiable` means the source was not retained so the span COULD
 * NOT be checked — which is not the same failure as a span that was checked and
 * did not match. See docs/_plans/2026-08-27-ground-truth-preflight-design.md §16.1.
 */
const EvidenceSchema = z.object({
  text: z.string(),
  sourceRole: z.string().nullable().optional(), // user | assistant | document | bundle
  verification: z.enum(['verified', 'unverifiable', 'failed']),
  ordinal: z.number().int().nonnegative(),
})

const FragmentSchema = z.object({
  title: z.string().nullable(),
  content: z.string(),
  contentType: z.string(), // theme | insight | quote | stat | principle (free-form for forward-compat)
  confidence: ConfidenceSchema.nullable(),
  sourceType: z.string(), // extraction | import | manual
  // The three below are optional so a bundle exported before the ground truth
  // check still restores. Absent means "this export predates evidence", which is
  // exactly `null` / no rows — not a validation failure.
  interpretationType: z.string().nullable().optional(), // verbatim | interpretation
  reviewedAt: z.string().datetime().nullable().optional(),
  evidence: z.array(EvidenceSchema).optional(),
})

const GapSchema = z.object({
  title: z.string(),
  description: z.string(),
})

const SynthesisSchema = z.object({
  dimension: z.string(),
  summary: z.string().nullable(),
  gaps: z.array(GapSchema),
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
export type BundleEvidence = z.infer<typeof EvidenceSchema>
export type BundleSynthesis = z.infer<typeof SynthesisSchema>

export function parseBundle(raw: unknown): ProjectBundle {
  return ProjectBundleSchema.parse(raw)
}

export function safeParseBundle(raw: unknown) {
  return ProjectBundleSchema.safeParse(raw)
}
