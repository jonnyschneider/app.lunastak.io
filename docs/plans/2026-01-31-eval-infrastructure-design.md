# Eval Infrastructure Design

**Date:** 2026-01-31
**Status:** Approved
**Purpose:** Enable systematic evaluation of prompt versions and generation quality

## Overview

Build lightweight eval infrastructure to support prompt iteration through expert review. Replace stale Jupyter notebooks with purpose-built tooling that fits the project's iteration speed.

## Goals

1. Export trace data from DB to portable JSON format
2. Compare outputs from same input across different prompt versions
3. Capture component-level evaluation notes and tags
4. Track findings to inform prompt improvements

## Non-Goals (for now)

- Cohort/aggregate comparison across trace groups
- Database sync for querying eval data
- Automated LLM-as-judge scoring
- More than 2 variants per eval

## Data Model

### Trace JSON

Location: `evals/traces/{traceId}.json`

```json
{
  "id": "abc123",
  "exportedAt": "2026-01-31T12:00:00Z",
  "promptVersions": {
    "extraction": "v1-emergent",
    "generation": "v2-themes-only"
  },
  "components": {
    "conversation": {
      "messages": [...],
      "questionCount": 5
    },
    "extraction": {
      "themes": [...],
      "dimensionalCoverage": {...},
      "reflectiveSummary": {...}
    },
    "generation": {
      "vision": "...",
      "strategy": "...",
      "objectives": [...]
    }
  },
  "timing": {
    "extractionMs": 12000,
    "generationMs": 29000
  }
}
```

### Eval JSON

Location: `evals/{name}.eval.json`

```json
{
  "name": "Summary vs Themes-Only",
  "date": "2026-01-31",
  "purpose": "Compare generation quality with/without reflective summary",
  "traces": ["abc123", "def456"],
  "baseline": "abc123",
  "evaluation": {
    "abc123": {
      "conversation": { "notes": "", "tags": [] },
      "extraction": { "notes": "", "tags": [] },
      "generation": { "notes": "", "tags": [] }
    },
    "def456": {
      "conversation": { "notes": "", "tags": [] },
      "extraction": { "notes": "", "tags": [] },
      "generation": { "notes": "", "tags": [] }
    }
  },
  "summary": "",
  "outcome": ""
}
```

### Tags JSON

Location: `evals/tags.json`

```json
{
  "conversation": [],
  "extraction": [],
  "generation": []
}
```

Tags are component-scoped and evolve organically as patterns emerge during review.

## Export Scripts

### export-trace.ts

Extracts trace data from DB, transforms to JSON.

```bash
# Export single trace
npx tsx scripts/export-trace.ts --traceId abc123

# Export multiple traces
npx tsx scripts/export-trace.ts --traceId abc123 --traceId def456

# Export by project (all traces for a project)
npx tsx scripts/export-trace.ts --projectId xyz789
```

Behavior:
- Fetches trace with related conversation, messages, extraction data
- Transforms to trace JSON structure
- Writes to `evals/traces/{traceId}.json`
- Skips existing files (use `--force` to overwrite)

### create-eval.ts

Scaffolds a new eval file.

```bash
npx tsx scripts/create-eval.ts --name "summary-vs-themes" --traces abc123,def456 --baseline abc123
```

Creates `evals/2026-01-31-summary-vs-themes.eval.json` with empty evaluation structure.

## Admin UI

Route: `/admin/eval/[evalId]`

Example: `/admin/eval/2026-01-31-summary-vs-themes`

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Eval: Summary vs Themes-Only          [Save] [Export]   │
├─────────────────────────────────────────────────────────┤
│ Purpose: Compare generation quality with/without...     │
├───────────────────────┬─────────────────────────────────┤
│   BASELINE (abc123)   │   VARIANT (def456)              │
├───────────────────────┼─────────────────────────────────┤
│ ▼ Conversation        │ ▼ Conversation                  │
│   [messages...]       │   [messages...]                 │
│   Notes: [________]   │   Notes: [________]             │
│   Tags: [+]           │   Tags: [+]                     │
├───────────────────────┼─────────────────────────────────┤
│ ▼ Extraction          │ ▼ Extraction                    │
│   [themes, dims...]   │   [themes, dims...]             │
│   Notes: [________]   │   Notes: [________]             │
│   Tags: [+]           │   Tags: [+]                     │
├───────────────────────┼─────────────────────────────────┤
│ ▼ Generation          │ ▼ Generation                    │
│   Vision: ...         │   Vision: ...                   │
│   Strategy: ...       │   Strategy: ...                 │
│   Objectives: ...     │   Objectives: ...               │
│   Notes: [________]   │   Notes: [________]             │
│   Tags: [+]           │   Tags: [+]                     │
├───────────────────────┴─────────────────────────────────┤
│ Summary: [___________________________________________]  │
│ Outcome: [___________________________________________]  │
└─────────────────────────────────────────────────────────┘
```

### Features

- Side-by-side comparison with collapsible sections
- Inline editing for notes (auto-saves to JSON)
- Tag picker with typeahead (shows existing tags + create new)
- New tags auto-added to `tags.json`
- Summary/outcome fields for overall conclusions

### File Operations

- **Save**: Writes evaluation data back to `.eval.json` file
- **Export**: Downloads the eval JSON (for sharing/archiving)

No tag management UI - edit `tags.json` directly to rename, merge, or delete tags.

## Directory Structure

```
evals/
  tags.json                              # Component-scoped tag definitions
  traces/
    cml1lvd1b000fcz9eyd6t7sh0.json       # Exported trace
    cml1m1idua6msfq4l.json               # Another trace
  2026-01-31-summary-vs-themes.eval.json # Eval comparing two traces
  2026-01-31-extraction-optimisation.json # Existing eval (migrate format)
```

## Notebook Archival

Move existing notebooks to `docs/notebooks/` (gitignored):
- `notebooks/trace_analysis_starter.ipynb`
- `notebooks/dimensional_coverage_analysis.ipynb`

Preserved for reference but removed from repo.

## Implementation Approach

1. Create TypeScript types for trace/eval JSON structures
2. Build export-trace.ts script
3. Build create-eval.ts script
4. Create admin eval viewer UI
5. Add auto-save and tag management
6. Archive notebooks
7. Migrate existing eval to new format
