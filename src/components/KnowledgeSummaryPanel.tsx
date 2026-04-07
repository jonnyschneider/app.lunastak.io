'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, ChevronUp, MessageCircle, ArrowRight, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { getStatsigClient, logAndFlush } from '@/components/StatsigProvider'

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

// Harvey ball for confidence visualization
function HarveyBall({ confidence }: { confidence: string | null }) {
  const size = 14
  const radius = 6
  const cx = 7
  const cy = 7

  // null/no fragments = empty, LOW = quarter, MEDIUM = half, HIGH/MEDIUM-HIGH = full
  const level = !confidence ? 0
    : confidence === 'LOW' ? 1
    : confidence === 'MEDIUM' ? 2
    : 3 // HIGH, MEDIUM-HIGH

  // Empty circle
  if (level === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-muted-foreground/40">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }

  // Full circle
  if (level === 3) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-luna">
        <circle cx={cx} cy={cy} r={radius} fill="currentColor" />
      </svg>
    )
  }

  // Half circle (left half filled)
  if (level === 2) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-luna">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d={`M ${cx} ${cy - radius} A ${radius} ${radius} 0 0 0 ${cx} ${cy + radius} Z`}
          fill="currentColor"
        />
      </svg>
    )
  }

  // Quarter circle (bottom-left quadrant filled)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-luna">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d={`M ${cx} ${cy} L ${cx} ${cy + radius} A ${radius} ${radius} 0 0 1 ${cx - radius} ${cy} Z`}
        fill="currentColor"
      />
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

/** Render inline markdown: **bold** */
function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

interface DimensionalSynthesis {
  dimension: string
  confidence: string
  fragmentCount: number
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
  dimensionalCoverage: Record<string, { fragmentCount: number; averageConfidence: number }>
  syntheses: DimensionalSynthesis[]
  latestStrategyTraceId: string | null
  onRefreshClick: () => void
  onChatClick: () => void
  onEditClick: () => void
  onDimensionClick: (dimension: string) => void
  /** Knowledge-side busy message (extraction, doc processing, syncing) */
  knowledgeBusyMessage?: string | null
  /** Strategy-side busy message (generation, refresh) — shown on RHS */
  strategyBusyMessage?: string | null
  /** Hide action links (e.g. demo mode) */
  readOnly?: boolean
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
  syntheses,
  latestStrategyTraceId,
  onRefreshClick,
  onChatClick,
  onEditClick,
  onDimensionClick,
  knowledgeBusyMessage = null,
  strategyBusyMessage = null,
  readOnly = false,
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
    logAndFlush('pro_upgrade_click', 'knowledge-chat')
    onChatClick()
  }, [onChatClick])

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    logAndFlush('pro_upgrade_click', 'knowledge-edit')
    onEditClick()
  }, [onEditClick])

  const handleDimensionClick = useCallback((dimension: string) => {
    console.log('[Analytics] knowledge_panel_dimension_clicked', { dimension })
    onDimensionClick(dimension)
  }, [onDimensionClick])

  // Header timestamp
  const updatedLabel = knowledgeUpdatedAt
    ? `updated ${formatRelativeTime(knowledgeUpdatedAt)}`
    : null

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header Bar */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Image
            src="/animated-logo-glitch.svg"
            alt=""
            width={16}
            height={16}
            className={isBusy ? 'animate-pulse' : ''}
          />
          <span className="font-medium text-sm">
            {knowledgeBusy ? knowledgeBusyMessage : 'Knowledgebase'}
          </span>
          {!knowledgeBusy && updatedLabel && (
            <span className="hidden md:inline text-xs text-muted-foreground">
              ({updatedLabel})
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Stats + strategy status */}
          {!isBusy && fragmentCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="hidden md:inline">{chatCount} chat{chatCount !== 1 ? 's' : ''}</span>
              <span className="hidden md:inline">&middot;</span>
              <span className="hidden md:inline">{documentCount} doc{documentCount !== 1 ? 's' : ''}</span>
              <span className="hidden md:inline">&middot;</span>
              <span>{fragmentCount} insight{fragmentCount !== 1 ? 's' : ''}</span>
              {strategyIsStale && fragmentsSinceStrategy > 0 && (
                <>
                  <span className="hidden md:inline">&middot;</span>
                  <span className="hidden md:inline font-medium text-lunastak dark:text-lunastak">
                    {fragmentsSinceStrategy} since last strategy
                  </span>
                </>
              )}
            </div>
          )}

          {/* Strategy action — RHS */}
          {strategyBusy ? (
            <span className="text-sm text-muted-foreground animate-pulse">
              {strategyBusyMessage}
            </span>
          ) : fragmentCount > 0 && (
            strategyIsStale ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleRefreshClick}
                  className="h-7 text-xs bg-[#b18225] hover:bg-[#9a7120] text-white"
                >
                  Create strategy
                </Button>
              </div>
            ) : latestStrategyTraceId ? (
              <span className="text-xs text-muted-foreground">
                Strategy in sync
              </span>
            ) : null
          )}

          {/* Chevron */}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-4 space-y-3">
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
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              <InlineMarkdown text={knowledgeSummary} />
            </p>
          ) : fragmentCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Luna has extracted insights from your inputs. Add more documents or start a conversation to go deeper.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Have conversations with Luna to build context about your strategy.
            </p>
          )}

          {/* Dimensions Grid */}
          {fragmentCount > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
              {TIER_1_DIMENSIONS.map((dimension) => {
                const coverage = dimensionalCoverage[dimension]
                const dimFragmentCount = coverage?.fragmentCount || 0
                const synthesis = syntheses?.find(s => s.dimension === dimension)
                const confidence = synthesis?.confidence || (dimFragmentCount > 0 ? 'MEDIUM' : null)

                return (
                  <button
                    key={dimension}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDimensionClick(dimension)
                    }}
                    className="flex items-center gap-2 py-1 text-xs hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                  >
                    <HarveyBall confidence={confidence} />
                    <span className="text-muted-foreground truncate">
                      {DIMENSION_LABELS[dimension]}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
