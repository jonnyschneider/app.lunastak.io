# Enhanced Strategy Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add flip cards for objectives with metrics, complete the Decision Stack with initiatives and principles, and implement objective-based filtering.

**Architecture:** Hybrid component approach using Catalyst for app shell and shadcn/ui for content cards. 3D CSS flip cards for objectives, filtered grid for initiatives, flex layout for principles. Placeholder data for initiatives/principles until future LLM generation features are built.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS 3.3, shadcn/ui (Card, Badge), Headless UI

---

## Task 1: Install and Configure shadcn/ui

**Files:**
- Create: `components.json`
- Modify: `tailwind.config.ts`
- Modify: `src/styles/globals.css`

**Step 1: Initialize shadcn/ui**

Run: `npx shadcn-ui@latest init`

When prompted:
- TypeScript: Yes
- Style: Default
- Base color: Zinc
- CSS variables: Yes
- Tailwind config: `tailwind.config.ts`
- Components: `src/components/ui`
- Utils: `src/lib/utils.ts`
- React Server Components: Yes
- Write config: Yes

**Step 2: Verify components.json created**

Run: `cat components.json`

Expected: JSON config file with paths and style settings

**Step 3: Add Card component**

Run: `npx shadcn-ui@latest add card`

Expected: Creates `src/components/ui/card.tsx`

**Step 4: Add Badge component**

Run: `npx shadcn-ui@latest add badge`

Expected: Creates `src/components/ui/badge.tsx`

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add components.json tailwind.config.ts src/styles/globals.css src/components/ui/card.tsx src/components/ui/badge.tsx src/lib/utils.ts
git commit -m "chore: install shadcn/ui with Card and Badge components"
```

---

## Task 2: Update Type Definitions

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add new interfaces**

Add the following interfaces to `src/lib/types.ts` after the existing `StrategyStatements` interface:

```typescript
export interface ObjectiveMetric {
  summary: string;        // "25%" or "Growth" - shown on front
  full: string;          // "Increase revenue by 25% in Q1 2025"
  category: string;      // "Revenue", "Customer", "Product", etc.
}

export interface Objective {
  id: string;            // For filtering relationships
  pithy: string;         // Short 1-2 sentence objective
  metric: ObjectiveMetric;
  explanation: string;   // Full detail for back of card
  successCriteria: string; // What success looks like
}

export interface Initiative {
  id: string;
  title: string;
  description: string;
  objectiveIds: string[]; // References to objectives this supports
}

export interface Principle {
  id: string;
  title: string;
  description: string;
}
```

**Step 2: Update StrategyStatements interface**

Replace the existing `StrategyStatements` interface with:

```typescript
export interface StrategyStatements {
  vision: string;
  mission: string;
  objectives: Objective[];
  initiatives: Initiative[];
  principles: Principle[];
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Type errors in StrategyDisplay.tsx (expected - we'll fix next)

**Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add enhanced types for objectives, initiatives, and principles"
```

---

## Task 3: Create Placeholder Data Generator

**Files:**
- Create: `src/lib/placeholders.ts`

**Step 1: Create placeholder utility file**

Create `src/lib/placeholders.ts`:

```typescript
import { Objective, Initiative, Principle } from './types';

export function generatePlaceholderInitiatives(objectives: Objective[]): Initiative[] {
  if (objectives.length === 0) {
    return [];
  }

  const objectiveIds = objectives.map(obj => obj.id);

  // Helper to get random subset of objective IDs
  const getRandomObjectives = (): string[] => {
    const count = Math.floor(Math.random() * 2) + 1; // 1-2 objectives per initiative
    const shuffled = [...objectiveIds].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  return [
    {
      id: 'init-1',
      title: 'Launch MVP Product',
      description: 'Develop and release minimum viable product to test market fit and gather user feedback.',
      objectiveIds: getRandomObjectives(),
    },
    {
      id: 'init-2',
      title: 'Build Marketing Campaign',
      description: 'Create comprehensive marketing strategy targeting key customer segments.',
      objectiveIds: getRandomObjectives(),
    },
    {
      id: 'init-3',
      title: 'Establish Sales Process',
      description: 'Define and implement repeatable sales methodology with clear qualification criteria.',
      objectiveIds: getRandomObjectives(),
    },
    {
      id: 'init-4',
      title: 'Develop Partnership Strategy',
      description: 'Identify and engage strategic partners to expand market reach and capabilities.',
      objectiveIds: getRandomObjectives(),
    },
    {
      id: 'init-5',
      title: 'Optimize Customer Onboarding',
      description: 'Streamline new customer experience to reduce time-to-value and increase retention.',
      objectiveIds: getRandomObjectives(),
    },
  ];
}

export function generatePlaceholderPrinciples(): Principle[] {
  return [
    {
      id: 'prin-1',
      title: 'Customer First',
      description: 'Every decision prioritizes long-term customer value over short-term gains.',
    },
    {
      id: 'prin-2',
      title: 'Data-Driven Decisions',
      description: 'Base strategic choices on quantitative evidence and validated learning.',
    },
    {
      id: 'prin-3',
      title: 'Iterate Rapidly',
      description: 'Test assumptions quickly, learn fast, and adapt based on feedback.',
    },
    {
      id: 'prin-4',
      title: 'Quality Over Speed',
      description: 'Build sustainable solutions that scale rather than quick fixes.',
    },
    {
      id: 'prin-5',
      title: 'Transparent Communication',
      description: 'Share information openly with stakeholders to build trust and alignment.',
    },
    {
      id: 'prin-6',
      title: 'Sustainable Growth',
      description: 'Focus on profitable, repeatable growth models rather than unsustainable expansion.',
    },
    {
      id: 'prin-7',
      title: 'Team Empowerment',
      description: 'Give teams autonomy and ownership to drive innovation and accountability.',
    },
    {
      id: 'prin-8',
      title: 'Continuous Improvement',
      description: 'Regularly review and refine processes, products, and strategies.',
    },
  ];
}

export function convertLegacyObjectives(legacyObjectives: string[]): Objective[] {
  return legacyObjectives.map((obj, index) => ({
    id: `obj-${index + 1}`,
    pithy: obj,
    metric: {
      summary: '25%', // Placeholder
      full: 'Increase by 25% within 6 months',
      category: 'Growth',
    },
    explanation: `This objective focuses on ${obj.toLowerCase()}. It connects to our overall mission by driving key outcomes that matter to stakeholders.`,
    successCriteria: 'Achievement will be measured through quantifiable metrics and stakeholder feedback.',
  }));
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/placeholders.ts
git commit -m "feat: add placeholder data generators for initiatives and principles"
```

---

## Task 4: Create FlipCard Component

**Files:**
- Create: `src/components/ui/flip-card.tsx`

**Step 1: Create FlipCard component**

Create `src/components/ui/flip-card.tsx`:

```typescript
'use client';

import { useState } from 'react';
import clsx from 'clsx';

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
}

export function FlipCard({ front, back, className }: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div
      className={clsx('flip-card-container', className)}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={handleFlip}
    >
      <div
        className={clsx(
          'flip-card-inner',
          'relative w-full h-full transition-transform duration-600 ease-in-out',
          '[transform-style:preserve-3d]',
          isFlipped && '[transform:rotateY(180deg)]'
        )}
      >
        {/* Front Face */}
        <div
          className={clsx(
            'flip-card-front',
            'absolute inset-0 w-full h-full',
            '[backface-visibility:hidden]'
          )}
        >
          {front}
        </div>

        {/* Back Face */}
        <div
          className={clsx(
            'flip-card-back',
            'absolute inset-0 w-full h-full',
            '[backface-visibility:hidden]',
            '[transform:rotateY(180deg)]'
          )}
        >
          {back}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/flip-card.tsx
git commit -m "feat: add FlipCard component with 3D flip animation"
```

---

## Task 5: Create ObjectiveCard Component

**Files:**
- Create: `src/components/ObjectiveCard.tsx`

**Step 1: Create ObjectiveCard component**

Create `src/components/ObjectiveCard.tsx`:

```typescript
'use client';

import { Objective } from '@/lib/types';
import { FlipCard } from '@/components/ui/flip-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface ObjectiveCardProps {
  objective: Objective;
  isFilterActive: boolean;
  onToggleFilter: () => void;
}

export function ObjectiveCard({ objective, isFilterActive, onToggleFilter }: ObjectiveCardProps) {
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent flip when clicking filter toggle
    onToggleFilter();
  };

  const frontContent = (
    <Card className={clsx(
      'h-full border-zinc-200 dark:border-zinc-700 hover:shadow-lg transition-shadow duration-200',
      isFilterActive && 'ring-2 ring-zinc-400'
    )}>
      <CardContent className="p-6 h-full flex flex-col">
        {/* Filter Toggle - Top Left */}
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={handleToggleClick}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            aria-label={isFilterActive ? 'Hide related initiatives' : 'Show related initiatives'}
          >
            {isFilterActive ? (
              <EyeIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            ) : (
              <EyeSlashIcon className="w-5 h-5 text-zinc-400" />
            )}
          </button>

          <div className="flex flex-col items-end gap-1">
            {/* Metric Badge */}
            <Badge variant="secondary" className="text-lg font-bold">
              {objective.metric.summary}
            </Badge>
            {/* Category Badge */}
            <Badge variant="outline" className="text-xs">
              {objective.metric.category}
            </Badge>
          </div>
        </div>

        {/* Pithy Objective */}
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed flex-1">
          {objective.pithy}
        </p>

        {/* Flip Indicator */}
        <div className="flex justify-end mt-4">
          <ArrowPathIcon className="w-4 h-4 text-zinc-400" />
        </div>
      </CardContent>
    </Card>
  );

  const backContent = (
    <Card className="h-full bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
      <CardContent className="p-6 h-full flex flex-col">
        {/* SMART Metric */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Target
          </h4>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {objective.metric.full}
          </p>
        </div>

        {/* Explanation */}
        <div className="mb-4 flex-1">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Why It Matters
          </h4>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {objective.explanation}
          </p>
        </div>

        {/* Success Criteria */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Success Looks Like
          </h4>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {objective.successCriteria}
          </p>
        </div>

        {/* Back Indicator */}
        <div className="flex justify-end">
          <ArrowPathIcon className="w-4 h-4 text-zinc-400 transform rotate-180" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <FlipCard
      front={frontContent}
      back={backContent}
      className="h-80"
    />
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ObjectiveCard.tsx
git commit -m "feat: add ObjectiveCard component with flip behavior and filter toggle"
```

---

## Task 6: Create InitiativeCard Component

**Files:**
- Create: `src/components/InitiativeCard.tsx`

**Step 1: Create InitiativeCard component**

Create `src/components/InitiativeCard.tsx`:

```typescript
'use client';

import { Initiative, Objective } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface InitiativeCardProps {
  initiative: Initiative;
  objectives: Objective[];
}

export function InitiativeCard({ initiative, objectives }: InitiativeCardProps) {
  // Get objective names for badges
  const relatedObjectives = objectives.filter(obj =>
    initiative.objectiveIds.includes(obj.id)
  );

  return (
    <Card className="border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow duration-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {initiative.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {initiative.description}
        </p>

        {/* Related Objectives Badges */}
        {relatedObjectives.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">
              Supports:
            </span>
            {relatedObjectives.map(obj => (
              <Badge
                key={obj.id}
                variant="secondary"
                className="text-xs"
              >
                {obj.metric.category}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/InitiativeCard.tsx
git commit -m "feat: add InitiativeCard component with objective relationship badges"
```

---

## Task 7: Create PrincipleBar Component

**Files:**
- Create: `src/components/PrincipleBar.tsx`

**Step 1: Create PrincipleBar component**

Create `src/components/PrincipleBar.tsx`:

```typescript
'use client';

import { Principle } from '@/lib/types';

interface PrincipleBarProps {
  principle: Principle;
}

export function PrincipleBar({ principle }: PrincipleBarProps) {
  return (
    <div className="bg-zinc-600 dark:bg-zinc-700 rounded-lg p-6 shadow-sm flex-1 min-w-[280px]">
      <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-2">
        {principle.title}
      </h3>
      <p className="text-base text-white leading-relaxed">
        {principle.description}
      </p>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/PrincipleBar.tsx
git commit -m "feat: add PrincipleBar component"
```

---

## Task 8: Refactor StrategyDisplay Component (Part 1 - Setup)

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`

**Step 1: Update imports**

Replace the imports at the top of `src/components/StrategyDisplay.tsx`:

```typescript
'use client';

import { useState, useMemo } from 'react';
import { StrategyStatements } from '@/lib/types';
import { ObjectiveCard } from './ObjectiveCard';
import { InitiativeCard } from './InitiativeCard';
import { PrincipleBar } from './PrincipleBar';
import { Button } from '@/components/ui/button';
import { convertLegacyObjectives, generatePlaceholderInitiatives, generatePlaceholderPrinciples } from '@/lib/placeholders';
```

**Step 2: Update component signature and add state**

Replace the component definition:

```typescript
interface StrategyDisplayProps {
  strategy: StrategyStatements;
  thoughts?: string;
}

export default function StrategyDisplay({ strategy: rawStrategy, thoughts }: StrategyDisplayProps) {
  // Convert legacy objectives if needed
  const strategy = useMemo(() => {
    if (rawStrategy.objectives.length > 0 && typeof rawStrategy.objectives[0] === 'string') {
      // Legacy format - convert to new format
      const convertedObjectives = convertLegacyObjectives(rawStrategy.objectives as any);
      return {
        ...rawStrategy,
        objectives: convertedObjectives,
        initiatives: generatePlaceholderInitiatives(convertedObjectives),
        principles: generatePlaceholderPrinciples(),
      };
    }
    return rawStrategy;
  }, [rawStrategy]);

  // Filter state
  const [activeObjectiveFilters, setActiveObjectiveFilters] = useState<Set<string>>(new Set());

  // Toggle filter for an objective
  const toggleObjectiveFilter = (objectiveId: string) => {
    setActiveObjectiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(objectiveId)) {
        next.delete(objectiveId);
      } else {
        next.add(objectiveId);
      }
      return next;
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveObjectiveFilters(new Set());
  };

  // Filter initiatives based on active objective filters
  const filteredInitiatives = useMemo(() => {
    if (activeObjectiveFilters.size === 0) {
      return strategy.initiatives;
    }

    // Show initiatives that relate to ANY active objective (OR logic)
    return strategy.initiatives.filter(initiative =>
      initiative.objectiveIds.some(objId => activeObjectiveFilters.has(objId))
    );
  }, [strategy.initiatives, activeObjectiveFilters]);
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Possible errors in JSX (we'll fix in next task)

**Step 4: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git commit -m "feat: add filter state and legacy objective conversion to StrategyDisplay"
```

---

## Task 9: Refactor StrategyDisplay Component (Part 2 - JSX)

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`

**Step 1: Replace the return JSX**

Replace the entire return statement with:

```typescript
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Thoughts Section */}
      {thoughts && (
        <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Strategic Thinking
          </h3>
          <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap text-sm">
            {thoughts}
          </p>
        </div>
      )}

      {/* Decision Stack */}
      <div className="space-y-6">
        {/* Vision Bar */}
        <div className="bg-zinc-800 dark:bg-zinc-700 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Vision
          </h3>
          <p className="text-lg font-medium text-white leading-relaxed">
            {strategy.vision}
          </p>
        </div>

        {/* Mission Bar */}
        <div className="bg-zinc-700 dark:bg-zinc-600 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide mb-3">
            Mission
          </h3>
          <p className="text-lg font-medium text-white leading-relaxed">
            {strategy.mission}
          </p>
        </div>

        {/* Objectives Section */}
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
            Objectives
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategy.objectives.map((objective) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                isFilterActive={activeObjectiveFilters.has(objective.id)}
                onToggleFilter={() => toggleObjectiveFilter(objective.id)}
              />
            ))}
          </div>
        </div>

        {/* Initiatives Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Initiatives
            </h2>
            {activeObjectiveFilters.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs"
              >
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300">
            {filteredInitiatives.map((initiative) => (
              <InitiativeCard
                key={initiative.id}
                initiative={initiative}
                objectives={strategy.objectives}
              />
            ))}
          </div>

          {filteredInitiatives.length === 0 && activeObjectiveFilters.size > 0 && (
            <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
              No initiatives match the selected objectives.
            </p>
          )}
        </div>

        {/* Principles Section */}
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
            Principles
          </h2>
          <div className="flex flex-wrap gap-4">
            {strategy.principles.map((principle) => (
              <PrincipleBar key={principle.id} principle={principle} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Test dev server starts**

Run: `npm run dev`

Expected: Server starts successfully

**Step 4: Stop dev server**

Press Ctrl+C

**Step 5: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git commit -m "feat: complete StrategyDisplay refactor with objectives, initiatives, and principles"
```

---

## Task 10: Add CSS for Flip Card Animation

**Files:**
- Modify: `src/styles/globals.css`

**Step 1: Add flip card styles**

Add the following to the end of `src/styles/globals.css`:

```css
/* Flip Card Animations */
.flip-card-container {
  perspective: 1000px;
}

.flip-card-inner {
  transform-style: preserve-3d;
}

.flip-card-front,
.flip-card-back {
  backface-visibility: hidden;
}

/* Mobile: disable hover flip, use click only */
@media (max-width: 768px) {
  .flip-card-container {
    perspective: none;
  }
}
```

**Step 2: Verify styles compile**

Run: `npm run dev`

Expected: Dev server starts without errors

**Step 3: Stop dev server**

Press Ctrl+C

**Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "style: add CSS for flip card 3D animations"
```

---

## Task 11: Fix shadcn Button Import

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`

**Step 1: Check if Button component exists**

Run: `ls src/components/ui/button.tsx`

Expected: If file doesn't exist, continue. If exists, skip to Step 4.

**Step 2: Add shadcn Button component**

Run: `npx shadcn-ui@latest add button`

Expected: Creates `src/components/ui/button.tsx`

**Step 3: Update StrategyDisplay import**

The Button import in `src/components/StrategyDisplay.tsx` should already be correct:

```typescript
import { Button } from '@/components/ui/button';
```

If there's a conflict with the Catalyst Button, update the import to be explicit:

```typescript
import { Button } from '@/components/ui/button'; // shadcn button for Clear Filters
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 5: Commit (if button was added)**

```bash
git add src/components/ui/button.tsx src/components/StrategyDisplay.tsx
git commit -m "chore: add shadcn Button component for filters"
```

---

## Task 12: Build and Test

**Files:**
- None (verification only)

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 2: Run production build**

Run: `npm run build`

Expected: Build completes successfully

**Step 3: Start dev server**

Run: `npm run dev`

Expected: Server starts at http://localhost:3000

**Step 4: Manual verification**

Open http://localhost:3000 and test:

1. Complete a conversation to generate strategy
2. Verify objectives display as flip cards
3. Hover over objective card (desktop) - should flip
4. Click objective card (mobile/tablet) - should flip
5. Click filter toggle on objective - initiatives should filter
6. Click multiple objective filters - should show union (OR logic)
7. Click "Clear Filters" - all initiatives should return
8. Verify initiatives show related objective badges
9. Verify principles display in flex layout
10. Check responsive behavior (resize browser)

**Step 5: Stop dev server**

Press Ctrl+C

**Step 6: Document any issues**

If issues found, note them for fixing. Otherwise, proceed.

---

## Task 13: Update Session Notes

**Files:**
- Modify: `session-notes.md`

**Step 1: Add session entry**

Add to the top of `session-notes.md` (after the `# Session Notes` header):

```markdown
## 2025-12-10 (Session 2): Enhanced Strategy Display

### Overview
Implemented complete Decision Stack visualization with flip cards for objectives, filtered initiatives grid, and principles layout. Added shadcn/ui components alongside Catalyst for hybrid component approach.

### Changes

**New Components:**
- FlipCard - 3D flip animation component
- ObjectiveCard - Flip card with metrics, filter toggle
- InitiativeCard - Card showing initiative with objective badges
- PrincipleBar - Bar component for principles

**Enhanced Data Model:**
- Objective with metrics (summary, full SMART, category)
- Initiative with objective relationships
- Principle structure
- Placeholder data generators

**Filtering System:**
- Toggle icons on objective cards
- OR logic for multiple active filters
- Clear all filters button
- Smooth transitions

**Component Library:**
- Added shadcn/ui (Card, Badge, Button)
- Kept Catalyst for app shell
- Hybrid approach working well

### Technical Details

**Files Created:**
- `src/components/ui/flip-card.tsx`
- `src/components/ObjectiveCard.tsx`
- `src/components/InitiativeCard.tsx`
- `src/components/PrincipleBar.tsx`
- `src/lib/placeholders.ts`
- `components.json` (shadcn config)

**Files Modified:**
- `src/lib/types.ts` - Enhanced type definitions
- `src/components/StrategyDisplay.tsx` - Complete refactor with all sections
- `src/styles/globals.css` - Flip card animations
- `tailwind.config.ts` - shadcn integration

**Dependencies Added:**
- shadcn/ui components (via copy/paste)

### Verification
- ✅ Build succeeds
- ✅ TypeScript compiles cleanly
- ✅ Objective cards flip on hover/click
- ✅ Filter toggles work
- ✅ Initiative filtering with OR logic
- ✅ Principles display in flex layout
- ✅ Responsive behavior
- ✅ Greyscale aesthetic maintained

### Hours
~3 hours implementation + testing

---

```

**Step 2: Verify markdown formatting**

Run: `head -50 session-notes.md`

Expected: Should see the new session entry at the top

**Step 3: Commit**

```bash
git add session-notes.md
git commit -m "docs: add session notes for enhanced strategy display implementation"
```

---

## Verification Steps

After completing all tasks:

1. **Build succeeds**: `npm run build` completes without errors
2. **Type check passes**: `npx tsc --noEmit` shows no errors
3. **Flip cards work**: Hover/click flips objective cards front/back
4. **Metrics display**: Front shows summary + category, back shows full SMART
5. **Filtering works**: Toggle objectives filters initiatives correctly
6. **OR logic**: Multiple active filters show union of initiatives
7. **Clear filters**: Button appears and clears all filters
8. **Initiative badges**: Show related objective categories
9. **Principles layout**: Display in flex wrap, 2-3 per row
10. **Responsive**: Works on mobile, tablet, desktop
11. **Animations smooth**: No jank, proper transitions
12. **Greyscale maintained**: Consistent with overall design

## Success Criteria

- ✅ All components render without errors
- ✅ Legacy objective format converts automatically
- ✅ Placeholder data generates correctly
- ✅ 3D flip animation works on hover (desktop) and click (mobile)
- ✅ Filter toggles show/hide initiatives
- ✅ Multiple filters use OR logic
- ✅ Clear filters button works
- ✅ Initiative cards show objective relationship badges
- ✅ Principles display in responsive flex layout
- ✅ No TypeScript errors
- ✅ No console warnings
- ✅ Build succeeds
- ✅ Greyscale aesthetic consistent
- ✅ Session notes updated
