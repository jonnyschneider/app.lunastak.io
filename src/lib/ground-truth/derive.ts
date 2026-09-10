/**
 * The ground-truth review's view model, derived from `GET /api/project/[id]/fragments` exactly as
 * it ships — no reshaping on the server.
 *
 * That was the claim design §16.6 made when it said the read surface must be *data-shaped, not
 * screen-shaped*: if the review is a pure front-end change, this file is the whole of it. It was
 * built against the real endpoint in the prototype and moved here unchanged, which is the evidence
 * that the claim held.
 *
 * Everything here is a pure function of the response. Nothing is asked of the model, nothing is
 * stored, and no score is invented — the split is arithmetic over evidence the producer already
 * had to cite (design §13: ask for the span, compute the rest).
 */
import { THIN_EVIDENCE_CHARS } from '@/lib/support/dimension-support'
import { TIER_1_DIMENSIONS, DIMENSION_CONTEXT, type Tier1Dimension } from '@/lib/constants/dimensions'

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
  /** The ingest this came from (`doc:<id>` | `bundle:<id>`), or null — see `review-batch.ts`. */
  reviewBatch?: string | null
  capturedAt: string
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
 *  - `failed`       the span did not match the source.
 *
 *      ⚠ TREAT WITH CARE — it is not reliably "the model made this up". The one `failed` span in
 *      the baseline project is a FALSE POSITIVE: the model wrote "I've seen some stuff…" where the
 *      transcript says "I have seen some stuff…". One contraction, 97 characters otherwise
 *      character-perfect. `normaliseForMatch` handles markdown, smart quotes and whitespace (§14's
 *      gotcha) but not contractions, so a faithful quote fails.
 *
 *      That is the same silent-tidying class as task 15-27 (`Teh role` → `The role` in a bundle),
 *      and it means `failed` currently mixes real fabrication with checker strictness. Until the
 *      verifier is fixed, it does not earn a marker in the user's face: telling someone "this
 *      doesn't match anything you gave me" about their own words is worse than saying nothing.
 *
 *  - `thin`         a real span, under the measured 40-char threshold.
 *
 * A fourth case is FILTERED OUT rather than shown — see `isLunaTalkingToItself`.
 */
export type WeakReason = 'no-evidence' | 'failed' | 'thin'

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
  /** Row-sized label. The full name is for the expanded view; a row only needs the path. */
  sourceShort: string
  /** Which ingest path — drives the row icon. */
  sourceKind: 'document' | 'conversation' | 'bundle' | 'manual'
  /**
   * The source record's id, when there is one to link to. Carried so a row can offer "read the
   * conversation this came from" — reading the exchange is often how a user decides whether a row
   * is worth keeping.
   */
  sourceId: string | null
  /** The ingest this row arrived in, so the review can be scoped to "what you just shared". */
  reviewBatch: string | null
  type: 'verbatim' | 'interpretation' | null
  dimensions: string[]
  /** The dimension the row is filed under. First tag wins; extraction lists them best-first. */
  dimension: string | null
  /** Human label for `dimension` — "Customer & Market", not CUSTOMER_MARKET. */
  dimensionLabel: string | null
  reviewed: boolean
  /** True when `claim` was derived from content because the fragment carries no usable title. */
  titleIsDerived: boolean
  weakReason: WeakReason | null
  /** Shown to the user. The system showing its working is the trust mechanism (design §5). */
  reason: string | null
}

const REASONS: Record<WeakReason, string | null> = {
  'no-evidence': 'No source text behind this one',
  /**
   * ⚠ DELIBERATELY SILENT, 2026-09-08. This used to read "This doesn't match anything you gave
   * me" — which the comment on `WeakReason` above already argues is worse than saying nothing,
   * because `failed` mixes real fabrication with checker strictness.
   *
   * Preview measured how bad the mix is: 5 failed spans on a real project, 3 of them Luna's own
   * turns and 2 the model eliding with "..." inside a span asked for as verbatim (`15-34`).
   * Zero fabrications. Telling a user their own words match nothing, on that hit rate, is a
   * false accusation the row cannot defend itself against.
   *
   * The row still SHOWS — it is prunable like any other, and its span renders with the
   * destructive rule. It simply makes no claim about why. Restore a sentence here when the
   * verifier handles elision and the verdict means what it says.
   */
  failed: null,
  thin: 'Only a few words to go on',
}

/**
 * ⚠ A BUG, SURFACED BY RUNNING THIS AGAINST REAL DATA — filtered here, to be fixed upstream.
 *
 * Conversation extraction reads the whole transcript, so it can build a "theme" entirely out of
 * LUNA's own turns. In the baseline project three of 35 fragments are exactly that, and one is a
 * restatement of a question Luna asked: *"Open question about how much effort is required per
 * manufacturer…"*. Every span on them is `sourceRole: 'assistant'`, so the user contributed
 * nothing — not even assent.
 *
 * Design §13 ruled that assistant SEEDING is not a defect: a framing Luna proposes and the user
 * confirms is normal consulting, and what matters is degree of assent. These have none. That is
 * the mechanical rule, and it is why this is a filter rather than a weak-set category: showing a
 * user their own context should not include Luna talking to itself.
 *
 * §13 recorded the same thing as a measurement caveat ("the judge pointed at the prompt that
 * elicited the answer") and treated it as an upper bound on a statistic. It is not only that — it
 * manufactures fragments. Task 15-29.
 */
export function isLunaTalkingToItself(f: {
  evidence: { sourceRole: string | null }[]
}): boolean {
  return f.evidence.length > 0 && f.evidence.every(e => e.sourceRole === 'assistant')
}

/**
 * ⚠ A tension is NOT a ground truth, so it does not belong in this review (Jonny, 2026-09-08).
 *
 * It is the skill's own reading ACROSS themes — a conclusion drawn in a conversation this app
 * never saw. It carries no verbatim span because it is not a quote, and asking it to cite one
 * would invite exactly the laundering §13 named. So it was landing in the weak set saying "I
 * couldn't find your own words behind this one", which reads as doubt about the CONTENT when it
 * is really an artefact of the bundle format having no shape for tensions at all.
 *
 * They stay as context — synthesis and generation read them like anything else. They are simply
 * not something to ask a user to verify. `contentType: 'tension'` is set by the import transform;
 * the title check covers rows imported before that change.
 */
export function isNotGroundTruth(f: { contentType: string; title: string | null }): boolean {
  return f.contentType === 'tension' || f.title?.trim() === 'Strategic tension'
}

/**
 * Is this a ground truth — something the user can be asked to verify?
 *
 * ⚠ THE ONE DEFINITION, USED ON BOTH SIDES OF THE WIRE. The review filtered these rows out while
 * every count in the app still included them, so the knowledgebase said 32 and the review showed
 * 24, and a single document upload could report "5 since last strategy" above three visible rows.
 * The user has no way to reconcile that, and the missing two are not theirs to reconcile: a bundle
 * tension is the skill's reading across themes, and a Luna turn is the assistant's own words.
 *
 * They remain SYSTEM CONTEXT — still stored, still fed to synthesis and generation, still counted
 * by the support model (§16.4, which is measured and must not move). They are simply not counted
 * at the user, because a number a user cannot account for is worse than a smaller true one.
 *
 * Structural parameters, not `ApiFragment`, so the API route can call it on Prisma rows.
 */
export function isGroundTruth(f: {
  contentType: string
  title: string | null
  evidence: { sourceRole: string | null }[]
}): boolean {
  return !isNotGroundTruth(f) && !isLunaTalkingToItself(f)
}

/**
 * Bundle `tensions` all arrive titled "Strategic tension" — the transform falls back to that
 * literal when the spec provides no `tensionTitle` (task 15-28). In a title-only scan list that is
 * six identical rows. Checked where they go: nothing downstream distinguishes a tension from any
 * other fragment, so they ARE live context feeding synthesis and generation, and their content is
 * substantive. So they get a readable label here rather than being hidden.
 *
 * ⚠ NEVER TRUNCATE. The first pass capped the derived label at 96 chars with an ellipsis, and on a
 * card where that label is the ONLY heading it reads as a sentence cut off mid-word — disorienting
 * exactly where the user is being asked to make a judgement. A row can wrap; a claim cannot be
 * half-shown. Where no real title exists, `titleIsDerived` tells the view to present the whole
 * claim rather than dressing a fragment of it up as a heading.
 */
function labelFor(f: ApiFragment): { claim: string; derived: boolean } {
  const t = f.title?.trim()
  if (t && t !== 'Strategic tension') return { claim: t, derived: false }
  return { claim: f.content.split(/ — |[.;] /)[0].trim(), derived: true }
}

/**
 * A fragment's source, named the way a user would recognise it — NOT the way the row is stored.
 * A conversation's `title` is its generated opening question, which ran to a full sentence in the
 * baseline and swamped the row it was labelling. Conversations get a stable number instead.
 */
/**
 * The expanded view's source line — as specific as the data allows.
 *
 * ⚠ For a bundle that is NOT the filename, because no filename is stored. `importBatchId` is a
 * bare UUID, the import dialog takes paste-or-file without capturing a name, and themes-mode
 * bundles carry no `sources` either (chunk-mode does). The import DATE is the most specific true
 * thing available, and it is at least enough to tell two imports apart. Task 15-31.
 */
function sourceName(f: ApiFragment, convIndex: Map<string, number>): string {
  if (f.source?.type === 'document') return f.source.name
  if (f.source?.type === 'conversation') {
    return f.source.name && f.source.name !== 'Untitled'
      ? f.source.name
      : `Conversation ${convIndex.get(f.source.id) ?? 1}`
  }
  if (f.sourceType === 'import') {
    const d = new Date(f.capturedAt)
    return `Context bundle · imported ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return 'Added directly'
}

function sourceKind(f: ApiFragment): GateItem['sourceKind'] {
  if (f.source?.type === 'document') return 'document'
  if (f.source?.type === 'conversation') return 'conversation'
  return f.sourceType === 'import' ? 'bundle' : 'manual'
}

/**
 * What a row shows. `2026-09-02-voice-memo-001.md` is 28 characters of mostly-noise on every row,
 * and it was forcing claims to wrap. A row only needs to say WHICH INGEST PATH this came from —
 * the exact filename is one tap away. Where a project has several documents the name is needed to
 * tell them apart, so it degrades to a truncated filename rather than an ambiguous "Document".
 */
function sourceShort(f: ApiFragment, convIndex: Map<string, number>, docCount: number): string {
  if (f.source?.type === 'conversation') return `Chat ${convIndex.get(f.source.id) ?? 1}`
  if (f.source?.type === 'document') {
    if (docCount <= 1) return 'Document'
    const base = f.source.name.replace(/\.[^.]+$/, '')
    return base.length > 16 ? `${base.slice(0, 15)}…` : base
  }
  return f.sourceType === 'import' ? 'Bundle' : 'Added'
}

function classify(f: ApiFragment): WeakReason | null {
  if (f.evidence.length === 0) return 'no-evidence'
  const usable = f.evidence.filter(e => e.verification !== 'failed')
  // Unsupported evidence beats thin evidence: evidence we cannot stand behind is the bigger claim
  // on the user's attention. (The all-assistant case never reaches here — it is filtered out.)
  if (usable.length === 0) return 'failed'
  // A fragment is thin on its STRONGEST span, not its shortest — one long span it can stand on is
  // not made weak by a short one sitting beside it.
  if (Math.max(...usable.map(e => e.text.length)) < THIN_EVIDENCE_CHARS) return 'thin'
  return null
}

/** Reuses the shipped taxonomy rather than a second copy of the labels. */
export function dimensionLabel(dim: string): string {
  return DIMENSION_CONTEXT[dim as Tier1Dimension]?.name ?? dim.replace(/_/g, ' ').toLowerCase()
}

export function toItem(f: ApiFragment, convIndex: Map<string, number> = new Map(), docCount = 1): GateItem {
  const weakReason = classify(f)
  const label = labelFor(f)
  const primary = f.dimensions[0]?.dimension ?? null
  // Show the strongest span we can stand behind; only fall back to a failed one when that is all
  // there is, and let `verification` carry the caveat rather than hiding it.
  const usable = f.evidence.filter(e => e.verification !== 'failed')
  const best = [...(usable.length ? usable : f.evidence)].sort((a, b) => b.text.length - a.text.length)[0]

  return {
    id: f.id,
    claim: label.claim,
    titleIsDerived: label.derived,
    detail: f.content,
    evidence: weakReason === 'no-evidence' ? null : best?.text ?? null,
    spans: f.evidence.length,
    verification: (best?.verification as GateItem['verification']) ?? null,
    sourceRole: best?.sourceRole ?? null,
    sourceName: sourceName(f, convIndex),
    sourceShort: sourceShort(f, convIndex, docCount),
    sourceKind: sourceKind(f),
    sourceId: f.source?.id ?? null,
    reviewBatch: f.reviewBatch ?? null,
    type: f.interpretationType,
    dimensions: f.dimensions.map(d => d.dimension),
    dimension: primary,
    dimensionLabel: primary ? dimensionLabel(primary) : null,
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
const CLASS_ORDER: Record<WeakReason, number> = { thin: 0, failed: 1, 'no-evidence': 2 }

export function orderWeak(items: GateItem[]): GateItem[] {
  return [...items].sort((a, b) => {
    const c = CLASS_ORDER[a.weakReason!] - CLASS_ORDER[b.weakReason!]
    if (c !== 0) return c
    if (a.type !== b.type) return a.type === 'interpretation' ? -1 : 1
    return (a.evidence?.length ?? 0) - (b.evidence?.length ?? 0)
  })
}

/**
 * The two sets need names the user can hold. "Skip the rest of these" was ambiguous — it meant the
 * rest of the flagged ones, and reads as "skip everything", which then dumps 25 more on someone who
 * thought they were done (Jonny, 2026-09-07). Naming them once here and referring to them by name
 * everywhere is what removes the ambiguity; no copy change to a single button could.
 */
export const SETS = {
  weak: 'Worth a look',
  confident: 'Well grounded',
} as const

/**
 * Group a list by dimension, in the taxonomy's own order so the gate reads in the same sequence as
 * the Knowledgebase coverage grid the user already knows.
 *
 * Why group at all: capture order makes 25 rows one undifferentiated run, and "is anything off
 * here?" is a 25-item question. By dimension it becomes five or six small ones, each in a single
 * frame of mind — the batching rationale from the retired preflight (§3), which survived its
 * interaction. An untagged remainder sorts last rather than being hidden.
 */
export interface DimensionGroup {
  dimension: string | null
  label: string
  items: GateItem[]
}

export function groupByDimension(items: GateItem[]): DimensionGroup[] {
  const order = [...TIER_1_DIMENSIONS] as string[]
  const groups = new Map<string | null, GateItem[]>()
  for (const it of items) {
    const k = it.dimension
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(it)
  }
  const rank = (d: string | null) => (d === null ? 999 : order.indexOf(d) === -1 ? 998 : order.indexOf(d))
  return Array.from(groups.entries())
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([dimension, list]) => ({
      dimension,
      label: dimension ? dimensionLabel(dimension) : 'Not filed anywhere',
      items: list,
    }))
}

export interface GateModel {
  total: number
  weak: GateItem[]
  confident: GateItem[]
  /** The one example the open screen leads with — best-evidenced, so it makes the strongest case. */
  example: GateItem | null
  /** Dropped before the user sees anything — Luna quoting itself. Prototype instrumentation. */
  filtered: number
  counts: Record<WeakReason, number>
}

/**
 * The one item the open screen leads with. It has to carry the whole case, so it needs a span long
 * enough to be convincing and short enough to read at a glance — Jonny, 2026-09-07: *"pick a strong
 * one, lean toward shorter"*. Sorted by distance from an ideal span length rather than by maximum,
 * which is what produced the five-line wall of quote on the first pass.
 */
const IDEAL_SPAN = 110

export function pickExample(confident: GateItem[]): GateItem | null {
  const withSpan = confident.filter(i => i.evidence && i.evidence.length >= THIN_EVIDENCE_CHARS)
  if (withSpan.length === 0) return confident[0] ?? null
  return [...withSpan].sort((a, b) =>
    Math.abs((a.evidence!.length) - IDEAL_SPAN) - Math.abs((b.evidence!.length) - IDEAL_SPAN)
  )[0]
}

/**
 * @param status which rows to model. `'active'` is the review itself.
 *
 * ⚠ `'archived'` EXISTS BECAUSE THE STATUS FILTER IS NOT OPTIONAL HERE. The recovery list feeds
 * this the `?status=archived` response, and with the filter hardcoded to active that returned an
 * empty model every time — so "N discarded · show" opened onto "Nothing to show" for as long as
 * it shipped (2026-09-08, caught the same day). A caller cannot fix it from outside, so it is a
 * parameter rather than a convention.
 */
export function buildGateModel(res: ApiResponse, status: 'active' | 'archived' = 'active'): GateModel {
  const active = res.fragments.filter(f => f.status === status)
  const usable = active.filter(f => !isLunaTalkingToItself(f) && !isNotGroundTruth(f))
  const filtered = active.length - usable.length
  // Number conversations in the order their fragments were captured, so the label is stable.
  const convIndex = new Map<string, number>()
  for (const f of usable) {
    if (f.source?.type === 'conversation' && !convIndex.has(f.source.id)) {
      convIndex.set(f.source.id, convIndex.size + 1)
    }
  }
  const docCount = new Set(
    usable.filter(f => f.source?.type === 'document').map(f => f.source!.id)
  ).size
  const items = usable.map(f => toItem(f, convIndex, docCount))
  const weak = orderWeak(items.filter(i => i.weakReason))
  const confident = items.filter(i => !i.weakReason)

  return {
    total: items.length,
    weak,
    confident,
    example: pickExample(confident),
    filtered,
    counts: {
      'no-evidence': weak.filter(i => i.weakReason === 'no-evidence').length,
      failed: weak.filter(i => i.weakReason === 'failed').length,
      thin: weak.filter(i => i.weakReason === 'thin').length,
    },
  }
}
