/**
 * Computed support for one project-dimension — the Harvey ball's input (design §16.4).
 *
 * It replaces `synthesis?.confidence || (fragmentCount > 0 ? 'MEDIUM' : null)`, which reached the
 * ball as a boolean on the first-run path and as a per-run model self-report afterwards.
 *
 * Two rules make this worth having and both are structural, not stylistic:
 *
 * 1. **Structural signals only lift.** Distinct sources and active fragment count are properties
 *    of what the *user* supplied; the producer cannot influence them. Bands are set from 878 real
 *    prod project-dimension instances.
 * 2. **Producer-influenced signals only pull down.** Evidence state and evidence substance can
 *    demote by at most one band and can never promote, so quoting more cannot buy a fuller circle
 *    — it can only stop losing one. Gaming has no upside.
 *
 * Computed on read, never stored on `Fragment`, never put in a prompt, never returned to a
 * producer: a stored field is one refactor away from being fed back to the model that earns it.
 */

export type SupportLevel = 'empty' | 'quarter' | 'half' | 'three-quarter' | 'full'

/** Ascending, so a demotion is one step left. */
const LEVELS: SupportLevel[] = ['empty', 'quarter', 'half', 'three-quarter', 'full']

/**
 * Shortest evidence span we treat as substantial. Above `MIN_SPAN_CHARS` (12 — the "a four-word
 * assent is not a citation" floor in `@/lib/evidence/verify`) and below any real quoted sentence.
 * MEASURED, not a guess (design doc §13): a 40-char floor flagged 26.8% of fragments from
 * sub-600-char conversations and 0% from 4k+ ones — a clean separator with no false positives in
 * that sample. Caveat worth knowing before re-tuning it: that was measured on spans a judge picked
 * AFTER the fact. Extraction-time spans, where the producer knows the span is what survives, have
 * not been re-measured against it.
 */
export const THIN_EVIDENCE_CHARS = 40

export interface SupportEvidence {
  text: string
  /** 'verified' | 'unverifiable' | 'failed' — see `@/lib/evidence/verify`. */
  verification: string
}

/** The subset of a fragment the calculator reads. Deliberately not the prisma type. */
export interface SupportFragment {
  conversationId?: string | null
  documentId?: string | null
  importBatchId?: string | null
  /** 'extraction' | 'import' | 'manual' — a manual fragment has no evidence by design. */
  sourceType?: string | null
  evidence?: SupportEvidence[]
}

/**
 * Distinct sources feeding the dimension: conversations, documents and import batches.
 *
 * Fragments carrying none of the three — the template path — collectively count as **one**
 * source, not zero and not one each (§17): those rows are substantial but structurally carry no
 * source id, and scoring them zero would show empty for a well-populated dimension.
 */
export function countSources(fragments: SupportFragment[]): number {
  const sources = new Set<string>()

  for (const f of fragments) {
    let hasId = false
    if (f.conversationId) { sources.add(`conversation:${f.conversationId}`); hasId = true }
    if (f.documentId) { sources.add(`document:${f.documentId}`); hasId = true }
    if (f.importBatchId) { sources.add(`import:${f.importBatchId}`); hasId = true }
    if (!hasId) sources.add('unsourced')
  }

  return sources.size
}

/**
 * The structural band. Set from prod (878 project-dimension instances, template path counted as
 * one source); the shares each band took there are in §16.4.
 *
 * The soft floor is the `>= 5` fragment arm of half: one thorough conversation earns half rather
 * than quarter. Full is reachable only by adding sources.
 */
export function supportBand(sourceCount: number, fragmentCount: number): SupportLevel {
  if (fragmentCount === 0 || sourceCount === 0) return 'empty'
  if (sourceCount >= 5 && fragmentCount >= 8) return 'full'
  if (sourceCount >= 3) return 'three-quarter'
  if (sourceCount >= 2) return 'half'
  return fragmentCount >= 5 ? 'half' : 'quarter'
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Should the structural band be pulled down one step?
 *
 * `unverifiable` NEVER counts against. It records that no source was retained to check against —
 * true of every bundle import, and a property of the ingest path rather than of the evidence.
 * Conflating it with `failed` would penalise roughly half of production fragments for the route
 * they arrived by.
 *
 * While evidence backfills, a dimension with no evidence rows anywhere has had nothing measured,
 * so nothing is demoted — otherwise every pre-existing fragment would read as a failure.
 */
function shouldDemote(fragments: SupportFragment[]): boolean {
  const allRows = fragments.flatMap(f => f.evidence ?? [])
  if (allRows.length === 0) return false

  // A manual fragment (including the correction an edit creates) legitimately has no evidence:
  // it is the user speaking, so its absence is not a miss.
  const expected = fragments.filter(f => (f.sourceType ?? 'extraction') !== 'manual')
  const unsupported = expected.filter(f => {
    const rows = f.evidence ?? []
    if (rows.length === 0) return true
    return rows.some(r => r.verification === 'failed')
  })

  if (expected.length > 0 && unsupported.length * 2 > expected.length) return true

  return median(allRows.map(r => r.text?.length ?? 0)) < THIN_EVIDENCE_CHARS
}

/**
 * The ball's value for one dimension, from that dimension's active fragments.
 *
 * A dimension with any fragments never falls to `empty`: empty means "nothing here", and demoting
 * into it would read as a loss of material the user can see they supplied.
 */
export function computeDimensionSupport(fragments: SupportFragment[]): SupportLevel {
  if (fragments.length === 0) return 'empty'

  const band = supportBand(countSources(fragments), fragments.length)
  if (!shouldDemote(fragments)) return band

  const demoted = LEVELS[Math.max(0, LEVELS.indexOf(band) - 1)]
  return demoted === 'empty' ? 'quarter' : demoted
}
