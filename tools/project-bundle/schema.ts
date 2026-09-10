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

export const BUNDLE_VERSION = 5 as const

const ConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])

const ComponentSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough() // component shape varies by type and may evolve; preserve unknown fields

/**
 * Which strategic dimensions a fragment was tagged into.
 *
 * Added in v5. `FragmentDimensionTag` was NEVER carried by this format, so every export dropped it
 * and every restore produced a project whose fragments belong to no dimension at all — the coverage
 * grid empty, every ground truth filed under "not filed anywhere". The four committed demos have
 * shipped that way for as long as they have existed, which is why nobody connected the empty
 * Harvey balls to a data problem: there was nothing to compare against.
 *
 * `reasoning` and `subdimension` are deliberately NOT carried. The first is a note about how a tag
 * was arrived at, not the tag; the second is unused (Tier 2 is future work). Both would be dead
 * weight in a file that is read by people.
 */
const DimensionTagSchema = z.object({
  dimension: z.string(),
  confidence: z.string().nullable().optional(),
})

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
  /**
   * Which tool produced the context bundle this fragment came from, and how it was
   * imported. Added in v4 — the columns landed 2026-09-09 (src/lib/import/provenance.ts)
   * and this boundary was never updated, so every dev → preview → prod hop silently
   * erased them. Exactly the failure v3 fixed for evidence, repeated.
   *
   * Optional and nullable: absent means "exported before provenance existed", null means
   * the bundle claimed nothing. Neither is a category — see provenance.ts.
   */
  generatedBy: z.string().nullable().optional(),
  importMode: z.string().nullable().optional(),
  /** v5. Optional so a v4 bundle still restores — absent means "exported before dimensions". */
  dimensions: z.array(DimensionTagSchema).optional(),
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
