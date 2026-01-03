# Database Schema Design: Summary & Next Steps

**Date:** 2026-01-03
**Status:** Design Complete, Ready for Review
**Effort:** ~2 days implementation + migration

---

## What We Designed

A **project-scoped, fragment-based synthesis architecture** that:

1. ✅ **Supports multi-source input** (conversations, voice memos, documents)
2. ✅ **Enables multi-project** per user today, multi-user later
3. ✅ **Structures dimensional synthesis** (queryable themes + emergent subdimensions)
4. ✅ **Preserves evaluation traces** for experimentation and quality assessment
5. ✅ **Avoids premature optimization** while maintaining extensibility
6. ✅ **Uses tiered fragment lifecycle** (active → archived → soft deleted)

---

## Core Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Boundary entity** | `Project` | Enables multi-project today, multi-user tomorrow. Each project = one strategic understanding. |
| **Source handling** | `Conversation` + `Document` (includes voice) | Voice memos are transcribed = text documents. Two source types, not three. |
| **Fragment tagging** | `FragmentDimensionTag` junction table | Extensible metadata per tag (confidence, reasoning), supports ML training. |
| **Synthesis storage** | Hybrid: structured fields + JSONB | Core fields (summary, themes, gaps) queryable. Subdimensions emergent in JSONB. |
| **Synthesis timing** | Batch (after extraction step) | Aligns with user flow, efficient, one synthesis per dimension per session. |
| **Fragment lifecycle** | `active → archived → soft_deleted` | Invisible to user, enables hard delete later after validation. |
| **Evaluation** | `ExtractionRun` model | Atomic trace of extraction+synthesis+output for A/B tests and error coding. |
| **Multi-tenancy** | Deferred (add `Organization` later) | Not needed for experimentation phase. Add when you have paying teams. |

---

## Schema Structure Overview

```
User
  └── Project (1:N - multi-project support)
       ├── Conversations (interactive sessions)
       ├── Documents (voice memos, PDFs, text - all transcribed/extracted to text)
       ├── Fragments (raw material from both sources)
       │    └── FragmentDimensionTags (many-to-many with dimensions)
       ├── DimensionalSynthesis (11 records per project, one per Tier 1 dimension)
       ├── GeneratedOutputs (Decision Stack artifacts)
       └── ExtractionRuns (eval traces for experimentation)
```

---

## Key Files Created

1. **`proposed-schema-v1.prisma`**
   - Complete Prisma schema with all models
   - Inline documentation and extensibility notes
   - Ready to copy into `prisma/schema.prisma`

2. **`schema-migration-plan.md`**
   - 7-phase migration from current → V1
   - Zero-downtime, additive changes
   - Backfill scripts and verification steps
   - Estimated 2 days effort

3. **`synthesis-algorithm-design.md`**
   - Full vs. incremental synthesis
   - LLM prompts for synthesis
   - Gap identification and contradiction surfacing
   - Fragment archival after validation
   - Performance optimizations

4. **`schema-design-summary.md`** (this file)
   - High-level overview and decisions
   - Next steps and open questions

---

## What This Enables

### Today
- Single user, single project, conversation-based extraction
- Fragments stored with lineage (which conversation/message)
- Dimensional synthesis with structured understanding
- Evaluation traces for experimentation

### Tomorrow (No Refactoring Required)
- **Multi-project**: User creates 2nd project → just create new Project record
- **Voice memos**: Upload/transcribe → create Document with `sourceType = 'voice_memo'`
- **Document upload**: Upload PDF → create Document with `sourceType = 'uploaded_document'`
- **Multi-user/teams**: Add `ProjectMember` junction table, update access control
- **Organizations**: Add `Organization` model as wrapper around Users
- **Tier 2 subdimensions**: Already stored in `DimensionalSynthesis.subdimensions` JSONB

### Future (More Involved)
- Cross-project fragment linking (for shared insights)
- LLM-powered synthesis quality evaluation
- Collaborative editing of synthesis
- Fragment embeddings for semantic search

---

## Migration Path (High-Level)

```
Phase 1: Add new tables (Project, Fragment, etc.)
  ↓
Phase 2: Create default Project per User
  ↓
Phase 3: Link Conversations to Projects
  ↓
Phase 4: Initialize DimensionalSynthesis (11 per project)
  ↓
Phase 5: Update app code to use Fragment-based extraction
  ↓
Phase 6: (Optional) Extract fragments from historical Traces
  ↓
Phase 7: Deprecate Trace → rename to LegacyTrace
```

**Rollback-safe**: Each phase can be reverted independently.
**Non-breaking**: Existing app continues working until Phase 5.

---

## Implementation Checklist

### Schema Migration
- [ ] Review `proposed-schema-v1.prisma`
- [ ] Test migration on local dev database
- [ ] Run Phase 1-4 migrations (additive, non-breaking)
- [ ] Update app code (Phase 5)
- [ ] Deploy to staging
- [ ] Verify extraction flow works
- [ ] Deploy to production

### Synthesis Algorithm
- [ ] Implement `lib/synthesis/full-synthesis.ts`
- [ ] Implement `lib/synthesis/incremental-synthesis.ts`
- [ ] Add synthesis trigger after extraction step
- [ ] Test synthesis quality with real conversations
- [ ] Tune LLM prompts based on output quality
- [ ] Add fragment archival after synthesis validation

### Evaluation Infrastructure
- [ ] Create `ExtractionRun` on each extraction
- [ ] Store synthesis snapshots (before/after)
- [ ] Add experiment variant tracking
- [ ] Build eval dashboard to compare runs
- [ ] Add error coding UI for quality assessment

### Future Features
- [ ] Document upload UI
- [ ] Voice memo recording + transcription
- [ ] Multi-project switcher in UI
- [ ] Manual re-synthesis trigger
- [ ] Synthesis diff view ("what changed")

---

## Open Questions & Decisions Needed

### Immediate
1. **Should we migrate historical Traces to Fragments?**
   - **Recommendation**: No, unless you need historical lineage. Start fresh with new extraction flow.

2. **When to trigger synthesis updates?**
   - **Decision**: Batch after extraction step ✅

3. **How aggressive should fragment archival be?**
   - **Decision**: Archive after synthesis validation, soft delete after 90 days, hard delete after 1 year (or never) ✅

### Soon
4. **Guest user handling**: Create anonymous Project for guests?
   - **Recommendation**: Yes, `Project.userId` nullable for guest sessions

5. **Synthesis quality threshold**: What makes synthesis "validated"?
   - **Recommendation**: HIGH confidence + substantive summary + few gaps

6. **Document processing**: Build upload UI immediately or defer?
   - **Depends**: Is voice memo feature next? If yes, build Document model now.

### Later
7. **Cross-project analytics**: Opt-in or always on?
8. **Subdimension promotion**: When to make emergent subdimensions first-class?
9. **Fragment embeddings**: When to add semantic search?

---

## Key Trade-offs Made

### What We Optimized For
- ✅ **Future extensibility** over current simplicity
- ✅ **Intentional structure** over "move fast and break things"
- ✅ **Data preservation** over storage minimization
- ✅ **Evaluation rigor** over shipping speed

### What We Deferred
- ❌ Multi-tenancy (Organizations, row-level security)
- ❌ Full Trace → Fragment migration (keep LegacyTrace)
- ❌ Synthesis change log (no UI for it yet)
- ❌ Fragment embeddings (no semantic search yet)

### Why These Trade-offs Make Sense
You're in **hypothesis validation** mode, but with **product conviction**. This schema:
- Doesn't over-engineer for scale you don't have (no orgs, no embeddings)
- But creates the right boundaries (Projects) to avoid refactoring hell later
- Preserves eval data rigorously (you're learning what works)
- Keeps fragments as source of truth (synthesis is derived, can regenerate)

---

## Critical Success Factors

For this design to succeed, you need:

1. **Disciplined synthesis updates**: Don't let synthesis get stale. Trigger after every extraction.

2. **Fragment quality matters**: Garbage fragments → garbage synthesis. Invest in extraction quality.

3. **Eval rigor**: Use `ExtractionRun` to actually compare variants. Don't let it become dead data.

4. **Access control abstraction**: Even though multi-user is deferred, write queries through `getUserAccessibleProjects()` now.

5. **Schema discipline**: When adding fields, ask: "Should this be queryable (column) or emergent (JSONB)?"

---

## What Could Go Wrong

| Risk | Mitigation |
|------|------------|
| **Synthesis quality is poor** | Tune prompts, add LLM-as-judge eval, iterate on synthesis algorithm |
| **Fragment count explodes** | Implement archival aggressively, monitor storage costs |
| **Queries become slow** | Add indexes (already in schema), use fragment counts for dashboards |
| **Users want features you deferred** | Extensibility built in, just add models (ProjectMember, Organization, etc.) |
| **Migration breaks production** | Rollback plan in place, each phase tested in staging first |

---

## Success Metrics (Post-Migration)

You'll know this schema is working if:

1. ✅ **Synthesis quality improves over time** (users give positive feedback on outputs)
2. ✅ **Multi-project adoption** (users create 2nd/3rd projects)
3. ✅ **Fragment→synthesis→output lineage is clear** (can debug "why did it say that?")
4. ✅ **Evals run smoothly** (can compare extraction variants easily)
5. ✅ **No schema refactors needed** when adding voice/docs/multi-user

---

## Next Steps

### Immediate (This Week)
1. **Review all design docs** with team/stakeholders
2. **Test migration on local database** with real data
3. **Decide on historical Trace migration** (recommend: skip it)

### Short-term (Next 2 Weeks)
4. **Implement schema migration** (Phases 1-4)
5. **Update extraction flow** to create Fragments + ExtractionRuns
6. **Implement basic synthesis algorithm** (full synthesis first, defer incremental)
7. **Deploy to staging, verify**

### Medium-term (Next Month)
8. **Build Document upload feature** (for voice memos or PDFs)
9. **Add incremental synthesis** for performance
10. **Build eval dashboard** to compare ExtractionRuns
11. **Tune synthesis prompts** based on quality feedback

---

## Final Thoughts

This schema is **right-sized for where you are**:
- Not a toy schema that breaks when you add features
- Not over-engineered for problems you don't have yet
- Disciplined enough to enforce intentionality
- Flexible enough to accommodate emergence

The hardest part will be **synthesis quality** — the schema just enables it. Focus on:
1. High-quality fragment extraction
2. Well-tuned synthesis prompts
3. Rigorous eval + iteration

The schema gives you the **foundation to iterate fast** without refactoring hell later.

---

**Ready to proceed?** Review docs, test migration locally, then implement Phase 1-4 this week.
