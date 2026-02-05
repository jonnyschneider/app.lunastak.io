# Activity A3: Data Architecture & Multi-Session Knowledge

**Activity Code:** A3
**Type:** Supporting R&D Activity
**Period:** January 2026 - Ongoing

---

## Unknown Outcome

Whether a data architecture can be designed that enables strategic knowledge to accumulate across multiple sessions while maintaining coherence, supporting rapid experimentation, and preventing data corruption during schema evolution.

**Specific unknowns:**
1. Can fragment-based architecture support continuous knowledge accumulation?
2. Do TypeScript contracts at data boundaries catch breaking changes without excessive overhead?
3. How should strategic insight be decomposed for storage and synthesis?
4. Can incremental synthesis maintain coherence as knowledge accumulates?
5. What schema patterns support both experimentation and production stability?

---

## Why Existing Knowledge is Insufficient

1. **Novel knowledge structure:** Strategic insight doesn't fit standard data models (documents, records, graphs). The optimal decomposition is unknown.

2. **Accumulation challenge:** Knowledge must accumulate across sessions without becoming incoherent or contradictory. No established patterns exist.

3. **Schema evolution risk:** Rapid experimentation requires frequent schema changes. Standard migration approaches are too slow and risky.

4. **Synthesis complexity:** Combining fragments into coherent understanding requires algorithms that don't exist in literature.

---

## Systematic Work Conducted

### 1. Fragment-Based Knowledge Architecture (v1.4.0)

**Challenge:** Enable knowledge to accumulate across multiple conversations and documents

**Design decisions:**
- **Fragment model:** Discrete pieces of strategic insight (not full documents)
- **FragmentDimensionTag:** Links fragments to strategic dimensions
- **Source tracking:** Each fragment linked to source conversation or document
- **Temporal ordering:** Fragments timestamped for recency weighting

**Evidence:** v1.4.0 CHANGELOG; `src/lib/fragments.ts`

### 2. Dimensional Synthesis (v1.4.0)

**Challenge:** Compress many fragments into coherent per-dimension understanding

**Algorithms developed:**
- **Full synthesis:** Process all fragments for a dimension from scratch
- **Incremental synthesis:** Merge new fragments into existing synthesis
- **Staleness detection:** Determine when full re-synthesis needed

**Key insight:** Synthesis must balance compression (concise understanding) with source fidelity (not losing important nuance).

**Evidence:** `src/lib/synthesis/full-synthesis.ts`, `src/lib/synthesis/incremental-synthesis.ts`

### 3. Contract-Driven Quality System (v1.4.4)

**Challenge:** Prevent breaking changes during rapid experimentation

**Solutions developed:**
- TypeScript contracts at extraction/persistence/generation boundaries
- Contract validation tests (extraction, persistence, generation)
- Smoke tests for critical path verification
- Pre-push hook enforcing `npm run verify`

**Outcome:** Contracts caught multiple breaking changes during E3 development

**Evidence:** v1.4.4 CHANGELOG; `src/lib/contracts/README.md`

### 4. Schema Evolution Strategy

**Challenge:** Balance experimentation velocity with data integrity

**Approach:**
- Prisma schema as protected boundary (explicit change control)
- Contracts define expected shapes at pipeline boundaries
- `npm run verify` gates all pushes
- Preview deployments for schema testing before production

**Evidence:** `docs/ARCHITECTURE.md` schema change policy

### 5. Multi-Session Knowledge Refresh (v1.7.1)

**Challenge:** Strategy needs updating as new knowledge arrives

**Solutions developed:**
- Compare existing vs new fragments using `knowledgeUpdatedAt` timestamp
- Generate change summary highlighting what's new
- Version chain via `GeneratedOutput.previousOutputId`

**Evidence:** v1.7.1 CHANGELOG

### 6. Guest User Isolation (v1.4.0)

**Challenge:** Track knowledge for unauthenticated users, then merge on auth

**Solutions developed:**
- Guest users create real User + Project records
- Full fragment tracking for all users
- Session transfer merges data on authentication
- Cascade delete for empty guest projects

**Evidence:** v1.4.0 CHANGELOG; `src/lib/projects.ts`, `src/lib/transferSession.ts`

---

## New Knowledge Generated

### Validated Findings

1. **Fragments work:** Decomposing strategic insight into discrete fragments with dimension tags supports accumulation without coherence loss.

2. **Contracts catch breaks:** TypeScript contracts at data boundaries catch breaking changes during rapid iteration with minimal overhead.

3. **Incremental synthesis viable:** New knowledge can be merged into existing synthesis without full reprocessing, though quality monitoring needed.

4. **Source linking essential:** Users need to trace generated insight back to source. Data architecture must preserve this lineage.

### Documented Compromises

| Compromise | Status | Rationale |
|------------|--------|-----------|
| Sequential synthesis (slow) | Okay for now | Parallelisation adds coherence risk |
| Full re-synthesis on conflicts | Okay for now | Conflict resolution algorithms complex |
| Guest project cascade delete | Durable | Simpler than merge logic |

### Pending Validation

- Optimal fragment granularity (sentence vs paragraph vs theme)
- Synthesis quality as fragment count grows (100+)
- Cross-project knowledge sharing patterns
- Conflict resolution when sources contradict

---

## Evidence References

| Evidence Type | Location | Description |
|---------------|----------|-------------|
| Fragment Service | `src/lib/fragments.ts` | Fragment creation/retrieval |
| Synthesis Algorithms | `src/lib/synthesis/*.ts` | Full/incremental synthesis |
| Contract Documentation | `src/lib/contracts/README.md` | Contract system explanation |
| Contract Tests | `src/lib/__tests__/contracts/*.test.ts` | Validation test suites |
| Smoke Tests | `src/lib/__tests__/smoke.test.ts` | Critical path verification |
| Architecture Doc | `docs/ARCHITECTURE.md` | Schema policy, compromises |

---

## Expenditure Allocation

Estimated **15%** of total R&D time allocated to A3 activities:
- Fragment architecture design and implementation
- Synthesis algorithm development
- Contract system design and implementation
- Test infrastructure (contract tests, smoke tests)
- Schema evolution management
- Guest user isolation and session transfer

---

## Relationship to Other Activities

- **A1 (Judgement Engine):** A3 provides the data structures A1 operates on
- **A2 (Observability):** A3 trace structures enable A2 analysis
- **A4 (Interaction Design):** A3 multi-session support shapes A4 navigation patterns
- **A5 (Performance):** A3 synthesis algorithms are performance-critical

---

## Why This is R&D (Not Standard Data Modelling)

Standard data modelling applies known patterns to known domains. A3 addresses research questions:

1. *How should strategic knowledge be decomposed?* (No prior work)
2. *Can fragments maintain coherence as they accumulate?* (Uncertain outcome)
3. *What synthesis algorithms preserve quality?* (Novel algorithms required)

The fragment/synthesis architecture is a hypothesis about knowledge representation, not an application of established patterns.
