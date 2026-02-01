# Dashboard Reorganization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the project dashboard by consolidating exploration modules and improving navigation.

**Architecture:** Merge Deep Dives, Provocations, and Strategic Gaps into a unified "Explore Next" component. Move Refresh button to Knowledgebase header. Remove Generated Strategies module (versions move to Current Strategy area).

**Tech Stack:** React, Next.js, Tailwind CSS, Lucide icons, shadcn/ui components

---

## Task 1: Rename LunasMemoryHeader to KnowledgebaseHeader

**Files:**
- Rename: `src/components/LunasMemoryHeader.tsx` → `src/components/KnowledgebaseHeader.tsx`
- Modify: `src/app/project/[id]/page.tsx:67` (import)
- Modify: `src/app/project/[id]/page.tsx` (usage)

**Step 1: Rename the file**

```bash
mv src/components/LunasMemoryHeader.tsx src/components/KnowledgebaseHeader.tsx
```

**Step 2: Update component name and text in KnowledgebaseHeader.tsx**

Change line 76:
```tsx
// Before
export function LunasMemoryHeader({

// After
export function KnowledgebaseHeader({
```

Change line 104:
```tsx
// Before
<span className="font-medium text-sm">Luna&apos;s Memory</span>

// After
<span className="font-medium text-sm">Knowledgebase</span>
```

Change line 145:
```tsx
// Before
<h4 className="text-sm font-medium">What Luna Knows</h4>

// After
<h4 className="text-sm font-medium">Knowledge Summary</h4>
```

**Step 3: Update import in page.tsx**

Change line 67:
```tsx
// Before
import { LunasMemoryHeader } from '@/components/LunasMemoryHeader'

// After
import { KnowledgebaseHeader } from '@/components/KnowledgebaseHeader'
```

**Step 4: Update usage in page.tsx**

Find and replace `<LunasMemoryHeader` with `<KnowledgebaseHeader` (should be around line 458-469).

**Step 5: Run type-check**

```bash
npm run type-check
```

Expected: PASS

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor: rename LunasMemoryHeader to KnowledgebaseHeader"
```

---

## Task 2: Add Refresh Button to KnowledgebaseHeader

**Files:**
- Modify: `src/components/KnowledgebaseHeader.tsx`

**Step 1: Add onRefreshClick prop to interface**

Around line 64-74, update the interface:
```tsx
interface KnowledgebaseHeaderProps {
  fragmentCount: number
  chatCount: number
  docCount: number
  coveragePercentage: number
  newInsightsCount: number
  knowledgeSummary: string | null
  dimensionalCoverage: Record<string, { fragmentCount: number; averageConfidence: number }>
  syntheses: DimensionalSynthesis[]
  onRefreshClick: () => void
}
```

**Step 2: Add RefreshCw import**

```tsx
import { ChevronDown, ChevronUp, Sparkles, RefreshCw } from 'lucide-react'
```

**Step 3: Add Button import**

```tsx
import { Button } from '@/components/ui/button'
```

**Step 4: Update function signature**

```tsx
export function KnowledgebaseHeader({
  fragmentCount,
  chatCount,
  coveragePercentage,
  newInsightsCount,
  knowledgeSummary,
  dimensionalCoverage,
  syntheses,
  onRefreshClick,
}: KnowledgebaseHeaderProps) {
```

**Step 5: Replace the "new insights" section with Refresh button**

Find this block (around lines 117-128):
```tsx
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
```

Replace with:
```tsx
{/* Refresh button - always visible */}
<Button
  variant="outline"
  size="sm"
  onClick={(e) => {
    e.stopPropagation()
    if (newInsightsCount > 0) {
      onRefreshClick()
    }
  }}
  disabled={newInsightsCount === 0}
  className="h-7 text-xs"
  title={newInsightsCount > 0
    ? `Refresh strategy with ${newInsightsCount} new insights`
    : 'Add more context to enable refresh'}
>
  <RefreshCw className="h-3 w-3 mr-1.5" />
  {newInsightsCount > 0
    ? `Refresh (${newInsightsCount} new)`
    : 'Add context to refresh'}
</Button>
```

**Step 6: Remove handleNewInsightsClick function**

Delete lines 88-93:
```tsx
const handleNewInsightsClick = (e: React.MouseEvent) => {
  e.stopPropagation()
  if (newInsightsCount > 0) {
    onNewInsightsClick()
  }
}
```

**Step 7: Remove onNewInsightsClick from props interface and function signature**

Remove `onNewInsightsClick: () => void` from interface and function params.

**Step 8: Run type-check**

```bash
npm run type-check
```

Expected: FAIL (page.tsx needs updating)

---

## Task 3: Update page.tsx to use new KnowledgebaseHeader props

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Find the KnowledgebaseHeader usage**

Around line 458-469, update the props:

```tsx
<KnowledgebaseHeader
  fragmentCount={stats.fragmentCount}
  chatCount={stats.conversationCount}
  docCount={stats.documentCount}
  coveragePercentage={coveragePercentage}
  newInsightsCount={stats.unsynthesizedFragmentCount}
  knowledgeSummary={projectData?.knowledgeSummary || null}
  dimensionalCoverage={stats.dimensionalCoverage}
  syntheses={projectData?.syntheses || []}
  onRefreshClick={() => setRefreshStrategyDialogOpen(true)}
/>
```

Note: Remove `onNewInsightsClick` prop, add `onRefreshClick` prop.

**Step 2: Run type-check**

```bash
npm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add always-visible Refresh button to KnowledgebaseHeader"
```

---

## Task 4: Remove Generated Strategies Module and convert to 2-column grid

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Change grid from 3-column to 2-column**

Find around line 471:
```tsx
<div className="grid gap-6 md:grid-cols-3">
```

Change to:
```tsx
<div className="grid gap-6 md:grid-cols-2">
```

**Step 2: Delete the Generated Strategies card**

Find and delete the entire Generated Strategies card section (approximately lines 715-818). This is the third `<Card>` in the grid that starts with:
```tsx
{/* Generated Strategies */}
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-lg">
      <Target className="h-5 w-5 text-green-600" />
      Generated Strategies
```

Delete from `{/* Generated Strategies */}` through the closing `</Card>`.

**Step 3: Remove unused state variable**

Find and remove:
```tsx
const [showAllOutputs, setShowAllOutputs] = useState(false)
```

**Step 4: Run type-check**

```bash
npm run type-check
```

Expected: PASS (or warnings about unused imports)

**Step 5: Remove unused Target import if no longer used**

Check if `Target` is used elsewhere. If not, remove from imports.

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor: remove Generated Strategies module, convert to 2-column grid"
```

---

## Task 5: Create ExploreNextSection component

**Files:**
- Create: `src/components/ExploreNextSection.tsx`

**Step 1: Create the component file**

```tsx
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
import { Zap, Puzzle, Crosshair, X, Star, Plus } from 'lucide-react'
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
```

**Step 2: Run type-check**

```bash
npm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: create ExploreNextSection component"
```

---

## Task 6: Create GoToStrategyCard component

**Files:**
- Create: `src/components/GoToStrategyCard.tsx`

**Step 1: Create the component file**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, ArrowRight } from 'lucide-react'

interface GoToStrategyCardProps {
  onGoToStrategy: () => void
}

const DISMISSED_KEY = 'go-to-strategy-card-dismissed'

export function GoToStrategyCard({ onGoToStrategy }: GoToStrategyCardProps) {
  const [isDismissed, setIsDismissed] = useState(true) // Start hidden to avoid flash

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    setIsDismissed(dismissed === 'true')
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setIsDismissed(true)
  }

  if (isDismissed) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">More features coming soon</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-6 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded hover:bg-muted text-muted-foreground"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-center space-y-4">
          <div>
            <h3 className="font-medium text-sm">View Your Strategy</h3>
            <p className="text-xs text-muted-foreground mt-1">
              See your current decision stack and track progress
            </p>
          </div>
          <Button onClick={onGoToStrategy} size="sm">
            Go to Strategy
            <ArrowRight className="h-3 w-3 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Run type-check**

```bash
npm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: create GoToStrategyCard component"
```

---

## Task 7: Integrate ExploreNextSection into page.tsx

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Add imports**

```tsx
import { ExploreNextSection, ExploreItem } from '@/components/ExploreNextSection'
import { GoToStrategyCard } from '@/components/GoToStrategyCard'
```

**Step 2: Remove unused imports**

Remove these if no longer used elsewhere:
- `Lightbulb`
- `AlertCircle`
- `Crosshair`

Keep `X` as it may be used elsewhere.

**Step 3: Find and delete the Deep Dives section**

Delete the entire Deep Dives section (approximately lines 821-970), from:
```tsx
{/* Deep Dives - Full Width Panel */}
```
through its closing `})()}`.

**Step 4: Find and delete Provocations + Strategic Gaps section**

Delete the entire section (approximately lines 972-1148), from:
```tsx
{/* Provocations + Strategic Gaps */}
<div className="grid gap-6 lg:grid-cols-2">
```
through the closing `</div>`.

**Step 5: Add the new Explore Next row**

After the 2-column Docs/Chats grid, add:

```tsx
{/* Explore Next + Go to Strategy */}
<div className="grid gap-6 lg:grid-cols-2">
  <ExploreNextSection
    deepDives={projectData?.deepDives || []}
    provocations={projectData?.suggestedQuestions || []}
    syntheses={projectData?.syntheses || []}
    isItemDismissed={isItemDismissed}
    onDismissItem={dismissItem}
    onItemClick={(item) => {
      if (item.type === 'deep-dive') {
        const ddId = item.id.replace('dd-', '')
        openDeepDiveSheet(ddId)
      } else if (item.type === 'provocation') {
        setChatInitialQuestion(item.description)
        setChatDeepDiveId(undefined)
        setChatGapExploration(undefined)
        setChatResumeConversationId(undefined)
        setChatViewOnly(false)
        setChatSheetOpen(true)
      } else if (item.type === 'gap') {
        setChatDeepDiveId(undefined)
        setChatInitialQuestion(undefined)
        setChatGapExploration({
          dimension: item.dimension || '',
          summary: item.description,
        })
        setChatResumeConversationId(undefined)
        setChatViewOnly(false)
        setChatSheetOpen(true)
      }
    }}
    onAddDeepDive={() => setAddDeepDiveOpen(true)}
  />
  <GoToStrategyCard
    onGoToStrategy={() => {
      // Scroll to strategy section or navigate
      const strategySection = document.getElementById('current-strategy')
      if (strategySection) {
        strategySection.scrollIntoView({ behavior: 'smooth' })
      }
    }}
  />
</div>
```

**Step 6: Add id to Current Strategy section**

Find the Current Strategy section and add an id:
```tsx
<div id="current-strategy">
  {/* Current Strategy content */}
</div>
```

(Note: You'll need to locate where the Current Strategy is rendered - this may be further down in the file or in a separate component.)

**Step 7: Remove unused state variables**

Remove these if no longer used:
```tsx
const [showAllFocusAreas, setShowAllFocusAreas] = useState(false)
const [showAllProvocations, setShowAllProvocations] = useState(false)
```

**Step 8: Run type-check**

```bash
npm run type-check
```

Expected: PASS (or fixable errors)

**Step 9: Commit**

```bash
git add -A && git commit -m "feat: integrate ExploreNextSection and GoToStrategyCard into dashboard"
```

---

## Task 8: Clean up and verify

**Files:**
- Modify: `src/app/project/[id]/page.tsx` (if needed)

**Step 1: Run full verification**

```bash
npm run verify
```

Expected: PASS

**Step 2: Manual testing checklist**

- [ ] Knowledgebase header shows "Knowledgebase" not "Luna's Memory"
- [ ] Refresh button always visible (disabled when no new insights)
- [ ] Docs and Chats show in 2-column grid (no Generated Strategies)
- [ ] Explore Next shows unified list with correct icons:
  - Deep Dives: Crosshairs (green)
  - Provocations: Bolt (muted)
  - Gaps: Puzzle (muted)
- [ ] Clicking items opens correct sheet/dialog
- [ ] Dismiss works for all item types
- [ ] "+ Add topic" opens AddDeepDiveDialog
- [ ] "Go to Strategy" card scrolls to strategy section
- [ ] Card can be dismissed (persists in localStorage)
- [ ] Responsive layout works on mobile

**Step 3: Fix any issues found**

Address any bugs or visual issues.

**Step 4: Final commit**

```bash
git add -A && git commit -m "chore: dashboard reorganization cleanup"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Rename LunasMemoryHeader → KnowledgebaseHeader |
| 2 | Add always-visible Refresh button to header |
| 3 | Update page.tsx to use new header props |
| 4 | Remove Generated Strategies, convert to 2-column |
| 5 | Create ExploreNextSection component |
| 6 | Create GoToStrategyCard component |
| 7 | Integrate new components into page.tsx |
| 8 | Clean up and verify |

**Estimated commits:** 7-8
