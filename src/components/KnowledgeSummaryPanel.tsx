'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, MessageCircle, ArrowRight, Pencil, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { getStatsigClient, logAndFlush } from '@/components/StatsigProvider'
import { cn } from '@/lib/utils'
import { InlineMarkdown } from '@/components/InlineMarkdown'
import { GroundTruthReview } from '@/components/ground-truth/GroundTruthReview'
import type { SupportLevel } from '@/lib/support/dimension-support'

/**
 * The two section headings inside the expanded panel. Filled, not ruled: the list already uses
 * ruled uppercase text for its dimension groups, and a heading has to outrank its own contents.
 */
/**
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
  strategyIsStale: boolean
  fragmentsSinceStrategy: number
  fragmentsSinceSummary: number
  knowledgeUpdatedAt: string | null
  knowledgeSummary: string | null
  /** Per-dimension fragment volume plus the computed support the ball reads (design §16.4). */
  dimensionalCoverage: Record<string, { fragmentCount: number; support: SupportLevel }>
  latestStrategyTraceId: string | null
  onRefreshClick: () => void
  onChatClick: () => void
  onEditClick: () => void
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
  strategyIsStale,
  fragmentsSinceStrategy,
  fragmentsSinceSummary,
  knowledgeUpdatedAt,
  knowledgeSummary,
  dimensionalCoverage,
  latestStrategyTraceId,
  onRefreshClick,
  onChatClick,
  onEditClick,
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

  const handleChatClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onChatClick()
  }, [onChatClick])

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEditClick()
  }, [onEditClick])

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
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex flex-col gap-2 hover:bg-muted/50 transition-colors text-left"
      >
        {/* Row 1: title + strategy action + chevron */}
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <span className={cn("font-medium text-sm", knowledgeBusy && "animate-pulse text-muted-foreground")}>
              {knowledgeBusy ? knowledgeBusyMessage : 'Summary and ground truths'}
            </span>
            {!knowledgeBusy && updatedLabel && (
              <span className="text-xs text-muted-foreground truncate">
                ({updatedLabel})
              </span>
            )}
          </div>

          <div className="flex items-center shrink-0">
            {/* Chevron */}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Row 2: stats meta + strategy action */}
        {!isBusy && fragmentCount > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{chatCount} chat{chatCount !== 1 ? 's' : ''}</span>
              <span>&middot;</span>
              <span>{documentCount} doc{documentCount !== 1 ? 's' : ''}</span>
              {/*
                ⚠ NO INSIGHT COUNT HERE. It used to read "33 insights" directly above
                "Ground truths (24)" — two numbers for the same thing, disagreeing, because the
                review filters what is not the user's to verify. Side by side on different screens
                that was defensible; stacked in one panel it reads as a bug. The panel now states
                the number it can stand behind, once, next to the list it counts.
              */}
              {strategyIsStale && fragmentsSinceStrategy > 0 && (
                <>
                  <span>&middot;</span>
                  <span className="font-medium text-lunastak dark:text-lunastak">
                    {fragmentsSinceStrategy} since last strategy
                  </span>
                </>
              )}
            </div>
            <div className="shrink-0">
              {strategyBusy ? (
                <span className="text-xs text-muted-foreground animate-pulse">
                  {strategyBusyMessage}
                </span>
              ) : strategyIsStale ? (
                <Button
                  size="sm"
                  onClick={handleRefreshClick}
                  className="h-7 text-xs bg-[#b18225] hover:bg-[#9a7120] text-white"
                >
                  Create strategy
                </Button>
              ) : latestStrategyTraceId ? (
                <span className="text-xs text-muted-foreground">
                  Strategy in sync
                </span>
              ) : null}
            </div>
          </div>
        )}
      </button>

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
                    className={cn(
                      'flex items-center gap-2 py-1 text-xs rounded px-1 -mx-1 transition-colors',
                      selected ? 'bg-muted' : 'hover:bg-muted/50')}
                  >
                    <HarveyBall support={support} />
                    <span className={cn('truncate', selected ? 'text-foreground font-medium' : 'text-muted-foreground')}>
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
                className="flex items-center gap-1.5 md:pointer-events-none md:cursor-default"
              >
                <span>Summary</span>
                {knowledgeSummary && fragmentCount > 0 && (
                  <span className={SECTION_HEADING_META}>({summaryStatus})</span>
                )}
                {summaryOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0 md:hidden" />
                  : <ChevronDown className="h-4 w-4 shrink-0 md:hidden" />}
              </button>

              {knowledgeSummary && fragmentCount > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={SECTION_HEADING_ACTION} aria-label="Refine this summary">
                      <Pencil className="h-3 w-3" />
                      Refine
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-44 p-1">
                    <button
                      onClick={handleChatClick}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      Talk it through
                    </button>
                    <button
                      onClick={handleEditClick}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      Edit directly
                    </button>
                  </PopoverContent>
                </Popover>
              )}
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
                  {selectedDimension
                    ? DIMENSION_LABELS[selectedDimension as Tier1Dimension]
                    : 'Ground truths'}
                  {truthCounts && <span className={cn('ml-1.5', SECTION_HEADING_META)}>({truthCounts.total})</span>}
                </span>

                <div className={SECTION_HEADING_ACTION}>
                  {selectedDimension && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedDimension(null) }}
                      className="underline underline-offset-4"
                    >
                      Show all
                    </button>
                  )}
                  {!!truthCounts?.archived && (
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
                ⚠ THE EXPLAINER IS NOT DECORATION. Moved here from the Launchpad gate, which is the
                only place it ever existed — so on this surface the list arrived with nothing saying
                what it was or what to do with it. It also carries the save model, because there is
                no submit and a user who expects one needs telling, not guessing.
              */}
              <Alert className="mb-3 mt-2 py-2.5">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
                  Everything your vision, strategy and objectives get built from. Discard anything
                  wrong — it saves straight away, and you can bring it back from the count above.
                </AlertDescription>
              </Alert>
              <GroundTruthReview
                projectId={projectId!}
                dimension={selectedDimension ?? undefined}
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
