# Decision Stack Editing — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Vision, Strategy, and Objectives directly editable inline with silent versioning.

**Architecture:** Reuse the OpportunityEditor container pattern. Each component (Vision, Strategy, each Objective) can be edited in place. On save, create a new StrategyVersion record. Display shows latest version. No version history UI yet.

**Tech Stack:** Next.js, Prisma, React, Tailwind, existing StrategyDisplay patterns

**Design doc:** `docs/plans/2026-02-09-decision-stack-editing-design.md`

**Branch:** `feat/decision-stack-completion` (create from `development`)

---

## Task 0: Create Feature Branch

**Step 1: Create and checkout the feature branch**

```bash
git checkout development
git pull origin development
git checkout -b feat/decision-stack-completion
```

**Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `feat/decision-stack-completion`

---

## Task 1: Add StrategyVersion Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the StrategyVersion model**

Add after the `GeneratedOutput` model (around line 406):

```prisma
model StrategyVersion {
  id            String   @id @default(cuid())
  projectId     String
  componentType String   // 'vision' | 'strategy' | 'objective'
  componentId   String?  // For objectives: which objective (null for vision/strategy)
  content       Json     // The actual content
  version       Int      @default(1)
  createdAt     DateTime @default(now())
  createdBy     String   // 'user' | 'ai' | 'system'
  sourceType    String   // 'generation' | 'user_edit' | 'coaching'
  sourceId      String?  // traceId, conversationId if relevant

  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, componentType, componentId])
  @@index([projectId, componentType, version])
}
```

Add to Project model relations (around line 38):

```prisma
  strategyVersions StrategyVersion[]
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully

**Step 3: Create migration**

Run: `npx prisma migrate dev --name add_strategy_version`
Expected: Migration created and applied

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add StrategyVersion model for edit history"
```

---

## Task 2: Add StrategyVersion Types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add TypeScript types**

Add after the `Principle` interface (around line 37):

```typescript
export type StrategyComponentType = 'vision' | 'strategy' | 'objective';
export type StrategyVersionSource = 'generation' | 'user_edit' | 'coaching';
export type StrategyVersionCreator = 'user' | 'ai' | 'system';

export interface StrategyVersion {
  id: string;
  projectId: string;
  componentType: StrategyComponentType;
  componentId: string | null;
  content: VisionContent | StrategyContent | ObjectiveContent;
  version: number;
  createdAt: Date;
  createdBy: StrategyVersionCreator;
  sourceType: StrategyVersionSource;
  sourceId: string | null;
}

// Content types for each component
export interface VisionContent {
  text: string;
}

export interface StrategyContent {
  text: string;
}

export interface ObjectiveContent {
  pithy: string;
  metric: ObjectiveMetric;
  explanation: string;
  successCriteria: string;
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add StrategyVersion types"
```

---

## Task 3: Create Strategy Version Contracts

**Files:**
- Create: `src/lib/contracts/strategy-version.ts`
- Modify: `src/lib/contracts/index.ts`

**Reference:** See `src/lib/contracts/README.md` for contract patterns. Follow existing patterns in `src/lib/contracts/generation.ts`.

**Step 1: Create the contract file**

Create `src/lib/contracts/strategy-version.ts`:

```typescript
// src/lib/contracts/strategy-version.ts
/**
 * Strategy Version Contracts
 *
 * Defines what /api/project/[id]/strategy-version expects and produces.
 */

import { ObjectiveContract } from './generation';

// Component types
export type StrategyComponentType = 'vision' | 'strategy' | 'objective';
export type StrategyVersionSource = 'generation' | 'user_edit' | 'coaching';
export type StrategyVersionCreator = 'user' | 'ai' | 'system';

// Content contracts for each component type
export interface VisionContentContract {
  text: string;
}

export interface StrategyContentContract {
  text: string;
}

export interface ObjectiveContentContract {
  pithy: string;
  metric: ObjectiveContract['metric'];
  explanation: string;
  successCriteria: string;
}

// API Input contract for POST /api/project/[id]/strategy-version
export interface StrategyVersionInputContract {
  componentType: StrategyComponentType;
  componentId?: string; // Required for objectives
  content: VisionContentContract | StrategyContentContract | ObjectiveContentContract;
  sourceType: StrategyVersionSource;
  sourceId?: string;
}

// API Output contract
export interface StrategyVersionOutputContract {
  id: string;
  projectId: string;
  componentType: StrategyComponentType;
  componentId: string | null;
  content: VisionContentContract | StrategyContentContract | ObjectiveContentContract;
  version: number;
  createdAt: string;
  createdBy: StrategyVersionCreator;
  sourceType: StrategyVersionSource;
  sourceId: string | null;
}

// Validation functions
export function validateStrategyVersionInput(data: unknown): data is StrategyVersionInputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Validate componentType
  if (!['vision', 'strategy', 'objective'].includes(obj.componentType as string)) {
    return false;
  }

  // Validate sourceType
  if (!['generation', 'user_edit', 'coaching'].includes(obj.sourceType as string)) {
    return false;
  }

  // Validate content exists
  if (!obj.content || typeof obj.content !== 'object') {
    return false;
  }

  // Validate componentId required for objectives
  if (obj.componentType === 'objective' && !obj.componentId) {
    return false;
  }

  // Validate content shape based on componentType
  const content = obj.content as Record<string, unknown>;
  if (obj.componentType === 'vision' || obj.componentType === 'strategy') {
    if (typeof content.text !== 'string' || !content.text.trim()) {
      return false;
    }
  } else if (obj.componentType === 'objective') {
    if (typeof content.pithy !== 'string' || !content.pithy.trim()) {
      return false;
    }
    if (!content.metric || typeof content.metric !== 'object') {
      return false;
    }
  }

  return true;
}

export function validateStrategyVersionOutput(data: unknown): data is StrategyVersionOutputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  if (!['vision', 'strategy', 'objective'].includes(obj.componentType as string)) return false;
  if (typeof obj.version !== 'number') return false;
  if (!['user', 'ai', 'system'].includes(obj.createdBy as string)) return false;
  if (!['generation', 'user_edit', 'coaching'].includes(obj.sourceType as string)) return false;

  return true;
}
```

**Step 2: Export from contracts index**

Add to `src/lib/contracts/index.ts`:

```typescript
export * from './strategy-version';
```

**Step 3: Verify types compile**

Run: `npm run type-check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/contracts/strategy-version.ts src/lib/contracts/index.ts
git commit -m "feat(contracts): add StrategyVersion contracts"
```

---

## Task 4: Add Strategy Version Contract Tests

**Files:**
- Create: `src/lib/__tests__/contracts/strategy-version-contracts.test.ts`

**Reference:** Follow pattern in `src/lib/__tests__/contracts/generation-contracts.test.ts`

**Step 1: Create the test file**

```typescript
// src/lib/__tests__/contracts/strategy-version-contracts.test.ts
/**
 * Strategy Version Contract Tests
 *
 * Verifies strategy version input/output contracts.
 */

import {
  validateStrategyVersionInput,
  validateStrategyVersionOutput,
  StrategyVersionInputContract,
  StrategyVersionOutputContract,
} from '@/lib/contracts/strategy-version';

describe('Strategy Version Contracts', () => {
  describe('StrategyVersionInputContract', () => {
    const validVisionInput: StrategyVersionInputContract = {
      componentType: 'vision',
      content: { text: 'To be the leading provider of...' },
      sourceType: 'user_edit',
    };

    const validObjectiveInput: StrategyVersionInputContract = {
      componentType: 'objective',
      componentId: 'obj-123',
      content: {
        pithy: 'Achieve product-market fit',
        metric: {
          summary: '100 customers',
          full: 'Acquire 100 paying customers',
          category: 'Growth',
          direction: 'increase',
          timeframe: '12M',
        },
        explanation: 'Critical for sustainability',
        successCriteria: 'Consistent month-over-month growth',
      },
      sourceType: 'user_edit',
    };

    it('should validate correct vision input', () => {
      expect(validateStrategyVersionInput(validVisionInput)).toBe(true);
    });

    it('should validate correct strategy input', () => {
      const strategyInput = { ...validVisionInput, componentType: 'strategy' };
      expect(validateStrategyVersionInput(strategyInput)).toBe(true);
    });

    it('should validate correct objective input', () => {
      expect(validateStrategyVersionInput(validObjectiveInput)).toBe(true);
    });

    it('should reject objective without componentId', () => {
      const invalid = { ...validObjectiveInput, componentId: undefined };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should reject invalid componentType', () => {
      const invalid = { ...validVisionInput, componentType: 'invalid' };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should reject invalid sourceType', () => {
      const invalid = { ...validVisionInput, sourceType: 'invalid' };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should reject vision with empty text', () => {
      const invalid = {
        ...validVisionInput,
        content: { text: '  ' },
      };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should reject objective with empty pithy', () => {
      const invalid = {
        ...validObjectiveInput,
        content: { ...validObjectiveInput.content, pithy: '' },
      };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should accept input with optional sourceId', () => {
      const withSourceId = { ...validVisionInput, sourceId: 'trace-123' };
      expect(validateStrategyVersionInput(withSourceId)).toBe(true);
    });
  });

  describe('StrategyVersionOutputContract', () => {
    const validOutput: StrategyVersionOutputContract = {
      id: 'sv-123',
      projectId: 'proj-456',
      componentType: 'vision',
      componentId: null,
      content: { text: 'To be the leading provider of...' },
      version: 1,
      createdAt: '2026-02-09T10:00:00Z',
      createdBy: 'user',
      sourceType: 'user_edit',
      sourceId: null,
    };

    it('should validate correct output', () => {
      expect(validateStrategyVersionOutput(validOutput)).toBe(true);
    });

    it('should reject output with missing id', () => {
      const invalid = { ...validOutput, id: '' };
      expect(validateStrategyVersionOutput(invalid)).toBe(false);
    });

    it('should reject output with invalid createdBy', () => {
      const invalid = { ...validOutput, createdBy: 'robot' };
      expect(validateStrategyVersionOutput(invalid)).toBe(false);
    });

    it('should validate output with componentId for objectives', () => {
      const objectiveOutput = {
        ...validOutput,
        componentType: 'objective' as const,
        componentId: 'obj-123',
      };
      expect(validateStrategyVersionOutput(objectiveOutput)).toBe(true);
    });
  });
});
```

**Step 2: Run the tests**

Run: `npm test -- --testPathPattern=strategy-version-contracts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/__tests__/contracts/strategy-version-contracts.test.ts
git commit -m "test(contracts): add StrategyVersion contract tests"
```

---

## Task 5: Create Strategy Version API

**Files:**
- Create: `src/app/api/project/[id]/strategy-version/route.ts`

**Step 1: Create the API route**

Uses contract validation from Task 3.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import {
  validateStrategyVersionInput,
  StrategyVersionInputContract,
} from '@/lib/contracts/strategy-version';

// GET: Fetch latest versions for all components
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const guestId = cookieStore.get('guest_id')?.value;

  if (!session?.user?.id && !guestId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify project access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId: session?.user?.id },
        { guestId: guestId }
      ]
    }
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get latest version for each component
  const versions = await prisma.strategyVersion.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    distinct: ['componentType', 'componentId'],
  });

  return NextResponse.json({ versions });
}

// POST: Create a new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const guestId = cookieStore.get('guest_id')?.value;

  if (!session?.user?.id && !guestId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify project access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId: session?.user?.id },
        { guestId: guestId }
      ]
    }
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();

  // Validate using contract
  if (!validateStrategyVersionInput(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { componentType, componentId, content, sourceType, sourceId } = body as StrategyVersionInputContract;

  // Get current max version for this component
  const latestVersion = await prisma.strategyVersion.findFirst({
    where: {
      projectId,
      componentType,
      componentId: componentId ?? null,
    },
    orderBy: { version: 'desc' },
  });

  const newVersion = (latestVersion?.version ?? 0) + 1;

  // Create the new version
  const version = await prisma.strategyVersion.create({
    data: {
      projectId,
      componentType,
      componentId: componentId ?? null,
      content: content as object,
      version: newVersion,
      createdBy: 'user',
      sourceType,
      sourceId: sourceId ?? null,
    },
  });

  return NextResponse.json({ version });
}
```

**Step 2: Verify types compile**

Run: `npm run type-check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/project/[id]/strategy-version/route.ts
git commit -m "feat(api): add strategy-version endpoint for edit history"
```

---

## Task 6: Create InlineTextEditor Component

**Files:**
- Create: `src/components/InlineTextEditor.tsx`

**Step 1: Create the reusable inline editor**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface InlineTextEditorProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  minRows?: number;
}

export function InlineTextEditor({
  value,
  onSave,
  onCancel,
  placeholder = 'Enter text...',
  minRows = 3,
}: InlineTextEditorProps) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    // Move cursor to end
    textareaRef.current?.setSelectionRange(text.length, text.length);
  }, []);

  const handleSave = async () => {
    if (text.trim() === value.trim()) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(text.trim());
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
    // Cmd/Ctrl + Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={minRows}
        className="w-full resize-none text-base leading-relaxed"
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !text.trim()}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Press Esc to cancel, ⌘+Enter to save
      </p>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run type-check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/InlineTextEditor.tsx
git commit -m "feat(ui): add InlineTextEditor component"
```

---

## Task 7: Make Vision Editable

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`

**Step 1: Add state and handlers for Vision editing**

At the top of the component, add imports and state:

```typescript
// Add to imports
import { InlineTextEditor } from './InlineTextEditor';

// Add state inside component (after existing state)
const [editingVision, setEditingVision] = useState(false);
```

**Step 2: Add save handler**

Add this function inside the component:

```typescript
const handleSaveVision = async (newText: string) => {
  try {
    const response = await fetch(`/api/project/${projectId}/strategy-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        componentType: 'vision',
        content: { text: newText },
        sourceType: 'user_edit',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save');
    }

    // Update local state
    if (onUpdate) {
      onUpdate({
        ...statements,
        vision: newText,
      });
    }
    setEditingVision(false);
  } catch (error) {
    console.error('Failed to save vision:', error);
    // Could add toast notification here
  }
};
```

Note: We need to add `projectId` and `onUpdate` as props. Update the component props:

```typescript
interface StrategyDisplayProps {
  statements: StrategyStatements;
  traceId: string;
  projectId: string;
  onUpdate?: (statements: StrategyStatements) => void;
}
```

**Step 3: Update Vision rendering**

Find the Vision card section (around line 115-140) and replace the content paragraph with conditional rendering:

```typescript
{/* Vision content - editable */}
{editingVision ? (
  <InlineTextEditor
    value={statements.vision}
    onSave={handleSaveVision}
    onCancel={() => setEditingVision(false)}
    placeholder="What is your aspirational future state?"
    minRows={4}
  />
) : (
  <p className="text-base leading-relaxed whitespace-pre-wrap">
    {statements.vision}
  </p>
)}
```

**Step 4: Update edit button to trigger editing**

Replace the FakeDoorDialog for Vision edit button with:

```typescript
<button
  onClick={() => setEditingVision(true)}
  className="p-1 rounded hover:bg-white/50 transition-colors opacity-0 group-hover:opacity-100"
  title="Edit vision"
>
  <svg className="w-4 h-4 text-[#0A2933]" /* ... existing pencil icon ... */ />
</button>
```

**Step 5: Update parent page to pass projectId and onUpdate**

File: `src/app/strategy/[traceId]/page.tsx`

The page needs to pass `projectId` and handle `onUpdate`. Check the current implementation and add:

```typescript
// In the page component
const [statements, setStatements] = useState<StrategyStatements | null>(null);

// ... fetch logic populates statements ...

<StrategyDisplay
  statements={statements}
  traceId={traceId}
  projectId={trace.projectId}
  onUpdate={setStatements}
/>
```

**Step 6: Verify it works**

Run: `npm run dev`
Test: Navigate to a strategy page, hover over Vision, click edit, modify text, save.
Expected: Text updates and persists (check database for StrategyVersion record)

**Step 7: Commit**

```bash
git add src/components/StrategyDisplay.tsx src/components/InlineTextEditor.tsx src/app/strategy/[traceId]/page.tsx
git commit -m "feat(ui): make Vision editable with inline editor"
```

---

## Task 8: Make Strategy Editable

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`

**Step 1: Add state for Strategy editing**

```typescript
const [editingStrategy, setEditingStrategy] = useState(false);
```

**Step 2: Add save handler**

```typescript
const handleSaveStrategy = async (newText: string) => {
  try {
    const response = await fetch(`/api/project/${projectId}/strategy-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        componentType: 'strategy',
        content: { text: newText },
        sourceType: 'user_edit',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save');
    }

    if (onUpdate) {
      onUpdate({
        ...statements,
        strategy: newText,
      });
    }
    setEditingStrategy(false);
  } catch (error) {
    console.error('Failed to save strategy:', error);
  }
};
```

**Step 3: Update Strategy rendering**

Find the Strategy card section (around line 145-175) and apply the same pattern:

```typescript
{editingStrategy ? (
  <InlineTextEditor
    value={statements.strategy}
    onSave={handleSaveStrategy}
    onCancel={() => setEditingStrategy(false)}
    placeholder="What are your coherent choices to achieve the vision?"
    minRows={4}
  />
) : (
  <p className="text-base leading-relaxed whitespace-pre-wrap">
    {statements.strategy}
  </p>
)}
```

**Step 4: Update edit button**

Replace the FakeDoorDialog for Strategy edit with:

```typescript
<button
  onClick={() => setEditingStrategy(true)}
  className="p-1 rounded hover:bg-white/50 transition-colors opacity-0 group-hover:opacity-100"
  title="Edit strategy"
>
  <svg className="w-4 h-4 text-[#0A2933]" /* ... pencil icon ... */ />
</button>
```

**Step 5: Test**

Run: `npm run dev`
Test: Edit Strategy, save, verify persistence.

**Step 6: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git commit -m "feat(ui): make Strategy editable with inline editor"
```

---

## Task 9: Make Objectives Editable

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`
- Modify: `src/components/ObjectiveCard.tsx`
- Create: `src/components/ObjectiveEditor.tsx`

This is more complex because Objectives have structured data (pithy, metric, explanation, successCriteria).

**Step 1: Create ObjectiveEditor component**

Create `src/components/ObjectiveEditor.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Objective, ObjectiveMetric } from '@/lib/types';

interface ObjectiveEditorProps {
  objective: Objective;
  onSave: (objective: Objective) => Promise<void>;
  onCancel: () => void;
}

export function ObjectiveEditor({ objective, onSave, onCancel }: ObjectiveEditorProps) {
  const [pithy, setPithy] = useState(objective.pithy);
  const [metricSummary, setMetricSummary] = useState(objective.metric.summary);
  const [metricFull, setMetricFull] = useState(objective.metric.full);
  const [metricCategory, setMetricCategory] = useState(objective.metric.category);
  const [direction, setDirection] = useState<'increase' | 'decrease' | undefined>(objective.metric.direction);
  const [timeframe, setTimeframe] = useState<'3M' | '6M' | '9M' | '12M' | '18M' | undefined>(objective.metric.timeframe);
  const [explanation, setExplanation] = useState(objective.explanation);
  const [successCriteria, setSuccessCriteria] = useState(objective.successCriteria);
  const [saving, setSaving] = useState(false);

  const pithyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    pithyRef.current?.focus();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedObjective: Objective = {
        ...objective,
        pithy: pithy.trim(),
        metric: {
          summary: metricSummary.trim(),
          full: metricFull.trim(),
          category: metricCategory.trim(),
          direction,
          metricName: objective.metric.metricName,
          metricValue: objective.metric.metricValue,
          timeframe,
        },
        explanation: explanation.trim(),
        successCriteria: successCriteria.trim(),
      };
      await onSave(updatedObjective);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border" onKeyDown={handleKeyDown}>
      <div>
        <Label htmlFor="pithy">Objective</Label>
        <Textarea
          ref={pithyRef}
          id="pithy"
          value={pithy}
          onChange={(e) => setPithy(e.target.value)}
          placeholder="Short 1-2 sentence objective"
          rows={2}
          className="mt-1"
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="metricSummary">Metric (short)</Label>
          <Input
            id="metricSummary"
            value={metricSummary}
            onChange={(e) => setMetricSummary(e.target.value)}
            placeholder="e.g., 25%"
            className="mt-1"
            disabled={saving}
          />
        </div>
        <div>
          <Label htmlFor="timeframe">Timeframe</Label>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3M">3 months</SelectItem>
              <SelectItem value="6M">6 months</SelectItem>
              <SelectItem value="9M">9 months</SelectItem>
              <SelectItem value="12M">12 months</SelectItem>
              <SelectItem value="18M">18 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={metricCategory}
            onChange={(e) => setMetricCategory(e.target.value)}
            placeholder="e.g., Revenue, Customer"
            className="mt-1"
            disabled={saving}
          />
        </div>
        <div>
          <Label htmlFor="direction">Direction</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="increase">↑ Increase</SelectItem>
              <SelectItem value="decrease">↓ Decrease</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="metricFull">Full metric description</Label>
        <Input
          id="metricFull"
          value={metricFull}
          onChange={(e) => setMetricFull(e.target.value)}
          placeholder="e.g., Increase revenue by 25% in Q1 2025"
          className="mt-1"
          disabled={saving}
        />
      </div>

      <div>
        <Label htmlFor="explanation">Why it matters</Label>
        <Textarea
          id="explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Explain why this objective is important"
          rows={2}
          className="mt-1"
          disabled={saving}
        />
      </div>

      <div>
        <Label htmlFor="successCriteria">Success criteria</Label>
        <Textarea
          id="successCriteria"
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
          placeholder="What does success look like?"
          rows={2}
          className="mt-1"
          disabled={saving}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !pithy.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Add Objective editing state to StrategyDisplay**

```typescript
const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
```

**Step 3: Add save handler for Objectives**

```typescript
const handleSaveObjective = async (updatedObjective: Objective) => {
  try {
    const response = await fetch(`/api/project/${projectId}/strategy-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        componentType: 'objective',
        componentId: updatedObjective.id,
        content: {
          pithy: updatedObjective.pithy,
          metric: updatedObjective.metric,
          explanation: updatedObjective.explanation,
          successCriteria: updatedObjective.successCriteria,
        },
        sourceType: 'user_edit',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save');
    }

    if (onUpdate) {
      onUpdate({
        ...statements,
        objectives: statements.objectives.map((obj) =>
          obj.id === updatedObjective.id ? updatedObjective : obj
        ),
      });
    }
    setEditingObjectiveId(null);
  } catch (error) {
    console.error('Failed to save objective:', error);
  }
};
```

**Step 4: Update Objectives grid rendering**

In the objectives section, wrap each ObjectiveCard with conditional rendering:

```typescript
{statements.objectives.map((objective) => (
  <div key={objective.id}>
    {editingObjectiveId === objective.id ? (
      <ObjectiveEditor
        objective={objective}
        onSave={handleSaveObjective}
        onCancel={() => setEditingObjectiveId(null)}
      />
    ) : (
      <ObjectiveCard
        objective={objective}
        onEdit={() => setEditingObjectiveId(objective.id)}
      />
    )}
  </div>
))}
```

**Step 5: Update ObjectiveCard to accept onEdit prop**

Modify `src/components/ObjectiveCard.tsx` to accept and use `onEdit`:

```typescript
interface ObjectiveCardProps {
  objective: Objective;
  onEdit?: () => void;
}

// In the component, replace the FakeDoorDialog edit button with:
{onEdit && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onEdit();
    }}
    className="absolute top-2 right-2 p-1 rounded hover:bg-white/50 transition-colors opacity-0 group-hover:opacity-100"
    title="Edit objective"
  >
    <svg className="w-4 h-4 text-[#0A2933]" /* pencil icon */ />
  </button>
)}
```

**Step 6: Test**

Run: `npm run dev`
Test: Click edit on an Objective, modify fields, save.
Expected: Objective updates and StrategyVersion record created.

**Step 7: Commit**

```bash
git add src/components/ObjectiveEditor.tsx src/components/ObjectiveCard.tsx src/components/StrategyDisplay.tsx
git commit -m "feat(ui): make Objectives editable with structured editor"
```

---

## Task 10: Seed Initial Versions from Generation

**Files:**
- Modify: `src/app/api/generate/route.ts`

When a new Decision Stack is generated, we should create initial StrategyVersion records so version history starts from generation.

**Step 1: Add version seeding after successful generation**

In the generate route, after saving the Trace and GeneratedOutput, add:

```typescript
// Seed initial StrategyVersion records
const { vision, strategy, objectives } = statements;

await prisma.$transaction([
  // Vision version
  prisma.strategyVersion.create({
    data: {
      projectId,
      componentType: 'vision',
      content: { text: vision },
      version: 1,
      createdBy: 'ai',
      sourceType: 'generation',
      sourceId: trace.id,
    },
  }),
  // Strategy version
  prisma.strategyVersion.create({
    data: {
      projectId,
      componentType: 'strategy',
      content: { text: strategy },
      version: 1,
      createdBy: 'ai',
      sourceType: 'generation',
      sourceId: trace.id,
    },
  }),
  // Objective versions
  ...objectives.map((obj) =>
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'objective',
        componentId: obj.id,
        content: {
          pithy: obj.pithy,
          metric: obj.metric,
          explanation: obj.explanation,
          successCriteria: obj.successCriteria,
        },
        version: 1,
        createdBy: 'ai',
        sourceType: 'generation',
        sourceId: trace.id,
      },
    })
  ),
]);
```

**Step 2: Test**

Generate a new Decision Stack and verify StrategyVersion records are created.

**Step 3: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat(api): seed StrategyVersion records on generation"
```

---

## Task 11: Add Type Checking and Verification

**Files:**
- Run verification suite

**Step 1: Run type check**

Run: `npm run type-check`
Expected: No type errors

**Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass

**Step 3: Run full verify**

Run: `npm run verify`
Expected: All checks pass

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: phase 1 complete - inline editing with silent versioning"
```

---

## Summary

**Phase 1 delivers:**
- StrategyVersion schema for edit history
- Inline editing for Vision (text)
- Inline editing for Strategy (text)
- Structured editing for Objectives (pithy, metric, explanation, successCriteria)
- Silent version capture on every edit
- Version seeding from generation

**Not included (deferred to later phases):**
- AI polish button
- Version history UI
- Principles editing
- Coaching conversations
