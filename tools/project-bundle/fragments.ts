/**
 * Fragment mapping for the Project Bundle — the one place that knows which
 * Fragment columns cross the export/restore boundary.
 *
 * It lives apart from export.ts / restore.ts because both of those are CLI
 * entrypoints that run `main()` on import. Keeping the mapping here makes the
 * boundary testable, and gives a single file to update when Fragment grows a
 * column that must survive a dev → preview → prod hop.
 */
import { randomUUID } from 'node:crypto'
import type { BundleEvidence, BundleFragment } from './schema'

/** The shape export.ts reads off Prisma (`fragment` with `evidence` included). */
export interface ExportableFragment {
  title: string | null
  content: string
  contentType: string
  confidence: string | null
  sourceType: string
  interpretationType: string | null
  reviewedAt: Date | string | null
  evidence: {
    text: string
    sourceRole: string | null
    verification: string
    ordinal: number
  }[]
}

/**
 * The slice of a Prisma transaction client `writeFragments` needs. Structural,
 * so the contract test can hand it a recorder instead of a database.
 */
export interface FragmentRow {
  id: string
  projectId: string
  title: string | null
  content: string
  contentType: string
  confidence: string | null
  sourceType: string
  interpretationType: string | null
  reviewedAt: Date | null
  status: string
}

export interface EvidenceRow {
  id: string
  fragmentId: string
  text: string
  sourceRole: string | null
  verification: string
  ordinal: number
}

export interface FragmentWriteClient {
  fragment: { createMany(args: { data: FragmentRow[] }): Promise<unknown> }
  evidence: { createMany(args: { data: EvidenceRow[] }): Promise<unknown> }
}

export function toBundleFragment(f: ExportableFragment): BundleFragment {
  return {
    title: f.title,
    content: f.content,
    contentType: f.contentType,
    confidence: f.confidence as BundleFragment['confidence'],
    sourceType: f.sourceType,
    interpretationType: f.interpretationType ?? null,
    reviewedAt: f.reviewedAt ? new Date(f.reviewedAt).toISOString() : null,
    evidence: (f.evidence ?? [])
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((e) => ({
        text: e.text,
        sourceRole: e.sourceRole ?? null,
        verification: e.verification as BundleEvidence['verification'],
        ordinal: e.ordinal,
      })),
  }
}

/**
 * Insert a bundle's fragments and their evidence.
 *
 * IDs are pre-assigned so both inserts stay `createMany` and evidence can name
 * its parent without a read-back — the same pattern as
 * `createFragmentsFromImport` in src/lib/fragments.ts. Matching evidence to
 * fragments by content after the fact would be wrong the moment two fragments
 * share text.
 *
 * `verification` is carried through verbatim, unlike the import path, which
 * forces `unverifiable`. A bundle restore is a replication of fragments that
 * were already checked against their source somewhere else; re-labelling them
 * would destroy the verdict this format exists to preserve.
 */
export async function writeFragments(
  tx: FragmentWriteClient,
  projectId: string,
  fragments: BundleFragment[],
): Promise<void> {
  if (fragments.length === 0) return

  const fragmentRows: FragmentRow[] = fragments.map((f) => ({
    id: randomUUID(),
    projectId,
    title: f.title,
    content: f.content,
    contentType: f.contentType,
    confidence: f.confidence,
    sourceType: f.sourceType,
    interpretationType: f.interpretationType ?? null,
    reviewedAt: f.reviewedAt ? new Date(f.reviewedAt) : null,
    status: 'active',
  }))

  const evidenceRows: EvidenceRow[] = fragments.flatMap((f, i) =>
    (f.evidence ?? []).map((e, ordinal) => ({
      id: randomUUID(),
      fragmentId: fragmentRows[i].id,
      text: e.text,
      sourceRole: e.sourceRole ?? null,
      verification: e.verification,
      // Ordinal is positional in the bundle; trust the array, not a stale integer.
      ordinal: e.ordinal ?? ordinal,
    })),
  )

  await tx.fragment.createMany({ data: fragmentRows })
  if (evidenceRows.length > 0) {
    await tx.evidence.createMany({ data: evidenceRows })
  }
}
