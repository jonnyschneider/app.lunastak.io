# OKR-Style Objectives Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate objectives to OKR model with hypothesis-driven Key Results and full-width expanded editor.

**Architecture:** Update Objective type to support 1-3 Key Results with structured belief/signal/target/timeframe. Build sentence-builder UI that maps to structured data. Migrate existing single-metric objectives to single KR.

**Tech Stack:** React, TypeScript, Tailwind, existing UI components (Input, Textarea, Select, Card)

---

## Task 1: Update Types and Contracts

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/contracts/generation.ts`
- Modify: `src/lib/contracts/strategy-version.ts`
- Test: `src/lib/__tests__/contracts/strategy-version-contracts.test.ts`

**Step 1: Define KeyResult interface in types.ts**

Add after existing Objective interface:

```typescript
export interface KeyResult {
  id: string;
  belief: {
    action: string;   // "improving onboarding"
    outcome: string;  // "increase retention"
  };
  signal: string;     // "7-day active user rate"
  baseline: string;   // "40%"
  target: string;     // "55%"
  timeframe: '3M' | '6M' | '9M' | '12M' | '18M';
}
```

**Step 2: Update Objective interface**

Replace single `metric` with `keyResults` array, keep `metric` as optional for migration:

```typescript
export interface Objective {
  id: string;
  title?: string;
  objective: string;          // renamed from pithy
  explanation: string;
  keyResults: KeyResult[];    // new: 1-3 KRs
  metric?: ObjectiveMetric;   // deprecated, kept for migration
  pithy?: string;             // deprecated alias
  successCriteria?: string;   // kept for AI context
}
```

**Step 3: Update contracts to match**

Update `ObjectiveContract` in generation.ts and `ObjectiveContentContract` in strategy-version.ts.

**Step 4: Update contract tests**

Add tests for new KeyResult structure validation.

**Step 5: Run tests**

Run: `npm run type-check && npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/contracts/*.ts src/lib/__tests__/contracts/*.ts
git commit -m "feat(types): add KeyResult interface and update Objective for OKR model"
```

---

## Task 2: Create Migration Helper

**Files:**
- Create: `src/lib/objective-migration.ts`
- Test: `src/lib/__tests__/objective-migration.test.ts`

**Step 1: Write failing test**

```typescript
import { migrateObjectiveToOKR, isLegacyObjective } from '../objective-migration';

describe('objective-migration', () => {
  it('should detect legacy objective with metric field', () => {
    const legacy = {
      id: '1',
      pithy: 'Grow revenue',
      metric: { summary: '25%', full: 'Increase by 25%', category: 'Revenue', direction: 'increase', timeframe: '6M' },
      explanation: 'Growth matters',
      successCriteria: 'Hit target',
    };
    expect(isLegacyObjective(legacy)).toBe(true);
  });

  it('should migrate legacy objective to OKR format', () => {
    const legacy = {
      id: '1',
      pithy: 'Grow revenue significantly',
      metric: { summary: '25%', full: 'Increase revenue by 25%', category: 'Revenue', direction: 'increase', timeframe: '6M' },
      explanation: 'Growth matters',
      successCriteria: 'Hit target',
    };
    const migrated = migrateObjectiveToOKR(legacy);

    expect(migrated.objective).toBe('Grow revenue significantly');
    expect(migrated.keyResults).toHaveLength(1);
    expect(migrated.keyResults[0].target).toBe('25%');
    expect(migrated.keyResults[0].timeframe).toBe('6M');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=objective-migration`
Expected: FAIL (module not found)

**Step 3: Implement migration helper**

```typescript
// src/lib/objective-migration.ts
import { Objective, KeyResult, ObjectiveMetric } from './types';
import { nanoid } from 'nanoid';

export function isLegacyObjective(obj: unknown): boolean {
  return typeof obj === 'object' && obj !== null &&
    'metric' in obj && !('keyResults' in obj);
}

export function migrateObjectiveToOKR(legacy: {
  id: string;
  pithy?: string;
  objective?: string;
  title?: string;
  metric?: ObjectiveMetric;
  explanation: string;
  successCriteria?: string;
}): Objective {
  const keyResult: KeyResult = {
    id: nanoid(),
    belief: {
      action: extractAction(legacy.metric?.full || ''),
      outcome: extractOutcome(legacy.metric?.full || ''),
    },
    signal: legacy.metric?.category || '',
    baseline: '', // Unknown from legacy format
    target: legacy.metric?.summary || '',
    timeframe: legacy.metric?.timeframe || '6M',
  };

  return {
    id: legacy.id,
    title: legacy.title,
    objective: legacy.objective || legacy.pithy || '',
    explanation: legacy.explanation,
    keyResults: [keyResult],
    successCriteria: legacy.successCriteria,
  };
}

function extractAction(full: string): string {
  // Best effort: take first part before "by" or "to"
  const match = full.match(/^(.+?)\s+(?:by|to)\s+/i);
  return match ? match[1] : full;
}

function extractOutcome(full: string): string {
  // Best effort: take part after "will" or return generic
  const match = full.match(/will\s+(.+)/i);
  return match ? match[1] : 'achieve target';
}
```

**Step 4: Run tests**

Run: `npm test -- --testPathPattern=objective-migration`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/objective-migration.ts src/lib/__tests__/objective-migration.test.ts
git commit -m "feat: add objective migration helper for legacy to OKR format"
```

---

## Task 3: Create KeyResultEditor Component

**Files:**
- Create: `src/components/KeyResultEditor.tsx`

**Step 1: Create sentence-builder component**

```typescript
'use client';

import { KeyResult } from '@/lib/types';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface KeyResultEditorProps {
  keyResult: KeyResult;
  onChange: (updated: KeyResult) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function KeyResultEditor({
  keyResult,
  onChange,
  onRemove,
  canRemove
}: KeyResultEditorProps) {
  const update = (field: string, value: string) => {
    if (field.startsWith('belief.')) {
      const beliefField = field.split('.')[1] as 'action' | 'outcome';
      onChange({
        ...keyResult,
        belief: { ...keyResult.belief, [beliefField]: value },
      });
    } else {
      onChange({ ...keyResult, [field]: value });
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      {/* Belief line */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">We believe</span>
        <Input
          value={keyResult.belief.action}
          onChange={(e) => update('belief.action', e.target.value)}
          placeholder="improving onboarding"
          className="w-48 inline-flex"
        />
        <span className="text-muted-foreground">will</span>
        <Input
          value={keyResult.belief.outcome}
          onChange={(e) => update('belief.outcome', e.target.value)}
          placeholder="increase retention"
          className="w-48 inline-flex"
        />
      </div>

      {/* Signal line */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">and we'll know when</span>
        <Input
          value={keyResult.signal}
          onChange={(e) => update('signal', e.target.value)}
          placeholder="7-day active user rate"
          className="w-48 inline-flex"
        />
      </div>

      {/* Target line */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">moves from</span>
        <Input
          value={keyResult.baseline}
          onChange={(e) => update('baseline', e.target.value)}
          placeholder="40%"
          className="w-20 inline-flex"
        />
        <span className="text-muted-foreground">→</span>
        <Input
          value={keyResult.target}
          onChange={(e) => update('target', e.target.value)}
          placeholder="55%"
          className="w-20 inline-flex"
        />
        <span className="text-muted-foreground">by</span>
        <Select
          value={keyResult.timeframe}
          onValueChange={(v) => update('timeframe', v)}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3M">3 months</SelectItem>
            <SelectItem value="6M">6 months</SelectItem>
            <SelectItem value="9M">9 months</SelectItem>
            <SelectItem value="12M">12 months</SelectItem>
            <SelectItem value="18M">18 months</SelectItem>
          </SelectContent>
        </Select>

        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="ml-auto"
          >
            <TrashIcon className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/KeyResultEditor.tsx
git commit -m "feat(ui): add KeyResultEditor sentence-builder component"
```

---

## Task 4: Update ObjectiveInlineEditor for OKR

**Files:**
- Modify: `src/components/ObjectiveInlineEditor.tsx`

**Step 1: Refactor to use new Objective structure with KeyResults**

- Import KeyResultEditor
- Replace single metric state with keyResults array state
- Add "Add Key Result" button (max 3)
- Handle migration for legacy objectives on load
- Update save handler to emit new structure

**Step 2: Update layout for full-width**

- Add prop for expanded state
- When expanded, render O section at top, KRs below
- Use KeyResultEditor for each KR

**Step 3: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/ObjectiveInlineEditor.tsx
git commit -m "feat(ui): update ObjectiveInlineEditor for OKR with KeyResults"
```

---

## Task 5: Update StrategyDisplay for Full-Width Editing

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`

**Step 1: Add state for expanded objective**

```typescript
const [expandedObjectiveId, setExpandedObjectiveId] = useState<string | null>(null);
```

**Step 2: Update objective grid rendering**

When an objective is expanded:
- Render it full-width (col-span-full)
- Other objectives wrap below
- Pass expanded prop to ObjectiveInlineEditor

**Step 3: Update save handler for new structure**

Handle keyResults array instead of single metric.

**Step 4: Run type-check and manual test**

Run: `npm run type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git commit -m "feat(ui): implement full-width objective editing in StrategyDisplay"
```

---

## Task 6: Update ObjectiveCard for OKR Display

**Files:**
- Modify: `src/components/ObjectiveCard.tsx`

**Step 1: Update front of card**

- Show objective title and first KR target as badge
- Use `objective` field instead of `pithy`

**Step 2: Update back of card**

- Show all KRs as formatted sentences
- Remove old metric display

**Step 3: Handle legacy objectives**

Use migration helper to display consistently.

**Step 4: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ObjectiveCard.tsx
git commit -m "feat(ui): update ObjectiveCard for OKR display with Key Results"
```

---

## Task 7: Update Strategy Version API

**Files:**
- Modify: `src/app/api/project/[id]/strategy-version/route.ts`

**Step 1: Update objective content handling**

Accept and persist keyResults array in objective content.

**Step 2: Update Trace.output sync**

Ensure Trace.output is updated with new objective structure.

**Step 3: Test manually**

Create/edit objective, verify persistence.

**Step 4: Commit**

```bash
git add src/app/api/project/[id]/strategy-version/route.ts
git commit -m "feat(api): update strategy-version API for OKR objectives"
```

---

## Task 8: Update getObjectiveTitle Helper

**Files:**
- Modify: `src/lib/utils.ts`

**Step 1: Update helper to use new field names**

```typescript
export function getObjectiveTitle(objective: Pick<Objective, 'title' | 'objective' | 'pithy'>): string {
  if (objective.title) return objective.title;
  const text = objective.objective || objective.pithy || '';
  const words = text.split(/\s+/);
  if (words.length <= 5) return text;
  return words.slice(0, 5).join(' ') + '...';
}
```

**Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "refactor: update getObjectiveTitle for new Objective structure"
```

---

## Task 9: Integration Test and Cleanup

**Files:**
- All modified files

**Step 1: Run full verification**

Run: `npm run verify`
Expected: All tests pass

**Step 2: Manual testing**

- Create new project, generate strategy
- Edit objective, add KRs
- Verify persistence on refresh
- Test with existing project (migration)

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: cleanup and integration fixes for OKR objectives"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Update types and contracts | types.ts, contracts/*.ts |
| 2 | Create migration helper | objective-migration.ts |
| 3 | Create KeyResultEditor | KeyResultEditor.tsx |
| 4 | Update ObjectiveInlineEditor | ObjectiveInlineEditor.tsx |
| 5 | Update StrategyDisplay | StrategyDisplay.tsx |
| 6 | Update ObjectiveCard | ObjectiveCard.tsx |
| 7 | Update API | strategy-version/route.ts |
| 8 | Update helper | utils.ts |
| 9 | Integration test | All |

**Deferred:**
- Update `/generate` API to output OKR format (separate task)
- AI coaching for KR refinement (Phase 4)
