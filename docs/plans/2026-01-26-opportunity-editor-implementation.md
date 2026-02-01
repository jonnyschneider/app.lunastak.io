# Opportunity Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to create and manage Opportunities with inline editing and real-time coaching feedback.

**Architecture:** New `UserContent` table stores user-authored content (opportunities, later principles). Client-side heuristics evaluate quality criteria. Inline editor replaces the stubbed placeholder in StrategyDisplay.

**Tech Stack:** Prisma schema migration, Next.js API route, React components with controlled textarea, TypeScript utility for coaching heuristics.

---

## Task 1: Schema - Add UserContent Model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the UserContent model to schema**

Add after the `UserDismissal` model (end of file):

```prisma
model UserContent {
  id        String   @id @default(cuid())
  projectId String

  type      String   // 'opportunity' | 'principle'
  content   String   @db.Text
  status    String   @default("draft")  // 'draft' | 'complete'
  metadata  Json?    // objectiveIds, coachingDismissed, parsed fields

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([type])
  @@index([status])
}
```

**Step 2: Add relation to Project model**

In the `Project` model, add to the relations section (after `dismissals`):

```prisma
  userContent          UserContent[]
```

**Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 4: Create and apply migration**

Run: `npx prisma migrate dev --name add_user_content`
Expected: Migration created and applied successfully

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add UserContent model for user-authored opportunities"
```

---

## Task 2: Seed Infrastructure - Add Fixture Types

**Files:**
- Modify: `scripts/seed/types.ts`

**Step 1: Add FixtureUserContent type**

Add after `FixtureGeneratedOutput` interface:

```typescript
// User-authored content in fixture (opportunities, principles)
export interface FixtureUserContent {
  id: string; // "{{UC_N_ID}}" placeholder
  type: 'opportunity' | 'principle';
  content: string;
  status: 'draft' | 'complete';
  metadata?: {
    objectiveIds?: string[];
    coachingDismissed?: boolean;
    parsedTitle?: string;
    parsedTimeframe?: string;
  };
}
```

**Step 2: Add userContent to FixtureProject**

In the `FixtureProject` interface, add after `generatedOutputs`:

```typescript
  userContent?: FixtureUserContent[];
```

**Step 3: Commit**

```bash
git add scripts/seed/types.ts
git commit -m "feat: add FixtureUserContent type for seed infrastructure"
```

---

## Task 3: Seed Infrastructure - Update Hydrate Script

**Files:**
- Modify: `scripts/seed/hydrate.ts`

**Step 1: Add ID mapping for user content**

After the document ID mapping block (around line 128), add:

```typescript
  // Map user content IDs
  fixture.projects.forEach(p => {
    p.userContent?.forEach((uc) => {
      idMap.set(uc.id, generateCuid());
    });
  });
```

**Step 2: Add hydration logic for user content**

After the generated outputs hydration block (around line 339, before the knowledgeUpdatedAt update), add:

```typescript
    // Create user content (opportunities, principles)
    for (const ucFixture of projectFixture.userContent || []) {
      const ucId = resolveId(ucFixture.id);
      await prisma.userContent.create({
        data: {
          id: ucId,
          projectId: project.id,
          type: ucFixture.type,
          content: ucFixture.content,
          status: ucFixture.status,
          metadata: ucFixture.metadata ? JSON.parse(JSON.stringify(ucFixture.metadata)) : undefined,
        },
      });
    }
```

**Step 3: Update console log to include user content count**

Update the log line (around line 350) to:

```typescript
    const ucCount = projectFixture.userContent?.length || 0;
    console.log(`  [OK] Project complete: ${projectFixture.conversations.length} conversations, ${projectFixture.fragments.length} fragments, ${synthCount} syntheses, ${outputCount} outputs, ${ucCount} user content`);
```

**Step 4: Commit**

```bash
git add scripts/seed/hydrate.ts
git commit -m "feat: add UserContent hydration to seed script"
```

---

## Task 4: Demo Fixture - Add Sample Opportunities

**Files:**
- Modify: `scripts/seed/fixtures/demo-extended.json`

**Step 1: Add userContent array to the project**

After the `generatedOutputs` array (or after `syntheses` if no generatedOutputs), add:

```json
"userContent": [
  {
    "id": "{{UC_1_ID}}",
    "type": "opportunity",
    "content": "Launch Selection Tracker MVP (Q2) → Core selection workflow, client portal integration, notification system for trades",
    "status": "complete",
    "metadata": {
      "parsedTitle": "Launch Selection Tracker MVP",
      "parsedTimeframe": "Q2"
    }
  },
  {
    "id": "{{UC_2_ID}}",
    "type": "opportunity",
    "content": "Partner with 3 regional home builder associations for distribution",
    "status": "draft",
    "metadata": {
      "coachingDismissed": false
    }
  }
]
```

**Step 2: Validate fixture**

Run: `npx tsx scripts/seed/validate.ts --fixture demo-extended`
Expected: Validation passes (or create validate script if missing)

**Step 3: Test hydration locally**

Run: `npx tsx scripts/seed/hydrate.ts --fixture demo-extended --email test-uc@test.com --reset`
Expected: Hydration completes with "2 user content"

**Step 4: Clean up test data**

Run: `npx tsx scripts/seed/hydrate.ts --fixture empty-project --email test-uc@test.com --reset` (or manually delete)

**Step 5: Commit**

```bash
git add scripts/seed/fixtures/demo-extended.json
git commit -m "feat: add sample opportunities to demo fixture"
```

---

## Task 5: API - Create Content Endpoint

**Files:**
- Create: `src/app/api/project/[id]/content/route.ts`

**Step 1: Create the API route file**

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  let userId: string | null = session?.user?.id || null

  if (!userId) {
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)

    if (guestCookie?.value) {
      const guestUser = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { email: true },
      })

      if (guestUser && isGuestUser(guestUser.email)) {
        userId = guestCookie.value
      }
    }
  }

  return userId
}

async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true },
  })
  return !!project
}

/**
 * GET /api/project/[id]/content
 * Fetches all user content for a project
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  if (!(await verifyProjectAccess(projectId, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const content = await prisma.userContent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Error fetching user content:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}

/**
 * POST /api/project/[id]/content
 * Creates new user content
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  if (!(await verifyProjectAccess(projectId, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { type, content, status, metadata } = body

    if (!type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['opportunity', 'principle'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const userContent = await prisma.userContent.create({
      data: {
        projectId,
        type,
        content,
        status: status || 'draft',
        metadata: metadata || undefined,
      },
    })

    return NextResponse.json({ content: userContent }, { status: 201 })
  } catch (error) {
    console.error('Error creating user content:', error)
    return NextResponse.json({ error: 'Failed to create content' }, { status: 500 })
  }
}

/**
 * PUT /api/project/[id]/content
 * Updates existing user content
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  if (!(await verifyProjectAccess(projectId, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { id, content, status, metadata } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing content id' }, { status: 400 })
    }

    // Verify content belongs to project
    const existing = await prisma.userContent.findFirst({
      where: { id, projectId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const updated = await prisma.userContent.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        ...(metadata !== undefined && { metadata }),
      },
    })

    return NextResponse.json({ content: updated })
  } catch (error) {
    console.error('Error updating user content:', error)
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
  }
}

/**
 * DELETE /api/project/[id]/content
 * Deletes user content
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  if (!(await verifyProjectAccess(projectId, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get('id')

    if (!contentId) {
      return NextResponse.json({ error: 'Missing content id' }, { status: 400 })
    }

    // Verify content belongs to project
    const existing = await prisma.userContent.findFirst({
      where: { id: contentId, projectId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    await prisma.userContent.delete({
      where: { id: contentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user content:', error)
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/project/\[id\]/content/route.ts
git commit -m "feat: add CRUD API for user content"
```

---

## Task 6: Coaching Utility - Client-Side Heuristics

**Files:**
- Create: `src/lib/opportunity-coaching.ts`

**Step 1: Create the coaching utility**

```typescript
/**
 * Opportunity Coaching
 *
 * Client-side heuristics to evaluate opportunity quality.
 * Provides real-time feedback without API calls.
 */

export interface CoachingCriterion {
  id: string;
  label: string;
  passed: boolean;
  suggestion?: string;
}

export interface CoachingResult {
  criteria: CoachingCriterion[];
  overallStrength: 'weak' | 'okay' | 'strong';
}

// Timeframe patterns: Q1-Q4, year, months, weeks
const TIMEFRAME_PATTERN = /\b(Q[1-4]|20\d{2}|\d+\s*(month|week|M|W)s?)\b/i;

// Deliverable indicators: arrows, bullets, semicolons, "deliver", "launch", "ship"
const DELIVERABLE_PATTERN = /→|•|;|\bdeliver\b|\blaunch\b|\bship\b|\bbuild\b|\bcreate\b/i;

// Vague phrases that indicate low specificity
const VAGUE_PATTERNS = [
  /^improve\s+\w+$/i,
  /^enhance\s+\w+$/i,
  /^better\s+\w+$/i,
  /^optimize\s+\w+$/i,
  /^increase\s+\w+$/i,
  /^grow\s+\w+$/i,
];

// Specific action verbs that indicate good specificity
const ACTION_VERBS = /\b(launch|build|create|develop|implement|deploy|integrate|establish|partner|hire|acquire|migrate|design|test|validate|ship)\b/i;

/**
 * Evaluates an opportunity and returns coaching feedback
 */
export function evaluateOpportunity(content: string): CoachingResult {
  const trimmed = content.trim();
  const criteria: CoachingCriterion[] = [];

  // Criterion 1: Has timeframe
  const hasTimeframe = TIMEFRAME_PATTERN.test(trimmed);
  criteria.push({
    id: 'timeframe',
    label: 'Has a timeframe',
    passed: hasTimeframe,
    suggestion: hasTimeframe ? undefined : 'Add when this should happen (e.g., "Q2", "within 3 months")',
  });

  // Criterion 2: Has deliverables
  const hasDeliverables = DELIVERABLE_PATTERN.test(trimmed);
  criteria.push({
    id: 'deliverables',
    label: 'Clear deliverables',
    passed: hasDeliverables,
    suggestion: hasDeliverables ? undefined : 'Add what you\'ll deliver (use → to list outcomes)',
  });

  // Criterion 3: Specific (not vague)
  const isVague = VAGUE_PATTERNS.some(pattern => pattern.test(trimmed));
  const hasActionVerb = ACTION_VERBS.test(trimmed);
  const isSpecific = !isVague && (hasActionVerb || trimmed.length > 30);
  criteria.push({
    id: 'specific',
    label: 'Specific action',
    passed: isSpecific,
    suggestion: isSpecific ? undefined : 'Be more specific about what you\'ll actually do',
  });

  // Criterion 4: Sufficient detail (word count)
  const wordCount = trimmed.split(/\s+/).length;
  const hasSufficientDetail = wordCount >= 5;
  criteria.push({
    id: 'detail',
    label: 'Enough detail',
    passed: hasSufficientDetail,
    suggestion: hasSufficientDetail ? undefined : 'Add more detail about this opportunity',
  });

  // Calculate overall strength
  const passedCount = criteria.filter(c => c.passed).length;
  let overallStrength: 'weak' | 'okay' | 'strong';

  if (passedCount >= 4) {
    overallStrength = 'strong';
  } else if (passedCount >= 2) {
    overallStrength = 'okay';
  } else {
    overallStrength = 'weak';
  }

  return { criteria, overallStrength };
}

/**
 * Parses opportunity content to extract title and timeframe for card display
 */
export function parseOpportunityContent(content: string): {
  title: string;
  timeframe?: string;
  details?: string;
} {
  const trimmed = content.trim();

  // Extract timeframe
  const timeframeMatch = trimmed.match(TIMEFRAME_PATTERN);
  const timeframe = timeframeMatch?.[0];

  // Split on arrow if present
  const arrowIndex = trimmed.indexOf('→');
  if (arrowIndex > 0) {
    const title = trimmed.substring(0, arrowIndex).trim();
    const details = trimmed.substring(arrowIndex + 1).trim();
    return { title, timeframe, details };
  }

  // Otherwise, first line or first 60 chars is title
  const lines = trimmed.split('\n');
  if (lines.length > 1) {
    return { title: lines[0], timeframe, details: lines.slice(1).join('\n') };
  }

  if (trimmed.length > 60) {
    return { title: trimmed.substring(0, 60) + '...', timeframe, details: trimmed };
  }

  return { title: trimmed, timeframe };
}
```

**Step 2: Commit**

```bash
git add src/lib/opportunity-coaching.ts
git commit -m "feat: add client-side opportunity coaching heuristics"
```

---

## Task 7: Component - OpportunityCoaching

**Files:**
- Create: `src/components/OpportunityCoaching.tsx`

**Step 1: Create the coaching display component**

```typescript
'use client';

import { CoachingResult } from '@/lib/opportunity-coaching';

interface OpportunityCoachingProps {
  result: CoachingResult;
  onRewriteClick: () => void;
}

export function OpportunityCoaching({ result, onRewriteClick }: OpportunityCoachingProps) {
  const { criteria, overallStrength } = result;

  // Don't show if all criteria pass
  const hasIssues = criteria.some(c => !c.passed);
  if (!hasIssues) return null;

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Coaching
        </span>
        <span className={`text-xs px-2 py-0.5 rounded ${
          overallStrength === 'strong' ? 'bg-green-100 text-green-700' :
          overallStrength === 'okay' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {overallStrength === 'strong' ? 'Strong' :
           overallStrength === 'okay' ? 'Okay' : 'Weak'}
        </span>
      </div>

      <ul className="space-y-1.5">
        {criteria.map((criterion) => (
          <li key={criterion.id} className="flex items-start gap-2 text-sm">
            <span className={criterion.passed ? 'text-green-600' : 'text-amber-500'}>
              {criterion.passed ? '✓' : '⚠'}
            </span>
            <span className={criterion.passed ? 'text-muted-foreground' : 'text-foreground'}>
              {criterion.passed ? criterion.label : criterion.suggestion}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-end">
        <button
          onClick={onRewriteClick}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Rewrite with suggestions ✨
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/OpportunityCoaching.tsx
git commit -m "feat: add OpportunityCoaching component"
```

---

## Task 8: Component - OpportunityEditor

**Files:**
- Create: `src/components/OpportunityEditor.tsx`

**Step 1: Create the editor component**

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { evaluateOpportunity, CoachingResult } from '@/lib/opportunity-coaching';
import { OpportunityCoaching } from './OpportunityCoaching';
import { FakeDoorDialog } from './FakeDoorDialog';

interface OpportunityEditorProps {
  initialContent?: string;
  onSave: (content: string, status: 'draft' | 'complete') => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export function OpportunityEditor({
  initialContent = '',
  onSave,
  onCancel,
  saving = false,
}: OpportunityEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [coaching, setCoaching] = useState<CoachingResult | null>(null);
  const [showCoaching, setShowCoaching] = useState(false);
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Evaluate coaching on pause (2s debounce) or blur
  const evaluateContent = useCallback(() => {
    if (content.trim().length > 0) {
      const result = evaluateOpportunity(content);
      setCoaching(result);
      setShowCoaching(true);
    } else {
      setShowCoaching(false);
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setShowCoaching(false);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for 2s pause
    timeoutRef.current = setTimeout(evaluateContent, 2000);
  };

  const handleBlur = () => {
    // Clear debounce timeout and evaluate immediately
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    evaluateContent();
  };

  const handleSave = async () => {
    if (!content.trim() || saving) return;

    // Determine status based on coaching
    const result = coaching || evaluateOpportunity(content);
    const status = result.overallStrength === 'strong' ? 'complete' : 'draft';

    await onSave(content, status);
  };

  const handleRewriteClick = () => {
    setFakeDoorOpen(true);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Describe your opportunity... (e.g., 'Launch MVP in Q2 → Core features, beta testing, 10 pilot customers')"
        className="w-full min-h-[100px] p-3 border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        disabled={saving}
      />

      {showCoaching && coaching && (
        <OpportunityCoaching
          result={coaching}
          onRewriteClick={handleRewriteClick}
        />
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!content.trim() || saving}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <FakeDoorDialog
        open={fakeDoorOpen}
        onOpenChange={setFakeDoorOpen}
        featureName="AI Rewrite"
        description="Get AI-powered suggestions to improve your opportunity based on the coaching feedback.\n\nThis feature would rewrite your opportunity to include timeframes, specific deliverables, and clearer action items."
        onInterest={() => {
          console.log('[FakeDoor] User interested in: AI Rewrite for Opportunities');
        }}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/OpportunityEditor.tsx
git commit -m "feat: add OpportunityEditor component with coaching integration"
```

---

## Task 9: Component - OpportunityCard

**Files:**
- Create: `src/components/OpportunityCard.tsx`

**Step 1: Create the card component**

```typescript
'use client';

import { parseOpportunityContent } from '@/lib/opportunity-coaching';

interface OpportunityCardProps {
  id: string;
  content: string;
  status: 'draft' | 'complete';
  coachingDismissed?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function OpportunityCard({
  id,
  content,
  status,
  coachingDismissed,
  onEdit,
  onDelete,
}: OpportunityCardProps) {
  const parsed = parseOpportunityContent(content);
  const showWarning = status === 'draft' && !coachingDismissed;

  return (
    <div className={`
      bg-white border rounded-lg p-4 relative group transition-shadow hover:shadow-md
      ${status === 'draft' ? 'border-dashed border-muted-foreground/50' : 'border-[#0A2933]'}
    `}>
      {/* Timeframe badge */}
      {parsed.timeframe && (
        <span className="absolute top-3 left-3 inline-block px-2 py-0.5 text-xs font-medium bg-[#E0FF4F] text-[#0A2933] rounded">
          {parsed.timeframe}
        </span>
      )}

      {/* Status badges */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {status === 'draft' && (
          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
            Draft
          </span>
        )}
        {showWarning && (
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
            ⚠ Could improve
          </span>
        )}

        {/* Edit button */}
        <button
          onClick={() => onEdit(id)}
          className="text-[#0A2933]/50 hover:text-[#0A2933]/80 transition-colors opacity-0 group-hover:opacity-100"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={() => onDelete(id)}
          className="text-[#0A2933]/50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className={parsed.timeframe ? 'mt-6' : ''}>
        <p className="text-sm font-medium text-[#0A2933]">
          {parsed.title}
        </p>
        {parsed.details && (
          <p className="mt-1 text-sm text-muted-foreground">
            → {parsed.details}
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/OpportunityCard.tsx
git commit -m "feat: add OpportunityCard component"
```

---

## Task 10: Component - OpportunitySection

**Files:**
- Create: `src/components/OpportunitySection.tsx`

**Step 1: Create the section orchestrator component**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { OpportunityEditor } from './OpportunityEditor';
import { OpportunityCard } from './OpportunityCard';
import { InfoDialog } from './InfoDialog';

interface Opportunity {
  id: string;
  content: string;
  status: 'draft' | 'complete';
  metadata?: {
    coachingDismissed?: boolean;
  };
}

interface OpportunitySectionProps {
  projectId: string;
}

export function OpportunitySection({ projectId }: OpportunitySectionProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  // Fetch opportunities on mount
  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await fetch(`/api/project/${projectId}/content`);
      if (res.ok) {
        const data = await res.json();
        setOpportunities(
          data.content.filter((c: { type: string }) => c.type === 'opportunity')
        );
      }
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleCreate = async (content: string, status: 'draft' | 'complete') => {
    setSaving(true);
    try {
      const res = await fetch(`/api/project/${projectId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'opportunity',
          content,
          status,
          metadata: { coachingDismissed: status === 'draft' },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunities(prev => [...prev, data.content]);
        // Keep editor open for next one, just clear it
        setIsAdding(true);
      }
    } catch (error) {
      console.error('Failed to create opportunity:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, content: string, status: 'draft' | 'complete') => {
    setSaving(true);
    try {
      const res = await fetch(`/api/project/${projectId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          content,
          status,
          metadata: { coachingDismissed: status === 'draft' },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunities(prev =>
          prev.map(o => o.id === id ? data.content : o)
        );
        setEditingId(null);
      }
    } catch (error) {
      console.error('Failed to update opportunity:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/project/${projectId}/content?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setOpportunities(prev => prev.filter(o => o.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete opportunity:', error);
    }
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setIsAdding(false);
  };

  const handleStartAdding = () => {
    setIsAdding(true);
    setEditingId(null);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDoneAdding = () => {
    setIsAdding(false);
  };

  if (loading) {
    return (
      <div className="bg-white border border-dashed border-[#0A2933] rounded-lg p-12 text-center">
        <p className="text-muted-foreground">Loading opportunities...</p>
      </div>
    );
  }

  const hasOpportunities = opportunities.length > 0;
  const showPlaceholder = !hasOpportunities && !isAdding;
  const editingOpportunity = editingId
    ? opportunities.find(o => o.id === editingId)
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Opportunities
          </h3>
          <button
            onClick={() => setInfoDialogOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Learn about Opportunities"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Placeholder state */}
      {showPlaceholder && (
        <div className="bg-white border border-dashed border-[#0A2933] rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">
            Define opportunities that support your objectives
          </p>
          <button
            onClick={handleStartAdding}
            className="px-6 py-2 bg-[#E0FF4F] text-[#0A2933] font-medium rounded-lg hover:bg-[#E0FF4F]/80 transition-colors"
          >
            Create Opportunities
          </button>
        </div>
      )}

      {/* Cards grid */}
      {hasOpportunities && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {opportunities.map(opp => (
            editingId === opp.id ? (
              <div key={opp.id} className="col-span-full">
                <OpportunityEditor
                  initialContent={opp.content}
                  onSave={(content, status) => handleUpdate(opp.id, content, status)}
                  onCancel={handleCancelEdit}
                  saving={saving}
                />
              </div>
            ) : (
              <OpportunityCard
                key={opp.id}
                id={opp.id}
                content={opp.content}
                status={opp.status as 'draft' | 'complete'}
                coachingDismissed={opp.metadata?.coachingDismissed}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )
          ))}
        </div>
      )}

      {/* Inline editor for adding */}
      {isAdding && !editingId && (
        <div className="mb-4">
          <OpportunityEditor
            onSave={handleCreate}
            onCancel={handleCancelAdd}
            saving={saving}
          />
          {hasOpportunities && (
            <div className="mt-2 text-right">
              <button
                onClick={handleDoneAdding}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Done adding
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add button when has opportunities but not adding */}
      {hasOpportunities && !isAdding && !editingId && (
        <button
          onClick={handleStartAdding}
          className="w-full py-3 border border-dashed border-muted-foreground/50 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
        >
          + Add opportunity
        </button>
      )}

      <InfoDialog
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
        title="Opportunities"
        content="Opportunities are specific actions (3-12 months) that support your objectives. Each should have clear deliverables and timelines.\n\n**Like this...**\nLaunch knowledge graph indexing (Q2) → Index 500M entities, integrate with search results, measure relevance lift\n\n**Not this...**\nImprove product features"
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/OpportunitySection.tsx
git commit -m "feat: add OpportunitySection orchestrator component"
```

---

## Task 11: Integration - Update StrategyDisplay

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`

**Step 1: Import OpportunitySection**

At the top of the file, add:

```typescript
import { OpportunitySection } from './OpportunitySection';
```

**Step 2: Add projectId prop**

Update the interface to include projectId:

```typescript
interface StrategyDisplayProps {
  strategy: StrategyStatements;
  conversationId: string;
  traceId: string;
  projectId: string;  // Add this
}
```

Update the function signature:

```typescript
export default function StrategyDisplay({ strategy, conversationId, traceId, projectId }: StrategyDisplayProps) {
```

**Step 3: Replace the Opportunities placeholder section**

Find the Opportunities section (around line 243-272) that looks like:

```tsx
{/* Opportunities Section - Blank with CTA */}
<div>
  <div className="flex items-center justify-between mb-4">
    ...
  </div>
  <div className="bg-white border border-dashed border-[#0A2933] rounded-lg p-12 text-center">
    ...
  </div>
</div>
```

Replace it with:

```tsx
{/* Opportunities Section */}
<OpportunitySection projectId={projectId} />
```

**Step 4: Find where StrategyDisplay is used and add projectId prop**

Search for usages:
- `src/app/project/[id]/strategy/[traceId]/page.tsx` (or similar)

Add `projectId` prop wherever StrategyDisplay is rendered.

**Step 5: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git commit -m "feat: integrate OpportunitySection into StrategyDisplay"
```

---

## Task 12: Integration - Update Strategy Page

**Files:**
- Identify and modify the page that renders StrategyDisplay

**Step 1: Find the strategy page**

Run: `grep -r "StrategyDisplay" src/app --include="*.tsx" -l`

**Step 2: Update the page to pass projectId**

The page likely already has access to projectId from the route params or from fetching the trace. Pass it to StrategyDisplay:

```tsx
<StrategyDisplay
  strategy={...}
  conversationId={...}
  traceId={...}
  projectId={projectId}  // Add this
/>
```

**Step 3: Commit**

```bash
git add src/app/...  # whatever files were modified
git commit -m "feat: pass projectId to StrategyDisplay for opportunities"
```

---

## Task 13: Type Check and Test

**Step 1: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass

**Step 3: Run verification**

Run: `npm run verify`
Expected: All checks pass

**Step 4: Fix any issues that arise**

If there are type errors or test failures, fix them before proceeding.

**Step 5: Commit any fixes**

```bash
git add .
git commit -m "fix: address type check and test issues"
```

---

## Task 14: Manual Testing

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test with demo user**

1. Hydrate demo fixture: `npx tsx scripts/seed/hydrate.ts --fixture demo-extended --email test@test.com --reset`
2. Login as test@test.com
3. Navigate to strategy page
4. Verify opportunities section shows sample opportunities

**Step 3: Test creating new opportunity**

1. Click "Add opportunity"
2. Type something vague: "Improve product"
3. Wait 2 seconds - coaching should appear showing warnings
4. Add more detail with timeframe: "Launch MVP in Q2 → Core features, beta testing"
5. Coaching should show more checks passing
6. Click Save
7. Card should appear

**Step 4: Test editing**

1. Click edit icon on a card
2. Modify content
3. Save
4. Verify changes persisted

**Step 5: Test deleting**

1. Click delete icon on a card
2. Verify card removed

---

## Task 15: Final Commit and Cleanup

**Step 1: Verify all changes**

Run: `git status`
Run: `git diff --staged` (if anything staged)

**Step 2: Final verification**

Run: `npm run verify`
Expected: All checks pass

**Step 3: Summary commit if needed**

If there were multiple fix commits, consider a squash or summary commit.

---

## Summary of Files Changed

**Schema:**
- `prisma/schema.prisma` - Added UserContent model

**Seed Infrastructure:**
- `scripts/seed/types.ts` - Added FixtureUserContent type
- `scripts/seed/hydrate.ts` - Added UserContent hydration
- `scripts/seed/fixtures/demo-extended.json` - Added sample opportunities

**API:**
- `src/app/api/project/[id]/content/route.ts` - New CRUD endpoint

**Components:**
- `src/lib/opportunity-coaching.ts` - Coaching heuristics
- `src/components/OpportunityCoaching.tsx` - Coaching display
- `src/components/OpportunityEditor.tsx` - Editor with coaching
- `src/components/OpportunityCard.tsx` - Display card
- `src/components/OpportunitySection.tsx` - Section orchestrator
- `src/components/StrategyDisplay.tsx` - Integration

**Pages:**
- Strategy page - Pass projectId propZ
