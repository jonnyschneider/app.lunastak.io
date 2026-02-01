# Dashboard Reorganization

## Overview

Simplify the project dashboard by consolidating related modules and reducing visual noise.

## Current Layout

1. **Luna's Memory** (full-width header)
2. **3-column grid:** Docs | Chats | Generated Strategies
3. **Deep Dives** (full-width with fixed RHS explainer panel)
4. **2-column grid:** Provocations | Strategic Gaps
5. **Current Strategy** view

## Proposed Layout

1. **Knowledgebase** (renamed header, always-visible Refresh button)
2. **2-column grid:** Docs | Chats
3. **2-column grid:** Explore Next | Go to Strategy (placeholder card)
4. **Current Strategy** (with version dropdown for history)

---

## Changes

### 1. Rename "Luna's Memory" to "Knowledgebase"

Simple rename. No structural changes to the header component.

### 2. Refresh Button Always Visible

Move Refresh button into the Knowledgebase status bar. Always visible, not conditionally displayed.

**Enabled state:**
- Label: "X new insights"
- Click triggers strategy refresh

**Disabled state:**
- Label: "Add more context to refresh"
- Button disabled
- Tooltip explains user needs more fragments

### 3. Remove "Generated Strategies" Module

Delete the third column from the top grid. Docs and Chats become a 2-column layout.

Version history moves to the Current Strategy area (see below).

### 4. Remove Deep Dives Fixed RHS Panel

Delete the "What are Deep Dives?" explainer panel. Deep Dives becomes a standard module.

### 5. Merge into "Explore Next"

Combine three lists into one unified "Explore Next" module:

| Type | Icon | Style | Source |
|------|------|-------|--------|
| Gap | Puzzle piece | Neutral/muted | AI-generated |
| Provocation | Bolt ⚡ | Neutral/muted | AI-generated |
| Deep Dive | Crosshairs | Small green | User-added |

**List item actions:**
- **Star** - pins to top, marks important
- **Dismiss** - removes from list
- **Click** - opens sheet with type-specific header

**Footer:** "+ Add topic" button for manual deep dive entries

**Sheet view:** When item opens, prominent header card shows item type label and context about why it's suggested (for AI-generated items).

**Empty state:** "Nothing to explore yet. Start a chat or upload a document to generate suggestions."

### 6. Add Placeholder Card

The second half of the Explore Next row contains a simple card:
- "Go to Strategy" button that scrolls to Current Strategy section
- Dismissable (once user is familiar)

### 7. Version Dropdown in Current Strategy

Add a version dropdown to the Current Strategy header:
- Shows "v3 (current) ▼" style selector
- Click to view older versions
- Current version is always default

---

## Implementation Tasks

### Task 1: Rename Luna's Memory to Knowledgebase
- Update `LunasMemoryHeader.tsx` component name and references
- Update all text labels from "Luna's Memory" to "Knowledgebase"

### Task 2: Refresh Button Always Visible
- Move Refresh button into Knowledgebase status bar
- Add disabled state with helper text
- Remove conditional rendering logic

### Task 3: Remove Generated Strategies Module
- Delete the third column from the 3-column grid
- Change grid from `md:grid-cols-3` to `md:grid-cols-2`
- Remove all Generated Strategies rendering code

### Task 4: Remove Deep Dives RHS Panel
- Delete the fixed right panel with explainer text
- Remove the `lg:grid-cols-2 divide-x` layout
- Make Deep Dives a standard card component

### Task 5: Create Explore Next Module
- Create new `ExploreNextSection.tsx` component
- Unify data from deep dives, provocations, and strategic gaps
- Add item type icons (puzzle piece, bolt, crosshairs)
- Implement star/dismiss/click actions
- Add "+ Add topic" button

### Task 6: Create Placeholder Card
- Simple card with "Go to Strategy" button
- Scroll-to-section behavior
- Dismissable (store in local storage or user preferences)

### Task 7: Add Version Dropdown to Current Strategy
- Add dropdown selector to strategy header
- Fetch and display version list
- Handle version selection to show historical strategy

### Task 8: Update Page Layout
- Restructure `project/[id]/page.tsx` grid layout
- Wire up new components
- Remove old Provocations and Strategic Gaps sections

### Task 9: Verify and Test
- Run type-check and tests
- Manual testing of all interactions
- Verify responsive behavior

---

## Files Affected

**Components to modify:**
- `src/components/LunasMemoryHeader.tsx` → rename + refresh button
- `src/app/project/[id]/page.tsx` → layout restructure

**Components to create:**
- `src/components/ExploreNextSection.tsx` → unified exploration list
- `src/components/GoToStrategyCard.tsx` → placeholder card (or inline)

**Components to remove/simplify:**
- Deep Dives RHS panel (inline in page.tsx)
- Provocations section (inline in page.tsx)
- Strategic Gaps section (inline in page.tsx)
- Generated Strategies module (inline in page.tsx)
