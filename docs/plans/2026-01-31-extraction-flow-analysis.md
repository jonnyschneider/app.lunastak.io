# Extraction Flow Analysis

## Current Flow (AS-IS)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              /api/extract                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐                                                   │
│  │ Claude Call 1        │  Input: conversation history                      │
│  │ THEME EXTRACTION     │  Output: 3-7 themes with dimension tags           │
│  │ (~3-8s)              │                                                   │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ Claude Call 2        │  Input: conversation history (same)               │
│  │ REFLECTIVE SUMMARY   │  Output: strengths[], emerging[],                 │
│  │ (~3-8s)              │          opportunities[], thought_prompt          │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ Create Fragments     │  Writes themes to DB as fragments                 │
│  │ (DB write)           │  with dimension tags                              │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ Claude Calls 3-N     │  Per dimension with fragments:                    │
│  │ UPDATE SYNTHESES     │  full or incremental synthesis                    │
│  │ (~15-30s)            │                                                   │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ Claude Call N+1      │  Generates knowledge summary                      │
│  │ KNOWLEDGE SUMMARY    │  and provocations from fragments                  │
│  │ (~5-10s)             │                                                   │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│         COMPLETE ──────────────────────────────────────────────────────────►│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ExtractionConfirm                                   │
│  Shows: themes, strengths, emerging, opportunities, thought_prompt          │
│  User action: "Generate Strategy" or "Continue Conversation"                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              /api/generate                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐                                                   │
│  │ Claude Call          │  Input: themes + strengths + emerging +           │
│  │ STRATEGY GENERATION  │         opportunities (from reflective_summary)   │
│  │ (~5-10s)             │  Output: vision, strategy, objectives             │
│  └──────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Total blocking time: ~30-60s** (varies by # dimensions)

---

## Prompt Chain Analysis

### What data flows extract → generate?

```
EMERGENT_GENERATION_PROMPT uses:
├── {themes}      ← From theme extraction (Claude Call 1)
├── {strengths}   ← From reflective_summary (Claude Call 2)
├── {emerging}    ← From reflective_summary (Claude Call 2)
└── {unexplored}  ← From reflective_summary (Claude Call 2)
```

### Is reflective_summary essential?

**What REFLECTIVE_SUMMARY_PROMPT produces:**
- `strengths[]` - "What's clearly articulated and solid"
- `emerging[]` - "Themes that started to surface"
- `opportunities_for_enrichment[]` - "Areas that could benefit from deeper thinking"
- `thought_prompt` - "Open-ended question to spark reflection"

**How generate uses it:**
```
INSIGHTS FROM CONVERSATION:
Strengths identified:
{strengths}

Emerging patterns:
{emerging}

Areas to explore further:
{unexplored}
```

This is **hint data** - it guides the strategy generation but isn't strictly required. The generate prompt already has the full themes, which contain the actual content.

**Key insight:** The reflective_summary is a Claude-generated analysis of the conversation. The generate Claude call could do this analysis itself, or work without it (themes already contain the substance).

---

## Fragment Timing

```
Fragments are created AFTER theme extraction, BEFORE synthesis:

Theme Extraction → Create Fragments → Synthesis → Knowledge Summary
                   ▲
                   │
                   └── This happens in /api/extract
                       BEFORE 'complete' is sent
```

**Fragments are available for /api/generate** - they're created during extraction.

---

## Proposed Flow (TO-BE): Option C

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              /api/extract                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐                                                   │
│  │ Claude Call 1        │  Input: conversation history                      │
│  │ THEME EXTRACTION     │  Output: 3-7 themes with dimension tags           │
│  │ (~3-8s)              │                                                   │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ Create Fragments     │  Writes themes to DB as fragments                 │
│  │ (DB write)           │  with dimension tags                              │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│         COMPLETE ──────────────────────────────────────────────────────────►│
│             │                                                               │
│             ▼ (fire-and-forget via waitUntil)                               │
│  ┌──────────────────────┐                                                   │
│  │ BACKGROUND:          │                                                   │
│  │ - Reflective Summary │  Populates "Luna's Thinking" tab                  │
│  │ - Update Syntheses   │  Populates dimensional synthesis                  │
│  │ - Knowledge Summary  │  Populates "Your Thinking" page                   │
│  └──────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ (skip ExtractionConfirm)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              /api/generate                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐                                                   │
│  │ Claude Call          │  Input: themes only (no reflective_summary)       │
│  │ STRATEGY GENERATION  │  Output: vision, strategy, objectives,            │
│  │ (~5-10s)             │          + optional: thoughts/analysis            │
│  └──────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Strategy Page                                   │
│  - Decision Stack (vision, strategy, objectives)                            │
│  - Luna's Thinking tab (loads when background completes)                    │
│  - Fragments/synthesis (loads when background completes)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Total blocking time: ~10-18s** (theme extraction + strategy generation)

---

## Quality Impact Assessment

### Will removing reflective_summary affect strategy quality?

**Arguments FOR removing:**
1. Themes already contain the substance - reflective_summary is derivative
2. The generate prompt has full context to identify strengths/gaps itself
3. The `{thoughts}` output from generate already provides reasoning
4. "Luna's Thinking" tab will show this analysis anyway (from background)

**Arguments AGAINST removing:**
1. Two-stage analysis (extract → reflect → generate) may produce more nuanced output
2. reflective_summary forces explicit identification of gaps before generation
3. Current prompt was tuned with this data available

**Mitigation:**
- Modify generate prompt to include its own analysis step
- Add `<analysis>` section to generate output for strengths/gaps identification
- OR: Trust that themes are sufficient and simplify the prompt

### Recommendation

**Low risk to remove.** The reflective_summary is "meta-analysis" that adds color but not substance. The themes contain the actual content. We can:

1. **Option A:** Simplify generate prompt to work with themes only
2. **Option B:** Expand generate prompt to include its own brief analysis

Either way, "Luna's Thinking" tab will show the full analysis once background completes.

---

## Questions for Decision

1. **Prompt simplification vs expansion?**
   - Simplify: Remove strengths/emerging/unexplored from generate prompt
   - Expand: Have generate prompt produce its own analysis

2. **UI flow change?**
   - Skip ExtractionConfirm entirely (go straight to generating)
   - Or show minimal "Generating your strategy..." state

3. **What if background fails?**
   - Strategy page works fine (has decision stack)
   - Luna's Thinking shows "Still analyzing..." or empty state
   - Fragments/synthesis show loading state

---

## Summary

| Metric | Current | Proposed |
|--------|---------|----------|
| Blocking Claude calls | 2 + N + 1 | 2 |
| Blocking time | ~30-60s | ~10-18s |
| User steps | Extract → Review → Generate | Extract → Generate (automatic) |
| Risk | - | Low - themes contain the substance |
