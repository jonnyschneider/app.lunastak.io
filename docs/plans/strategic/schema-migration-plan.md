# Schema Migration Plan: Current → V1 (Project-Based Synthesis)

**Status:** Draft
**Created:** 2026-01-03
**Estimated Effort:** 2-3 days
**Risk Level:** Low (non-breaking, additive changes)

---

## Overview

Migrate from current single-user, conversation-scoped schema to project-based synthesis architecture that supports:
- Multi-project per user
- Multi-source fragments (conversations + documents)
- Dimensional synthesis with structured storage
- Future extensibility for teams/orgs

---

## Migration Strategy

**Approach:** Additive, non-breaking changes in phases
**Rollback:** Each phase can be rolled back independently
**Data Loss:** None - all existing data preserved

---

## Phase 1: Add New Tables (Non-Breaking)

**Goal:** Add Project, Fragment, DimensionalSynthesis tables without touching existing schema

### 1.1 Update schema.prisma

Copy new models from `proposed-schema-v1.prisma`:
- `Project`
- `Document`
- `Fragment`
- `FragmentDimensionTag`
- `DimensionalSynthesis`
- `GeneratedOutput`

Keep existing models untouched:
- `User`, `Conversation`, `Message`, `Trace`, `Event`, etc.

### 1.2 Generate migration

```bash
npx prisma migrate dev --name add_project_synthesis_models
```

### 1.3 Verify

```bash
npx prisma studio
# Confirm new tables exist but are empty
```

**Impact:** None. Existing app continues working.

---

## Phase 2: Create Default Projects (Backfill)

**Goal:** Every existing user gets a default Project

### 2.1 Create migration script

```typescript
// scripts/migrations/001-create-default-projects.ts
import { prisma } from '@/lib/prisma'

async function main() {
  const users = await prisma.user.findMany()

  console.log(`Creating default projects for ${users.length} users...`)

  for (const user of users) {
    // Check if user already has a project
    const existingProject = await prisma.project.findFirst({
      where: { userId: user.id }
    })

    if (existingProject) {
      console.log(`User ${user.email} already has project ${existingProject.id}`)
      continue
    }

    // Create default project
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: user.name ? `${user.name}'s Strategy` : "My Strategy",
        status: "active",
      }
    })

    console.log(`✓ Created project ${project.id} for ${user.email}`)
  }

  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### 2.2 Run migration

```bash
npx tsx scripts/migrations/001-create-default-projects.ts
```

### 2.3 Verify

```sql
-- Check that all users have projects
SELECT
  u.id,
  u.email,
  COUNT(p.id) as project_count
FROM "User" u
LEFT JOIN "Project" p ON p."userId" = u.id
GROUP BY u.id, u.email
HAVING COUNT(p.id) = 0;

-- Should return 0 rows
```

**Impact:** Every user now has a Project. Still no breaking changes.

---

## Phase 3: Link Conversations to Projects

**Goal:** Migrate existing conversations to belong to projects

### 3.1 Add projectId to Conversation (nullable)

```prisma
model Conversation {
  id        String   @id @default(cuid())
  userId    String?  // Keep for now
  projectId String?  // Add as nullable
  // ...

  project   Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

```bash
npx prisma migrate dev --name add_conversation_project_id
```

### 3.2 Backfill conversation.projectId

```typescript
// scripts/migrations/002-link-conversations-to-projects.ts
import { prisma } from '@/lib/prisma'

async function main() {
  const conversations = await prisma.conversation.findMany({
    where: { projectId: null },
    include: { user: true }
  })

  console.log(`Linking ${conversations.length} conversations to projects...`)

  for (const conv of conversations) {
    if (!conv.userId) {
      console.log(`⚠ Conversation ${conv.id} has no userId, skipping`)
      continue
    }

    // Find user's default project
    const project = await prisma.project.findFirst({
      where: { userId: conv.userId },
      orderBy: { createdAt: 'asc' } // Use oldest (first created) project
    })

    if (!project) {
      console.error(`✗ No project found for user ${conv.userId}`)
      continue
    }

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { projectId: project.id }
    })

    console.log(`✓ Linked conversation ${conv.id} to project ${project.id}`)
  }

  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

```bash
npx tsx scripts/migrations/002-link-conversations-to-projects.ts
```

### 3.3 Make projectId required

After backfill is verified:

```prisma
model Conversation {
  projectId String   // Remove ?

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

```bash
npx prisma migrate dev --name make_conversation_project_required
```

### 3.4 Verify

```sql
-- Check all conversations have projectId
SELECT COUNT(*) FROM "Conversation" WHERE "projectId" IS NULL;
-- Should return 0
```

**Impact:** Conversations now belong to Projects. Queries need to filter by projectId.

---

## Phase 4: Initialize Dimensional Syntheses

**Goal:** Create 11 DimensionalSynthesis records per project (one for each Tier 1 dimension)

### 4.1 Create synthesis initialization script

```typescript
// scripts/migrations/003-initialize-syntheses.ts
import { prisma } from '@/lib/prisma'

const TIER_1_DIMENSIONS = [
  'CUSTOMER_MARKET',
  'PROBLEM_OPPORTUNITY',
  'VALUE_PROPOSITION',
  'DIFFERENTIATION_ADVANTAGE',
  'COMPETITIVE_LANDSCAPE',
  'BUSINESS_MODEL_ECONOMICS',
  'GO_TO_MARKET',
  'PRODUCT_EXPERIENCE',
  'CAPABILITIES_ASSETS',
  'RISKS_CONSTRAINTS',
  'STRATEGIC_INTENT',
] as const

async function main() {
  const projects = await prisma.project.findMany()

  console.log(`Initializing syntheses for ${projects.length} projects...`)

  for (const project of projects) {
    for (const dimension of TIER_1_DIMENSIONS) {
      // Check if synthesis already exists
      const existing = await prisma.dimensionalSynthesis.findUnique({
        where: {
          projectId_dimension: {
            projectId: project.id,
            dimension
          }
        }
      })

      if (existing) {
        console.log(`  → ${dimension} already exists for project ${project.id}`)
        continue
      }

      // Create empty synthesis
      await prisma.dimensionalSynthesis.create({
        data: {
          projectId: project.id,
          dimension,
          synthesisVersion: "v1",
          summary: null,
          keyThemes: [],
          keyQuotes: [],
          gaps: [],
          contradictions: [],
          subdimensions: null,
          confidence: "LOW",
          fragmentCount: 0,
        }
      })

      console.log(`  ✓ Created ${dimension} for project ${project.id}`)
    }
  }

  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

```bash
npx tsx scripts/migrations/003-initialize-syntheses.ts
```

### 4.2 Verify

```sql
-- Check each project has 11 syntheses
SELECT
  p.id,
  p.name,
  COUNT(ds.id) as synthesis_count
FROM "Project" p
LEFT JOIN "DimensionalSynthesis" ds ON ds."projectId" = p.id
GROUP BY p.id, p.name;

-- Each should have 11
```

**Impact:** Every project has dimensional syntheses ready for updates.

---

## Phase 5: Update Application Code

**Goal:** Switch from Trace-based extraction to Fragment-based extraction

### 5.1 Update conversation creation

**Before:**
```typescript
const conversation = await prisma.conversation.create({
  data: {
    userId: user.id,
    status: "in_progress",
  }
})
```

**After:**
```typescript
// Get or create default project
const project = await prisma.project.findFirst({
  where: { userId: user.id }
})

if (!project) {
  throw new Error("User has no project")
}

const conversation = await prisma.conversation.create({
  data: {
    projectId: project.id,
    userId: user.id,
    status: "in_progress",
  }
})
```

### 5.2 Update extraction flow

**Before (Trace-based):**
```typescript
// Old: Store extraction in Trace.extractedContext
const trace = await prisma.trace.create({
  data: {
    conversationId: conversation.id,
    userId: user.id,
    extractedContext: {
      themes: [...],
      insights: [...],
    },
    dimensionalCoverage: {
      dimensions: [...],
    },
    output: generatedOutput,
    // ...
  }
})
```

**After (Fragment-based):**
```typescript
// New: Extract fragments from conversation
const extractionResult = await extractFragmentsFromConversation(conversation)

// Create fragments
const fragments = await Promise.all(
  extractionResult.themes.map(theme =>
    prisma.fragment.create({
      data: {
        projectId: conversation.projectId,
        conversationId: conversation.id,
        content: theme.content,
        contentType: "theme",
        confidence: theme.confidence,
        extractedBy: "claude-opus-4",
      }
    })
  )
)

// Tag fragments to dimensions
for (const fragment of fragments) {
  const tagging = extractionResult.tagging.find(t => t.fragmentId === fragment.id)

  for (const dimension of tagging.dimensions) {
    await prisma.fragmentDimensionTag.create({
      data: {
        fragmentId: fragment.id,
        dimension: dimension.name,
        confidence: dimension.confidence,
        reasoning: dimension.reasoning,
        taggedBy: "claude-opus-4",
      }
    })
  }
}

// Update syntheses for affected dimensions
await updateDimensionalSyntheses(
  conversation.projectId,
  extractionResult.affectedDimensions
)

// Store generated output
const output = await prisma.generatedOutput.create({
  data: {
    projectId: conversation.projectId,
    outputType: "full_decision_stack",
    content: generatedOutput,
    modelUsed: "claude-opus-4",
    // ...
  }
})
```

### 5.3 Create synthesis update function

```typescript
// lib/synthesis/update-synthesis.ts
import { prisma } from '@/lib/prisma'

export async function updateDimensionalSynthesis(
  projectId: string,
  dimension: string
) {
  // Get all active fragments for this dimension
  const fragments = await prisma.fragment.findMany({
    where: {
      projectId,
      status: "active",
      dimensionTags: {
        some: { dimension }
      }
    },
    include: {
      dimensionTags: {
        where: { dimension }
      }
    }
  })

  if (fragments.length === 0) {
    // No fragments - set synthesis to LOW confidence
    await prisma.dimensionalSynthesis.update({
      where: { projectId_dimension: { projectId, dimension } },
      data: {
        summary: null,
        keyThemes: [],
        confidence: "LOW",
        fragmentCount: 0,
        lastSynthesizedAt: new Date(),
      }
    })
    return
  }

  // Call LLM to synthesize fragments
  const synthesis = await synthesizeFragments(dimension, fragments)

  // Update synthesis record
  await prisma.dimensionalSynthesis.update({
    where: { projectId_dimension: { projectId, dimension } },
    data: {
      summary: synthesis.summary,
      keyThemes: synthesis.keyThemes,
      keyQuotes: synthesis.keyQuotes,
      gaps: synthesis.gaps,
      contradictions: synthesis.contradictions,
      subdimensions: synthesis.subdimensions,
      confidence: synthesis.confidence,
      fragmentCount: fragments.length,
      lastSynthesizedAt: new Date(),
      synthesizedBy: "claude-opus-4",
    }
  })
}

async function synthesizeFragments(dimension: string, fragments: Fragment[]) {
  // TODO: Implement LLM synthesis
  // For now, basic aggregation
  return {
    summary: fragments.map(f => f.content).join('\n\n'),
    keyThemes: fragments.map(f => f.content).slice(0, 5),
    keyQuotes: [],
    gaps: [],
    contradictions: [],
    subdimensions: null,
    confidence: fragments.length > 5 ? "HIGH" : "MEDIUM",
  }
}
```

---

## Phase 6: Optional - Migrate Historical Traces to Fragments

**Goal:** Convert old Trace.extractedContext into Fragments (optional, only if you want historical data)

This is a nice-to-have. You could:
- **Option A**: Leave old Traces as-is, only use new Fragment flow going forward
- **Option B**: Extract fragments from historical traces for complete lineage

If you choose Option B:

```typescript
// scripts/migrations/004-extract-fragments-from-traces.ts
// (Similar to Phase 4 in previous migration path document)
```

**Recommendation:** Skip this unless you need historical data. Focus on new extraction flow.

---

## Phase 7: Deprecate Trace Table

### 7.1 Rename to LegacyTrace

```prisma
model LegacyTrace {
  // ... same fields as current Trace

  @@map("Trace") // Keep original table name in DB
}
```

```bash
npx prisma migrate dev --name rename_trace_to_legacy
```

### 7.2 Stop writing new Traces

Remove all `prisma.trace.create()` calls from codebase.

### 7.3 Eventually archive or delete

After 3-6 months, once you're confident new system works:
- Export Traces to CSV for archival
- Drop the table

---

## Verification Checklist

After each phase, verify:

- [ ] All migrations ran successfully (no errors)
- [ ] Data integrity checks pass (no null FKs, orphaned records)
- [ ] Application still works (manual testing)
- [ ] Can create new conversations
- [ ] Can extract fragments
- [ ] Can view syntheses

---

## Rollback Plan

### Rollback Phase 5-7 (app code changes)
- Revert code to use Trace-based extraction
- No database changes needed

### Rollback Phase 4 (syntheses)
```sql
DELETE FROM "DimensionalSynthesis";
```

### Rollback Phase 3 (conversation.projectId)
```prisma
model Conversation {
  projectId String? // Make nullable again
}
```
```bash
npx prisma migrate dev --name rollback_conversation_project
```

### Rollback Phase 2 (default projects)
```sql
DELETE FROM "Project";
```

### Rollback Phase 1 (new tables)
```bash
npx prisma migrate rollback
```

---

## Timeline Estimate

| Phase | Task | Time |
|-------|------|------|
| 1 | Add new tables | 30 min |
| 2 | Create default projects | 1 hour |
| 3 | Link conversations to projects | 2 hours |
| 4 | Initialize syntheses | 1 hour |
| 5 | Update app code | 1 day |
| 6 | (Optional) Migrate traces | 4 hours |
| 7 | Deprecate Trace | 1 hour |
| **Total** | | **~2 days** |

---

## Next Steps

1. Review this migration plan
2. Test migration on local dev database
3. Test migration on staging database
4. Run migration on production
5. Monitor for issues
6. Implement synthesis update logic
7. Add Document upload/processing features

---

## Open Questions

- [ ] Should we migrate historical Traces to Fragments? (Recommend: No, unless needed)
- [ ] When should synthesis updates trigger? (After extraction, or async job?)
- [ ] How to handle guest users (no userId)? (Create anonymous Project?)
- [ ] Fragment archival policy? (Auto-archive after synthesis validation?)
