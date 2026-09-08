'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { getStatsigClient, logAndFlush } from '@/components/StatsigProvider'
import { cn } from '@/lib/utils'
import { InlineMarkdown } from '@/components/InlineMarkdown'
import { GroundTruthReview } from '@/components/ground-truth/GroundTruthReview'
import type { SupportLevel } from '@/lib/support/dimension-support'

/**
 * The two section headings inside the expanded panel. Filled, not ruled: the list already uses
 * ruled uppercase text for its dimension groups, and a heading has to outrank its own contents.
 *
 * ⚠ THE BAR OWNS THE LIST-LEVEL CONTROLS.
 *
 * "Refine this summary" and "N discarded" both used to float loose in the body — the first as a
 * row above the prose, the second between the explainer and the list, where it read as orphaned
 * (Jonny, 2026-09-08). They are not content; they act on the whole column, which is exactly what
 * the heading names. So each bar reads: what this is, its state in brackets, and what you can do
 * to it — with the doing on the right.
 *
 * Wraps rather than truncates: the summary's state can be a sentence, and a heading that hides
 * its own status to stay on one line is worse than one that takes two.
 */
const SECTION_HEADING =
  'mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground'
/** Inside a bar: normal weight, sentence case, and legible on the fill. */
const SECTION_HEADING_META = 'font-normal normal-case tracking-normal text-primary-foreground/75'
const SECTION_HEADING_ACTION =
  'ml-auto flex items-center gap-1 font-normal normal-case tracking-normal text-primary-foreground/75 transition-colors hover:text-primary-foreground'

/**
 * Both section headings stick under the panel's own sticky block, so the column you are working in
 * keeps saying which one it is.
 *
 * The offset cannot be a constant: the block above is the header rows PLUS the coverage grid, and
 * that grid reflows from five columns to three as the viewport narrows. So its height is measured
 * and published as a custom property — a guessed number would be right at one width and wrong at
 * every other. `md:` only, matching the block it hangs from.
 */
const SECTION_HEADING_STICKY = 'md:sticky md:top-[calc(3.5rem+var(--ks-head,0px))] md:z-20'

/** One option in the ground-truths filter row. */
function FilterChip({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn('rounded-full border px-2.5 py-1 text-[11px] transition-colors',
        active
          ? 'border-foreground/20 bg-foreground/10 font-medium text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  )
}

/**
 * One input count: number badge, label beside it.
 *
 * Stacked number-over-label was tried first and read as a dashboard the header did not want — four
 * two-line blocks make a quiet row into a panel of its own. Collapsed onto one line the counts sit
 * where they belong, as a caption under the title rather than a display above the content.
 *
 * An icon-and-number treatment was tried before that and rejected on sight: at this size the
 * glyphs carried nothing the label did not.
 */
function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
        accent ? 'bg-lunastak/15 text-lunastak' : 'bg-muted text-foreground')}>
        {value}
      </span>
      {/* Same colour as its number: greying the label made the pair read as two things. */}
      <span className={cn('text-[10px] uppercase tracking-wider',
        accent ? 'text-lunastak' : 'text-foreground')}>
        {label}
      </span>
    </span>
  )
}

// Dimension display names
const DIMENSION_LABELS: Record<Tier1Dimension, string> = {
  CUSTOMER_MARKET: 'Customer & Market',
  PROBLEM_OPPORTUNITY: 'Problem & Opportunity',
  VALUE_PROPOSITION: 'Value Proposition',
  DIFFERENTIATION_ADVANTAGE: 'Differentiation',
  COMPETITIVE_LANDSCAPE: 'Competition',
  BUSINESS_MODEL_ECONOMICS: 'Business Model',
  GO_TO_MARKET: 'Go-to-Market',
  PRODUCT_EXPERIENCE: 'Product & Experience',
  CAPABILITIES_ASSETS: 'Capabilities',
  RISKS_CONSTRAINTS: 'Risks & Constraints',
  STRATEGIC_INTENT: 'Strategic Intent',
}

/**
 * Five-state Harvey ball over computed support (design §16.4).
 *
 * The fill sweeps from the top anticlockwise — quarter is the bottom-left quadrant, half the left
 * half, three-quarter those plus the bottom-right — so each state visibly contains the one below.
 */
export function HarveyBall({ support }: { support: SupportLevel }) {
  const size = 14
  const radius = 6
  const cx = 7
  const cy = 7

  // Empty circle
  if (support === 'empty') {
    return (
      <svg data-support={support} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-muted-foreground/40">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }

  // Full circle
  if (support === 'full') {
    return (
      <svg data-support={support} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-luna">
        <circle cx={cx} cy={cy} r={radius} fill="currentColor" />
      </svg>
    )
  }

  // Wedge on an outline: quarter (bottom-left), half (left), three-quarter (all but top-right)
  const wedge =
    support === 'quarter'
      ? `M ${cx} ${cy} L ${cx} ${cy + radius} A ${radius} ${radius} 0 0 1 ${cx - radius} ${cy} Z`
      : support === 'half'
        ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 0 0 ${cx} ${cy + radius} Z`
        : `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy} L ${cx} ${cy} Z`

  return (
    <svg data-support={support} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-luna">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d={wedge} fill="currentColor" />
    </svg>
  )
}

/** Format a date as relative time (e.g. "2h ago", "3d ago") */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface KnowledgeSummaryPanelProps {
  fragmentCount: number
  chatCount: number
  documentCount: number
  /** Context bundles imported. A whole ingest path was invisible in this row without it. */
  importCount?: number
  strategyIsStale: boolean
  fragmentsSinceStrategy: number
  fragmentsSinceSummary: number
  knowledgeUpdatedAt: string | null
  knowledgeSummary: string | null
  /** Per-dimension fragment volume plus the computed support the ball reads (design §16.4). */
  dimensionalCoverage: Record<string, { fragmentCount: number; support: SupportLevel }>
  latestStrategyTraceId: string | null
  /**
   * What changed since the stack was generated. `comparable: false` means the snapshot predates
   * `DecisionStackSnapshot.fragmentIds`, so only additions are visible and the panel says less
   * rather than something it cannot stand behind.
   */
  /** Take the user to the Decision Stack this context built. */
  onOpenStrategy?: () => void
  strategySync?: {
    version: number | null
    added: number
    removed: number
    comparable: boolean
    builtAt: string | null
    addedIds: string[]
    removedIds: string[]
  }
  onRefreshClick: () => void
  /**
   * Fallback for hosts that cannot show the ground truths in place — demo mode, and anywhere
   * `projectId` is absent. When the list IS in place, a ball filters it instead of navigating.
   */
  onDimensionClick: (dimension: string) => void
  /**
   * Set to bring the ground truths INTO this panel. Design: `docs/_plans/2026-09-08-post-uat-batch.md`
   * §4. The coverage grid asks "how well covered is this dimension?" and the fragments behind it
   * answer "here is what that judgement is made of" — one thought, which was spanning two surfaces
   * and a sheet that took over the screen.
   */
  projectId?: string
  onResumeConversation?: (conversationId: string) => void
  /** Knowledge-side busy message (extraction, doc processing, syncing) */
  knowledgeBusyMessage?: string | null
  /** Strategy-side busy message (generation, refresh) — shown on RHS */
  strategyBusyMessage?: string | null
  /** Hide action links (e.g. demo mode) */
  readOnly?: boolean
  /** Optional class name for outer container (e.g. col-span control) */
  className?: string
}

export function KnowledgeSummaryPanel({
  fragmentCount,
  chatCount,
  documentCount,
  importCount = 0,
  strategyIsStale,
  fragmentsSinceStrategy,
  fragmentsSinceSummary,
  knowledgeUpdatedAt,
  knowledgeSummary,
  dimensionalCoverage,
  latestStrategyTraceId,
  strategySync,
  onOpenStrategy,
  onRefreshClick,
  onDimensionClick,
  projectId,
  onResumeConversation,
  knowledgeBusyMessage = null,
  strategyBusyMessage = null,
  readOnly = false,
  className,
}: KnowledgeSummaryPanelProps) {
  const knowledgeBusy = !!knowledgeBusyMessage
  const strategyBusy = !!strategyBusyMessage
  const isBusy = knowledgeBusy || strategyBusy
  const [isExpanded, setIsExpanded] = useState(false)
  const expandedAtRef = useRef<number | null>(null)

  const handleToggle = useCallback(() => {
    const willExpand = !isExpanded
    setIsExpanded(willExpand)

    if (willExpand) {
      expandedAtRef.current = Date.now()
      logAndFlush('kb_summary_viewed', 'knowledge-panel', {
        strategyIsStale: String(strategyIsStale),
        fragmentCount: String(fragmentCount),
      })
    }
  }, [isExpanded, strategyIsStale, fragmentCount])

  const handleRefreshClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    logAndFlush('cta_refresh_strategy', 'knowledge-panel')
    onRefreshClick()
  }, [onRefreshClick])

  /**
   * A ball is a FILTER when the list is in place, and a link only when it cannot be.
   *
   * Clicking the selected one clears it — the grid has no "all" affordance of its own and does not
   * need one, because the unfiltered list is the resting state.
   */
  const inPlace = !!projectId && !readOnly
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null)
  const [truthCounts, setTruthCounts] = useState<{ total: number; archived: number } | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  /** Showing only what changed since the stack was built. Cleared when a dimension is picked —
   *  two filters at once answers neither question. */
  const [changedOnly, setChangedOnly] = useState(false)
  const changedIds = strategySync
    ? [...strategySync.addedIds, ...strategySync.removedIds]
    : []
  const onTruthCount = useCallback((_r: number, total: number, archived: number) => {
    setTruthCounts({ total, archived })
  }, [])

  /**
   * ⚠ NO SCROLL-TO ON MOBILE, deliberately — it was tried and removed 2026-09-08.
   *
   * Tapping a ball used to scroll the list into view. It reads as jumpy, and worse, it leaves the
   * filter behind: the grid is not sticky on a small screen (eleven balls at two columns is six
   * rows, too much of the viewport to spend on chrome), so arriving at the list means the next
   * filter tap is a scroll back up.
   *
   * The fix is to shorten the distance rather than automate it — see the summary disclosure below.
   * With the summary folded away the grid and the list are adjacent, and nothing has to move.
   */
  const handleDimensionClick = useCallback((dimension: string) => {
    logAndFlush('cta_open_evidence', 'dimension-chip', { dimension })
    if (inPlace) {
      setChangedOnly(false)
      setSelectedDimension(d => (d === dimension ? null : dimension))
      return
    }
    onDimensionClick(dimension)
  }, [inPlace, onDimensionClick])

  /**
   * THE SUMMARY FOLDS AWAY, ON SMALL SCREENS ONLY.
   *
   * Stacked, the summary sits between the filter and the work — it is long, it is read once, and
   * after that it is distance. Folding it is what keeps the grid within reach of the list without
   * a second tab strip under the page's own (Jonny, 2026-09-08: a global nav toggle plus an
   * in-page toggle is the thing to avoid).
   *
   * Open by default, because the first visit should read it, and remembered per project, because
   * the second visit should not have to fold it again. Desktop never sees this — the two columns
   * put the summary beside the work rather than in front of it.
   */
  const headRef = useRef<HTMLDivElement | null>(null)
  const [headHeight, setHeadHeight] = useState(0)
  useEffect(() => {
    const el = headRef.current
    if (!el || !isExpanded) return
    const ro = new ResizeObserver(() => setHeadHeight(el.offsetHeight))
    ro.observe(el)
    setHeadHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [isExpanded])

  /**
   * The summary's state, in the heading's brackets — the mirror of the ground truths' count.
   *
   * Deliberately NOT worded with "insights": that word was just removed from the panel header for
   * disagreeing with the ground-truths count, and reintroducing it three lines below would put the
   * same two numbers back in conflict.
   */
  const remainingToUpdate = 15 - fragmentsSinceSummary
  const summaryStatus = fragmentsSinceSummary === 0
    ? 'up to date'
    : remainingToUpdate > 0
      ? `updates in ${remainingToUpdate}`
      : 'updating soon'

  /**
   * What the slot says, in words the user can act on.
   *
   * Version FIRST when there is one — "v3" is the anchor, and everything else is said relative to
   * it. A pre-`fragmentIds` snapshot cannot account for discards, so it claims nothing beyond the
   * version it can prove.
   */
  const sync = (() => {
    if (!latestStrategyTraceId) return null
    // "Stack v3", not "v3": the number alone names nothing, and this label's whole job is to
    // connect the context to the thing it built.
    const version = strategySync?.version ? `Stack v${strategySync.version}` : 'Decision Stack'
    if (!strategySync?.comparable) {
      // Pre-`fragmentIds` snapshot: it cannot account for discards, so it says WHEN rather than
      // from what. A bare version number is true and useless.
      const built = strategySync?.builtAt
        ? `built ${new Date(strategySync.builtAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
        : null
      const changed = strategyIsStale ? 'context has changed since' : null
      return { version, detail: [built, changed].filter(Boolean).join(' · ') || null, changed: false }
    }
    const { added, removed } = strategySync
    if (!added && !removed) {
      return { version, detail: `built from these ${fragmentCount} ground truths`, changed: false }
    }
    const parts: string[] = []
    if (added) parts.push(`${added} added`)
    if (removed) parts.push(`${removed} discarded`)
    return { version, detail: `${parts.join(', ')} since`, changed: true }
  })()

  const summaryKey = projectId ? `project-${projectId}-kb-summary-open` : null
  const [summaryOpen, setSummaryOpen] = useState(true)
  useEffect(() => {
    if (!summaryKey) return
    setSummaryOpen(localStorage.getItem(summaryKey) !== '0')
  }, [summaryKey])
  const toggleSummary = useCallback(() => {
    setSummaryOpen(o => {
      const next = !o
      if (summaryKey) localStorage.setItem(summaryKey, next ? '1' : '0')
      return next
    })
  }, [summaryKey])

  // Header timestamp
  const updatedLabel = knowledgeUpdatedAt
    ? `updated ${formatRelativeTime(knowledgeUpdatedAt)}`
    : null

  return (
    <div
      className={cn("border border-border rounded-lg bg-background", className)}
      style={{ ['--ks-head' as string]: `${headHeight}px` }}
    >
      {/*
        ⚠ THE BALLS ARE THE INSTRUMENT, so they stay put.
        Expanded, this panel does three jobs at once: it explains, it lets the summary be refined,
        and it lets the ground truths be pruned. The coverage grid is what joins them — it is the
        filter, and a filter that scrolls away is a filter you have to go back for. So the header
        and the grid are ONE sticky block, and the work scrolls under it.

        `md:` only: eleven balls at two columns is six rows, too much of a small screen to spend on
        chrome. On mobile they scroll away with everything else.

        The card cannot carry `overflow-hidden` for this — it clips a sticky child — so the top
        rounding moves onto this block.
      */}
      <div
        ref={headRef}
        className={cn(isExpanded && 'md:sticky md:top-14 z-30 rounded-t-lg border-b border-border bg-background')}
      >
      {/* Header Bar */}
      {/*
        ⚠ NOT A BUTTON AROUND EVERYTHING.
        This whole block used to be one <button>, which made the version un-linkable — you cannot
        nest a link or a button inside one — and had already produced invalid markup, since the
        Rebuild action sat inside it. Only the title row toggles now; the counts and the strategy
        slot are siblings, free to hold their own controls.
      */}
      <div className="flex w-full flex-col gap-2 px-4 py-3">
        {/* Row 1: title + strategy state */}
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            onClick={handleToggle}
            aria-expanded={isExpanded}
            className="-mx-1 flex items-center gap-2 rounded px-1 min-w-0 text-left transition-colors hover:bg-muted/50"
          >
            {/* Leading, not trailing: the control that opens the panel belongs at the start of the
                thing it opens, where the eye already is. */}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            {/* Same weight as Explore Next / Chats — it is a card heading, not a label. */}
            <span className={cn("text-base font-semibold", knowledgeBusy && "animate-pulse text-muted-foreground")}>
              {knowledgeBusy ? knowledgeBusyMessage : 'Summary and ground truths'}
            </span>
            {!knowledgeBusy && updatedLabel && (
              <span className="text-xs text-muted-foreground truncate">
                ({updatedLabel})
              </span>
            )}
          </button>

        </div>

        {/* Row 2: stats meta + strategy action */}
        {!isBusy && fragmentCount > 0 && (
          <div className="flex items-center justify-between gap-3">
            {/*
              THE INPUTS, AS A CAPTION. Three counts in one line of small grey text said what had
              gone in without ever making it look like anything. Badged, they can be picked out at
              a glance and still sit under the title rather than becoming a display of their
              own — see `Stat` for the two treatments tried and dropped on the way here.

              ⚠ NO INSIGHT COUNT HERE. It used to read "33 insights" directly above
              "Ground truths (24)" — two numbers for one thing, disagreeing, because the review
              filters what is not the user's to verify. These three are INPUTS: what you put in,
              which nothing downstream contradicts. The output count lives on its own heading.
            */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Stat value={chatCount} label={chatCount === 1 ? 'chat' : 'chats'} />
              <Stat value={documentCount} label={documentCount === 1 ? 'doc' : 'docs'} />
              {importCount > 0 && (
                <Stat value={importCount} label={importCount === 1 ? 'import' : 'imports'} />
              )}
              {strategyIsStale && fragmentsSinceStrategy > 0 && (
                <Stat value={fragmentsSinceStrategy} label="since last strategy" accent />
              )}
            </div>
            {/*
              ⚠ THIS SLOT NAMES THE RELATIONSHIP BETWEEN CONTEXT AND STACK.
              It used to say "Strategy in sync" or offer a button, off a boolean that could only
              see fragments ADDED since the last generation. It now reads the set the stack was
              actually built from, so it can say which version, and what has changed on both
              sides — which is the thing that teaches the user that the two are connected at all.
            */}
            <div className="flex shrink-0 items-center gap-3">
              {strategyBusy ? (
                <span className="animate-pulse text-xs text-muted-foreground">
                  {strategyBusyMessage}
                </span>
              ) : (
                <>
                  {sync && (
                    <span className="text-xs text-muted-foreground">
                      {/*
                        The version is a REFERENCE, so it behaves like one. Without this the label
                        names a Decision Stack the user cannot get to from the thing that built it,
                        which is the connection this line exists to make.
                      */}
                      {onOpenStrategy ? (
                        <button
                          onClick={onOpenStrategy}
                          className="font-medium text-foreground underline underline-offset-4 hover:text-lunastak"
                        >
                          {sync.version}
                        </button>
                      ) : (
                        <span className="font-medium text-foreground">{sync.version}</span>
                      )}
                      {sync.detail && (
                        <>
                          {' · '}
                          {/*
                            "3 added, 2 discarded" is a claim; this makes it checkable. Clicking it
                            filters the ground truths to exactly those — the added ones live, the
                            discarded ones in the recovery list — which answers "changed how?" in
                            the surface the user is already in, with no navigation.
                          */}
                          {sync.changed ? (
                            <button
                              onClick={() => { setIsExpanded(true); setChangedOnly(o => !o) }}
                              aria-pressed={changedOnly}
                              className={cn('underline underline-offset-4 hover:text-foreground',
                                changedOnly && 'font-medium text-foreground')}
                            >
                              {sync.detail}
                            </button>
                          ) : (
                            sync.detail
                          )}
                        </>
                      )}
                    </span>
                  )}
                  {strategyIsStale && (
                    <Button
                      size="sm"
                      onClick={handleRefreshClick}
                      className="h-7 bg-[#b18225] text-xs text-white hover:bg-[#9a7120]"
                    >
                      {latestStrategyTraceId ? 'Rebuild' : 'Create strategy'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

        {/* Expanded, the header rows need a floor — without it "Strategy in sync" hangs over the
            grid, belonging to neither. */}
        {isExpanded && <div className="mx-4 border-t border-border" />}

        {/* The filter. Lives in the sticky block, not in the scrolling body. */}
        {isExpanded && fragmentCount > 0 && (
          <div className="px-4 pb-3 pt-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
              {TIER_1_DIMENSIONS.map((dimension) => {
                // Computed support, not the synthesis self-report: the old input reached the ball
                // as a boolean before synthesis ran and flickered per run after it (design §16.3).
                const support = dimensionalCoverage[dimension]?.support ?? 'empty'

                const selected = selectedDimension === dimension
                return (
                  <button
                    key={dimension}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDimensionClick(dimension)
                    }}
                    aria-pressed={inPlace ? selected : undefined}
                    title={
                      inPlace
                        ? selected
                          ? 'Show all ground truths'
                          : `Show only ${DIMENSION_LABELS[dimension]}`
                        : undefined
                    }
                    /*
                      ⚠ THE HOVER HAS TO SAY "THIS FILTERS".
                      It was `hover:bg-muted/50` — a tint that reads as a hover highlight, which
                      every non-interactive row in the app also has. A user who does not already
                      know the grid is a filter has nothing here to tell them (Jonny, 2026-09-09).

                      So hover borrows the SELECTED treatment minus the commitment: same fill, label
                      to full strength, plus a ring the resting state does not have — a ring is the
                      app's control language, so it reads as a thing you press rather than a thing
                      you are merely over. The title names the actual outcome, because "it filters"
                      is learnable in one hover and never again needs saying.
                    */
                    className={cn(
                      'group flex items-center gap-2 rounded px-1 -mx-1 py-1 text-xs transition-all',
                      selected
                        ? 'bg-muted ring-1 ring-foreground/15'
                        : 'hover:bg-muted hover:ring-1 hover:ring-foreground/10')}
                  >
                    <HarveyBall support={support} />
                    <span className={cn('truncate transition-colors',
                      selected
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground group-hover:text-foreground')}>
                      {DIMENSION_LABELS[dimension]}
                    </span>
                  </button>
                )
              })}
            </div>
            </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-4">
          {/*
            TWO COLUMNS, because one column was wrong for both halves. The summary is small text
            run to the full width of a card that DOUBLES in width on expand — an unreadable
            measure — and the ground truths sat below the fold of it. Side by side, the prose gets
            a column it can be read in and the list sits next to the grid that filters it.
          */}
          <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            {/*
              ⚠ SECTION HEADINGS OUTRANK THE DIMENSION HEADINGS INSIDE THE LIST.
              Both were small uppercase muted text, so "GROUND TRUTHS" read as a peer of
              "PROBLEM & OPPORTUNITY" — a heading competing with its own contents. A filled bar at
              full-strength foreground puts them in different classes at a glance.

              The fold is mobile-only, but the HEADING is not — on desktop it is the column header
              the two columns were missing. So the element is always a button and simply stops
              being interactive at `md`, rather than being a different element per breakpoint.
            */}
            <div className={cn(SECTION_HEADING, SECTION_HEADING_STICKY)}>
              <button
                onClick={toggleSummary}
                aria-expanded={summaryOpen}
                // `uppercase` is re-declared because Tailwind's preflight sets `text-transform: none`
                // on `button`, so the bar's own uppercase does not reach a label inside one.
                className="flex items-center gap-1.5 uppercase md:pointer-events-none md:cursor-default"
              >
                <span>Summary</span>
                {knowledgeSummary && fragmentCount > 0 && (
                  <span className={SECTION_HEADING_META}>({summaryStatus})</span>
                )}
                {summaryOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0 md:hidden" />
                  : <ChevronDown className="h-4 w-4 shrink-0 md:hidden" />}
              </button>

              {/*
                ⚠ NO REFINE ACTION. The bar carried "✎ Refine", whose two options — Talk it through
                and Edit directly — were both fake doors, and Statsig has never recorded a single
                click on any fake door in the project. A control that cannot do its own job is
                worse than no control: it invites the user to try, and then tells them no.
              */}
            </div>

            <div className={cn('space-y-3', !summaryOpen && 'hidden md:block')}>
          {/* Knowledge Summary */}
          {knowledgeSummary ? (
            <p className="max-w-[68ch] text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              <InlineMarkdown text={knowledgeSummary} />
            </p>
          ) : fragmentCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Insights have been extracted from your inputs. Add more documents or start a conversation to go deeper.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Start a conversation to build context about your strategy.
            </p>
          )}

          </div>
          </div>

          <div>
          {/*
            ⚠ THE GROUND TRUTHS LIVE HERE NOW, not behind a sheet.
            Two things on preview pointed the same way (design §4): the dimension link read well —
            the ball is the summary and the list is what the summary is made of — and the sheet
            could not hold a second job, because following a fragment to its conversation replaced
            the very list the user was working.

            So this is an EXPANSION, not a navigation. The list mounts once with the panel open and
            the grid narrows it, which is why clicking through dimensions costs no fetch and never
            loses the user's place.
          */}
          {inPlace && fragmentCount > 0 && (
            <div>
              <div className={cn(SECTION_HEADING, SECTION_HEADING_STICKY)}>
                <span>
                  {changedOnly
                    ? `Changed since ${sync?.version ?? 'the last build'}`
                    : selectedDimension
                      ? DIMENSION_LABELS[selectedDimension as Tier1Dimension]
                      : 'Ground truths'}
                  {changedOnly ? (
                    <span className={cn('ml-1.5', SECTION_HEADING_META)}>({changedIds.length})</span>
                  ) : (
                    truthCounts && <span className={cn('ml-1.5', SECTION_HEADING_META)}>({truthCounts.total})</span>
                  )}
                </span>

                <div className={SECTION_HEADING_ACTION}>
                  {/* Only for the dimension filter. The changed/all pair has its own control
                      below; two ways to clear the same state is one too many. */}
                  {selectedDimension && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedDimension(null) }}
                      className="underline underline-offset-4"
                    >
                      Show all
                    </button>
                  )}
                  {/* Not in the diff: it already shows the discards, and "13 discarded" beside
                      "(1)" is two counts of different things a step apart. */}
                  {!changedOnly && !!truthCounts?.archived && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setArchivedOpen(o => !o) }}
                      aria-expanded={archivedOpen}
                      className={cn('flex items-center gap-1', selectedDimension && 'ml-2')}
                    >
                      {truthCounts.archived} discarded
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', archivedOpen && 'rotate-180')} />
                    </button>
                  )}
                </div>
              </div>

              {/*
                ⚠ THE EXPLAINER IS NOT DECORATION, AND IT LEADS. It came from the Launchpad gate,
                the only place it ever existed — without it the list arrives with nothing saying
                what it is or what to do with it. It carries the save model too, because there is
                no submit and a user expecting one should be told rather than left to infer.

                First, and in the same voice as the summary opposite: this column and that one are
                two halves of one panel, so they should read as though written by the same hand.
                An Alert box was tried here and was too heavy for one line of guidance.
              */}
              <p className="mb-3 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                {changedOnly
                  ? `What has changed since ${sync?.version ?? 'the last build'}. Rebuild to catch it up.`
                  : 'Everything your Decision Stack is built from. Discard any items that are wrong, you can restore anytime.'}
              </p>

              {/*
                ⚠ A FILTER, NOT A DEAD END. Arriving here from "1 discarded since" dropped the user
                into a filtered list with no visible way back and nothing saying they were in one —
                the deep link disoriented precisely because the view carried no control of its own.
                Two options, shown whenever there is a diff to see, so the state is legible whether
                the user chose it or was sent to it.

                Below the guidance and above the sections: it is the control the guidance has just
                explained, and the thing it acts on follows it.
              */}
              {sync?.changed && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <FilterChip active={!changedOnly} onClick={() => setChangedOnly(false)}>
                    All
                  </FilterChip>
                  <FilterChip active={changedOnly} onClick={() => setChangedOnly(true)}>
                    Changed since {sync.version}
                  </FilterChip>
                </div>
              )}
              <GroundTruthReview
                projectId={projectId!}
                dimension={changedOnly ? undefined : selectedDimension ?? undefined}
                idFilter={changedOnly ? changedIds : null}
                onResumeConversation={onResumeConversation}
                onCountChange={onTruthCount}
                archivedOpen={archivedOpen}
                onArchivedOpenChange={setArchivedOpen}
              />
            </div>
          )}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
