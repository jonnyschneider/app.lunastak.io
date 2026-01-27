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
  const [showAll, setShowAll] = useState(false)
  const VISIBLE_LIMIT = 5

  // Build unified list
  const allItems: ExploreItem[] = []

  // Add deep dives (user-added)
  deepDives
    .filter(dd => !isItemDismissed('deep_dive', dd.id))
    .forEach(dd => {
      allItems.push({
        id: `dd-${dd.id}`,
        type: 'deep-dive',
        title: dd.topic,
        description: dd.conversationCount > 0
          ? `${dd.conversationCount} chat${dd.conversationCount !== 1 ? 's' : ''}`
          : 'Not started',
        conversationCount: dd.conversationCount,
      })
    })

  // Add provocations (AI-generated)
  provocations
    .filter(p => !isItemDismissed('suggested_question', p.description))
    .forEach((p, idx) => {
      allItems.push({
        id: `prov-${idx}`,
        type: 'provocation',
        title: p.title,
        description: p.description,
      })
    })

  // Add gaps from low-confidence syntheses (AI-generated)
  syntheses
    .filter(s => s.confidence === 'LOW' && s.gaps.length > 0)
    .filter(s => !isItemDismissed('focus_area', s.dimension))
    .forEach(s => {
      const gap = s.gaps[0]
      allItems.push({
        id: `gap-${s.dimension}`,
        type: 'gap',
        title: gap?.title || 'Explore this area',
        description: gap?.description || s.summary || '',
        dimension: s.dimension,
        gapData: gap,
      })
    })

  const visibleItems = showAll ? allItems : allItems.slice(0, VISIBLE_LIMIT)
  const hasMore = allItems.length > VISIBLE_LIMIT

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          Explore Next
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {allItems.length > 0 ? (
          <ItemGroup>
            {visibleItems.map((item, index) => {
              const dismissInfo = getDismissKey(item)
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <ItemSeparator />}
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
            })}
            {hasMore && (
              <>
                <ItemSeparator />
                <div className="px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowAll(!showAll)}
                  >
                    {showAll ? 'Show less' : `Show ${allItems.length - VISIBLE_LIMIT} more`}
                  </Button>
                </div>
              </>
            )}
          </ItemGroup>
        ) : (
          <div className="text-center py-8 px-6 text-muted-foreground">
            <p className="text-sm">Nothing to explore yet</p>
            <p className="text-xs mt-1">Start a chat or upload a document to generate suggestions</p>
          </div>
        )}
        <div className="p-4 pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={onAddDeepDive}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add topic
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Export the ExploreItem type for use in page.tsx
export type { ExploreItem, ExploreItemType }
