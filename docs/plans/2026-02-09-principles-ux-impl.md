# Principles UX — Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Principles as a first-class Decision Stack component with trade-off UX ("X even over Y").

**Architecture:** New Principle data model with `priority`/`deprioritized` fields. Two interaction modes: curated library for cold starts, context-aware suggestions when fragments exist. Uses existing UserContent API pattern.

**Tech Stack:** Next.js, React, Tailwind, existing component patterns from OpportunitySection

**Design doc:** `docs/plans/2026-02-09-decision-stack-editing-design.md`

**Prerequisites:** Phase 1 complete (inline editing infrastructure)

**Branch:** Continue on `feature/decision-stack-completion`

---

## Task 1: Update Principle Type

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/contracts/generation.ts`

**Step 1: Update the Principle interface**

Find the existing Principle interface (around line 33-37) and update:

```typescript
export interface Principle {
  id: string;
  priority: string;        // What we prioritize: "Strategic clients"
  deprioritized: string;   // What we deprioritize: "any paying client"
  context?: string;        // Optional: why this matters
  // Legacy support
  title?: string;          // Maps to priority for backward compat
  description?: string;    // Maps to context for backward compat
}
```

**Step 2: Update generation contract**

In `src/lib/contracts/generation.ts`, update the principles array type in StrategyStatementsContract:

```typescript
principles: Array<{
  id: string;
  priority: string;
  deprioritized: string;
  context?: string;
  // Legacy
  title?: string;
  description?: string;
}>;
```

**Step 3: Verify types compile**

Run: `npm run type-check`
Expected: No type errors (may have some temporary ones if code uses old shape)

**Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/contracts/generation.ts
git commit -m "feat(types): update Principle type to priority/deprioritized model"
```

---

## Task 2: Create Curated Trade-offs Library

**Files:**
- Create: `src/lib/curated-tradeoffs.ts`

**Step 1: Create the curated library**

```typescript
// src/lib/curated-tradeoffs.ts
/**
 * Curated Trade-offs Library
 *
 * Common business trade-offs organized by category.
 * Used for cold start principle selection.
 */

export interface TradeoffOption {
  id: string;
  category: 'growth' | 'culture' | 'product' | 'operations';
  optionA: string;
  optionB: string;
}

export const CURATED_TRADEOFFS: TradeoffOption[] = [
  // Growth
  { id: 'growth-1', category: 'growth', optionA: 'New customers', optionB: 'Customer retention' },
  { id: 'growth-2', category: 'growth', optionA: 'Revenue growth', optionB: 'Profitability' },
  { id: 'growth-3', category: 'growth', optionA: 'Market share', optionB: 'Profit margins' },
  { id: 'growth-4', category: 'growth', optionA: 'Scale fast', optionB: 'Sustainable growth' },
  { id: 'growth-5', category: 'growth', optionA: 'Broad market', optionB: 'Niche focus' },

  // Culture
  { id: 'culture-1', category: 'culture', optionA: 'Move fast', optionB: 'Move carefully' },
  { id: 'culture-2', category: 'culture', optionA: 'Hire specialists', optionB: 'Hire generalists' },
  { id: 'culture-3', category: 'culture', optionA: 'Remote work', optionB: 'Office culture' },
  { id: 'culture-4', category: 'culture', optionA: 'Autonomy', optionB: 'Alignment' },
  { id: 'culture-5', category: 'culture', optionA: 'Transparency', optionB: 'Need-to-know' },

  // Product
  { id: 'product-1', category: 'product', optionA: 'Build in-house', optionB: 'Buy solutions' },
  { id: 'product-2', category: 'product', optionA: 'Feature depth', optionB: 'Feature breadth' },
  { id: 'product-3', category: 'product', optionA: 'User delight', optionB: 'User efficiency' },
  { id: 'product-4', category: 'product', optionA: 'Innovation', optionB: 'Reliability' },
  { id: 'product-5', category: 'product', optionA: 'Customization', optionB: 'Standardization' },

  // Operations
  { id: 'ops-1', category: 'operations', optionA: 'Speed to market', optionB: 'Quality assurance' },
  { id: 'ops-2', category: 'operations', optionA: 'Cost efficiency', optionB: 'Customer experience' },
  { id: 'ops-3', category: 'operations', optionA: 'Process consistency', optionB: 'Situational flexibility' },
  { id: 'ops-4', category: 'operations', optionA: 'Internal capability', optionB: 'Partner ecosystem' },
  { id: 'ops-5', category: 'operations', optionA: 'Short-term results', optionB: 'Long-term positioning' },
];

export const CATEGORY_LABELS: Record<TradeoffOption['category'], string> = {
  growth: 'Growth',
  culture: 'Culture',
  product: 'Product',
  operations: 'Operations',
};

export function getTradeoffsByCategory(category: TradeoffOption['category']): TradeoffOption[] {
  return CURATED_TRADEOFFS.filter((t) => t.category === category);
}
```

**Step 2: Commit**

```bash
git add src/lib/curated-tradeoffs.ts
git commit -m "feat: add curated trade-offs library for principles"
```

---

## Task 3: Create TradeoffCard Component

**Files:**
- Create: `src/components/TradeoffCard.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { TradeoffOption } from '@/lib/curated-tradeoffs';

interface TradeoffCardProps {
  tradeoff: TradeoffOption;
  onSelect: (priority: string, deprioritized: string) => void;
  disabled?: boolean;
}

export function TradeoffCard({ tradeoff, onSelect, disabled }: TradeoffCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredSide, setHoveredSide] = useState<'A' | 'B' | null>(null);

  const handleSelect = (side: 'A' | 'B') => {
    if (disabled) return;
    const priority = side === 'A' ? tradeoff.optionA : tradeoff.optionB;
    const deprioritized = side === 'A' ? tradeoff.optionB : tradeoff.optionA;
    onSelect(priority, deprioritized);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        disabled={disabled}
        className={cn(
          'w-full px-4 py-3 rounded-lg border border-dashed border-gray-300',
          'text-left text-sm text-gray-600',
          'hover:border-[#0A2933] hover:bg-gray-50 transition-colors',
          'flex items-center gap-2',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="text-gray-400">+</span>
        <span>{tradeoff.optionA}</span>
        <span className="text-gray-400">vs</span>
        <span>{tradeoff.optionB}</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border-2 border-[#0A2933] overflow-hidden">
      <div className="text-xs text-center py-2 bg-gray-50 text-gray-500 font-medium">
        Which do you prioritize?
      </div>
      <div className="grid grid-cols-[1fr,auto,1fr]">
        <button
          onClick={() => handleSelect('A')}
          onMouseEnter={() => setHoveredSide('A')}
          onMouseLeave={() => setHoveredSide(null)}
          className={cn(
            'p-4 text-center font-medium transition-colors',
            hoveredSide === 'A' ? 'bg-[#E0FF4F] text-[#0A2933]' : 'hover:bg-gray-50'
          )}
        >
          {tradeoff.optionA}
        </button>
        <div className="flex items-center px-3 text-gray-400 text-sm font-medium">
          or
        </div>
        <button
          onClick={() => handleSelect('B')}
          onMouseEnter={() => setHoveredSide('B')}
          onMouseLeave={() => setHoveredSide(null)}
          className={cn(
            'p-4 text-center font-medium transition-colors',
            hoveredSide === 'B' ? 'bg-[#E0FF4F] text-[#0A2933]' : 'hover:bg-gray-50'
          )}
        >
          {tradeoff.optionB}
        </button>
      </div>
      <button
        onClick={() => setExpanded(false)}
        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run type-check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/TradeoffCard.tsx
git commit -m "feat(ui): add TradeoffCard component for principle selection"
```

---

## Task 4: Create PrincipleChip Component

**Files:**
- Create: `src/components/PrincipleChip.tsx`

**Step 1: Create the display component for selected principles**

```typescript
'use client';

import { X } from 'lucide-react';
import type { Principle } from '@/lib/types';

interface PrincipleChipProps {
  principle: Principle;
  onRemove?: () => void;
  onFlip?: () => void;
}

export function PrincipleChip({ principle, onRemove, onFlip }: PrincipleChipProps) {
  return (
    <div className="group flex items-center gap-2 px-4 py-3 bg-white border rounded-lg shadow-sm hover:shadow transition-shadow">
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-semibold text-[#0A2933]">{principle.priority}</span>
          <span className="text-gray-500"> even over </span>
          <span className="text-gray-600">{principle.deprioritized}</span>
        </p>
        {principle.context && (
          <p className="text-xs text-gray-400 mt-1 truncate">{principle.context}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onFlip && (
          <button
            onClick={onFlip}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Flip priority"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PrincipleChip.tsx
git commit -m "feat(ui): add PrincipleChip component for displaying principles"
```

---

## Task 5: Create PrinciplesSection Component

**Files:**
- Create: `src/components/PrinciplesSection.tsx`

**Step 1: Create the container component**

This manages the principles list, handles adding/removing, and renders the trade-off selection UI.

```typescript
'use client';

import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { TradeoffCard } from './TradeoffCard';
import { PrincipleChip } from './PrincipleChip';
import { CURATED_TRADEOFFS, CATEGORY_LABELS, type TradeoffOption } from '@/lib/curated-tradeoffs';
import type { Principle } from '@/lib/types';

interface PrinciplesSectionProps {
  projectId: string;
  initialPrinciples?: Principle[];
  onUpdate?: (principles: Principle[]) => void;
}

export function PrinciplesSection({
  projectId,
  initialPrinciples = [],
  onUpdate,
}: PrinciplesSectionProps) {
  const [principles, setPrinciples] = useState<Principle[]>(initialPrinciples);
  const [selectedCategory, setSelectedCategory] = useState<TradeoffOption['category']>('growth');
  const [saving, setSaving] = useState(false);

  // Filter out already-selected trade-offs
  const usedTradeoffIds = new Set(
    principles.map((p) => {
      const match = CURATED_TRADEOFFS.find(
        (t) =>
          (t.optionA === p.priority && t.optionB === p.deprioritized) ||
          (t.optionB === p.priority && t.optionA === p.deprioritized)
      );
      return match?.id;
    }).filter(Boolean)
  );

  const availableTradeoffs = CURATED_TRADEOFFS.filter(
    (t) => t.category === selectedCategory && !usedTradeoffIds.has(t.id)
  );

  const handleAddPrinciple = async (priority: string, deprioritized: string) => {
    const newPrinciple: Principle = {
      id: nanoid(),
      priority,
      deprioritized,
    };

    setSaving(true);
    try {
      const response = await fetch(`/api/project/${projectId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'principle',
          content: JSON.stringify(newPrinciple),
          status: 'complete',
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const updated = [...principles, newPrinciple];
      setPrinciples(updated);
      onUpdate?.(updated);
    } catch (error) {
      console.error('Failed to add principle:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/project/${projectId}/content?id=${id}`, {
        method: 'DELETE',
      });

      const updated = principles.filter((p) => p.id !== id);
      setPrinciples(updated);
      onUpdate?.(updated);
    } catch (error) {
      console.error('Failed to remove principle:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFlip = async (id: string) => {
    const principle = principles.find((p) => p.id === id);
    if (!principle) return;

    const flipped: Principle = {
      ...principle,
      priority: principle.deprioritized,
      deprioritized: principle.priority,
    };

    setSaving(true);
    try {
      await fetch(`/api/project/${projectId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          content: JSON.stringify(flipped),
        }),
      });

      const updated = principles.map((p) => (p.id === id ? flipped : p));
      setPrinciples(updated);
      onUpdate?.(updated);
    } catch (error) {
      console.error('Failed to flip principle:', error);
    } finally {
      setSaving(false);
    }
  };

  const atMaxPrinciples = principles.length >= 6;

  return (
    <div className="space-y-6">
      {/* Selected principles */}
      {principles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Your principles</h4>
          <div className="space-y-2">
            {principles.map((principle) => (
              <PrincipleChip
                key={principle.id}
                principle={principle}
                onRemove={() => handleRemove(principle.id)}
                onFlip={() => handleFlip(principle.id)}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400">
            {principles.length}/6 principles defined
          </p>
        </div>
      )}

      {/* Add more */}
      {!atMaxPrinciples && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">
            {principles.length === 0 ? 'Define your principles' : 'Add another principle'}
          </h4>

          {/* Category tabs */}
          <div className="flex gap-2">
            {(Object.keys(CATEGORY_LABELS) as TradeoffOption['category'][]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#0A2933] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Trade-off cards */}
          <div className="grid gap-2">
            {availableTradeoffs.map((tradeoff) => (
              <TradeoffCard
                key={tradeoff.id}
                tradeoff={tradeoff}
                onSelect={handleAddPrinciple}
                disabled={saving}
              />
            ))}
            {availableTradeoffs.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                All {CATEGORY_LABELS[selectedCategory].toLowerCase()} trade-offs selected
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PrinciplesSection.tsx
git commit -m "feat(ui): add PrinciplesSection container component"
```

---

## Task 6: Integrate PrinciplesSection into StrategyDisplay

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`

**Step 1: Import and render PrinciplesSection**

Replace the existing principles placeholder section with:

```typescript
// Add import
import { PrinciplesSection } from './PrinciplesSection';

// In the render, replace the placeholder principles section with:
<div className="bg-white rounded-xl p-6 shadow-sm border">
  <div className="flex items-center gap-2 mb-4">
    <h3 className="font-semibold text-[#0A2933]">Principles</h3>
    <span className="text-xs text-gray-400">("even over" statements)</span>
  </div>
  <PrinciplesSection
    projectId={projectId}
    initialPrinciples={statements.principles}
    onUpdate={(updated) => {
      if (onUpdate) {
        onUpdate({ ...statements, principles: updated });
      }
    }}
  />
</div>
```

**Step 2: Test**

Run: `npm run dev`
Test: Navigate to a strategy page, add principles using trade-off cards, verify persistence.

**Step 3: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git commit -m "feat(ui): integrate PrinciplesSection into StrategyDisplay"
```

---

## Task 7: Add Context-Aware Principle Suggestions (Optional A1)

**Files:**
- Create: `src/app/api/project/[id]/suggest-principles/route.ts`

**Note:** This task is optional and can be deferred. It requires AI to analyze fragments and suggest trade-offs.

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const guestId = cookieStore.get('guest_id')?.value;

  if (!session?.user?.id && !guestId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get project fragments
  const fragments = await prisma.fragment.findMany({
    where: { projectId },
    select: { content: true, themeName: true },
    take: 20,
  });

  if (fragments.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // Build context
  const context = fragments
    .map((f) => `Theme: ${f.themeName}\n${f.content}`)
    .join('\n\n');

  // Ask Claude to suggest trade-offs
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Based on these strategic themes from a business, suggest 4-6 relevant trade-off principles in "X even over Y" format.

${context}

Return as JSON array: [{ "optionA": "...", "optionB": "...", "reasoning": "..." }]

Focus on trade-offs that seem genuinely relevant to this specific business based on what they've discussed.`,
      },
    ],
  });

  // Parse response
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

  return NextResponse.json({ suggestions });
}
```

**Step 2: Update PrinciplesSection to show suggestions**

Add a "Suggested for you" section that fetches from this API when fragments exist.

**Step 3: Commit**

```bash
git add src/app/api/project/[id]/suggest-principles/route.ts
git commit -m "feat(api): add context-aware principle suggestions"
```

---

## Task 8: Verification

**Step 1: Run type check**

Run: `npm run type-check`
Expected: No type errors

**Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass

**Step 3: Run full verify**

Run: `npm run verify`
Expected: All checks pass

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: phase 2 complete - principles UX"
```

---

## Summary

**Phase 2 delivers:**
- Updated Principle type with priority/deprioritized model
- Curated library of 20 common business trade-offs
- TradeoffCard component for interactive selection
- PrincipleChip component for displaying selected principles
- PrinciplesSection container with full CRUD
- Optional: Context-aware AI suggestions

**Not included (deferred to later phases):**
- Custom principle creation (beyond curated library)
- Principle versioning (uses UserContent pattern instead)
