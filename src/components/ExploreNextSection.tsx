'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemSeparator,
} from '@/components/ui/item'
import { Zap, Puzzle, Crosshair, X, Plus } from 'lucide-react'
import { StructuredProvocation } from '@/lib/types'
import { Tier1Dimension } from '@/lib/constants/dimensions'

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

type ExploreItemType = 'deep-dive' | 'provocation' | 'gap'

interface ExploreItem {
  id: string
  type: ExploreItemType
  title: string
  description: string
  dimension?: string
  starred?: boolean
  // For deep dives
  conversationCount?: number
  // For gaps
  gapData?: StructuredProvocation
}

interface DeepDiveSummary {
  id: string
  topic: string
  status: string
  conversationCount: number
}

interface DimensionalSynthesis {
  dimension: string
  summary: string | null
  gaps: StructuredProvocation[]
  confidence: string
}

interface ExploreNextSectionProps {
  deepDives: DeepDiveSummary[]
  provocations: StructuredProvocation[]
  syntheses: DimensionalSynthesis[]
  isItemDismissed: (itemType: string, itemKey: string) => boolean
  onDismissItem: (itemType: string, itemKey: string) => void
  onItemClick: (item: ExploreItem) => void
  onAddDeepDive: () => void
}

export function ExploreNextSection({
  deepDives,
  provocations,
  syntheses,
  isItemDismissed,
  onDismissItem,
  onItemClick,
  onAddDeepDive,
}: ExploreNextSectionProps) {
  const [showAllSuggestions, setShowAllSuggestions] = useState(false)
  const SUGGESTIONS_LIMIT = 3

  // Build deep dives list (user-added topics)
  const deepDiveItems: ExploreItem[] = deepDives
    .filter(dd => !isItemDismissed('deep_dive', dd.id))
    .map(dd => ({
      id: `dd-${dd.id}`,
      type: 'deep-dive' as ExploreItemType,
      title: dd.topic,
      description: dd.conversationCount > 0
        ? `${dd.conversationCount} chat${dd.conversationCount !== 1 ? 's' : ''}`
        : 'Not started',
      conversationCount: dd.conversationCount,
    }))

  // Build suggestions list (AI-generated provocations + gaps)
  const suggestionItems: ExploreItem[] = []

  // Add provocations
  provocations
    .filter(p => !isItemDismissed('suggested_question', p.description))
    .forEach((p, idx) => {
      suggestionItems.push({
        id: `prov-${idx}`,
        type: 'provocation',
        title: p.title,
        description: p.description,
      })
    })

  // Add gaps from low-confidence syntheses
  syntheses
    .filter(s => s.confidence === 'LOW' && s.gaps.length > 0)
    .filter(s => !isItemDismissed('focus_area', s.dimension))
    .forEach(s => {
      const gap = s.gaps[0]
      suggestionItems.push({
        id: `gap-${s.dimension}`,
        type: 'gap',
        title: gap?.title || 'Explore this area',
        description: gap?.description || s.summary || '',
        dimension: s.dimension,
        gapData: gap,
      })
    })

  const visibleSuggestions = showAllSuggestions ? suggestionItems : suggestionItems.slice(0, SUGGESTIONS_LIMIT)
  const hasMoreSuggestions = suggestionItems.length > SUGGESTIONS_LIMIT

  const getIcon = (type: ExploreItemType) => {
    switch (type) {
      case 'deep-dive':
        return <Crosshair className="h-4 w-4 text-green-600" />
      case 'provocation':
        return <Zap className="h-4 w-4 text-muted-foreground" />
      case 'gap':
        return <Puzzle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getDismissKey = (item: ExploreItem): { type: string; key: string } => {
    switch (item.type) {
      case 'deep-dive':
        return { type: 'deep_dive', key: item.id.replace('dd-', '') }
      case 'provocation':
        return { type: 'suggested_question', key: item.description }
      case 'gap':
        return { type: 'focus_area', key: item.dimension || '' }
    }
  }

  const renderItem = (item: ExploreItem, index: number, showSeparator: boolean) => {
    const dismissInfo = getDismissKey(item)
    return (
      <React.Fragment key={item.id}>
        {showSeparator && index > 0 && <ItemSeparator />}
        <Item
          size="sm"
          className="cursor-pointer hover:bg-accent/50"
          onClick={() => onItemClick(item)}
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5 shrink-0">
              {getIcon(item.type)}
            </div>
            <ItemContent className="min-w-0">
              <ItemTitle>{item.title}</ItemTitle>
              <ItemDescription className="text-xs">{item.description}</ItemDescription>
              {item.dimension && (
                <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5 mt-1 w-fit inline-block">
                  {DIMENSION_LABELS[item.dimension as Tier1Dimension] || item.dimension}
                </span>
              )}
            </ItemContent>
          </div>
          <ItemActions>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDismissItem(dismissInfo.type, dismissInfo.key)
              }}
              className="p-1 rounded hover:bg-muted"
              title="Dismiss"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </ItemActions>
        </Item>
      </React.Fragment>
    )
  }

  const hasAnyContent = deepDiveItems.length > 0 || suggestionItems.length > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          Explore Next
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Deep Dives Section */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deep Dives</h4>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={onAddDeepDive}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        {deepDiveItems.length > 0 ? (
          <ItemGroup>
            {deepDiveItems.map((item, index) => renderItem(item, index, true))}
          </ItemGroup>
        ) : (
          <div className="px-4 pb-3 text-xs text-muted-foreground">
            No topics yet
          </div>
        )}

        {/* Suggestions Section */}
        {suggestionItems.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-2 border-t">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggestions</h4>
            </div>
            <ItemGroup>
              {visibleSuggestions.map((item, index) => renderItem(item, index, true))}
              {hasMoreSuggestions && (
                <>
                  <ItemSeparator />
                  <div className="px-4 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                    >
                      {showAllSuggestions ? 'Show less' : `Show ${suggestionItems.length - SUGGESTIONS_LIMIT} more`}
                    </Button>
                  </div>
                </>
              )}
            </ItemGroup>
          </>
        )}

        {/* Empty state when nothing at all */}
        {!hasAnyContent && (
          <div className="text-center py-6 px-6 text-muted-foreground border-t">
            <p className="text-sm">Start a chat or upload a document to generate suggestions</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Export the ExploreItem type for use in page.tsx
export type { ExploreItem, ExploreItemType }
