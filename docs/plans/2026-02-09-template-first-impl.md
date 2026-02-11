# Template-First Entry — Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to complete a Decision Stack template directly, inverting the conversation-first flow. AI extracts knowledge post-hoc from user-entered strategy.

**Architecture:** New entry point on project empty state. Empty Decision Stack template with guidance. Post-hoc extraction creates fragments from user-entered content. A/B testable.

**Tech Stack:** Next.js, React, Tailwind, existing extraction pipeline

**Design doc:** `docs/plans/2026-02-09-decision-stack-editing-design.md`

**Prerequisites:** Phase 1 (editing) and Phase 2 (principles) complete

**Branch:** Continue on `feature/decision-stack-completion`

---

## Task 1: Create Empty Decision Stack Template Page

**Files:**
- Create: `src/app/project/[id]/template/page.tsx`

**Step 1: Create the template page**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PrinciplesSection } from '@/components/PrinciplesSection';
import type { StrategyStatements, Objective, Principle } from '@/lib/types';
import { nanoid } from 'nanoid';

export default function TemplateEntryPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [vision, setVision] = useState('');
  const [strategy, setStrategy] = useState('');
  const [objectives, setObjectives] = useState<Partial<Objective>[]>([
    { id: nanoid(), pithy: '', metric: { summary: '', full: '', category: '' } },
  ]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'vision' | 'strategy' | 'objectives' | 'principles' | 'review'>('vision');

  const handleAddObjective = () => {
    setObjectives([
      ...objectives,
      { id: nanoid(), pithy: '', metric: { summary: '', full: '', category: '' } },
    ]);
  };

  const handleUpdateObjective = (index: number, field: string, value: string) => {
    const updated = [...objectives];
    if (field === 'pithy') {
      updated[index] = { ...updated[index], pithy: value };
    } else if (field.startsWith('metric.')) {
      const metricField = field.split('.')[1];
      updated[index] = {
        ...updated[index],
        metric: { ...updated[index].metric!, [metricField]: value },
      };
    }
    setObjectives(updated);
  };

  const handleRemoveObjective = (index: number) => {
    if (objectives.length > 1) {
      setObjectives(objectives.filter((_, i) => i !== index));
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Build the Decision Stack
      const statements: StrategyStatements = {
        vision,
        strategy,
        objectives: objectives.filter((o) => o.pithy?.trim()).map((o) => ({
          id: o.id!,
          pithy: o.pithy!,
          metric: {
            summary: o.metric?.summary || '',
            full: o.metric?.full || '',
            category: o.metric?.category || 'General',
          },
          explanation: '',
          successCriteria: '',
        })),
        opportunities: [],
        principles,
      };

      // Save to API
      const response = await fetch(`/api/project/${projectId}/template-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const { traceId } = await response.json();
      router.push(`/strategy/${traceId}`);
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'vision':
        return vision.trim().length > 20;
      case 'strategy':
        return strategy.trim().length > 20;
      case 'objectives':
        return objectives.some((o) => o.pithy?.trim());
      case 'principles':
        return true; // Optional
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const steps = ['vision', 'strategy', 'objectives', 'principles', 'review'] as const;
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          {steps.map((s, i) => (
            <span
              key={s}
              className={i <= currentStepIndex ? 'text-[#0A2933] font-medium' : ''}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0A2933] transition-all"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Vision step */}
      {step === 'vision' && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2933]">What's your vision?</h1>
            <p className="text-gray-500 mt-1">
              Your aspirational future state. Where are you heading in 3+ years?
            </p>
          </div>
          <Textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            placeholder="e.g., To be the trusted partner that empowers growth-stage teams to turn ambiguity into action..."
            rows={4}
            className="text-lg"
          />
          <p className="text-xs text-gray-400">
            Tip: Be specific about who you serve and what transformation you enable.
          </p>
        </div>
      )}

      {/* Strategy step */}
      {step === 'strategy' && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2933]">What's your strategy?</h1>
            <p className="text-gray-500 mt-1">
              Your coherent set of choices. How will you achieve the vision in 12-18 months?
            </p>
          </div>
          <Textarea
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            placeholder="e.g., Focus on enterprise customers, build a partner ecosystem, invest in automation..."
            rows={4}
            className="text-lg"
          />
          <p className="text-xs text-gray-400">
            Tip: Great strategy is as much about what you won't do as what you will.
          </p>
        </div>
      )}

      {/* Objectives step */}
      {step === 'objectives' && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2933]">What are your objectives?</h1>
            <p className="text-gray-500 mt-1">
              Measurable outcomes for the next 12-18 months. What does success look like?
            </p>
          </div>
          <div className="space-y-4">
            {objectives.map((obj, index) => (
              <div key={obj.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <Label>Objective {index + 1}</Label>
                  {objectives.length > 1 && (
                    <button
                      onClick={() => handleRemoveObjective(index)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Textarea
                  value={obj.pithy || ''}
                  onChange={(e) => handleUpdateObjective(index, 'pithy', e.target.value)}
                  placeholder="e.g., Achieve product-market fit with 100 paying customers"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={obj.metric?.summary || ''}
                    onChange={(e) => handleUpdateObjective(index, 'metric.summary', e.target.value)}
                    placeholder="Metric (e.g., 100 customers)"
                    className="px-3 py-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    value={obj.metric?.category || ''}
                    onChange={(e) => handleUpdateObjective(index, 'metric.category', e.target.value)}
                    placeholder="Category (e.g., Growth)"
                    className="px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={handleAddObjective} className="w-full">
            + Add another objective
          </Button>
        </div>
      )}

      {/* Principles step */}
      {step === 'principles' && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2933]">What are your principles?</h1>
            <p className="text-gray-500 mt-1">
              Trade-offs that guide decisions. What do you prioritize "even over" alternatives?
            </p>
          </div>
          <PrinciplesSection
            projectId={projectId}
            initialPrinciples={principles}
            onUpdate={setPrinciples}
          />
          <p className="text-xs text-gray-400">
            Tip: Good principles address real tensions. "Quality over speed" only matters if you sometimes sacrifice quality for speed.
          </p>
        </div>
      )}

      {/* Review step */}
      {step === 'review' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2933]">Review your Decision Stack</h1>
            <p className="text-gray-500 mt-1">
              Here's what you've defined. You can always edit these later.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-sm text-gray-500 mb-1">Vision</h3>
              <p>{vision}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-sm text-gray-500 mb-1">Strategy</h3>
              <p>{strategy}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-sm text-gray-500 mb-1">Objectives</h3>
              <ul className="list-disc list-inside space-y-1">
                {objectives.filter((o) => o.pithy?.trim()).map((obj) => (
                  <li key={obj.id}>{obj.pithy}</li>
                ))}
              </ul>
            </div>
            {principles.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-sm text-gray-500 mb-1">Principles</h3>
                <ul className="space-y-1">
                  {principles.map((p) => (
                    <li key={p.id}>
                      <strong>{p.priority}</strong> even over {p.deprioritized}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-4 border-t">
        <Button
          variant="ghost"
          onClick={() => setStep(steps[currentStepIndex - 1])}
          disabled={currentStepIndex === 0}
        >
          Back
        </Button>
        {step === 'review' ? (
          <Button onClick={handleComplete} disabled={saving}>
            {saving ? 'Saving...' : 'Complete & View Strategy'}
          </Button>
        ) : (
          <Button
            onClick={() => setStep(steps[currentStepIndex + 1])}
            disabled={!canProceed()}
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/project/[id]/template/page.tsx
git commit -m "feat(ui): add template-first entry page"
```

---

## Task 2: Create Template Entry API

**Files:**
- Create: `src/app/api/project/[id]/template-entry/route.ts`

**Step 1: Create the API route**

This saves the user-entered Decision Stack and creates initial StrategyVersion records.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import type { StrategyStatements } from '@/lib/types';

interface TemplateEntryBody {
  statements: StrategyStatements;
}

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

  const body: TemplateEntryBody = await request.json();
  const { statements } = body;

  // Create a Trace record (for consistency with generation flow)
  const traceId = nanoid();

  const trace = await prisma.trace.create({
    data: {
      id: traceId,
      conversationId: `template-${traceId}`, // Synthetic conversation ID
      projectId,
      extractedContext: {
        source: 'template_entry',
        themes: [], // No extraction themes for template entry
      },
      output: statements,
      claudeThoughts: 'User entered Decision Stack directly via template.',
    },
  });

  // Create StrategyVersion records
  const { vision, strategy, objectives } = statements;

  await prisma.$transaction([
    // Vision
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'vision',
        content: { text: vision },
        version: 1,
        createdBy: 'user',
        sourceType: 'user_edit',
        sourceId: trace.id,
      },
    }),
    // Strategy
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'strategy',
        content: { text: strategy },
        version: 1,
        createdBy: 'user',
        sourceType: 'user_edit',
        sourceId: trace.id,
      },
    }),
    // Objectives
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
          createdBy: 'user',
          sourceType: 'user_edit',
          sourceId: trace.id,
        },
      })
    ),
  ]);

  // Trigger post-hoc extraction (async, don't wait)
  fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/project/${projectId}/extract-from-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statements, traceId }),
  }).catch((err) => console.error('Post-hoc extraction failed:', err));

  return NextResponse.json({ traceId: trace.id });
}
```

**Step 2: Commit**

```bash
git add src/app/api/project/[id]/template-entry/route.ts
git commit -m "feat(api): add template entry endpoint"
```

---

## Task 3: Create Post-Hoc Extraction API

**Files:**
- Create: `src/app/api/project/[id]/extract-from-template/route.ts`

**Step 1: Create the extraction route**

This extracts fragments from user-entered Decision Stack content.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import type { StrategyStatements } from '@/lib/types';

const anthropic = new Anthropic();

interface ExtractBody {
  statements: StrategyStatements;
  traceId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body: ExtractBody = await request.json();
  const { statements, traceId } = body;

  // Build content for extraction
  const content = `
Vision: ${statements.vision}

Strategy: ${statements.strategy}

Objectives:
${statements.objectives.map((o) => `- ${o.pithy} (${o.metric.summary})`).join('\n')}

Principles:
${statements.principles.map((p) => `- ${p.priority} even over ${p.deprioritized}`).join('\n')}
`;

  // Extract themes using Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Extract strategic themes from this Decision Stack. Return as JSON array with format:
[{
  "theme_name": "Theme title",
  "content": "Key insight or context",
  "dimensions": [{ "name": "dimension_name", "confidence": "HIGH" | "MEDIUM" }]
}]

Valid dimensions: problem_opportunity, customer_segment, value_proposition, competitive_landscape, business_model, team_capability, growth_strategy, constraints, vision_aspiration, success_metrics, risk_awareness

Decision Stack:
${content}`,
      },
    ],
  });

  // Parse themes
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const themes = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

  // Create fragments
  for (const theme of themes) {
    await prisma.fragment.create({
      data: {
        id: nanoid(),
        projectId,
        conversationId: `template-${traceId}`,
        themeName: theme.theme_name,
        content: theme.content,
        dimensions: theme.dimensions || [],
        source: 'template_entry',
      },
    });
  }

  return NextResponse.json({ fragmentsCreated: themes.length });
}
```

**Step 2: Commit**

```bash
git add src/app/api/project/[id]/extract-from-template/route.ts
git commit -m "feat(api): add post-hoc extraction from template entry"
```

---

## Task 4: Add Entry Point to Project Empty State

**Files:**
- Modify: `src/app/project/[id]/page.tsx` (or relevant empty state component)

**Step 1: Add template entry option**

Find the empty state / new project UI and add a second option:

```typescript
// Add alongside existing "Start a conversation" option
<div className="grid md:grid-cols-2 gap-4 mt-6">
  {/* Existing conversation option */}
  <button
    onClick={() => router.push(`/project/${projectId}/chat`)}
    className="p-6 border rounded-xl hover:border-[#0A2933] hover:shadow transition-all text-left"
  >
    <h3 className="font-semibold text-[#0A2933]">Talk with Luna</h3>
    <p className="text-sm text-gray-500 mt-1">
      Have a conversation and let Luna help shape your strategy
    </p>
  </button>

  {/* New template option */}
  <button
    onClick={() => router.push(`/project/${projectId}/template`)}
    className="p-6 border rounded-xl hover:border-[#0A2933] hover:shadow transition-all text-left"
  >
    <h3 className="font-semibold text-[#0A2933]">I have a strategy</h3>
    <p className="text-sm text-gray-500 mt-1">
      Already know your vision? Enter it directly and Luna will learn from it
    </p>
  </button>
</div>
```

**Step 2: Test the flow**

Run: `npm run dev`
Test: Create new project, click "I have a strategy", complete template, verify Decision Stack created.

**Step 3: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(ui): add template entry option to project empty state"
```

---

## Task 5: Add A/B Test Flag (Optional)

**Files:**
- Modify: `src/lib/statsig.ts` (or experiment config)

**Step 1: Add experiment**

```typescript
// Add to experiment definitions
export const TEMPLATE_FIRST_EXPERIMENT = 'template_first_entry';

// Variants
export type TemplateFirstVariant = 'control' | 'template_visible';
```

**Step 2: Gate the template option behind experiment**

```typescript
const showTemplateOption = useExperiment(TEMPLATE_FIRST_EXPERIMENT) === 'template_visible';

{showTemplateOption && (
  <button onClick={() => router.push(`/project/${projectId}/template`)}>
    ...
  </button>
)}
```

**Step 3: Commit**

```bash
git add src/lib/statsig.ts src/app/project/[id]/page.tsx
git commit -m "feat: add A/B test flag for template-first entry"
```

---

## Task 6: Verification

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
git commit -m "chore: phase 3 complete - template-first entry"
```

---

## Summary

**Phase 3 delivers:**
- Template entry page with step-by-step wizard
- Vision, Strategy, Objectives, Principles entry forms
- Template entry API that creates Trace and StrategyVersion records
- Post-hoc extraction to create fragments from user-entered content
- New entry point on project empty state
- Optional A/B test flag

**What this enables:**
- Users who already have a strategy can enter it directly
- Luna learns from user-entered content via fragment extraction
- A/B testable against conversation-first flow
- Faster time-to-value for prepared users
