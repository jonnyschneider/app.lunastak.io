# Project Navigation Restructure Design

**Date:** 2026-01-13
**Status:** Draft
**Scope:** Sidebar restructure, project view split into Strategy/Thinking/Outcomes

---

## Problem

Current UI has several issues:

1. **"New Chat" / "Upload" buttons at sidebar top are ambiguous** - With multiple projects, which one are you adding to?
2. **Project view is overwhelming** - Too many things competing for attention, no clear path
3. **No distinction between locked strategy and ongoing thinking** - Everything is mixed together
4. **Actions are context-less** - User doesn't know *why* they'd add more content

---

## Solution Overview

Restructure navigation to reflect the three Jobs to be Done:

| Job | Nav Item | What it is |
|-----|----------|------------|
| **Clarify** | Strategy | The locked artifact (point-in-time output) |
| **Adapt** | Thinking | Second brain for continuous capture and refinement |
| **Operate** | Outcomes | Enable decisions from results (fake door for now) |

---

## Sidebar Structure

### Before

```
[Logo]

Quick Actions
├── [New Chat] [Upload]    ← ambiguous, context-less

Projects
├── My Strategy
└── Demo: Catalyst

Your Lunastak
├── Settings
└── ...
```

### After

```
[Logo]

Projects
├── My Strategy
│   ├── Strategy           ← locked artifact
│   ├── Thinking           ← second brain (default view)
│   └── Outcomes           ← [coming soon]
├── Demo: Catalyst
│   └── ...
└── + New Project

Your Lunastak
├── Settings
└── ...
```

**Key changes:**
- Remove top-level "New Chat" / "Upload" buttons
- Add submenu under each project showing Strategy / Thinking / Outcomes
- "Outcomes" shows "[coming soon]" badge (fake door)
- Project context menu retains: New Chat, Upload, Delete

---

## View Contents

### Strategy View

The locked artifact from the last Clarify cycle.

**Contains:**
- Vision statement
- Strategy statement
- Objectives (with metrics)
- "Last updated: [date]"
- "Regenerate Strategy" CTA (when new thinking available)

**What it doesn't have:**
- Deep Dives, Luna Wonders, Worth Exploring (those are Thinking)
- Conversations, Documents list (those are inputs, live in Thinking)

### Thinking View

The second brain. Where most time is spent.

**Contains:**
- **What Luna Knows** - Current understanding summary
- **Luna Wonders** - Provocations (with CTAs: Add Context / Create Deep Dive)
- **Worth Exploring** - Gap-based provocations (with CTAs)
- **Deep Dives** - Areas of value being explored
- **Recent Activity** - Conversations, Documents (collapsed/summary)
- **Quick Capture** - Prominent CTAs for New Chat, Upload Doc

**Design principle:** Luna Wonders and Worth Exploring are provocations that lead to either:
1. Add more context (conversation/doc) → breadth
2. Create Deep Dive → depth

### Outcomes View (Fake Door)

**Shows:**
- "Coming Soon" messaging
- Brief description: "Monthly reviews, quarterly planning, decision artifacts—all connected to your strategy."
- Optional: Interest capture ("Notify me when available")

---

## Navigation Behavior

### Default View
When clicking a project name → opens **Thinking** view (where most engagement happens)

### Submenu Items
- Strategy → `/project/[id]/strategy`
- Thinking → `/project/[id]` (or `/project/[id]/thinking`)
- Outcomes → `/project/[id]/outcomes` (fake door)

### Project Context Menu
Right-click or "..." menu on project:
- New Chat
- Upload Document
- Delete Project

---

## Migration Path

### Current URLs
- `/project/[id]` → Project view (everything)

### New URLs
- `/project/[id]` → Redirects to Thinking (default)
- `/project/[id]/strategy` → Strategy view
- `/project/[id]/thinking` → Thinking view (same as `/project/[id]`)
- `/project/[id]/outcomes` → Outcomes view (fake door)

---

## Implementation Phases

### Phase 1: Sidebar Restructure
1. Add collapsible submenu to project items
2. Add Strategy / Thinking / Outcomes items
3. Remove top-level "New Chat" / "Upload" buttons
4. Add "New Chat" / "Upload" / "Delete" to project context menu

### Phase 2: Split Views
1. Create `/project/[id]/strategy` route
2. Move strategy artifact display to Strategy view
3. Refactor current project view as Thinking view
4. Add "Outcomes" fake door page

### Phase 3: Thinking View Polish
1. Add prominent quick capture CTAs
2. Refine Luna Wonders / Worth Exploring with action buttons
3. Add "What's new since last strategy" indicator

---

## Out of Scope

- Voice memo capture (future Adapt enhancement)
- Email forwarding (future Adapt enhancement)
- MBR generation (future Outcomes feature)
- Strategy versioning/history (future Clarify enhancement)

---

## Success Criteria

1. User can immediately see Strategy / Thinking / Outcomes structure in sidebar
2. "New Chat" and "Upload" are discoverable within Thinking view
3. No confusion about which project actions apply to
4. Fake door captures interest signal for Outcomes

---

## References

- `docs/positioning/jobs-to-be-done.md` - JTBD framework informing this design	
