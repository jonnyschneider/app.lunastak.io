'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
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
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-green-600">
        <circle cx={cx} cy={cy} r={radius} fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-green-600">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d={`M ${cx} ${cy - radius} A ${radius} ${radius} 0 0 0 ${cx} ${cy + radius} Z`}
        fill="currentColor"
      />
    </svg>
  )
}

interface DimensionalSynthesis {
  dimension: string
  confidence: string
  fragmentCount: number
}

interface LunasMemoryHeaderProps {
  fragmentCount: number
  chatCount: number
  docCount: number
  coveragePercentage: number
  newInsightsCount: number
  knowledgeSummary: string | null
  dimensionalCoverage: Record<string, { fragmentCount: number; averageConfidence: number }>
  syntheses: DimensionalSynthesis[]
  onNewInsightsClick: () => void
}

export function LunasMemoryHeader({
  fragmentCount,
  chatCount,
  coveragePercentage,
  newInsightsCount,
  knowledgeSummary,
  dimensionalCoverage,
  syntheses,
  onNewInsightsClick,
}: LunasMemoryHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleNewInsightsClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (newInsightsCount > 0) {
      onNewInsightsClick()
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Collapsed Header Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-green-600" />
          <span className="font-medium text-sm">Luna&apos;s Memory</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats - muted */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{fragmentCount} insights</span>
            <span>•</span>
            <span>{chatCount} chats</span>
            <span>•</span>
            <span>{coveragePercentage}%</span>
          </div>

          {/* New insights - highlighted if present */}
          {newInsightsCount > 0 ? (
            <button
              onClick={handleNewInsightsClick}
              className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 hover:underline"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>{newInsightsCount} new to include</span>
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">Up to date</span>
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
              <h4 className="text-sm font-medium">What Luna Knows</h4>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {knowledgeSummary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Have conversations with Luna to build context about your strategy.
            </p>
          )}

          {/* Dimensions Grid - Compact 2-row layout */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Strategic Dimensions</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
              {TIER_1_DIMENSIONS.map((dimension) => {
                const coverage = dimensionalCoverage[dimension]
                const dimFragmentCount = coverage?.fragmentCount || 0
                const synthesis = syntheses?.find(s => s.dimension === dimension)
                const confidence = synthesis?.confidence || (dimFragmentCount > 0 ? 'MEDIUM' : 'LOW')

                return (
                  <div
                    key={dimension}
                    className="flex items-center gap-2 py-1 text-xs"
                  >
                    <HarveyBall confidence={confidence} />
                    <span className="text-muted-foreground truncate">
                      {DIMENSION_LABELS[dimension]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
