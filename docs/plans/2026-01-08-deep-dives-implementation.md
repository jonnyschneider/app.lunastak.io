# Deep Dives Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement user-initiated deep dive topics that organize conversations and documents for focused exploration.

**Architecture:** DeepDive is a sub-project entity owned by Project. Conversations and Documents can optionally belong to a DeepDive. Fragments always roll up to Project level (no deepDiveId on Fragment).

**Tech Stack:** Next.js, Prisma, shadcn/ui, TypeScript

**Design Doc:** `docs/plans/2026-01-08-deep-dives-design.md`

---

## Phase 1: Foundation (Schema + Contracts)

### Task 1.1: Create DeepDive Data Contracts

**Files:**
- Create: `src/lib/contracts/deep-dive.ts`
- Modify: `src/lib/contracts/index.ts`

**Step 1: Create the contract file with types**

```typescript
// src/lib/contracts/deep-dive.ts
/**
 * Deep Dive Contracts
 *
 * Defines types and validation for Deep Dive entities.
 * Deep Dives are user-initiated priority topics that organize
 * conversations and documents for focused exploration.
 */

// Status values
export const DEEP_DIVE_STATUSES = ['pending', 'active', 'resolved'] as const;
export type DeepDiveStatus = typeof DEEP_DIVE_STATUSES[number];

// Origin values - how the deep dive was created
export const DEEP_DIVE_ORIGINS = ['manual', 'message', 'document'] as const;
export type DeepDiveOrigin = typeof DEEP_DIVE_ORIGINS[number];

// Core deep dive contract
export interface DeepDiveContract {
  id: string;
  projectId: string;
  topic: string;
  notes?: string;
  status: DeepDiveStatus;
  origin: DeepDiveOrigin;
  sourceMessageId?: string;
  sourceDocumentId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Input for creating a deep dive
export interface DeepDiveCreateInput {
  projectId: string;
  topic: string;
  notes?: string;
  origin?: DeepDiveOrigin;
  sourceMessageId?: string;
  sourceDocumentId?: string;
}

// Deep dive with counts for list views
export interface DeepDiveWithCounts extends DeepDiveContract {
  conversationCount: number;
  documentCount: number;
  lastActivityAt?: string;
}

// Validation functions
export function isValidDeepDiveStatus(status: string): status is DeepDiveStatus {
  return DEEP_DIVE_STATUSES.includes(status as DeepDiveStatus);
}

export function isValidDeepDiveOrigin(origin: string): origin is DeepDiveOrigin {
  return DEEP_DIVE_ORIGINS.includes(origin as DeepDiveOrigin);
}

export function validateDeepDive(data: unknown): data is DeepDiveContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  if (typeof obj.topic !== 'string' || !obj.topic) return false;
  if (typeof obj.status !== 'string' || !isValidDeepDiveStatus(obj.status)) return false;
  if (typeof obj.origin !== 'string' || !isValidDeepDiveOrigin(obj.origin)) return false;
  if (typeof obj.createdAt !== 'string' || !obj.createdAt) return false;
  if (typeof obj.updatedAt !== 'string' || !obj.updatedAt) return false;

  // Optional fields
  if (obj.notes !== undefined && obj.notes !== null && typeof obj.notes !== 'string') return false;
  if (obj.sourceMessageId !== undefined && obj.sourceMessageId !== null && typeof obj.sourceMessageId !== 'string') return false;
  if (obj.sourceDocumentId !== undefined && obj.sourceDocumentId !== null && typeof obj.sourceDocumentId !== 'string') return false;
  if (obj.resolvedAt !== undefined && obj.resolvedAt !== null && typeof obj.resolvedAt !== 'string') return false;

  return true;
}

export function validateDeepDiveCreateInput(data: unknown): data is DeepDiveCreateInput {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  if (typeof obj.topic !== 'string' || !obj.topic) return false;

  // Optional fields
  if (obj.notes !== undefined && obj.notes !== null && typeof obj.notes !== 'string') return false;
  if (obj.origin !== undefined && obj.origin !== null) {
    if (typeof obj.origin !== 'string' || !isValidDeepDiveOrigin(obj.origin)) return false;
  }
  if (obj.sourceMessageId !== undefined && obj.sourceMessageId !== null && typeof obj.sourceMessageId !== 'string') return false;
  if (obj.sourceDocumentId !== undefined && obj.sourceDocumentId !== null && typeof obj.sourceDocumentId !== 'string') return false;

  return true;
}
```

**Step 2: Export from contracts index**

Add to `src/lib/contracts/index.ts`:
```typescript
export * from './deep-dive';
```

**Step 3: Commit**

```bash
git add src/lib/contracts/deep-dive.ts src/lib/contracts/index.ts
git commit -m "feat: add deep dive data contracts"
```

---

### Task 1.2: Create DeepDive Contract Tests

**Files:**
- Create: `src/lib/__tests__/contracts/deep-dive-contracts.test.ts`

**Step 1: Write contract tests**

```typescript
// src/lib/__tests__/contracts/deep-dive-contracts.test.ts
/**
 * Deep Dive Contract Tests
 *
 * Verifies deep dive creation and validation conforms to contracts.
 */

import {
  validateDeepDive,
  validateDeepDiveCreateInput,
  isValidDeepDiveStatus,
  isValidDeepDiveOrigin,
  DEEP_DIVE_STATUSES,
  DEEP_DIVE_ORIGINS,
  DeepDiveContract,
  DeepDiveCreateInput,
} from '@/lib/contracts/deep-dive';

describe('Deep Dive Contracts', () => {
  describe('isValidDeepDiveStatus', () => {
    it('should accept all valid statuses', () => {
      for (const status of DEEP_DIVE_STATUSES) {
        expect(isValidDeepDiveStatus(status)).toBe(true);
      }
    });

    it('should reject invalid statuses', () => {
      expect(isValidDeepDiveStatus('invalid')).toBe(false);
      expect(isValidDeepDiveStatus('ACTIVE')).toBe(false);
      expect(isValidDeepDiveStatus('')).toBe(false);
    });
  });

  describe('isValidDeepDiveOrigin', () => {
    it('should accept all valid origins', () => {
      for (const origin of DEEP_DIVE_ORIGINS) {
        expect(isValidDeepDiveOrigin(origin)).toBe(true);
      }
    });

    it('should reject invalid origins', () => {
      expect(isValidDeepDiveOrigin('invalid')).toBe(false);
      expect(isValidDeepDiveOrigin('MANUAL')).toBe(false);
      expect(isValidDeepDiveOrigin('')).toBe(false);
    });
  });

  describe('DeepDiveContract', () => {
    const validDeepDive: DeepDiveContract = {
      id: 'dd_abc123',
      projectId: 'proj_xyz789',
      topic: 'Pricing strategy for enterprise',
      status: 'active',
      origin: 'manual',
      createdAt: '2026-01-08T10:00:00Z',
      updatedAt: '2026-01-08T10:00:00Z',
    };

    it('should validate a correct deep dive', () => {
      expect(validateDeepDive(validDeepDive)).toBe(true);
    });

    it('should validate deep dive with all optional fields', () => {
      const fullDeepDive: DeepDiveContract = {
        ...validDeepDive,
        notes: 'Need to explore pricing tiers and competitive positioning',
        sourceMessageId: 'msg_def456',
        resolvedAt: '2026-01-10T15:30:00Z',
        status: 'resolved',
      };
      expect(validateDeepDive(fullDeepDive)).toBe(true);
    });

    it('should validate deep dive from message deferral', () => {
      const messageDeepDive: DeepDiveContract = {
        ...validDeepDive,
        origin: 'message',
        sourceMessageId: 'msg_def456',
      };
      expect(validateDeepDive(messageDeepDive)).toBe(true);
    });

    it('should validate pending deep dive from document', () => {
      const documentDeepDive: DeepDiveContract = {
        ...validDeepDive,
        status: 'pending',
        origin: 'document',
        sourceDocumentId: 'doc_ghi789',
      };
      expect(validateDeepDive(documentDeepDive)).toBe(true);
    });

    it('should reject deep dive with missing id', () => {
      const { id, ...invalid } = validDeepDive;
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject deep dive with missing projectId', () => {
      const { projectId, ...invalid } = validDeepDive;
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject deep dive with empty topic', () => {
      const invalid = { ...validDeepDive, topic: '' };
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject deep dive with invalid status', () => {
      const invalid = { ...validDeepDive, status: 'invalid' };
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject deep dive with invalid origin', () => {
      const invalid = { ...validDeepDive, origin: 'invalid' };
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject null', () => {
      expect(validateDeepDive(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateDeepDive('string')).toBe(false);
      expect(validateDeepDive(123)).toBe(false);
    });
  });

  describe('DeepDiveCreateInput', () => {
    const validInput: DeepDiveCreateInput = {
      projectId: 'proj_xyz789',
      topic: 'Competitor analysis',
    };

    it('should validate minimal create input', () => {
      expect(validateDeepDiveCreateInput(validInput)).toBe(true);
    });

    it('should validate create input with optional fields', () => {
      const fullInput: DeepDiveCreateInput = {
        ...validInput,
        notes: 'Focus on Series B competitors',
        origin: 'message',
        sourceMessageId: 'msg_abc123',
      };
      expect(validateDeepDiveCreateInput(fullInput)).toBe(true);
    });

    it('should reject input with missing projectId', () => {
      const { projectId, ...invalid } = validInput;
      expect(validateDeepDiveCreateInput(invalid)).toBe(false);
    });

    it('should reject input with missing topic', () => {
      const { topic, ...invalid } = validInput;
      expect(validateDeepDiveCreateInput(invalid)).toBe(false);
    });

    it('should reject input with empty topic', () => {
      const invalid = { ...validInput, topic: '' };
      expect(validateDeepDiveCreateInput(invalid)).toBe(false);
    });

    it('should reject input with invalid origin', () => {
      const invalid = { ...validInput, origin: 'invalid' };
      expect(validateDeepDiveCreateInput(invalid)).toBe(false);
    });

    it('should accept input without origin (defaults on server)', () => {
      expect(validateDeepDiveCreateInput(validInput)).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=deep-dive-contracts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/contracts/deep-dive-contracts.test.ts
git commit -m "test: add deep dive contract tests"
```

---

### Task 1.3: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add DeepDive model and relations**

Add after the `Document` model:

```prisma
model DeepDive {
  id        String   @id @default(cuid())
  projectId String

  // Content
  topic     String               // The topic/question to explore
  notes     String?  @db.Text    // Optional user notes

  // Lifecycle
  status    String   @default("active")  // pending | active | resolved
  resolvedAt DateTime?

  // Origin tracking
  origin    String   @default("manual")  // manual | message | document
  sourceMessageId  String?       // If created from message deferral
  sourceDocumentId String?       // If created from document extraction

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  project       Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  conversations Conversation[]
  documents     Document[]

  @@index([projectId])
  @@index([status])
  @@index([createdAt])
}
```

**Step 2: Add deepDiveId to Conversation model**

Find `model Conversation` and add after `projectId`:

```prisma
  deepDiveId    String?
  deepDive      DeepDive?      @relation(fields: [deepDiveId], references: [id], onDelete: SetNull)
```

Add index:
```prisma
  @@index([deepDiveId])
```

**Step 3: Add deepDiveId to Document model**

Find `model Document` and add after `projectId`:

```prisma
  deepDiveId    String?
  deepDive      DeepDive?      @relation(fields: [deepDiveId], references: [id], onDelete: SetNull)
```

Add index:
```prisma
  @@index([deepDiveId])
```

**Step 4: Add deepDives relation to Project model**

Find `model Project` and add in relations section:

```prisma
  deepDives            DeepDive[]
```

**Step 5: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully

**Step 6: Push schema to database**

Run: `npx prisma db push`
Expected: Database schema updated

**Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add DeepDive model to schema"
```

---

## Phase 2: API Layer

### Task 2.1: Create Deep Dive API - POST (Create)

**Files:**
- Create: `src/app/api/deep-dive/route.ts`

**Step 1: Create the POST endpoint**

```typescript
// src/app/api/deep-dive/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateDeepDiveCreateInput } from '@/lib/contracts/deep-dive'

/**
 * POST /api/deep-dive
 * Creates a new deep dive
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    if (!validateDeepDiveCreateInput(body)) {
      return NextResponse.json(
        { error: 'Invalid input: projectId and topic are required' },
        { status: 400 }
      )
    }

    const { projectId, topic, notes, origin, sourceMessageId, sourceDocumentId } = body

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
        status: 'active',
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create the deep dive
    const deepDive = await prisma.deepDive.create({
      data: {
        projectId,
        topic,
        notes: notes || null,
        status: 'active',
        origin: origin || 'manual',
        sourceMessageId: sourceMessageId || null,
        sourceDocumentId: sourceDocumentId || null,
      },
    })

    return NextResponse.json({
      id: deepDive.id,
      projectId: deepDive.projectId,
      topic: deepDive.topic,
      notes: deepDive.notes,
      status: deepDive.status,
      origin: deepDive.origin,
      sourceMessageId: deepDive.sourceMessageId,
      sourceDocumentId: deepDive.sourceDocumentId,
      resolvedAt: deepDive.resolvedAt?.toISOString() || null,
      createdAt: deepDive.createdAt.toISOString(),
      updatedAt: deepDive.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error creating deep dive:', error)
    return NextResponse.json({ error: 'Failed to create deep dive' }, { status: 500 })
  }
}

/**
 * GET /api/deep-dive
 * Lists deep dives for a project
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const includeResolved = searchParams.get('includeResolved') === 'true'

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
        status: 'active',
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch deep dives with conversation and document counts
    const deepDives = await prisma.deepDive.findMany({
      where: {
        projectId,
        ...(includeResolved ? {} : { status: { not: 'resolved' } }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        conversations: {
          select: { id: true, updatedAt: true },
          where: { status: { not: 'abandoned' } },
        },
        documents: {
          select: { id: true, updatedAt: true },
        },
      },
    })

    // Format response with counts and last activity
    const formattedDeepDives = deepDives.map(dd => {
      // Calculate last activity from conversations and documents
      const conversationDates = dd.conversations.map(c => c.updatedAt)
      const documentDates = dd.documents.map(d => d.updatedAt)
      const allDates = [...conversationDates, ...documentDates, dd.updatedAt]
      const lastActivityAt = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime()))).toISOString()
        : dd.updatedAt.toISOString()

      return {
        id: dd.id,
        projectId: dd.projectId,
        topic: dd.topic,
        notes: dd.notes,
        status: dd.status,
        origin: dd.origin,
        sourceMessageId: dd.sourceMessageId,
        sourceDocumentId: dd.sourceDocumentId,
        resolvedAt: dd.resolvedAt?.toISOString() || null,
        createdAt: dd.createdAt.toISOString(),
        updatedAt: dd.updatedAt.toISOString(),
        conversationCount: dd.conversations.length,
        documentCount: dd.documents.length,
        lastActivityAt,
      }
    })

    return NextResponse.json({ deepDives: formattedDeepDives })
  } catch (error) {
    console.error('Error fetching deep dives:', error)
    return NextResponse.json({ error: 'Failed to fetch deep dives' }, { status: 500 })
  }
}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/deep-dive/route.ts
git commit -m "feat: add deep dive POST and GET endpoints"
```

---

### Task 2.2: Create Deep Dive API - PATCH and DELETE

**Files:**
- Create: `src/app/api/deep-dive/[id]/route.ts`

**Step 1: Create the single deep dive endpoints**

```typescript
// src/app/api/deep-dive/[id]/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isValidDeepDiveStatus } from '@/lib/contracts/deep-dive'

/**
 * GET /api/deep-dive/[id]
 * Get a single deep dive with its conversations and documents
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deepDive = await prisma.deepDive.findFirst({
      where: { id },
      include: {
        project: { select: { userId: true } },
        conversations: {
          where: { status: { not: 'abandoned' } },
          orderBy: { updatedAt: 'desc' },
          include: {
            messages: { select: { id: true } },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!deepDive) {
      return NextResponse.json({ error: 'Deep dive not found' }, { status: 404 })
    }

    // Verify user owns the project
    if (deepDive.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      deepDive: {
        id: deepDive.id,
        projectId: deepDive.projectId,
        topic: deepDive.topic,
        notes: deepDive.notes,
        status: deepDive.status,
        origin: deepDive.origin,
        sourceMessageId: deepDive.sourceMessageId,
        sourceDocumentId: deepDive.sourceDocumentId,
        resolvedAt: deepDive.resolvedAt?.toISOString() || null,
        createdAt: deepDive.createdAt.toISOString(),
        updatedAt: deepDive.updatedAt.toISOString(),
      },
      conversations: deepDive.conversations.map(c => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        status: c.status,
        messageCount: c.messages.length,
      })),
      documents: deepDive.documents.map(d => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error fetching deep dive:', error)
    return NextResponse.json({ error: 'Failed to fetch deep dive' }, { status: 500 })
  }
}

/**
 * PATCH /api/deep-dive/[id]
 * Update a deep dive (topic, notes, status)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { topic, notes, status } = body

    // Validate status if provided
    if (status !== undefined && !isValidDeepDiveStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.deepDive.findFirst({
      where: { id },
      include: { project: { select: { userId: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Deep dive not found' }, { status: 404 })
    }

    if (existing.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (topic !== undefined) updateData.topic = topic
    if (notes !== undefined) updateData.notes = notes || null
    if (status !== undefined) {
      updateData.status = status
      if (status === 'resolved') {
        updateData.resolvedAt = new Date()
      } else if (existing.status === 'resolved' && status !== 'resolved') {
        // Un-resolving
        updateData.resolvedAt = null
      }
    }

    const updated = await prisma.deepDive.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      id: updated.id,
      projectId: updated.projectId,
      topic: updated.topic,
      notes: updated.notes,
      status: updated.status,
      origin: updated.origin,
      sourceMessageId: updated.sourceMessageId,
      sourceDocumentId: updated.sourceDocumentId,
      resolvedAt: updated.resolvedAt?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error updating deep dive:', error)
    return NextResponse.json({ error: 'Failed to update deep dive' }, { status: 500 })
  }
}

/**
 * DELETE /api/deep-dive/[id]
 * Delete a deep dive (conversations/documents remain, deepDiveId set to null)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Verify ownership
    const existing = await prisma.deepDive.findFirst({
      where: { id },
      include: { project: { select: { userId: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Deep dive not found' }, { status: 404 })
    }

    if (existing.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete the deep dive (onDelete: SetNull will unlink conversations/documents)
    await prisma.deepDive.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting deep dive:', error)
    return NextResponse.json({ error: 'Failed to delete deep dive' }, { status: 500 })
  }
}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/deep-dive/[id]/route.ts
git commit -m "feat: add deep dive GET/PATCH/DELETE endpoints"
```

---

### Task 2.3: Update Project API to Include Deep Dives

**Files:**
- Modify: `src/app/api/project/[id]/route.ts`

**Step 1: Add deepDives to the project query and response**

In the `GET` function, update the `prisma.project.findFirst` include to add:

```typescript
        deepDives: {
          where: { status: { not: 'resolved' } },
          orderBy: { createdAt: 'desc' },
          include: {
            conversations: {
              select: { id: true, updatedAt: true },
              where: { status: { not: 'abandoned' } },
            },
            documents: {
              select: { id: true, updatedAt: true },
            },
          },
        },
```

**Step 2: Format deep dives in response**

Add after the `syntheses` formatting:

```typescript
    // Format deep dives
    const deepDives = project.deepDives.map(dd => {
      const conversationDates = dd.conversations.map(c => c.updatedAt)
      const documentDates = dd.documents.map(d => d.updatedAt)
      const allDates = [...conversationDates, ...documentDates, dd.updatedAt]
      const lastActivityAt = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime()))).toISOString()
        : dd.updatedAt.toISOString()

      return {
        id: dd.id,
        topic: dd.topic,
        status: dd.status,
        origin: dd.origin,
        conversationCount: dd.conversations.length,
        documentCount: dd.documents.length,
        lastActivityAt,
        createdAt: dd.createdAt.toISOString(),
      }
    })
```

**Step 3: Add deepDives to the JSON response**

Add `deepDives,` to the `NextResponse.json({...})` object.

**Step 4: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/project/[id]/route.ts
git commit -m "feat: include deep dives in project API response"
```

---

## Phase 3: Project View UI

### Task 3.1: Add Deep Dives Section to Project Page

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Add DeepDive type and state**

After existing interfaces, add:

```typescript
interface DeepDiveSummary {
  id: string
  topic: string
  status: string
  origin: string
  conversationCount: number
  documentCount: number
  lastActivityAt: string
  createdAt: string
}
```

Update `ProjectData` interface to include:
```typescript
  deepDives: DeepDiveSummary[]
```

Add state for deep dives expansion:
```typescript
  const [showAllDeepDives, setShowAllDeepDives] = useState(false)
```

**Step 2: Add Target icon to imports**

The Target icon is already imported, but we need Crosshair for deep dives. Update imports:

```typescript
import {
  // ... existing imports
  Crosshair,
} from 'lucide-react'
```

**Step 3: Add Deep Dives section**

After the "Areas of Focus" Card in the bottom section, add the Deep Dives section. (Full JSX in implementation - approximately 80 lines matching the Areas of Focus pattern)

**Step 4: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat: add deep dives section to project page"
```

---

### Task 3.2: Create Add Deep Dive Modal

**Files:**
- Create: `src/components/add-deep-dive-dialog.tsx`
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Create the dialog component**

```typescript
// src/components/add-deep-dive-dialog.tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface AddDeepDiveDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  initialTopic?: string
  origin?: 'manual' | 'message'
  sourceMessageId?: string
}

export function AddDeepDiveDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
  initialTopic = '',
  origin = 'manual',
  sourceMessageId,
}: AddDeepDiveDialogProps) {
  const [topic, setTopic] = useState(initialTopic)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          topic: topic.trim(),
          notes: notes.trim() || undefined,
          origin,
          sourceMessageId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create deep dive')
      }

      setTopic('')
      setNotes('')
      onOpenChange(false)
      onCreated()
    } catch (err) {
      setError('Failed to create deep dive. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Deep Dive</DialogTitle>
            <DialogDescription>
              Create a topic to explore in depth with focused conversations and documents.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                placeholder="e.g., Pricing strategy for enterprise"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any context or notes about this topic..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!topic.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Import and use in project page**

Add import:
```typescript
import { AddDeepDiveDialog } from '@/components/add-deep-dive-dialog'
```

Add state:
```typescript
const [addDeepDiveOpen, setAddDeepDiveOpen] = useState(false)
```

Add the dialog at the end of the component (before final closing tags):
```typescript
<AddDeepDiveDialog
  projectId={projectId}
  open={addDeepDiveOpen}
  onOpenChange={setAddDeepDiveOpen}
  onCreated={fetchProjectData}
/>
```

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/add-deep-dive-dialog.tsx src/app/project/[id]/page.tsx
git commit -m "feat: add deep dive creation modal"
```

---

### Task 3.3: Create Deep Dive Detail Sheet

**Files:**
- Create: `src/components/deep-dive-sheet.tsx`
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Create the sheet component**

```typescript
// src/components/deep-dive-sheet.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Upload,
  FileText,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

interface DeepDiveConversation {
  id: string
  createdAt: string
  updatedAt: string
  status: string
  messageCount: number
}

interface DeepDiveDocument {
  id: string
  fileName: string
  fileType: string
  status: string
  createdAt: string
}

interface DeepDiveDetail {
  id: string
  projectId: string
  topic: string
  notes: string | null
  status: string
  origin: string
  createdAt: string
}

interface DeepDiveSheetProps {
  deepDiveId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolve: () => void
  onStartChat: (deepDiveId: string) => void
  onUploadDoc: (deepDiveId: string) => void
}

export function DeepDiveSheet({
  deepDiveId,
  open,
  onOpenChange,
  onResolve,
  onStartChat,
  onUploadDoc,
}: DeepDiveSheetProps) {
  const [deepDive, setDeepDive] = useState<DeepDiveDetail | null>(null)
  const [conversations, setConversations] = useState<DeepDiveConversation[]>([])
  const [documents, setDocuments] = useState<DeepDiveDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isResolving, setIsResolving] = useState(false)

  useEffect(() => {
    if (deepDiveId && open) {
      fetchDeepDive()
    }
  }, [deepDiveId, open])

  const fetchDeepDive = async () => {
    if (!deepDiveId) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/deep-dive/${deepDiveId}`)
      if (response.ok) {
        const data = await response.json()
        setDeepDive(data.deepDive)
        setConversations(data.conversations)
        setDocuments(data.documents)
      }
    } catch (err) {
      console.error('Error fetching deep dive:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResolve = async () => {
    if (!deepDiveId) return
    setIsResolving(true)
    try {
      const response = await fetch(`/api/deep-dive/${deepDiveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      })
      if (response.ok) {
        onOpenChange(false)
        onResolve()
      }
    } catch (err) {
      console.error('Error resolving deep dive:', err)
    } finally {
      setIsResolving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const originLabel = {
    manual: 'Manually created',
    message: 'From conversation',
    document: 'From document',
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : deepDive ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {deepDive.topic}
                <Badge variant={deepDive.status === 'active' ? 'default' : 'secondary'}>
                  {deepDive.status}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {originLabel[deepDive.origin as keyof typeof originLabel] || deepDive.origin} on {formatDate(deepDive.createdAt)}
              </SheetDescription>
            </SheetHeader>

            {deepDive.notes && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{deepDive.notes}</p>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <Button size="sm" onClick={() => onStartChat(deepDive.id)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              <Button size="sm" variant="outline" onClick={() => onUploadDoc(deepDive.id)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              {deepDive.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResolve}
                  disabled={isResolving}
                >
                  {isResolving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Resolve
                </Button>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {/* Conversations */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Conversations ({conversations.length})
                </h4>
                {conversations.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <Link
                        key={conv.id}
                        href={`/conversation/${conv.id}`}
                        className="flex items-center justify-between p-2 rounded border hover:bg-accent transition-colors text-sm"
                      >
                        <div>
                          <div className="text-xs font-medium">{formatDate(conv.createdAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            {conv.messageCount} messages
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                )}
              </div>

              {/* Documents */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Documents ({documents.length})
                </h4>
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 p-2 rounded border text-sm"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1 text-xs">{doc.fileName}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {doc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents yet</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Deep dive not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

**Step 2: Import and wire up in project page**

Add import:
```typescript
import { DeepDiveSheet } from '@/components/deep-dive-sheet'
```

Add state:
```typescript
const [selectedDeepDiveId, setSelectedDeepDiveId] = useState<string | null>(null)
const [deepDiveSheetOpen, setDeepDiveSheetOpen] = useState(false)
```

Add handlers:
```typescript
const openDeepDiveSheet = (id: string) => {
  setSelectedDeepDiveId(id)
  setDeepDiveSheetOpen(true)
}

const handleStartDeepDiveChat = (deepDiveId: string) => {
  // TODO: Navigate to new conversation with deepDiveId
  router.push(`/?deepDiveId=${deepDiveId}`)
}

const handleUploadToDeepDive = (deepDiveId: string) => {
  // TODO: Open upload dialog with deepDiveId context
  setUploadDialogOpen(true)
}
```

Add the sheet component at end of component:
```typescript
<DeepDiveSheet
  deepDiveId={selectedDeepDiveId}
  open={deepDiveSheetOpen}
  onOpenChange={setDeepDiveSheetOpen}
  onResolve={fetchProjectData}
  onStartChat={handleStartDeepDiveChat}
  onUploadDoc={handleUploadToDeepDive}
/>
```

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/deep-dive-sheet.tsx src/app/project/[id]/page.tsx
git commit -m "feat: add deep dive detail sheet"
```

---

## Phase 4: Message Deferral (Conversation Integration)

### Task 4.1: Add Context Menu to Conversation Messages

**Files:**
- Modify: `src/components/ChatMessage.tsx` (or equivalent message component)

**Step 1: Locate the message component**

Find the component that renders individual messages in conversations.

**Step 2: Add dropdown menu to assistant messages**

Add a ⋯ button with "Defer to Deep Dive" option that opens the AddDeepDiveDialog with:
- `initialTopic` pre-filled from message content (truncated)
- `origin` set to 'message'
- `sourceMessageId` set to the message ID

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Test manually**

1. Open a conversation with Luna messages
2. Click ⋯ on a Luna message
3. Click "Defer to Deep Dive"
4. Verify modal opens with topic pre-filled

**Step 5: Commit**

```bash
git add src/components/ChatMessage.tsx
git commit -m "feat: add defer to deep dive option on messages"
```

---

## Phase 5: Deep Dive Context in Conversations

### Task 5.1: Pass deepDiveId When Creating Conversations

**Files:**
- Modify: Conversation creation flow (home page or wherever new conversations are initiated)

**Step 1: Accept deepDiveId from URL params**

When navigating to `/?deepDiveId=xxx`, read the param and pass to conversation creation.

**Step 2: Update conversation creation API call**

Include `deepDiveId` in the POST body when creating a new conversation.

**Step 3: Update conversation API to accept deepDiveId**

Modify `POST /api/conversation` to accept and save `deepDiveId`.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/app/api/conversation/route.ts
git commit -m "feat: support creating conversations within deep dives"
```

---

### Task 5.2: Inject Deep Dive Context into Luna's System Prompt

**Files:**
- Modify: `src/lib/system-prompt.ts` (or wherever system prompts are constructed)

**Step 1: Accept deepDive info in prompt builder**

If conversation has a deepDiveId, fetch the deep dive topic and inject into system prompt:

```
This conversation is part of a deep dive exploration on: "{topic}"

Focus on helping the user explore this topic in depth.
```

**Step 2: Commit**

```bash
git add src/lib/system-prompt.ts
git commit -m "feat: inject deep dive context into system prompt"
```

---

## Phase 6: Final Integration & Polish

### Task 6.1: Run Full Verification

**Step 1: Run all tests**

Run: `npm run verify`
Expected: All tests pass, no type errors

**Step 2: Manual testing checklist**

- [ ] Create deep dive manually from project page
- [ ] View deep dive in sheet
- [ ] Start conversation from deep dive
- [ ] Upload document to deep dive
- [ ] Resolve deep dive
- [ ] Defer message to new deep dive from conversation
- [ ] Verify deep dive shows in project view
- [ ] Verify limits (3 shown, "Show more" works)

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from integration testing"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|------------------|
| 1 | 1.1-1.3 | Contracts, tests, schema |
| 2 | 2.1-2.3 | API endpoints (CRUD) |
| 3 | 3.1-3.3 | Project page UI, modal, sheet |
| 4 | 4.1 | Message context menu deferral |
| 5 | 5.1-5.2 | Conversation integration |
| 6 | 6.1 | Verification & polish |

**Total estimated tasks:** 12 major tasks, ~30-40 bite-sized steps
