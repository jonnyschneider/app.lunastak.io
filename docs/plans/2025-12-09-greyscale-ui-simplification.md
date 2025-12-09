# Greyscale UI Simplification Plan

> **Branch:** development
> **Goal:** Simplify UI to elegant monotone greyscale wireframe style

## Overview

Remove all color inconsistencies and brand colors. Create a clean, elegant, wireframe-like interface using only greyscale palette.

**Principles:**
- Monotone greyscale only (whites, greys, blacks)
- Consistent styling across all components
- Keep existing canvas background
- White cards on grey canvas
- No bright colors (no blue, red, coral, etc.)
- Elegant but simple - like a high-fidelity wireframe

---

## Task 1: Update Tailwind Config for Greyscale

**Files:** `tailwind.config.ts`

Remove custom colors, keep only zinc/grey scale.

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        'sm': '0.25rem',
        'DEFAULT': '0.375rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
export default config;
```

**Commit:** `chore: simplify Tailwind config to greyscale only`

---

## Task 2: Simplify ChatInterface to Greyscale

**Files:** `src/components/ChatInterface.tsx`

**Changes:**
- Keep keyboard letter input (no button UI)
- User messages: `bg-zinc-800 text-white`
- Assistant messages: `bg-zinc-100 text-zinc-900` (light mode) / `bg-zinc-800 text-zinc-100` (dark mode)
- Borders: `border-zinc-200` (light) / `border-zinc-700` (dark)

```typescript
// User message bubble
className="bg-zinc-800 text-white rounded-lg p-4"

// Assistant message bubble
className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg p-4"

// Input field
className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"

// Send button
className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
```

**Commit:** `feat: simplify ChatInterface to greyscale palette`

---

## Task 3: Rebuild StrategyDisplay with Greyscale Cards

**Files:**
- `src/components/StrategyDisplay.tsx`
- DELETE: `src/components/StrategyFlow.tsx`

**Layout:**
- Remove ReactFlow visualization entirely
- Vision: Full-width grey card
- Mission: Full-width grey card
- Objectives: Responsive grid of white cards

```typescript
'use client';

import { StrategyStatements } from '@/lib/types';

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  thoughts?: string;
}

export default function StrategyDisplay({ strategy, thoughts }: StrategyDisplayProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Thoughts Section - Greyscale */}
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
      <div className="space-y-4">
        {/* Vision Card */}
        <div className="bg-zinc-800 dark:bg-zinc-700 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Vision
          </h3>
          <p className="text-lg font-medium text-white leading-relaxed">
            {strategy.vision}
          </p>
        </div>

        {/* Mission Card */}
        <div className="bg-zinc-700 dark:bg-zinc-600 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide mb-3">
            Mission
          </h3>
          <p className="text-lg font-medium text-white leading-relaxed">
            {strategy.mission}
          </p>
        </div>

        {/* Objectives Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategy.objectives.map((objective, index) => (
            <div
              key={index}
              className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm"
            >
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                Objective {index + 1}
              </h3>
              <p className="text-base text-zinc-900 dark:text-zinc-100 leading-relaxed">
                {objective}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Commit:** `feat: rebuild StrategyDisplay with greyscale card layout, remove ReactFlow`

---

## Task 4: Remove ReactFlow Dependencies

**Files:** `package.json`

```bash
npm uninstall reactflow @reactflow/node-resizer
```

**Verify:** `npm run build` succeeds

**Commit:** `chore: remove ReactFlow dependencies`

---

## Task 5: Simplify ExtractionConfirm to Greyscale

**Files:** `src/components/ExtractionConfirm.tsx`

```typescript
// Main card
className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 shadow-sm"

// Labels
className="text-sm font-medium text-zinc-700 dark:text-zinc-300"

// Values
className="text-zinc-900 dark:text-zinc-100"

// Reflective summary section
className="border-t pt-6 bg-zinc-50 dark:bg-zinc-900 -m-6 p-6 rounded-b-lg"

// Buttons
<button className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700">
  Generate my strategy
</button>
<button className="px-6 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
  Keep Exploring
</button>
```

**Commit:** `feat: simplify ExtractionConfirm to greyscale palette`

---

## Task 6: Simplify FeedbackButtons to Greyscale

**Files:** `src/components/FeedbackButtons.tsx`

```typescript
<button className="flex items-center gap-2 px-6 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">
  <span className="text-2xl">👍</span>
  <span className="text-zinc-900 dark:text-zinc-100">This is helpful</span>
</button>

// Thank you message
className="text-zinc-600 dark:text-zinc-400"
```

**Commit:** `feat: simplify FeedbackButtons to greyscale palette`

---

## Task 7: Verification & Testing

1. Run `npm run type-check` - verify no TypeScript errors
2. Run `npm run build` - verify build succeeds
3. Run `npm run dev` - test locally
4. Verify all screens are consistent greyscale
5. Test dark mode compatibility

**Commit:** `test: verify greyscale UI consistency`

---

## Task 8: Documentation

Update `session-notes.md`:

```markdown
## 2025-12-09 (Session 4): Greyscale UI Simplification

### Overview
Simplified entire UI to elegant monotone greyscale palette. Removed color inconsistencies and brand colors for clean wireframe-like aesthetic.

### Changes
- Removed all custom colors (blue, coral, red)
- Standardized to greyscale palette using Tailwind zinc scale
- Kept card-based Strategy Display layout
- Removed ReactFlow dependency
- Maintained keyboard letter input for chat options
- Consistent styling across all components

### Technical Details
**Files Modified:**
- `tailwind.config.ts` - Removed custom colors
- `src/components/ChatInterface.tsx` - Greyscale styling
- `src/components/StrategyDisplay.tsx` - Greyscale cards
- `src/components/ExtractionConfirm.tsx` - Greyscale styling
- `src/components/FeedbackButtons.tsx` - Greyscale styling

**Files Deleted:**
- `src/components/StrategyFlow.tsx`

**Dependencies Removed:**
- reactflow
- @reactflow/node-resizer
```

**Commit:** `docs: add session notes for greyscale UI simplification`

---

## Success Criteria

- ✅ No custom brand colors anywhere (no blue, coral, red)
- ✅ Consistent greyscale palette (zinc scale)
- ✅ ReactFlow removed completely
- ✅ Card-based Strategy Display with Vision/Mission/Objectives
- ✅ Keyboard letter input maintained for chat options
- ✅ Clean, elegant, wireframe-like aesthetic
- ✅ Dark mode compatible
- ✅ Build succeeds
- ✅ All tests pass
