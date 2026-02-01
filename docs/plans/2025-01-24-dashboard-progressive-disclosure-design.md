# Dashboard Progressive Disclosure Design

## Overview

Restructure the dashboard to prioritize actionable content while keeping informational context accessible but not dominant. The core insight: **informational sections (Luna's Memory, Dimensions) are important for mental model but shouldn't interrupt the action flow**.

## Current Problems

1. **Mixed intent** - Informational and actionable sections interleaved creates cognitive dissonance
2. **Visual dominance** - "What Luna Knows" and "10 Strategic Dimensions" take up significant space
3. **Deep Dives disconnected** - Should be grouped with Provocations/Gaps as they're related (bridge to action)
4. **Overwhelming** - Too much visible at once, especially for returning users

## Design Solution

### New Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Luna's Memory (collapsed header)                                │
│ 47 insights • 8 chats • 70%                    ● 3 new to include ▼ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Documents &     │ │ Chats           │ │ Generated       │
│ Memos           │ │                 │ │ Strategies      │
│                 │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Deep Dives (full-width, no accordion)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌───────────────────────────────┐ ┌───────────────────────────────┐
│ Provocations                  │ │ Strategic Gaps                │
│ [3 items visible]             │ │ [3 items visible]             │
│ Show 4 more →                 │ │ Show 2 more →                 │
└───────────────────────────────┘ └───────────────────────────────┘
```

### Component 1: Luna's Memory Header

**Purpose:** Reinforce that Luna has memory ("gets it") - key differentiator from public LLMs. Must be visible but not dominating.

**Collapsed state:**
```
Luna's Memory    47 insights • 8 chats • 70%    ● 3 new to include ▼
```

- Stats (insights, chats, coverage %) in muted gray text
- "X new to include" gets green text + small dot indicator (actionable emphasis)
- Chevron indicates expandable

**Interactions:**
- Click header bar → expands to show full content
- Click "X new to include" → opens synthesis dialog directly (shortcut)

**Expanded state:**
- Knowledge summary paragraph (existing "What Luna Knows" content)
- 10 Strategic Dimensions grid in compact 2-row layout with Harvey balls
- "Collapse" or click header to close

### Component 2: Action Row (unchanged)

Three-column grid: Documents & Memos | Chats | Generated Strategies

No changes to existing implementation.

### Component 3: Deep Dives (moved up)

- Moves from below Dimensions to directly after Action Row
- Full-width panel layout retained
- No accordion - stays as-is with tabbed list + explainer
- Groups logically with Provocations/Gaps below (the "bridge" zone)

### Component 4: Provocations & Strategic Gaps

Follow existing dashboard pattern for progressive disclosure:

- Show first **3 items** in each section
- Ghost button: "Show X more" / "Show less"
- Existing `FOCUS_AREA_LIMIT = 3` pattern already implemented for Gaps
- Apply same pattern to Provocations

```typescript
const PROVOCATION_LIMIT = 3
const visibleProvocations = showAllProvocations
  ? allProvocations
  : allProvocations.slice(0, PROVOCATION_LIMIT)
```

## Visual Hierarchy Summary

| Zone | Content | Treatment |
|------|---------|-----------|
| Context | Luna's Memory | Collapsed header, expand on demand |
| Action | Docs, Chats, Strategies | Full cards, always visible |
| Bridge | Deep Dives | Full panel, moved up |
| Explore | Provocations, Gaps | Peek (3 items) + expand |

## Implementation Notes

1. **Luna's Memory header** - New component, replace existing "What Luna Knows" + "10 Strategic Dimensions" cards
2. **Move Deep Dives** - Reorder JSX, no logic changes
3. **Provocations limit** - Add `PROVOCATION_LIMIT` constant and expand/collapse state
4. **Badge counters preserved** - Keep all existing counters, they encourage interaction

## Future Considerations

- Dimensions and Luna's Memory could become interactive in future (click dimension to explore)
- Drawer approach could work if persistent access needed, but in-page feels cleaner for now
- Consider sticky header behavior for Luna's Memory on long pages
