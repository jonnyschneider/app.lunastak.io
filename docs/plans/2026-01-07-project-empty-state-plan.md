# Project Empty State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a focused "Get Started" empty state when authenticated users land on an empty Project View.

**Architecture:** Add `ProjectEmptyState` component with 2 CTAs (conversation, upload). Render conditionally in Project page when no fragments AND no conversations. Clean up homepage by removing auth-conditional logic (authenticated users never see it).

**Tech Stack:** React, Next.js, Tailwind, Lucide icons

---

### Task 1: Create ProjectEmptyState Component

**Files:**
- Create: `src/components/ProjectEmptyState.tsx`

**Step 1: Create the component**

```tsx
'use client'

import { MessageSquare, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProjectEmptyStateProps {
  projectId: string
  onStartConversation: () => void
  onUploadDocument: () => void
}

export function ProjectEmptyState({
  projectId,
  onStartConversation,
  onUploadDocument,
}: ProjectEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-md text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Let's build your strategy
          </h1>
          <p className="text-muted-foreground">
            Start a conversation with Luna or upload an existing document to begin.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <button
            onClick={onStartConversation}
            className="flex flex-col items-center text-center p-6 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors"
          >
            <MessageSquare className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-medium text-foreground mb-2">
              Start a Conversation
            </h3>
            <p className="text-sm text-muted-foreground">
              Answer a few questions to help Luna understand your business
            </p>
          </button>

          <button
            onClick={onUploadDocument}
            className="flex flex-col items-center text-center p-6 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors"
          >
            <Upload className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-medium text-foreground mb-2">
              Upload a Document
            </h3>
            <p className="text-sm text-muted-foreground">
              Start with an existing strategy doc or business plan
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ProjectEmptyState.tsx
git commit -m "feat: add ProjectEmptyState component"
```

---

### Task 2: Integrate Empty State into Project Page

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Add import at top of file (around line 7)**

Find:
```tsx
import { AppLayout } from '@/components/layout/app-layout'
```

Add after:
```tsx
import { ProjectEmptyState } from '@/components/ProjectEmptyState'
```

**Step 2: Add empty state check after error handling (around line 337)**

Find:
```tsx
  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchProjectData} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const stats = projectData?.stats || {
```

Replace with:
```tsx
  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchProjectData} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Show empty state when project has no content
  const isEmpty =
    (projectData?.stats?.fragmentCount ?? 0) === 0 &&
    (projectData?.conversations?.length ?? 0) === 0

  if (isEmpty && projectData) {
    return (
      <AppLayout>
        <ProjectEmptyState
          projectId={projectId}
          onStartConversation={() => router.push(`/?projectId=${projectId}`)}
          onUploadDocument={() => setUploadDialogOpen(true)}
        />
        <DocumentUploadDialog
          projectId={projectId}
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUploadComplete={() => fetchProjectData()}
        />
      </AppLayout>
    )
  }

  const stats = projectData?.stats || {
```

**Step 3: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat: show empty state when project has no content"
```

---

### Task 3: Clean Up Homepage - Remove Auth Logic from EntryPointSelector

**Files:**
- Modify: `src/components/EntryPointSelector.tsx`

**Step 1: Simplify component - remove auth-conditional logic**

Replace entire file with:
```tsx
'use client';

import {
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { SignInGateDialog } from './SignInGateDialog';
import { useState } from 'react';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface EntryPointOption {
  id: EntryPoint;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gated?: boolean;
}

const options: EntryPointOption[] = [
  {
    id: 'guided',
    icon: ChatBubbleLeftIcon,
    title: 'Guided Conversation',
    description: 'Answer a few questions to help us understand your business',
  },
  {
    id: 'document',
    icon: DocumentTextIcon,
    title: 'Upload Document',
    description: 'Start with an existing strategy doc or business plan',
    gated: true,
  },
  {
    id: 'canvas',
    icon: Squares2X2Icon,
    title: 'Start with Blank Canvas',
    description: 'Build your strategy using a blank Decision Stack template',
    gated: true,
  },
];

interface EntryPointSelectorProps {
  onSelect: (option: EntryPoint) => void;
}

export function EntryPointSelector({ onSelect }: EntryPointSelectorProps) {
  const [gateDialogOpen, setGateDialogOpen] = useState(false);
  const [gatedFeatureName, setGatedFeatureName] = useState('');

  const handleOptionClick = (option: EntryPointOption) => {
    if (option.gated) {
      setGatedFeatureName(option.title);
      setGateDialogOpen(true);
    } else {
      onSelect(option.id);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {options.map((option) => {
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option)}
              className="relative flex flex-col items-center text-center p-6 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors"
            >
              {option.gated && (
                <div className="absolute top-2 right-2">
                  <LockClosedIcon className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-medium text-foreground mb-2">
                {option.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      <SignInGateDialog
        open={gateDialogOpen}
        onOpenChange={setGateDialogOpen}
        featureName={gatedFeatureName}
      />
    </>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/EntryPointSelector.tsx
git commit -m "refactor: simplify EntryPointSelector - homepage is guest-only"
```

---

### Task 4: Clean Up IntroCard - Remove isAuthenticated Prop

**Files:**
- Modify: `src/components/IntroCard.tsx`

**Step 1: Remove isAuthenticated prop**

Replace entire file with:
```tsx
'use client';

import Image from 'next/image';
import { EntryPointSelector } from './EntryPointSelector';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface IntroCardProps {
  onEntryPointSelect: (option: EntryPoint) => void;
  isLoading?: boolean;
}

export function IntroCard({ onEntryPointSelect, isLoading = false }: IntroCardProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto">
        <div className="flex-1 flex items-center justify-center p-6">
          <Image
            src="/animated-logo-glitch.svg"
            alt="Luna"
            width={48}
            height={48}
            className="animate-pulse"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Luna greeting */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Let&apos;s clarify your strategy
            </h1>
            <p className="text-muted-foreground max-w-md">
              &#128075; I'm Luna, the green blob. I don't look very smart, but I ask great questions (and, I'm a really good listener).
            </p>
          </div>
          <Image
            src="/animated-logo-glitch.svg"
            alt="Luna"
            width={56}
            height={56}
          />
        </div>

        {/* Entry point options */}
        <div className="pt-4">
          <EntryPointSelector onSelect={onEntryPointSelect} />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/IntroCard.tsx
git commit -m "refactor: remove isAuthenticated prop from IntroCard"
```

---

### Task 5: Clean Up Homepage - Remove isAuthenticated Prop Usage

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Remove isAuthenticated prop from IntroCard usage**

Find (around line 668-674):
```tsx
          {showIntro && flowStep === 'intro' && (
            <IntroCard
              onEntryPointSelect={handleEntryPointSelect}
              isLoading={isLoading}
              isAuthenticated={!!session}
            />
          )}
```

Replace with:
```tsx
          {showIntro && flowStep === 'intro' && (
            <IntroCard
              onEntryPointSelect={handleEntryPointSelect}
              isLoading={isLoading}
            />
          )}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor: remove isAuthenticated prop from IntroCard usage"
```

---

### Task 6: Run Full Verification

**Step 1: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass

**Step 3: Run smoke tests**

Run: `npm run smoke`
Expected: All smoke tests pass

**Step 4: Final commit if any fixes needed**

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create `ProjectEmptyState` component |
| 2 | Add empty state conditional render to Project page |
| 3 | Simplify `EntryPointSelector` (remove auth logic) |
| 4 | Simplify `IntroCard` (remove isAuthenticated prop) |
| 5 | Update `page.tsx` to not pass isAuthenticated |
| 6 | Run full verification |

## Not Changed

- Sidebar buttons (already correctly wired)
- Homepage redirect logic (already sends auth users to Project)
- Document upload dialog (already works)
- Conversation flow (already works)
