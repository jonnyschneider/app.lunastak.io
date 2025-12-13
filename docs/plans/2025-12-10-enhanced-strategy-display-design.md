# Enhanced Strategy Display Design

**Date:** 2025-12-10
**Status:** Approved for implementation

## Overview

Enhance the Strategy Display to show the complete Decision Stack with interactive objective cards, filtered initiatives, and principles. Use hybrid component approach: Catalyst for app shell, shadcn for content components.

## Requirements

1. **Enhanced Objective Cards** - Flip cards with metrics on front, full details on back
2. **Complete the Stack** - Add Initiatives (cards) and Principles (bars)
3. **Filtering** - Toggle objectives to filter related initiatives

## Visual Design

### Layout Hierarchy (Top to Bottom)

1. **Vision Bar** - Full-width, zinc-800, largest text
2. **Mission Bar** - Full-width, zinc-700, large text
3. **Objectives Section** - Grid of interactive flip cards
4. **Initiatives Section** - Filtered grid of initiative cards
5. **Principles Section** - Flex layout of principle bars (2-3 per row)

### Spacing & Typography

- **Section spacing:** 1.5rem (24px) vertical gaps
- **Section headers:** "Objectives", "Initiatives", "Principles" - uppercase, zinc-500, text-xs
- **Responsive grids:** 1 col mobile, 2 col tablet, 3 col desktop

## Component Design

### 1. Objective Flip Cards

**Interaction:**
- Hover on desktop → flip card
- Tap on mobile → toggle flip state
- 600ms 3D rotation animation

**Front Face:**
- Pithy objective statement (1-2 sentences) - prominent text
- Metric badge (top-right) - just number/keyword (e.g., "25%", "Growth")
- Category badge (below metric) - small pill (e.g., "Revenue", "Customer", "Product")
- Filter toggle icon (top-left) - eye/eye-off for initiative filtering
- Flip indicator (bottom-right) - ⟳ icon

**Back Face:**
- Full SMART metric - complete measurable statement
- Detailed explanation - connects to mission/vision
- Success criteria - what achievement looks like
- Back indicator - ⟲ icon to flip back

**Visual Style:**
- Front: white bg (current style)
- Back: zinc-50 bg for differentiation
- Shadow increases on hover
- Greyscale palette throughout

### 2. Initiative Cards

**Content:**
- Title - bold, prominent
- Description - 2-3 sentences
- Related objective badges - pill badges at bottom showing which objectives this supports

**Filtering:**
- Show all by default
- When objective toggles are active, show only initiatives where `objectiveIds` intersects with active filters
- OR logic - show initiative if it relates to ANY toggled objective
- 300ms fade in/out transition

**Filter Controls:**
- Toggle icons on objective cards (eye/eye-off)
- Active state: eye icon filled, card subtle highlight
- "Clear all filters" button appears when filters active

### 3. Principle Bars

**Layout:**
- Flex wrap layout, 2-3 bars per row on desktop
- Full-width bars on mobile
- Similar styling to Vision/Mission but lighter (zinc-600)

**Content:**
- Title - medium weight
- Description - 1-2 sentences

## Data Model

### Type Definitions

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

export interface StrategyStatements {
  vision: string;
  mission: string;
  objectives: Objective[];
  initiatives: Initiative[];
  principles: Principle[];
}
```

## Implementation Plan

### Phase 1: Component Library Setup

1. **Install shadcn/ui**
   - Initialize shadcn in project
   - Add Card and Badge components
   - Harmonize with existing greyscale theme

2. **Create Custom Components**
   - `FlipCard.tsx` - Reusable 3D flip card
   - `ObjectiveCard.tsx` - Objective-specific flip card with filter toggle
   - `InitiativeCard.tsx` - Simple card with objective badges
   - `PrincipleBar.tsx` - Bar component for principles

### Phase 2: Update Data Layer

1. **Update Types** (`src/lib/types.ts`)
   - Add new interfaces: `ObjectiveMetric`, `Objective`, `Initiative`, `Principle`
   - Update `StrategyStatements` interface

2. **Placeholder Data Generator**
   - Function to generate 4-6 placeholder initiatives
   - Function to generate 6-9 placeholder principles
   - Random objective relationships for initiatives

3. **Update LLM Prompt** (future - for now use placeholders)
   - Modify generation prompt to output structured objectives with metrics
   - Keep initiatives and principles as placeholders for now

### Phase 3: StrategyDisplay Refactor

1. **State Management**
   - Add `activeObjectiveFilters: Set<string>` state
   - Filter logic for initiatives

2. **Layout Structure**
   - Vision bar (existing)
   - Mission bar (existing)
   - Objectives grid with flip cards
   - Initiatives grid with filtering
   - Principles flex layout
   - Section headers

3. **Filter UI**
   - Toggle icons on objective cards
   - Clear all filters button
   - Filter transition animations

### Phase 4: Styling & Polish

1. **Animations**
   - 3D flip animation (600ms ease-in-out)
   - Filter transitions (300ms)
   - Hover effects (200ms)

2. **Responsive Behavior**
   - Mobile: tap to flip, 1 column grids
   - Tablet: 2 column grids
   - Desktop: hover to flip, 3 column grids

3. **Accessibility**
   - ARIA labels for flip cards
   - Keyboard navigation for filters
   - Focus indicators

## Technical Details

### CSS Approach

- Use Tailwind utility classes
- 3D flip: `preserve-3d`, `backface-hidden`, `rotateY`
- Responsive grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Principles flex: `flex flex-wrap gap-4`

### Component Architecture

```
StrategyDisplay (main orchestrator)
├── Vision bar
├── Mission bar
├── Objectives section
│   └── ObjectiveCard (with FlipCard)
│       ├── Front (pithy + metric + toggle)
│       └── Back (full details)
├── Initiatives section
│   ├── Filter controls
│   └── InitiativeCard (filtered)
└── Principles section
    └── PrincipleBar
```

### Placeholder Data Strategy

**For initial implementation:**
- Generate realistic placeholder initiatives (4-6 items)
- Generate realistic placeholder principles (6-9 items)
- Use random but consistent objective relationships
- Store placeholder generation logic in utility function for easy replacement later

**Future enhancement:**
- Replace with actual LLM generation
- Build separate features for initiative and principle creation
- See `docs/future-improvements.md` for intake flow improvements

## Dependencies

**New:**
- shadcn/ui (copy/paste components)
  - Card component
  - Badge component

**Existing:**
- Catalyst (app shell - Sidebar, Navbar, Dropdown)
- Tailwind CSS (styling)
- Headless UI (from Catalyst)

## Success Criteria

- [ ] Objective cards flip on hover (desktop) / tap (mobile)
- [ ] Metrics display correctly on card front (summary + category)
- [ ] Full SMART details show on card back
- [ ] Filter toggles show/hide initiatives correctly
- [ ] OR logic works for multiple active filters
- [ ] Initiatives show related objective badges
- [ ] Principles display in 2-3 column flex layout
- [ ] All animations smooth (no jank)
- [ ] Responsive behavior works on mobile/tablet/desktop
- [ ] Greyscale aesthetic maintained
- [ ] Build succeeds with no errors

## Future Enhancements

See `docs/future-improvements.md`:
- Enhanced intake/questioning flow
- Real initiative generation with LLM
- Real principle generation with LLM
- Advanced filtering options (AND logic, saved filters)
- Export/share strategy views
