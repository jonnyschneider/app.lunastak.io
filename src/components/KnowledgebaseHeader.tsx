'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, ChevronUp, MessageCircle, ArrowRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'

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
function HarveyBall({ confidence }: { confidence: string }) {
  const size = 14
  const radius = 6
  const cx = 7
  const cy = 7

  const fillPercent = confidence === 'HIGH' ? 100 : confidence === 'MEDIUM' ? 50 : 0

  if (fillPercent === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-muted-foreground/40">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }

  if (fillPercent === 100) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-luna">
        <circle cx={cx} cy={cy} r={radius} fill="currentColor" />
      </svg>
    )
  }

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

interface DimensionalSynthesis {
  dimension: string
  confidence: string
  fragmentCount: number
}

interface KnowledgebaseHeaderProps {
  fragmentCount: number
  chatCount: number
  strategyIsStale: boolean
  knowledgeUpdatedAt: string | null
  knowledgeSummary: string | null
  dimensionalCoverage: Record<string, { fragmentCount: number; averageConfidence: number }>
  syntheses: DimensionalSynthesis[]
  latestStrategyTraceId: string | null
  onRefreshClick: () => void
  onChatClick: () => void
  onDimensionClick: (dimension: string) => void
  /** Whether generation is in progress */
  isGenerating?: boolean
  /** Whether knowledgebase is syncing after generation */
  isSyncing?: boolean
  /** Whether documents are being processed */
  isProcessingDocuments?: boolean
  /** Number of documents currently processing */
  processingDocumentCount?: number
}

export function KnowledgebaseHeader({
  fragmentCount,
  chatCount,
  strategyIsStale,
  knowledgeUpdatedAt,
  knowledgeSummary,
  dimensionalCoverage,
  syntheses,
  latestStrategyTraceId,
  onRefreshClick,
  onChatClick,
  onDimensionClick,
  isGenerating = false,
  isSyncing = false,
  isProcessingDocuments = false,
  processingDocumentCount = 0,
}: KnowledgebaseHeaderProps) {
  const isBusy = isGenerating || isSyncing || isProcessingDocuments
  const [isExpanded, setIsExpanded] = useState(false)
  const expandedAtRef = useRef<number | null>(null)

  const handleToggle = useCallback(() => {
    const willExpand = !isExpanded
    setIsExpanded(willExpand)

    if (willExpand) {
      expandedAtRef.current = Date.now()
      console.log('[Analytics] knowledge_panel_expanded', {
        strategyIsStale,
        fragmentCount,
      })
    }
  }, [isExpanded, strategyIsStale, fragmentCount])

  const handleRefreshClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // Measure dwell time from when knowledge was updated
    if (knowledgeUpdatedAt) {
      const dwellMs = Date.now() - new Date(knowledgeUpdatedAt).getTime()
      console.log('[Analytics] strategy_refresh_dwell_time', { dwellMs })
    }
    onRefreshClick()
  }, [knowledgeUpdatedAt, onRefreshClick])

  const handleChatClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    console.log('[Analytics] knowledge_panel_chat_clicked')
    onChatClick()
  }, [onChatClick])

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
      {/* Collapsed Header Bar */}
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
            {isGenerating
              ? 'adding knowledge and drafting strategy...'
              : isSyncing
              ? 'updating...'
              : isProcessingDocuments
              ? `processing ${processingDocumentCount > 1 ? `${processingDocumentCount} documents` : 'document'}...`
              : 'Knowledgebase'}
          </span>
          {!isBusy && updatedLabel && (
            <span className="text-xs text-muted-foreground">
              ({updatedLabel})
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          {!isBusy && fragmentCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>{fragmentCount} insight{fragmentCount !== 1 ? 's' : ''}</span>
              <span>&middot;</span>
              <span>{chatCount} chat{chatCount !== 1 ? 's' : ''}</span>
            </div>
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
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Knowledge Summary */}
          {knowledgeSummary ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {knowledgeSummary}
              </p>
            </div>
          ) : fragmentCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Luna has extracted insights from your inputs. Add more documents or start a conversation to go deeper.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Have conversations with Luna to build context about your strategy.
            </p>
          )}

          {/* "Want to talk about this?" link */}
          {fragmentCount > 0 && (
            <button
              onClick={handleChatClick}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Want to talk about this?
            </button>
          )}

          {/* Dimensions Grid */}
          {fragmentCount > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
                {TIER_1_DIMENSIONS.map((dimension) => {
                  const coverage = dimensionalCoverage[dimension]
                  const dimFragmentCount = coverage?.fragmentCount || 0
                  const synthesis = syntheses?.find(s => s.dimension === dimension)
                  const confidence = synthesis?.confidence || (dimFragmentCount > 0 ? 'MEDIUM' : 'LOW')

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
            </div>
          )}

          {/* Strategy staleness alert + CTA */}
          {!isBusy && fragmentCount > 0 && (
            <>
              {strategyIsStale && latestStrategyTraceId && (
                <div className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2.5">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    This summary hasn&apos;t been applied to your strategy yet.
                  </p>
                </div>
              )}

              {strategyIsStale ? (
                <Button
                  onClick={handleRefreshClick}
                  className="w-full"
                >
                  Create strategy from this
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : latestStrategyTraceId ? (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Link href={`/strategy/${latestStrategyTraceId}`}>
                      Your Strategy
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}
