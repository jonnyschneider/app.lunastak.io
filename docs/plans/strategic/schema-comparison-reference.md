# Schema Comparison: Current vs. Proposed V1

Quick reference for understanding what changes and why.

---

## Current Schema (What You Have Today)

```
User
  └── Conversation
       ├── Messages
       └── Trace (stores everything in JSON)
            ├── extractedContext (JSON)
            ├── dimensionalCoverage (JSON)
            └── output (JSON)
```

**Limitations:**
- ❌ Can't query "all fragments about Customer & Market"
- ❌ No multi-project support
- ❌ No cross-session synthesis
- ❌ No multi-source (voice/docs) support
- ❌ Hard to extend (everything in JSON blobs)

---

## Proposed V1 Schema (Where You're Going)

```
User
  └── Project (NEW - enables multi-project)
       ├── Conversation
       │    └── Messages
       ├── Document (NEW - voice memos, PDFs, text)
       ├── Fragment (NEW - extracted themes/insights)
       │    └── FragmentDimensionTag (NEW - which dimensions)
       ├── DimensionalSynthesis (NEW - compressed understanding)
       ├── GeneratedOutput (NEW - Decision Stack outputs)
       └── ExtractionRun (NEW - eval traces)
```

**Advantages:**
- ✅ Queryable fragments and syntheses
- ✅ Multi-project ready
- ✅ Cross-session synthesis (fragments accumulate)
- ✅ Multi-source ready (conversation + voice + docs)
- ✅ Extensible (structured + JSONB hybrid)
- ✅ Eval-friendly (ExtractionRun for experiments)

---

## Side-by-Side: Key Entities

### User (No Change)
| Current | Proposed V1 | Change |
|---------|-------------|--------|
| ✅ User | ✅ User | None - stays the same |

### Conversation
| Current | Proposed V1 | Change |
|---------|-------------|--------|
| `userId` | `projectId` + `userId` | **Now belongs to Project** |
| No extraction tracking | `extractionRuns` relation | **Links to ExtractionRun** |

### Extraction Storage
| Current | Proposed V1 | Change |
|---------|-------------|--------|
| `Trace.extractedContext` (JSON blob) | `Fragment` + `FragmentDimensionTag` (relational) | **Queryable, structured** |
| Stored per conversation only | Stored per project (accumulates) | **Cross-session synthesis** |

### Dimensional Coverage
| Current | Proposed V1 | Change |
|---------|-------------|--------|
| `Trace.dimensionalCoverage` (JSON) | `DimensionalSynthesis` (structured + JSONB) | **Queryable summary, themes, gaps** |
| Snapshot per conversation | Evolves across conversations | **Incremental synthesis** |

### Generated Outputs
| Current | Proposed V1 | Change |
|---------|-------------|--------|
| `Trace.output` (JSON) | `GeneratedOutput` (separate model) | **Versioned, linked to synthesis** |

### Evaluation/Experimentation
| Current | Proposed V1 | Change |
|---------|-------------|--------|
| `Trace` (dual-purpose: production + eval) | `ExtractionRun` (eval-focused) | **Cleaner separation of concerns** |
| Stores duplicate data | Stores references (fragmentIds) | **Less redundancy** |

---

## What Gets Added

### New Tables

1. **`Project`**
   - Why: Boundary for strategic understanding, enables multi-project
   - When to use: Create one per user on signup, create more when user wants multiple strategies

2. **`Document`**
   - Why: Handle voice memos (transcribed) and document uploads
   - When to use: User uploads file or records voice memo

3. **`Fragment`**
   - Why: Store extracted themes/insights as queryable entities
   - When to use: After extraction step, create fragments from conversation or document

4. **`FragmentDimensionTag`**
   - Why: Many-to-many tagging with metadata (confidence, reasoning)
   - When to use: When fragment is relevant to dimension (can be multiple)

5. **`DimensionalSynthesis`**
   - Why: Store compressed understanding per dimension
   - When to use: Created on project initialization (11 per project), updated after extraction

6. **`GeneratedOutput`**
   - Why: Store Decision Stack artifacts separately from synthesis
   - When to use: After generation step, save vision/strategy/objectives/etc.

7. **`ExtractionRun`**
   - Why: Atomic trace for evaluation and A/B testing
   - When to use: Every extraction, stores metadata for experiment tracking

### New Relations

- `User → Project` (1:N)
- `Project → Conversation` (1:N)
- `Project → Document` (1:N)
- `Project → Fragment` (1:N)
- `Fragment → FragmentDimensionTag` (1:N)
- `Project → DimensionalSynthesis` (1:11, one per Tier 1 dimension)
- `Project → GeneratedOutput` (1:N)
- `Project → ExtractionRun` (1:N)

---

## What Gets Deprecated

### `Trace` → `LegacyTrace`

| Field | Current Use | V1 Replacement |
|-------|-------------|----------------|
| `extractedContext` | Store themes/insights | → `Fragment` records |
| `dimensionalCoverage` | Store dimension tags | → `FragmentDimensionTag` records |
| `output` | Store Decision Stack | → `GeneratedOutput` record |
| `userFeedback`, `qualityRating` | Eval tracking | → `ExtractionRun` fields |

**Migration strategy:**
- Rename `Trace` → `LegacyTrace` (keep table for history)
- Stop writing new Traces (use Fragment/Synthesis/ExtractionRun instead)
- Optionally extract fragments from historical Traces (not required)

---

## Example: Before & After Queries

### Query 1: "Get all themes about Customer & Market"

**Current (Hard):**
```typescript
// Can't query directly - need to scan all Traces
const traces = await prisma.trace.findMany({
  where: { userId }
})

const themes = traces.flatMap(trace => {
  const coverage = trace.dimensionalCoverage as any
  const customerThemes = coverage.dimensions
    ?.find(d => d.name === 'CUSTOMER_MARKET')
    ?.themes || []
  return customerThemes
})
```

**V1 (Easy):**
```typescript
const fragments = await prisma.fragment.findMany({
  where: {
    projectId,
    status: "active",
    dimensionTags: {
      some: { dimension: "CUSTOMER_MARKET" }
    }
  }
})
```

---

### Query 2: "Show synthesis for all dimensions"

**Current (Hard):**
```typescript
// Need to merge across all Traces manually
const traces = await prisma.trace.findMany({
  where: { userId },
  orderBy: { timestamp: 'desc' }
})

// Extract latest dimensionalCoverage, merge manually
// ... complex logic ...
```

**V1 (Easy):**
```typescript
const syntheses = await prisma.dimensionalSynthesis.findMany({
  where: { projectId }
})

// Already merged, always up-to-date
```

---

### Query 3: "Compare extraction quality across variants"

**Current (Medium):**
```typescript
const baselineTraces = await prisma.trace.findMany({
  where: { experimentVariant: "baseline-v1" }
})

const variantTraces = await prisma.trace.findMany({
  where: { experimentVariant: "emergent-extraction-v2" }
})

// Compare extractedContext manually
```

**V1 (Easy):**
```typescript
const baselineRuns = await prisma.extractionRun.findMany({
  where: { experimentVariant: "baseline-v1" },
  include: { generatedOutput: true }
})

const variantRuns = await prisma.extractionRun.findMany({
  where: { experimentVariant: "emergent-extraction-v2" },
  include: { generatedOutput: true }
})

// Compare fragmentIds, synthesis deltas, output quality
```

---

## Data Flow: Current vs. V1

### Current Flow

```
User has conversation
  ↓
Extraction step
  ↓
Create Trace with:
  - extractedContext (JSON blob)
  - dimensionalCoverage (JSON blob)
  - output (JSON blob)
  ↓
User views output
  ↓
(Next conversation = new Trace, no cross-session synthesis)
```

### V1 Flow

```
User has conversation (in Project)
  ↓
Extraction step
  ↓
Create ExtractionRun + Fragments
  ↓
Tag Fragments → Dimensions
  ↓
Update DimensionalSynthesis (incremental)
  ↓
Generate output → GeneratedOutput
  ↓
User views output
  ↓
(Next conversation = new Fragments → update existing Synthesis)
        ↑
    Synthesis evolves across sessions
```

---

## Migration Impact by Stakeholder

### For Developers
- **Code changes**: Update extraction flow to create Fragments instead of Traces
- **Query changes**: Use `Fragment` and `DimensionalSynthesis` queries
- **New concepts**: Understand synthesis update algorithm
- **Timeline**: ~2 days for migration + code updates

### For Users
- **UX changes**: None initially (backend change only)
- **New features unlocked**: Multi-project, voice memos, better cross-session synthesis
- **Data preservation**: All historical conversations preserved (in LegacyTrace)

### For Experiments/Evals
- **Eval tracking**: Cleaner with `ExtractionRun` (vs. dual-purpose Trace)
- **A/B testing**: Easier to compare variants
- **Error coding**: Same fields as Trace, easier to query

---

## Key Metrics: Current vs. V1

| Metric | Current | V1 | Change |
|--------|---------|----|----|
| **Tables** | 10 | 17 | +7 new tables |
| **JSON blobs** | 3 per Trace | 2 (subdimensions, synthesis snapshots) | More structured |
| **Queryable fragments** | No | Yes | New capability |
| **Cross-session synthesis** | No | Yes | New capability |
| **Multi-project support** | No | Yes | New capability |
| **Multi-source support** | No | Yes (Conversation + Document) | New capability |

---

## Quick Decision Guide

**Should I migrate?**

✅ YES if you:
- Want multi-project per user
- Want voice memos or document uploads
- Need cross-session synthesis
- Need better eval infrastructure
- Want queryable fragments/themes

⚠️ MAYBE if you:
- Just need minor schema tweaks
- Don't plan to add features soon

❌ NO if you:
- Current schema works perfectly
- No new features planned
- Pure experimentation phase (not building product)

---

## Timeline Reference

| Phase | Duration | Reversible? |
|-------|----------|-------------|
| 1. Add new tables | 30 min | ✅ Yes |
| 2. Create default projects | 1 hour | ✅ Yes |
| 3. Link conversations to projects | 2 hours | ✅ Yes |
| 4. Initialize syntheses | 1 hour | ✅ Yes |
| 5. Update app code | 1 day | ⚠️ Code rollback |
| 6. Migrate historical traces (optional) | 4 hours | ✅ Yes |
| 7. Deprecate Trace | 1 hour | ✅ Yes (rename back) |

**Total: ~2 days** (including testing)

---

## Questions? Quick Answers

**Q: Do I lose any data?**
A: No. Historical Traces preserved, all conversations kept.

**Q: Can I roll back?**
A: Yes, each phase is reversible until you deploy new code (Phase 5).

**Q: What breaks?**
A: Nothing until Phase 5 (code changes). Phases 1-4 are additive.

**Q: Can I test this first?**
A: Yes! Run migration on local dev DB, test thoroughly before production.

**Q: What about guests (no userId)?**
A: Create Project with `userId = null` for guest sessions.

**Q: How do I know synthesis is working?**
A: Check `DimensionalSynthesis` records after extraction, verify summary/themes populated.

**Q: Can I still run old Trace queries?**
A: Yes, LegacyTrace table remains for historical data.

---

## Final Comparison: Philosophy

### Current Schema Philosophy
- **Move fast**: JSON blobs for flexibility
- **Single-session**: Each conversation independent
- **Dual-purpose**: Production + eval in Trace

### V1 Schema Philosophy
- **Intentional structure**: Queryable where it matters, JSONB where emergent
- **Cross-session**: Synthesis evolves over time
- **Separation of concerns**: Production (Fragments/Synthesis) vs. Eval (ExtractionRun)
- **Extensibility**: Right abstraction boundaries for future growth

**Both are valid.** V1 is appropriate when you're transitioning from pure experimentation to building a product with multi-session synthesis as core feature.
