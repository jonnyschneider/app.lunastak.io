# Contract-Driven Quality Foundation

**Date:** 2026-01-05
**Status:** Design Complete
**Estimated effort:** 1-1.5 days

## Problem Statement

The codebase has grown through rapid iteration, and the core conversation → extraction → generation pipeline has become risky to change. Small modifications cascade into unexpected breakages that surface late (in Vercel preview/prod) rather than early (locally).

Current state:
- 113 TypeScript files, ~47k lines
- 100+ tests, but not at the right boundaries
- Documentation is mostly historical (plan outputs), not living guidelines
- No automated verification of data contracts between layers

The core issue: **implicit coupling** in the pipeline means changes are unpredictable.

## Design Principles

1. **Schema is source of truth** - The Prisma schema defines what data should exist and how it relates. Contracts flow from this.

2. **Test seams, not internals** - We don't test every function. We test the boundaries where data crosses from one concern to another.

3. **Contracts are explicit** - When data passes between layers, its expected shape is documented and verified. No implicit assumptions.

4. **Smoke test catches regressions** - One command exercises the critical path. If it passes, the core flow works.

5. **Quality is automatic** - Checks run as part of the normal deploy flow. You don't have to remember.

## What We're NOT Doing

- Rewriting or refactoring the core pipeline
- Achieving 100% test coverage
- Heavy documentation that goes stale
- Over-engineering for scale

## Architecture

### Data Contract Mapping

Starting from the Prisma schema, we identify the critical data flows:

```
Conversation start → Creates Conversation + Trace records
       ↓
Each message exchange → Updates Trace.messages, may update extractedContext
       ↓
Extraction complete → Populates Trace.extractedContext and dimensionalCoverage
       ↓
Generation → Produces Trace.output (the strategy)
       ↓
Synthesis → Updates DimensionalSynthesis records
```

For each transition, we document:
- **Input shape** - What data is expected coming in
- **Output shape** - What data should exist after
- **Invariants** - What must always be true

### Contract Types Location

```
src/lib/contracts/
├── README.md              # How to use and update contracts
├── data-contracts.ts      # TypeScript types for all contracts
├── extraction.ts          # Extraction-specific contracts
├── generation.ts          # Generation-specific contracts
└── persistence.ts         # Database persistence contracts
```

### Integration Tests at Seams

Tests verify contracts are honored at boundaries:

```
src/lib/__tests__/contracts/
├── extraction-contracts.test.ts   # API → Extraction service
├── generation-contracts.test.ts   # Extraction → Generation
└── persistence-contracts.test.ts  # Service → Database
```

**What these tests verify:**
- Data shape matches contract (not exact values)
- Required fields are present
- Relationships are correctly established
- Invariants hold

### Smoke Test

One command exercises the full critical path:

```bash
npm run smoke
```

**What it tests:**
```
Start conversation →
  Exchange messages →
    Complete extraction →
      Generate strategy →
        Verify output exists and has expected shape
```

**Characteristics:**
- Uses test database
- Mocks AI responses (fast and deterministic)
- Runs in ~10-30 seconds
- Exit code 0 = pass, non-zero = fail

### Deploy Flow Integration

**Enhanced workflow:**
```
changelog → version → commit → type-check → tests → smoke → push dev → PR
```

**New commands:**
```bash
npm run verify    # Runs type-check + tests + smoke in sequence
npm run smoke     # Just the smoke test
```

**Optional pre-push hook:**
- Runs `npm run verify` before push
- Blocks if anything fails
- Bypass with `--no-verify` when needed

### Living Documentation

| Living (stays current) | Historical (archived) |
|------------------------|----------------------|
| `.claude/architecture.md` | `docs/plans/*` |
| `.claude/decisions.md` | `docs/session-notes/*` |
| `src/lib/contracts/README.md` | Old design docs |

**Living docs are updated as part of the change, not after.**

## Implementation Plan

### Phase 1: Audit & Map Contracts (~2 hours)

1. Trace the current data flow through the pipeline
2. Document the actual shapes at each boundary
3. Identify gaps and implicit assumptions
4. Create `src/lib/contracts/` structure

**Output:** Contract types that reflect current reality

### Phase 2: Contract Tests for Core Seam (~2 hours)

Focus on the extraction → generation boundary (where breakages occurred):

1. Write contract types for `extractedContext` shape
2. Write contract types for `output` (strategy) shape
3. Create integration tests that verify:
   - Extraction produces valid `extractedContext`
   - Generation accepts `extractedContext` and produces valid `output`

**Output:** Tests that would have caught the fragment cascade

### Phase 3: Smoke Test (~1-2 hours)

1. Create end-to-end test harness
2. Mock AI responses for determinism
3. Wire up full critical path
4. Verify final output shape

**Output:** `npm run smoke` command that exercises the core flow

### Phase 4: Deploy Flow Integration (~30 mins)

1. Create `npm run verify` script
2. Update package.json scripts
3. Optional: Add pre-push hook
4. Update PR template with checklist

**Output:** Quality checks baked into normal workflow

### Phase 5: Living Documentation (~1 hour)

1. Refresh `.claude/architecture.md` with current state
2. Create `.claude/decisions.md` for ongoing decision log
3. Write `src/lib/contracts/README.md`
4. Archive stale docs to `docs/archive/` if needed

**Output:** Documentation that stays current

### Phase 6: Review (~30 mins)

1. Devil's advocate review of the implementation
2. Verify the contracts actually match the code
3. Run full verify flow
4. Document any gaps for future work

**Output:** Confidence that the foundation is solid

## Success Criteria

- [ ] Contract types exist for extraction → generation boundary
- [ ] Integration tests verify contracts at key seams
- [ ] `npm run smoke` passes and takes < 60 seconds
- [ ] `npm run verify` runs full check suite
- [ ] Living docs are current and useful
- [ ] A breaking change to extraction format would be caught before push

## Future Considerations

Once this foundation is in place:
- Add contracts for other boundaries as needed
- Consider runtime validation (Zod) for external inputs
- Contract tests become the specification for refactoring
- New experiments start with "what contract does this need?"

## Appendix: Mental Model

```
┌─────────────────────────────────────────────────────────┐
│                    App Logic Layer                       │
│         (React components, UI, presentation)             │
│                   ← Cheap to change                      │
├─────────────────────────────────────────────────────────┤
│                  Service Logic Layer                     │
│      (Conversation flow, extraction, generation)         │
│                   ← Safe to experiment                   │
├─────────────────────────────────────────────────────────┤
│                   Contract Layer                         │
│         (Types, shapes, invariants, tests)               │
│                   ← Protected boundary                   │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                            │
│            (Prisma schema, database)                     │
│                   ← Intentional changes only             │
└─────────────────────────────────────────────────────────┘
```

Changes flow from top to bottom with increasing intentionality.
The contract layer protects the data layer and makes the layers above safe to iterate.
