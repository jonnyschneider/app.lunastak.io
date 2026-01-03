# Database Schema V1 Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from user-scoped Trace model to project-scoped Fragment/Synthesis architecture, enabling multi-project support and cross-session synthesis.

**Architecture:** Add Project as boundary entity, create Fragment/DimensionalSynthesis models for queryable extraction data, preserve ExtractionRun for evaluation. Migration is additive and non-breaking until Phase 5. Document model deferred pending interaction research (HUM-32).

**Tech Stack:** Prisma, PostgreSQL, TypeScript, Next.js

**Related:**
- Design docs: `docs/plans/strategic/schema-design-summary.md`
- Full schema: `docs/plans/strategic/proposed-schema-v1.prisma`
- Migration plan: `docs/plans/strategic/schema-migration-plan.md`
- Linear: HUM-32 (research), HUM-33 (prototype), HUM-34 (document model)

---

## Pre-Implementation Checklist

- [ ] Read `docs/plans/strategic/schema-design-summary.md` (context)
- [ ] Read `docs/plans/strategic/schema-migration-plan.md` (detailed migration)
- [ ] Backup production database (if deploying to prod)
- [ ] Confirm Prisma CLI is installed: `npx prisma --version`
- [ ] Confirm database connection: `npx prisma db pull`

---

## Phase 1: Add New Models (Non-Breaking)

**Goal:** Add Project, Fragment, FragmentDimensionTag, DimensionalSynthesis, GeneratedOutput, ExtractionRun models without touching existing schema.

**Impact:** None. Existing app continues working.

---

### Task 1.1: Add Project Model

**Files:**
- Modify: `prisma/schema.prisma` (after User model, before Conversation)

**Step 1: Add Project model to schema**

After the `User` model (around line 120), add:

```prisma
model Project {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?  @db.Text
  status      String   @default("active") // active | archived | deleted

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations (will add as we create other models)
  user                  User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversations         Conversation[]
  fragments             Fragment[]
  dimensionalSyntheses  DimensionalSynthesis[]
  generatedOutputs      GeneratedOutput[]
  extractionRuns        ExtractionRun[]

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}
```

**Step 2: Add Project relation to User model**

In the `User` model (around line 120-135), add to relations section:

```prisma
model User {
  // ... existing fields ...

  projects      Project[]       // 👈 ADD THIS LINE
  conversations Conversation[]
  traces        Trace[]
  // ... rest of relations ...
}
```

**Step 3: Format schema**

Run: `npx prisma format`
Expected: Schema formatted, no errors

**Step 4: Verify schema is valid**

Run: `npx prisma validate`
Expected: "The schema is valid"

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add Project model for multi-project support"
```

---

### Task 1.2: Add Fragment and FragmentDimensionTag Models

**Files:**
- Modify: `prisma/schema.prisma` (after Project model)

**Step 1: Add Fragment model**

After the `Project` model, add:

```prisma
model Fragment {
  id          String   @id @default(cuid())
  projectId   String

  // Source: currently only Conversation (Document deferred)
  conversationId  String?
  messageId       String?

  // Content
  content         String   @db.Text
  contentType     String   @default("theme") // theme | insight | quote | stat | principle

  // Lifecycle
  status          String   @default("active") // active | archived | soft_deleted
  archivedAt      DateTime?
  archivedReason  String?
  softDeletedAt   DateTime?

  // Metadata
  capturedAt      DateTime @default(now())
  extractedBy     String?
  confidence      String?  // HIGH | MEDIUM | LOW

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  project         Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  conversation    Conversation?         @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  message         Message?              @relation(fields: [messageId], references: [id], onDelete: SetNull)
  dimensionTags   FragmentDimensionTag[]

  @@index([projectId])
  @@index([conversationId])
  @@index([status])
  @@index([capturedAt])
}
```

**Step 2: Add FragmentDimensionTag model**

After the `Fragment` model, add:

```prisma
model FragmentDimensionTag {
  id           String   @id @default(cuid())
  fragmentId   String
  dimension    String   // CUSTOMER_MARKET | PROBLEM_OPPORTUNITY | etc.

  // Tag metadata
  confidence   String?
  reasoning    String?  @db.Text
  taggedBy     String?
  taggedAt     DateTime @default(now())

  // Future: Tier 2 subdimensions
  subdimension String?

  fragment     Fragment @relation(fields: [fragmentId], references: [id], onDelete: Cascade)

  @@unique([fragmentId, dimension])
  @@index([fragmentId])
  @@index([dimension])
  @@index([subdimension])
}
```

**Step 3: Add Fragment relations to Message and Conversation**

In the `Message` model, add:

```prisma
model Message {
  // ... existing fields ...

  conversation        Conversation @relation(...)
  fragments           Fragment[]   // 👈 ADD THIS LINE

  @@index([conversationId])
  @@index([timestamp])
}
```

In the `Conversation` model, add (after `events`):

```prisma
model Conversation {
  // ... existing fields ...

  messages  Message[]
  traces    Trace[]
  events    Event[]
  fragments Fragment[]  // 👈 ADD THIS LINE

  @@index([userId])
  // ... rest of indexes ...
}
```

**Step 4: Format and validate**

Run: `npx prisma format && npx prisma validate`
Expected: "The schema is valid"

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add Fragment and FragmentDimensionTag models"
```

---

### Task 1.3: Add DimensionalSynthesis Model

**Files:**
- Modify: `prisma/schema.prisma` (after FragmentDimensionTag model)

**Step 1: Add DimensionalSynthesis model**

```prisma
model DimensionalSynthesis {
  id           String   @id @default(cuid())
  projectId    String
  dimension    String   // CUSTOMER_MARKET | PROBLEM_OPPORTUNITY | etc.

  // Synthesis content: hybrid structured + JSONB
  summary          String?  @db.Text
  keyThemes        String[] @default([])
  keyQuotes        String[] @default([])
  gaps             String[] @default([])
  contradictions   String[] @default([])

  // JSONB for emergent Tier 2 subdimensions
  subdimensions    Json?

  // Quality metrics
  confidence       String   @default("LOW") // HIGH | MEDIUM | LOW
  coverage         String?
  fragmentCount    Int      @default(0)

  // Versioning
  synthesisVersion String   @default("v1")

  // Temporal
  lastSynthesizedAt DateTime @default(now())
  synthesizedBy     String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, dimension])
  @@index([projectId])
  @@index([dimension])
  @@index([confidence])
  @@index([lastSynthesizedAt])
}
```

**Step 2: Format and validate**

Run: `npx prisma format && npx prisma validate`
Expected: "The schema is valid"

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add DimensionalSynthesis model for cross-session synthesis"
```

---

### Task 1.4: Add GeneratedOutput and ExtractionRun Models

**Files:**
- Modify: `prisma/schema.prisma` (after DimensionalSynthesis model)

**Step 1: Add GeneratedOutput model**

```prisma
model GeneratedOutput {
  id          String   @id @default(cuid())
  projectId   String
  userId      String?

  // Output metadata
  outputType  String   // vision | strategy | objectives | initiatives | principles | full_decision_stack
  version     Int      @default(1)

  // Content
  content     Json

  // Generation metadata
  generatedFrom    String?  @db.Text
  modelUsed        String
  promptTokens     Int?
  completionTokens Int?
  latencyMs        Int?

  // User feedback
  userFeedback     String?
  feedbackAt       DateTime?
  refinementNotes  String?  @db.Text

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  extractionRuns  ExtractionRun[]

  @@index([projectId])
  @@index([outputType])
  @@index([createdAt])
}
```

**Step 2: Add ExtractionRun model**

```prisma
model ExtractionRun {
  id          String   @id @default(cuid())
  projectId   String

  // What triggered this run
  conversationId String?

  // Experiment tracking
  experimentVariant String?
  experimentId      String?

  // What was extracted
  fragmentIds       String[] @default([])

  // Synthesis state snapshots
  synthesesBefore   Json?
  synthesesAfter    Json?

  // Generated output
  generatedOutputId String?

  // Model/performance metadata
  modelUsed         String
  promptTokens      Int?
  completionTokens  Int?
  latencyMs         Int?

  // Evaluation fields (same as Trace)
  userFeedback      String?
  feedbackAt        DateTime?
  qualityRating     String?
  errorCategories   String[]  @default([])
  openCodingNotes   String?   @db.Text
  reviewedAt        DateTime?
  reviewedBy        String?

  createdAt         DateTime  @default(now())

  // Relations
  project           Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  conversation      Conversation?     @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  generatedOutput   GeneratedOutput?  @relation(fields: [generatedOutputId], references: [id], onDelete: SetNull)

  @@index([projectId])
  @@index([conversationId])
  @@index([experimentVariant])
  @@index([experimentId])
  @@index([qualityRating])
  @@index([createdAt])
}
```

**Step 3: Add ExtractionRun relation to Conversation**

In the `Conversation` model, add:

```prisma
model Conversation {
  // ... existing fields ...

  events           Event[]
  fragments        Fragment[]
  extractionRuns   ExtractionRun[]  // 👈 ADD THIS LINE

  @@index([userId])
  // ... rest of indexes ...
}
```

**Step 4: Format and validate**

Run: `npx prisma format && npx prisma validate`
Expected: "The schema is valid"

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add GeneratedOutput and ExtractionRun models for evaluation"
```

---

### Task 1.5: Generate and Apply Migration

**Files:**
- Create: `prisma/migrations/XXXXXX_add_project_synthesis_models/migration.sql` (auto-generated)

**Step 1: Generate migration**

Run: `npx prisma migrate dev --name add_project_synthesis_models`
Expected: Migration created and applied, Prisma Client regenerated

**Step 2: Verify tables created**

Run: `npx prisma studio`
Then check:
- [ ] Project table exists (empty)
- [ ] Fragment table exists (empty)
- [ ] FragmentDimensionTag table exists (empty)
- [ ] DimensionalSynthesis table exists (empty)
- [ ] GeneratedOutput table exists (empty)
- [ ] ExtractionRun table exists (empty)
- [ ] All indexes created

**Step 3: Verify existing data intact**

In Prisma Studio, check:
- [ ] User table has data
- [ ] Conversation table has data
- [ ] Message table has data
- [ ] Trace table has data

**Step 4: Commit migration**

```bash
git add prisma/migrations/
git commit -m "migration: add project synthesis models (Phase 1)"
```

---

## Phase 2: Create Default Projects

**Goal:** Create a default Project for each existing User.

**Impact:** None. New tables populated, existing app continues working.

---

### Task 2.1: Create Migration Script

**Files:**
- Create: `scripts/migrations/001-create-default-projects.ts`

**Step 1: Create script file**

```typescript
#!/usr/bin/env tsx
/**
 * Migration: Create default Project for each User
 *
 * Phase 2 of schema V1 migration
 * Safe to run multiple times (idempotent)
 */

import { prisma } from '@/lib/db'

async function main() {
  console.log('Starting: Create default projects for users')

  const users = await prisma.user.findMany()
  console.log(`Found ${users.length} users`)

  let created = 0
  let skipped = 0

  for (const user of users) {
    // Check if user already has a project
    const existingProject = await prisma.project.findFirst({
      where: { userId: user.id }
    })

    if (existingProject) {
      console.log(`  ⏭  User ${user.email} already has project ${existingProject.id}`)
      skipped++
      continue
    }

    // Create default project
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: user.name ? `${user.name}'s Strategy` : 'My Strategy',
        status: 'active',
      }
    })

    console.log(`  ✓ Created project ${project.id} for ${user.email}`)
    created++
  }

  console.log(`\nComplete: ${created} created, ${skipped} skipped`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 2: Make script executable**

Run: `chmod +x scripts/migrations/001-create-default-projects.ts`

**Step 3: Test script (dry run - it's idempotent anyway)**

Run: `npx tsx scripts/migrations/001-create-default-projects.ts`
Expected: "✓ Created project [id] for [email]" for each user

**Step 4: Verify in database**

Run: `npx prisma studio`
Check:
- [ ] Project table has records (one per user)
- [ ] Each Project.userId matches a User.id
- [ ] Each Project.name is reasonable

**Step 5: Commit**

```bash
git add scripts/migrations/001-create-default-projects.ts
git commit -m "migration: create default projects for existing users (Phase 2)"
```

---

## Phase 3: Link Conversations to Projects

**Goal:** Add `projectId` to Conversation, backfill it, then make it required.

**Impact:** After backfill, conversations belong to projects. Queries must use `projectId`.

---

### Task 3.1: Add projectId to Conversation (Nullable)

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add projectId field to Conversation**

In the `Conversation` model (around line 10-31):

```prisma
model Conversation {
  id        String   @id @default(cuid())
  userId    String?  // Nullable for guest sessions
  projectId String?  // 👈 ADD THIS LINE (nullable for now)
  status    String
  // ... rest of fields ...

  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)  // 👈 ADD THIS LINE
  messages  Message[]
  // ... rest of relations ...

  @@index([userId])
  @@index([projectId])  // 👈 ADD THIS LINE
  @@index([createdAt])
  // ... rest of indexes ...
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_conversation_project_id`
Expected: Migration created and applied

**Step 3: Verify nullable column**

Run: `npx prisma studio`
Check:
- [ ] Conversation table has `projectId` column
- [ ] All existing conversations have `projectId = null`

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "migration: add nullable projectId to Conversation (Phase 3.1)"
```

---

### Task 3.2: Backfill conversation.projectId

**Files:**
- Create: `scripts/migrations/002-link-conversations-to-projects.ts`

**Step 1: Create backfill script**

```typescript
#!/usr/bin/env tsx
/**
 * Migration: Link conversations to projects
 *
 * Phase 3.2 of schema V1 migration
 * Safe to run multiple times (idempotent)
 */

import { prisma } from '@/lib/db'

async function main() {
  console.log('Starting: Link conversations to projects')

  const conversations = await prisma.conversation.findMany({
    where: { projectId: null },
    include: { user: true }
  })

  console.log(`Found ${conversations.length} conversations without projectId`)

  let linked = 0
  let skipped = 0

  for (const conv of conversations) {
    if (!conv.userId) {
      console.log(`  ⚠  Conversation ${conv.id} has no userId, skipping`)
      skipped++
      continue
    }

    // Find user's default project (first created)
    const project = await prisma.project.findFirst({
      where: { userId: conv.userId },
      orderBy: { createdAt: 'asc' }
    })

    if (!project) {
      console.error(`  ✗ No project found for user ${conv.userId}`)
      skipped++
      continue
    }

    // Update conversation
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { projectId: project.id }
    })

    console.log(`  ✓ Linked conversation ${conv.id} to project ${project.id}`)
    linked++
  }

  console.log(`\nComplete: ${linked} linked, ${skipped} skipped`)

  // Verify no nulls remain
  const remaining = await prisma.conversation.count({
    where: { projectId: null }
  })

  if (remaining > 0) {
    console.warn(`\n⚠  ${remaining} conversations still have null projectId`)
  } else {
    console.log('\n✓ All conversations linked to projects')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 2: Run backfill**

Run: `npx tsx scripts/migrations/002-link-conversations-to-projects.ts`
Expected: "✓ Linked conversation [id] to project [id]" for each conversation

**Step 3: Verify backfill**

Run this SQL query:
```sql
SELECT COUNT(*) FROM "Conversation" WHERE "projectId" IS NULL;
```
Expected: 0

**Step 4: Commit**

```bash
git add scripts/migrations/002-link-conversations-to-projects.ts
git commit -m "migration: backfill conversation.projectId (Phase 3.2)"
```

---

### Task 3.3: Make projectId Required

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Remove nullable from projectId**

In the `Conversation` model:

```prisma
model Conversation {
  id        String   @id @default(cuid())
  userId    String?
  projectId String   // 👈 REMOVE ? to make required
  status    String
  // ... rest of fields ...

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)  // 👈 REMOVE ?
  // ... rest of relations ...
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name make_conversation_project_required`
Expected: Migration created and applied

**Step 3: Verify constraint**

Try to create conversation without projectId:
```typescript
// This should fail
await prisma.conversation.create({
  data: { status: 'in_progress' }
})
```
Expected: Error about required field

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "migration: make conversation.projectId required (Phase 3.3)"
```

---

## Phase 4: Initialize Dimensional Syntheses

**Goal:** Create 11 DimensionalSynthesis records per Project (one for each Tier 1 dimension).

**Impact:** Every project has synthesis records ready for updates.

---

### Task 4.1: Create Initialization Script

**Files:**
- Create: `scripts/migrations/003-initialize-syntheses.ts`

**Step 1: Create constants file for dimensions**

Create: `src/lib/constants/dimensions.ts`

```typescript
/**
 * Tier 1 Strategic Dimensions
 * See: docs/plans/strategic/TAXONOMY_REFERENCE.md
 */
export const TIER_1_DIMENSIONS = [
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

export type Tier1Dimension = typeof TIER_1_DIMENSIONS[number]
```

**Step 2: Create initialization script**

Create: `scripts/migrations/003-initialize-syntheses.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Migration: Initialize DimensionalSynthesis for all projects
 *
 * Phase 4 of schema V1 migration
 * Creates 11 synthesis records per project (one per Tier 1 dimension)
 * Safe to run multiple times (idempotent)
 */

import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

async function main() {
  console.log('Starting: Initialize dimensional syntheses')

  const projects = await prisma.project.findMany()
  console.log(`Found ${projects.length} projects`)

  let created = 0
  let skipped = 0

  for (const project of projects) {
    console.log(`\nProject ${project.id} (${project.name}):`)

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
        console.log(`  ⏭  ${dimension} already exists`)
        skipped++
        continue
      }

      // Create empty synthesis
      await prisma.dimensionalSynthesis.create({
        data: {
          projectId: project.id,
          dimension,
          synthesisVersion: 'v1',
          summary: null,
          keyThemes: [],
          keyQuotes: [],
          gaps: [],
          contradictions: [],
          subdimensions: null,
          confidence: 'LOW',
          fragmentCount: 0,
        }
      })

      console.log(`  ✓ Created ${dimension}`)
      created++
    }
  }

  console.log(`\n\nComplete: ${created} created, ${skipped} skipped`)

  // Verify each project has 11 syntheses
  for (const project of projects) {
    const count = await prisma.dimensionalSynthesis.count({
      where: { projectId: project.id }
    })

    if (count !== 11) {
      console.warn(`⚠  Project ${project.id} has ${count} syntheses (expected 11)`)
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 3: Run initialization**

Run: `npx tsx scripts/migrations/003-initialize-syntheses.ts`
Expected: "✓ Created [dimension]" for each dimension per project

**Step 4: Verify in database**

Run: `npx prisma studio`
Check:
- [ ] DimensionalSynthesis table has records (11 × number of projects)
- [ ] Each project has exactly 11 records
- [ ] All dimensions covered
- [ ] All have confidence='LOW', fragmentCount=0

**Step 5: Commit**

```bash
git add src/lib/constants/dimensions.ts scripts/migrations/003-initialize-syntheses.ts
git commit -m "migration: initialize dimensional syntheses (Phase 4)"
```

---

## Phase 5: Update Application Code

**Goal:** Update app code to use `projectId` instead of `userId` for conversations and support new schema.

**Impact:** BREAKING CHANGES. Application requires new schema.

---

### Task 5.1: Create Project Helper Functions

**Files:**
- Create: `src/lib/projects.ts`

**Step 1: Create project utilities**

```typescript
/**
 * Project utilities for managing user projects
 */

import { prisma } from '@/lib/db'

/**
 * Get or create a default project for a user
 * Returns the first (oldest) project, or creates one if none exist
 */
export async function getOrCreateDefaultProject(userId: string | null) {
  if (!userId) {
    // Guest user - create anonymous project per session
    // TODO: Implement session-based project creation when guest support needed
    throw new Error('Guest projects not yet implemented')
  }

  // Try to find existing project
  let project = await prisma.project.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' } // Get oldest (default) project
  })

  if (!project) {
    // Create default project
    project = await prisma.project.create({
      data: {
        userId,
        name: 'My Strategy',
        status: 'active',
      }
    })
  }

  return project
}

/**
 * Get all projects for a user
 */
export async function getUserProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  })
}
```

**Step 2: Write tests**

Create: `src/lib/__tests__/projects.test.ts`

```typescript
import { prisma } from '@/lib/db'
import { getOrCreateDefaultProject, getUserProjects } from '@/lib/projects'

describe('Project utilities', () => {
  const testUserId = 'test-user-123'

  afterEach(async () => {
    // Cleanup
    await prisma.project.deleteMany({ where: { userId: testUserId } })
  })

  describe('getOrCreateDefaultProject', () => {
    it('creates project if none exists', async () => {
      const project = await getOrCreateDefaultProject(testUserId)

      expect(project.userId).toBe(testUserId)
      expect(project.name).toBe('My Strategy')
      expect(project.status).toBe('active')
    })

    it('returns existing project if one exists', async () => {
      const first = await getOrCreateDefaultProject(testUserId)
      const second = await getOrCreateDefaultProject(testUserId)

      expect(second.id).toBe(first.id)
    })

    it('returns oldest project if multiple exist', async () => {
      const first = await prisma.project.create({
        data: { userId: testUserId, name: 'First', status: 'active' }
      })
      await prisma.project.create({
        data: { userId: testUserId, name: 'Second', status: 'active' }
      })

      const result = await getOrCreateDefaultProject(testUserId)
      expect(result.id).toBe(first.id)
    })

    it('throws for guest users', async () => {
      await expect(getOrCreateDefaultProject(null)).rejects.toThrow()
    })
  })

  describe('getUserProjects', () => {
    it('returns empty array if no projects', async () => {
      const projects = await getUserProjects(testUserId)
      expect(projects).toEqual([])
    })

    it('returns all user projects', async () => {
      await prisma.project.create({
        data: { userId: testUserId, name: 'Project 1', status: 'active' }
      })
      await prisma.project.create({
        data: { userId: testUserId, name: 'Project 2', status: 'active' }
      })

      const projects = await getUserProjects(testUserId)
      expect(projects).toHaveLength(2)
    })
  })
})
```

**Step 3: Run tests**

Run: `npm test src/lib/__tests__/projects.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/lib/projects.ts src/lib/__tests__/projects.test.ts
git commit -m "feat(lib): add project utility functions"
```

---

### Task 5.2: Update Document Upload to Use Projects

**Files:**
- Modify: `src/app/api/upload-document/route.ts`

**Step 1: Import project utility**

At top of file, add:

```typescript
import { getOrCreateDefaultProject } from '@/lib/projects'
```

**Step 2: Update conversation creation**

Find the conversation creation code (around line 86-92):

```typescript
// BEFORE:
const conversation = await prisma.conversation.create({
  data: {
    userId,
    status: 'in_progress',
    experimentVariant: 'baseline-v1',
  },
})

// AFTER:
const project = await getOrCreateDefaultProject(userId)

const conversation = await prisma.conversation.create({
  data: {
    projectId: project.id,  // 👈 ADD THIS
    userId,
    status: 'in_progress',
    experimentVariant: 'baseline-v1',
  },
})
```

**Step 3: Test document upload**

Manual test:
1. Start dev server: `npm run dev`
2. Navigate to document upload UI
3. Upload a test PDF
4. Verify conversation created with projectId

**Step 4: Commit**

```bash
git add src/app/api/upload-document/route.ts
git commit -m "feat(api): use projects in document upload flow"
```

---

### Task 5.3: Update Main Conversation API Routes

**Files:**
- Find and update all API routes that create Conversation

**Step 1: Find conversation creation sites**

Run: `grep -r "conversation.create" src/app/api/ --include="*.ts"`

Expected output will show all places creating conversations.

**Step 2: Update each API route**

For EACH route found:

1. Import: `import { getOrCreateDefaultProject } from '@/lib/projects'`
2. Get project: `const project = await getOrCreateDefaultProject(userId)`
3. Add to create: `projectId: project.id`

**Example for a hypothetical `/api/conversation/create` route:**

```typescript
// BEFORE:
const conversation = await prisma.conversation.create({
  data: {
    userId,
    status: 'in_progress',
  }
})

// AFTER:
const project = await getOrCreateDefaultProject(userId)

const conversation = await prisma.conversation.create({
  data: {
    projectId: project.id,  // 👈 ADD
    userId,
    status: 'in_progress',
  }
})
```

**Step 3: Test each route**

For each updated route, test:
- Conversation creation works
- projectId is set
- Can query conversation via project

**Step 4: Commit after each route**

```bash
git add src/app/api/[route]/route.ts
git commit -m "feat(api): use projects in [route] conversation creation"
```

---

### Task 5.4: Update Conversation Queries (If Any)

**Files:**
- Search for conversation queries that might need projectId

**Step 1: Find conversation queries**

Run: `grep -r "conversation.findMany\|conversation.findFirst" src/ --include="*.ts" --include="*.tsx"`

**Step 2: Review each query**

For each query, ask:
- Does it need to filter by project?
- Is it using userId where it should use projectId?

**Step 3: Update queries as needed**

Example:

```typescript
// BEFORE:
const conversations = await prisma.conversation.findMany({
  where: { userId }
})

// MIGHT NEED (depends on context):
const project = await getOrCreateDefaultProject(userId)
const conversations = await prisma.conversation.findMany({
  where: { projectId: project.id }
})
```

**Note:** This depends on your specific UI. If you're only showing default project, filter by projectId. If showing all user conversations across projects, userId is fine.

**Step 4: Commit**

```bash
git add [modified files]
git commit -m "refactor(queries): update conversation queries for project scope"
```

---

## Phase 6: Testing and Verification

**Goal:** Comprehensive testing to ensure migration worked correctly.

---

### Task 6.1: Create Verification Script

**Files:**
- Create: `scripts/migrations/verify-migration.ts`

**Step 1: Create verification script**

```typescript
#!/usr/bin/env tsx
/**
 * Verification: Check migration data integrity
 */

import { prisma } from '@/lib/db'

async function main() {
  console.log('=== Migration Verification ===\n')

  // Check 1: All users have at least one project
  console.log('Check 1: Users have projects')
  const usersWithoutProjects = await prisma.user.findMany({
    where: {
      projects: { none: {} }
    }
  })
  if (usersWithoutProjects.length > 0) {
    console.log(`  ✗ FAIL: ${usersWithoutProjects.length} users without projects`)
    for (const user of usersWithoutProjects) {
      console.log(`    - ${user.email} (${user.id})`)
    }
  } else {
    console.log('  ✓ PASS: All users have projects')
  }

  // Check 2: All conversations have projectId
  console.log('\nCheck 2: Conversations have projectId')
  const conversationsWithoutProject = await prisma.conversation.count({
    where: { projectId: null }
  })
  if (conversationsWithoutProject > 0) {
    console.log(`  ✗ FAIL: ${conversationsWithoutProject} conversations without projectId`)
  } else {
    console.log('  ✓ PASS: All conversations have projectId')
  }

  // Check 3: All projects have 11 syntheses
  console.log('\nCheck 3: Projects have dimensional syntheses')
  const projects = await prisma.project.findMany({
    include: {
      _count: {
        select: { dimensionalSyntheses: true }
      }
    }
  })

  const projectsWithWrongCount = projects.filter(p => p._count.dimensionalSyntheses !== 11)
  if (projectsWithWrongCount.length > 0) {
    console.log(`  ✗ FAIL: ${projectsWithWrongCount.length} projects without exactly 11 syntheses`)
    for (const project of projectsWithWrongCount) {
      console.log(`    - ${project.name} has ${project._count.dimensionalSyntheses}`)
    }
  } else {
    console.log(`  ✓ PASS: All ${projects.length} projects have 11 syntheses`)
  }

  // Check 4: Foreign key integrity
  console.log('\nCheck 4: Foreign key integrity')
  const orphanedConversations = await prisma.conversation.count({
    where: {
      project: null
    }
  })
  if (orphanedConversations > 0) {
    console.log(`  ✗ FAIL: ${orphanedConversations} orphaned conversations`)
  } else {
    console.log('  ✓ PASS: No orphaned conversations')
  }

  // Summary
  console.log('\n=== Summary ===')
  const totalProjects = await prisma.project.count()
  const totalConversations = await prisma.conversation.count()
  const totalFragments = await prisma.fragment.count()
  const totalSyntheses = await prisma.dimensionalSynthesis.count()

  console.log(`Projects: ${totalProjects}`)
  console.log(`Conversations: ${totalConversations}`)
  console.log(`Fragments: ${totalFragments}`)
  console.log(`Syntheses: ${totalSyntheses}`)
  console.log(`Expected syntheses: ${totalProjects * 11}`)

  if (totalSyntheses === totalProjects * 11) {
    console.log('\n✓ All checks passed!')
  } else {
    console.log('\n⚠ Some checks failed - review output above')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 2: Run verification**

Run: `npx tsx scripts/migrations/verify-migration.ts`
Expected: "✓ All checks passed!"

**Step 3: Commit**

```bash
git add scripts/migrations/verify-migration.ts
git commit -m "test(migration): add data integrity verification script"
```

---

### Task 6.2: Manual Testing Checklist

**Step 1: Test conversation creation**

- [ ] Start dev server: `npm run dev`
- [ ] Create new conversation (guided or document upload)
- [ ] Verify conversation has projectId in database
- [ ] Verify messages are created

**Step 2: Test existing conversations**

- [ ] Open existing conversation (if any)
- [ ] Verify it loads correctly
- [ ] Verify all messages show

**Step 3: Test database queries**

In Prisma Studio:
- [ ] Can filter conversations by projectId
- [ ] Can find project's syntheses
- [ ] All foreign keys resolve

**Step 4: Document results**

Create: `docs/migration-test-results.md`

```markdown
# Migration Test Results

Date: 2026-01-03
Tester: [Your name]

## Automated Checks
- [x] Verification script passed
- [x] All users have projects
- [x] All conversations have projectId
- [x] All projects have 11 syntheses

## Manual Tests
- [x] New conversation creation works
- [x] Existing conversations load
- [x] Database queries work

## Issues Found
[None / List any issues]

## Sign-off
Migration successful: [Yes/No]
```

**Step 5: Commit**

```bash
git add docs/migration-test-results.md
git commit -m "docs: add migration test results"
```

---

## Post-Migration Cleanup

### Task 7.1: Update Documentation

**Files:**
- Update: `README.md` (if schema mentioned)
- Update: `.claude/architecture.md`

**Step 1: Document new schema in architecture**

Add to `.claude/architecture.md`:

```markdown
## Database Schema V1 (2026-01-03)

### Core Entities

- **Project**: Boundary for strategic understanding. One user can have multiple projects.
- **Conversation**: Interactive questioning sessions (belongs to Project)
- **Fragment**: Extracted themes/insights from conversations (belongs to Project)
- **FragmentDimensionTag**: Tags fragments to Tier 1 dimensions
- **DimensionalSynthesis**: Compressed understanding per dimension per project
- **GeneratedOutput**: Decision Stack artifacts
- **ExtractionRun**: Evaluation traces for A/B testing

### Legacy
- **Trace**: Deprecated, kept for historical data. New extractions use Fragment/ExtractionRun.

See: `docs/plans/strategic/schema-design-summary.md`
```

**Step 2: Commit**

```bash
git add .claude/architecture.md README.md
git commit -m "docs: update architecture with schema V1"
```

---

### Task 7.2: Create Rollback Plan (Just in Case)

**Files:**
- Create: `docs/plans/schema-v1-rollback.md`

**Step 1: Document rollback steps**

```markdown
# Schema V1 Rollback Plan

**ONLY USE IF CRITICAL ISSUES FOUND**

## Rollback Steps

### 1. Revert application code
```bash
git revert [commit-hash-of-phase-5-changes]
```

### 2. Remove new models (DANGEROUS - LOSES DATA)
```bash
npx prisma migrate dev --name rollback_schema_v1_DESTRUCTIVE
```

Then manually remove from schema.prisma:
- Project model
- Fragment model
- FragmentDimensionTag model
- DimensionalSynthesis model
- GeneratedOutput model
- ExtractionRun model

### 3. Deploy reverted code

### 4. Verify old code works

## Partial Rollback (Keep Data)

If you want to keep new tables but revert app code:

```bash
git revert [commit-hash-of-phase-5-changes]
# Keep new tables, just don't use them
```

## Prevention

- Test thoroughly in staging first
- Run verification script before production deploy
- Monitor error rates after deploy
```

**Step 2: Commit**

```bash
git add docs/plans/schema-v1-rollback.md
git commit -m "docs: add rollback plan for schema V1"
```

---

## Deployment Checklist

**Before deploying to production:**

- [ ] All migrations tested in local dev
- [ ] All migrations tested in staging
- [ ] Verification script passes in staging
- [ ] Manual testing complete
- [ ] Rollback plan reviewed
- [ ] Database backup taken
- [ ] Team notified of deployment window

**Deployment steps:**

1. Take database backup
2. Run migrations (Phase 1-4 scripts)
3. Deploy new application code (Phase 5)
4. Run verification script
5. Monitor for errors
6. Test critical paths

**If issues found:**

- Follow rollback plan in `docs/plans/schema-v1-rollback.md`
- Document issues
- Fix and retry

---

## Success Criteria

Migration is complete when:

- [ ] All new tables exist and are populated
- [ ] All existing data preserved
- [ ] All conversations linked to projects
- [ ] All projects have 11 dimensional syntheses
- [ ] Application code updated to use projectId
- [ ] Verification script passes
- [ ] Manual tests pass
- [ ] No errors in production logs
- [ ] Document upload works
- [ ] Conversation creation works

---

## Next Steps After Migration

Once migration is complete:

1. **HUM-32**: Research document interaction models
2. **Phase 6 (Future)**: Extract fragments from historical Traces (optional)
3. **Phase 7 (Future)**: Implement synthesis update algorithm
4. **HUM-33**: Prototype hybrid document preview
5. **HUM-34**: Add Document model when interaction validated

See: `docs/plans/strategic/schema-design-summary.md` for full roadmap.
