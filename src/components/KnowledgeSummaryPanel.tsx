'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, MessageCircle, ArrowRight, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { getStatsigClient, logAndFlush } from '@/components/StatsigProvider'
import { cn } from '@/lib/utils'
import { InlineMarkdown } from '@/components/InlineMarkdown'
import { GroundTruthReview } from '@/components/ground-truth/GroundTruthReview'
import type { SupportLevel } from '@/lib/support/dimension-support'

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
  /** Notify parent when expanded state changes (so parent can adjust layout) */
  onExpandedChange?: (expanded: boolean) => void
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
  onExpandedChange,
}: KnowledgeSummaryPanelProps) {
  const knowledgeBusy = !!knowledgeBusyMessage
  const strategyBusy = !!strategyBusyMessage
  const isBusy = knowledgeBusy || strategyBusy
  const [isExpanded, setIsExpanded] = useState(false)
  const expandedAtRef = useRef<number | null>(null)

  const handleToggle = useCallback(() => {
    const willExpand = !isExpanded
    setIsExpanded(willExpand)
    onExpandedChange?.(willExpand)

    if (willExpand) {
      expandedAtRef.current = Date.now()
      logAndFlush('kb_summary_viewed', 'knowledge-panel', {
        strategyIsStale: String(strategyIsStale),
        fragmentCount: String(fragmentCount),
      })
    }
  }, [isExpanded, strategyIsStale, fragmentCount, onExpandedChange])

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
  const onTruthCount = useCallback((_r: number, total: number, archived: number) => {
    setTruthCounts({ total, archived })
  }, [])

  const handleDimensionClick = useCallback((dimension: string) => {
    logAndFlush('cta_open_evidence', 'dimension-chip', { dimension })
    if (inPlace) {
      setSelectedDimension(d => (d === dimension ? null : dimension))
      return
    }
    onDimensionClick(dimension)
  }, [inPlace, onDimensionClick])

  // Header timestamp
  const updatedLabel = knowledgeUpdatedAt
    ? `updated ${formatRelativeTime(knowledgeUpdatedAt)}`
    : null

  return (
    <div className={cn("border border-border rounded-lg bg-background", className)}>
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
      <div className={cn(isExpanded && 'md:sticky md:top-14 z-30 rounded-t-lg border-b border-border bg-background')}>
      {/* Header Bar */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex flex-col gap-2 hover:bg-muted/50 transition-colors text-left"
      >
        {/* Row 1: title + strategy action + chevron */}
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <span className={cn("font-medium text-sm", knowledgeBusy && "animate-pulse text-muted-foreground")}>
              {knowledgeBusy ? knowledgeBusyMessage : 'Knowledge Summary'}
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
              <span>&middot;</span>
              <span>{fragmentCount} insight{fragmentCount !== 1 ? 's' : ''}</span>
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

        {/* The filter. Lives in the sticky block, not in the scrolling body. */}
        {isExpanded && fragmentCount > 0 && (
          <div className="px-4 pb-3">
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
          {/* Heading row: Refine popover + countdown */}
          {knowledgeSummary && fragmentCount > 0 && (
            <div className="flex items-baseline gap-1.5 text-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="font-medium hover:text-muted-foreground transition-colors inline-flex items-center gap-1">
                    <Pencil className="h-3 w-3" />
                    Refine this summary
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-44 p-1">
                  <button
                    onClick={handleChatClick}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    Talk it through
                  </button>
                  <button
                    onClick={handleEditClick}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    Edit directly
                  </button>
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">
                {fragmentsSinceSummary === 0
                  ? '· up to date'
                  : `· ${15 - fragmentsSinceSummary > 0 ? `${15 - fragmentsSinceSummary} more insights 'til next auto-update` : 'auto-updating soon'}`}
              </span>
            </div>
          )}

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
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {selectedDimension
                    ? DIMENSION_LABELS[selectedDimension as Tier1Dimension]
                    : `Ground truths${truthCounts ? ` · ${truthCounts.total}` : ''}`}
                </h4>
                {selectedDimension && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedDimension(null) }}
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Show all
                  </button>
                )}
              </div>
              <GroundTruthReview
                projectId={projectId!}
                dimension={selectedDimension ?? undefined}
                onResumeConversation={onResumeConversation}
                onCountChange={onTruthCount}
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
