/**
 * PROTOTYPE: the gate's view model, derived from the REAL read surface.
 *
 * Input is `GET /api/project/[id]/fragments` exactly as it ships — no fixture, no reshaping on the
 * server. That is the claim design §16.6 made when it said the read surface must be *data-shaped,
 * not screen-shaped*: if the gate is a pure front-end change, this file is the whole of it.
 *
 * Everything here is a pure function of the response. Nothing is asked of the model, nothing is
 * stored, and no score is invented — the split is arithmetic over evidence the producer already
 * had to cite (design §13: ask for the span, compute the rest).
 */
import { THIN_EVIDENCE_CHARS } from '@/lib/support/dimension-support'

/** One fragment, exactly as the fragments route returns it. */
export interface ApiFragment {
  id: string
  title: string | null
  content: string
  contentType: string
  status: string
  sourceType: string | null
  interpretationType: 'verbatim' | 'interpretation' | null
  reviewedAt: string | null
  dimensions: { dimension: string; confidence: string | null }[]
  source: { type: 'conversation' | 'document'; id: string; name: string } | null
  evidence: { text: string; verification: string; sourceRole: string | null; ordinal: number }[]
}

export interface ApiResponse {
  fragments: ApiFragment[]
  total: number
  activeCount: number
  archivedCount: number
}

/**
 * Why a fragment is in the weak set. These are NOT interchangeable, and merging them is the
 * mistake the first prototype made: each has a different cause, a different honest sentence, and
 * a different life expectancy.
 *
 *  - `no-evidence`  pre-change fragments, and the bundle `tensions` that arrive titleless. There is
 *                   no backfill (task 15-23), so this is the largest weak class today and shrinks
 *                   to nothing over time. It can show the user NOTHING.
 *  - `unsaid`       the span verified against the ASSISTANT's turns, not the user's — correct
 *                   behaviour per commit 0b60f9e, and NOT a fabrication. Luna is quoting itself.
 *  - `failed`        the span matches nothing in the source. A fabricated near-quote.
 *  - `thin`         a real span, under the measured 40-char threshold.
 */
export type WeakReason = 'no-evidence' | 'failed' | 'unsaid' | 'thin'

export interface GateItem {
  id: string
  claim: string
  detail: string
  /** The span we would show. Null when there is nothing to show — which is itself the finding. */
  evidence: string | null
  spans: number
  verification: 'verified' | 'unverifiable' | 'failed' | null
  sourceRole: string | null
  sourceName: string
  type: 'verbatim' | 'interpretation' | null
  dimensions: string[]
  reviewed: boolean
  weakReason: WeakReason | null
  /** Shown to the user. The system showing its working is the trust mechanism (design §5). */
  reason: string | null
}

/**
 * ⚠ FOUND BY RUNNING THIS AGAINST REAL DATA. `failed` was one bucket showing one sentence, and the
 * baseline project put two completely different failures behind it, indistinguishable on screen:
 * a span Luna quoted from its OWN turn, and a span the model invented outright. `sourceRole` has
 * always separated them and nothing was reading it. They deserve different sentences because they
 * are different admissions — one is "I said that, not you", the other is "I made that up".
 */
const REASONS: Record<WeakReason, string> = {
  'no-evidence': "I couldn't find your own words behind this one",
  unsaid: 'These are my words, not yours — you agreed rather than said it',
  failed: "This doesn't match anything you gave me",
  thin: 'Only a few words to go on',
}

/** A fragment's own source, named the way a user would recognise it. */
function sourceName(f: ApiFragment): string {
  if (f.source) return f.source.name
  return f.sourceType === 'import' ? 'Context bundle' : 'Added directly'
}

function classify(f: ApiFragment): WeakReason | null {
  if (f.evidence.length === 0) return 'no-evidence'
  const usable = f.evidence.filter(e => e.verification !== 'failed')
  // Unsupported evidence beats thin evidence: evidence we cannot stand behind is the bigger claim
  // on the user's attention. Within that, WHY it failed decides which of the two we admit to.
  if (usable.length === 0) {
    return f.evidence.every(e => e.sourceRole === 'assistant') ? 'unsaid' : 'failed'
  }
  // A fragment is thin on its STRONGEST span, not its shortest — one long span it can stand on is
  // not made weak by a short one sitting beside it.
  if (Math.max(...usable.map(e => e.text.length)) < THIN_EVIDENCE_CHARS) return 'thin'
  return null
}

export function toItem(f: ApiFragment): GateItem {
  const weakReason = classify(f)
  // Show the strongest span we can stand behind; only fall back to a failed one when that is all
  // there is, and let `verification` carry the caveat rather than hiding it.
  const usable = f.evidence.filter(e => e.verification !== 'failed')
  const best = [...(usable.length ? usable : f.evidence)].sort((a, b) => b.text.length - a.text.length)[0]

  return {
    id: f.id,
    claim: f.title?.trim() || f.content.slice(0, 90),
    detail: f.content,
    evidence: weakReason === 'no-evidence' ? null : best?.text ?? null,
    spans: f.evidence.length,
    verification: (best?.verification as GateItem['verification']) ?? null,
    sourceRole: best?.sourceRole ?? null,
    sourceName: sourceName(f),
    type: f.interpretationType,
    dimensions: f.dimensions.map(d => d.dimension),
    reviewed: f.reviewedAt !== null,
    weakReason,
    reason: weakReason ? REASONS[weakReason] : null,
  }
}

/**
 * §6 of the interaction design: ordering IS the persuasion — interpretations before verbatims,
 * thinnest evidence first, so the most-likely-wrong item lands first by construction.
 *
 * ⚠ CORRECTED AGAINST REAL DATA. Applied literally, that rule sorts the items with NO evidence to
 * the front — so the first card the user ever sees is the one where we can show them nothing. §4
 * promises to prove the reading before asking anything; §6 as written makes that impossible.
 *
 * So the classes are ordered by what we can actually put on screen: `thin` and `failed` lead
 * (both carry a real span the user can react to), and `no-evidence` goes last. Within a class,
 * §6 applies unchanged.
 */
const CLASS_ORDER: Record<WeakReason, number> = { thin: 0, failed: 1, unsaid: 2, 'no-evidence': 3 }

export function orderWeak(items: GateItem[]): GateItem[] {
  return [...items].sort((a, b) => {
    const c = CLASS_ORDER[a.weakReason!] - CLASS_ORDER[b.weakReason!]
    if (c !== 0) return c
    if (a.type !== b.type) return a.type === 'interpretation' ? -1 : 1
    return (a.evidence?.length ?? 0) - (b.evidence?.length ?? 0)
  })
}

export interface GateModel {
  total: number
  weak: GateItem[]
  confident: GateItem[]
  /** The one example the open screen leads with — best-evidenced, so it makes the strongest case. */
  example: GateItem | null
  counts: Record<WeakReason, number>
}

export function buildGateModel(res: ApiResponse): GateModel {
  const items = res.fragments.filter(f => f.status === 'active').map(toItem)
  const weak = orderWeak(items.filter(i => i.weakReason))
  const confident = items.filter(i => !i.weakReason)

  return {
    total: items.length,
    weak,
    confident,
    example: [...confident].sort((a, b) => (b.evidence?.length ?? 0) - (a.evidence?.length ?? 0))[0] ?? null,
    counts: {
      'no-evidence': weak.filter(i => i.weakReason === 'no-evidence').length,
      failed: weak.filter(i => i.weakReason === 'failed').length,
      unsaid: weak.filter(i => i.weakReason === 'unsaid').length,
      thin: weak.filter(i => i.weakReason === 'thin').length,
    },
  }
}
