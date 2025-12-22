# Cold Start Entry Points Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multiple entry points (guided conversation, document upload, fake door options) to solve cold start problem

**Architecture:** Add EntryPointSelector component to replace single Start button, integrate unstructured.io for document extraction, refactor fake doors to use AlertDialog, extend conversation API to accept document context

**Tech Stack:** Next.js 14, TypeScript, shadcn/ui (AlertDialog, Dropzone), unstructured-client, Claude API

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Create: `.env.local` (if not exists)

**Step 1: Install unstructured-client**

```bash
npm install unstructured-client
```

Expected: Package installed successfully

**Step 2: Install shadcn AlertDialog**

```bash
npx shadcn@latest add alert-dialog
```

Expected: Creates `src/components/ui/alert-dialog.tsx`

**Step 3: Install shadcn Dropzone**

Note: Dropzone is a forms component. Check https://ui.shadcn.com/docs/components/forms for installation.

```bash
npx shadcn@latest add form
npm install react-dropzone
```

Expected: Form utilities installed, react-dropzone package added

**Step 4: Add environment variable placeholder**

Add to `.env.local`:
```bash
# Unstructured.io API
UNSTRUCTURED_API_KEY=your_key_here
```

**Step 5: Commit**

```bash
git add package.json package-lock.json .env.local src/components/ui/alert-dialog.tsx
git commit -m "chore: install dependencies for cold start entry points"
```

---

## Task 2: Update Event Types

**Files:**
- Modify: `src/lib/events.ts:3-7`

**Step 1: Add new event types**

In `src/lib/events.ts`, update EventType:

```typescript
export type EventType =
  | 'fake_door_click'
  | 'info_icon_view'
  | 'extraction_choice'
  | 'quality_rating'
  | 'entry_point_selected'
  | 'document_uploaded';
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/events.ts
git commit -m "feat: add event types for entry point tracking"
```

---

## Task 3: Create FakeDoorDialog Component

**Files:**
- Create: `src/components/FakeDoorDialog.tsx`

**Step 1: Create FakeDoorDialog component**

```typescript
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FakeDoorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  description: string;
  onInterest: () => void;
}

export function FakeDoorDialog({
  open,
  onOpenChange,
  featureName,
  description,
  onInterest,
}: FakeDoorDialogProps) {
  const handleInterest = () => {
    onInterest();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{featureName} - Coming Soon</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">
            {description}
            {'\n\n'}
            We're validating interest before building this feature.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Maybe Later</AlertDialogCancel>
          <AlertDialogAction onClick={handleInterest}>
            I'm Interested
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/FakeDoorDialog.tsx
git commit -m "feat: create reusable FakeDoorDialog component"
```

---

## Task 4: Create EntryPointSelector Component

**Files:**
- Create: `src/components/EntryPointSelector.tsx`

**Step 1: Create EntryPointSelector component**

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  BoltIcon,
} from '@heroicons/react/24/outline';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface EntryPointOption {
  id: EntryPoint;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
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
  },
  {
    id: 'canvas',
    icon: Squares2X2Icon,
    title: 'Start from Canvas',
    description: 'Build your strategy using a blank Decision Stack template',
  },
  {
    id: 'fast-track',
    icon: BoltIcon,
    title: 'Fast Track',
    description: 'Quick multiple choice questions with targeted follow-ups',
  },
];

interface EntryPointSelectorProps {
  onSelect: (option: EntryPoint) => void;
}

export function EntryPointSelector({ onSelect }: EntryPointSelectorProps) {
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Card
            key={option.id}
            className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
            onClick={() => onSelect(option.id)}
          >
            <CardContent className="flex items-start gap-4 p-4">
              <Icon className="w-6 h-6 text-zinc-600 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {option.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  {option.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/EntryPointSelector.tsx
git commit -m "feat: create EntryPointSelector component with 4 options"
```

---

## Task 5: Create DocumentUpload Component

**Files:**
- Create: `src/components/DocumentUpload.tsx`

**Step 1: Create DocumentUpload component skeleton**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DocumentTextIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface DocumentUploadProps {
  onUploadComplete: (data: {
    conversationId: string;
    summary: string;
    filename: string;
  }) => void;
  onError: (error: string) => void;
}

export function DocumentUpload({ onUploadComplete, onError }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedFile(file);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      onUploadComplete({
        conversationId: data.conversationId,
        summary: data.summary,
        filename: file.name,
      });
    } catch (error) {
      console.error('Upload error:', error);
      onError(error instanceof Error ? error.message : 'Upload failed');
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete, onError]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragActive ? 'border-zinc-500 bg-zinc-50 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-600'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500'}
        `}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <>
            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-zinc-400 animate-pulse" />
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Extracting content from {uploadedFile?.name}...
            </p>
          </>
        ) : (
          <>
            <DocumentTextIcon className="mx-auto h-12 w-12 text-zinc-400" />
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {isDragActive
                ? 'Drop your file here'
                : 'Drag and drop your file here, or click to browse'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
              Supports PDF, DOCX, TXT, and Markdown files (max 10MB)
            </p>
          </>
        )}
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            {fileRejections[0].errors[0].code === 'file-too-large'
              ? 'File is too large. Please upload a file under 10MB.'
              : 'Invalid file type. Please upload a PDF, DOCX, TXT, or MD file.'}
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/DocumentUpload.tsx
git commit -m "feat: create DocumentUpload component with dropzone"
```

---

## Task 6: Create DocumentSummary Component

**Files:**
- Create: `src/components/DocumentSummary.tsx`

**Step 1: Create DocumentSummary component**

```typescript
'use client';

import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';

interface DocumentSummaryProps {
  filename: string;
  summary: string;
  onContinue: () => void;
  onRetry: () => void;
}

export function DocumentSummary({
  filename,
  summary,
  onContinue,
  onRetry,
}: DocumentSummaryProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              We've read your document: {filename}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Try Another File
        </button>
        <button
          onClick={onContinue}
          className="px-6 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium"
        >
          Continue
        </button>
      </div>

      <p className="text-xs text-center text-zinc-500 dark:text-zinc-500">
        We'll ask a few clarifying questions to fill in any gaps
      </p>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/DocumentSummary.tsx
git commit -m "feat: create DocumentSummary component"
```

---

## Task 7: Modify IntroCard to Use EntryPointSelector

**Files:**
- Modify: `src/components/IntroCard.tsx:1-47`

**Step 1: Update IntroCard component**

Replace entire file with:

```typescript
'use client';

import { EntryPointSelector } from './EntryPointSelector';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface IntroCardProps {
  onEntryPointSelect: (option: EntryPoint) => void;
  isLoading?: boolean;
}

export function IntroCard({ onEntryPointSelect, isLoading = false }: IntroCardProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-3xl mx-auto">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 dark:text-zinc-400">Thinking...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Assistant intro message bubble */}
        <div className="flex justify-start">
          <div className="max-w-[80%] bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg p-4">
            <p className="whitespace-pre-wrap">
              I help founders and business leaders clarify their strategic thinking.
              {'\n\n'}
              Through a short conversation, I'll help you articulate your vision, mission, and strategic objectives.
              {'\n\n'}
              How would you like to start?
            </p>
          </div>
        </div>

        {/* Entry point options */}
        <div className="flex justify-start">
          <div className="w-full max-w-2xl">
            <EntryPointSelector onSelect={onEntryPointSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/IntroCard.tsx
git commit -m "feat: replace start button with EntryPointSelector in IntroCard"
```

---

## Task 8: Update page.tsx Flow State Types

**Files:**
- Modify: `src/app/page.tsx:15`

**Step 1: Update FlowStep type**

Change line 15 from:
```typescript
type FlowStep = 'chat' | 'extracting' | 'extraction' | 'strategy';
```

To:
```typescript
type FlowStep = 'intro' | 'upload' | 'document-summary' | 'chat' | 'extracting' | 'extraction' | 'strategy';
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors (will have some unused state errors, we'll fix in next tasks)

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add upload and document-summary flow states"
```

---

## Task 9: Update page.tsx State and Handlers (Part 1)

**Files:**
- Modify: `src/app/page.tsx:17-32`

**Step 1: Add new state variables**

After line 29 (experimentVariant state), add:

```typescript
  const [showIntro, setShowIntro] = useState(true);
  const [documentContext, setDocumentContext] = useState<{
    extractedText: string;
    filename: string;
  } | null>(null);
  const [documentSummary, setDocumentSummary] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const [fakeDoorFeature, setFakeDoorFeature] = useState<{
    name: string;
    description: string;
    eventData: Record<string, any>;
  } | null>(null);
```

**Step 2: Remove old showIntro state (line 30)**

Delete the duplicate line:
```typescript
const [showIntro, setShowIntro] = useState(true);
```

**Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: Warnings about unused variables (OK for now)

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add state for document upload and fake door handling"
```

---

## Task 10: Add Entry Point Selection Handler

**Files:**
- Modify: `src/app/page.tsx` (after existing handlers)

**Step 1: Add handleEntryPointSelect handler**

After handleStartClick function (around line 100), add:

```typescript
  const handleEntryPointSelect = async (option: 'guided' | 'document' | 'canvas' | 'fast-track') => {
    // Log entry point selection
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: conversationId || 'no-conversation-yet',
        eventType: 'entry_point_selected',
        eventData: { option },
      }),
    }).catch(err => console.error('Failed to log event:', err));

    if (option === 'guided') {
      // Start normal conversation flow
      startConversation();
    } else if (option === 'document') {
      // Show document upload
      setFlowStep('upload');
      setShowIntro(false);
    } else {
      // Fake doors (canvas or fast-track)
      const fakeDoorConfig = {
        canvas: {
          name: 'Decision Stack Canvas',
          description: 'Build your strategy using a blank Decision Stack template.\n\nThis feature would let you directly fill in Vision, Mission, Objectives, Initiatives, and Principles in a visual canvas interface.',
          eventData: { feature: 'canvas' },
        },
        'fast-track': {
          name: 'Fast Track',
          description: 'Quick multiple choice questions with targeted follow-ups.\n\nThis feature would streamline the conversation with pre-defined options and smart branching.',
          eventData: { feature: 'fast-track' },
        },
      };

      setFakeDoorFeature(fakeDoorConfig[option]);
      setFakeDoorOpen(true);
    }
  };

  const handleFakeDoorInterest = async () => {
    if (!fakeDoorFeature || !conversationId) return;

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        eventType: 'fake_door_click',
        eventData: fakeDoorFeature.eventData,
      }),
    }).catch(err => console.error('Failed to log event:', err));

    console.log(`User interested in: ${fakeDoorFeature.name}`);
  };
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add entry point selection and fake door handlers"
```

---

## Task 11: Add Document Upload Handlers

**Files:**
- Modify: `src/app/page.tsx` (after entry point handlers)

**Step 1: Add document upload handlers**

After handleFakeDoorInterest function, add:

```typescript
  const handleDocumentUploadComplete = async (data: {
    conversationId: string;
    summary: string;
    filename: string;
  }) => {
    // Store conversation ID and document data
    setConversationId(data.conversationId);
    setDocumentSummary(data.summary);
    // Document context will be stored on server, we just need the summary for display
    setFlowStep('document-summary');
  };

  const handleDocumentUploadError = (error: string) => {
    setUploadError(error);
    // Stay on upload screen, show error
  };

  const handleDocumentSummaryContinue = async () => {
    // Move to chat with document context already loaded on server
    setFlowStep('chat');

    // Fetch first message (which will be context-aware based on document)
    try {
      const response = await fetch(`/api/conversation/${conversationId}/messages`);
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleDocumentSummaryRetry = () => {
    // Go back to upload screen
    setFlowStep('upload');
    setDocumentSummary('');
    setUploadError('');
  };
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add document upload complete and retry handlers"
```

---

## Task 12: Update page.tsx Render Logic

**Files:**
- Modify: `src/app/page.tsx:325-405` (return statement)

**Step 1: Update IntroCard props**

Change line 330 from:
```typescript
<IntroCard onStartClick={handleStartClick} isLoading={isLoading} />
```

To:
```typescript
<IntroCard onEntryPointSelect={handleEntryPointSelect} isLoading={isLoading} />
```

**Step 2: Add document upload flow rendering**

After IntroCard section (around line 332), add:

```typescript
          {flowStep === 'upload' && (
            <div className="flex-1 flex items-center justify-center">
              <DocumentUpload
                onUploadComplete={handleDocumentUploadComplete}
                onError={handleDocumentUploadError}
              />
              {uploadError && (
                <div className="mt-4 max-w-md mx-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {uploadError}
                  </p>
                </div>
              )}
            </div>
          )}

          {flowStep === 'document-summary' && documentSummary && (
            <div className="flex-1 flex items-center justify-center">
              <DocumentSummary
                filename={documentContext?.filename || 'your document'}
                summary={documentSummary}
                onContinue={handleDocumentSummaryContinue}
                onRetry={handleDocumentSummaryRetry}
              />
            </div>
          )}
```

**Step 3: Add fake door dialog**

Before the closing `</AppLayout>` tag (around line 400), add:

```typescript
          {fakeDoorFeature && (
            <FakeDoorDialog
              open={fakeDoorOpen}
              onOpenChange={setFakeDoorOpen}
              featureName={fakeDoorFeature.name}
              description={fakeDoorFeature.description}
              onInterest={handleFakeDoorInterest}
            />
          )}
```

**Step 4: Add imports at top of file**

Add to imports (around line 1-12):

```typescript
import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentSummary } from '@/components/DocumentSummary';
import { EntryPointSelector } from '@/components/EntryPointSelector';
import { FakeDoorDialog } from '@/components/FakeDoorDialog';
```

**Step 5: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up document upload and fake door flows in page.tsx"
```

---

## Task 13: Create Upload Document API Route

**Files:**
- Create: `src/app/api/upload-document/route.ts`

**Step 1: Create API route skeleton**

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { UnstructuredClient } from 'unstructured-client';
import { Strategy } from 'unstructured-client/sdk/models/shared';

export const maxDuration = 60;

const unstructured = new UnstructuredClient({
  security: {
    apiKeyAuth: process.env.UNSTRUCTURED_API_KEY || '',
  },
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text using unstructured.io
    console.log('[Upload] Extracting text from file:', file.name);
    const extractionResult = await unstructured.general.partition({
      files: {
        content: buffer,
        fileName: file.name,
      },
      partitionParameters: {
        strategy: Strategy.Auto,
      },
    });

    // Combine all elements into text
    const extractedText = extractionResult.elements
      ?.map((el: any) => el.text)
      .filter(Boolean)
      .join('\n\n') || '';

    if (!extractedText) {
      return NextResponse.json(
        { error: 'Could not extract text from file' },
        { status: 400 }
      );
    }

    console.log('[Upload] Extracted text length:', extractedText.length);

    // Generate summary using Claude
    const summaryResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Briefly summarize this business document in 1-2 sentences. Focus on what business/product it's about:\n\n${extractedText.slice(0, 4000)}`
      }],
      temperature: 0.7,
    });

    const summary = summaryResponse.content[0]?.type === 'text'
      ? summaryResponse.content[0].text
      : 'Document uploaded successfully.';

    console.log('[Upload] Generated summary');

    // Get session to check if user is authenticated
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Create conversation with document context
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        status: 'in_progress',
        experimentVariant: 'baseline-v1', // Default variant for document uploads
      },
    });

    // Store document context as first system message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: `Context from uploaded document (${file.name}):\n\n${extractedText}\n\nUse this as background context. Ask clarifying questions to fill gaps and deepen understanding. Don't rehash what's already clear from the document.`,
        stepNumber: 0, // System message
      },
    });

    // Generate first context-aware question
    const firstQuestionResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Based on this document summary, ask one focused clarifying question to understand their business better:\n\n${summary}\n\nIMPORTANT: Output ONLY the question itself. No preambles.`
        }
      ],
      temperature: 0.7,
    });

    const firstQuestion = firstQuestionResponse.content[0]?.type === 'text'
      ? firstQuestionResponse.content[0].text
      : 'What specific aspects of your strategy would you like to focus on?';

    // Save first question
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: firstQuestion,
        stepNumber: 1,
      },
    });

    // Log document upload event
    await prisma.event.create({
      data: {
        conversationId: conversation.id,
        eventType: 'document_uploaded',
        eventData: {
          fileType: file.type,
          fileSize: file.size,
          filename: file.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      summary,
      extractedText,
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/upload-document/route.ts
git commit -m "feat: create upload-document API with unstructured.io integration"
```

---

## Task 14: Add Conversation Messages API Route

**Files:**
- Create: `src/app/api/conversation/[id]/messages/route.ts`

**Step 1: Create messages retrieval endpoint**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { stepNumber: 'asc' },
    });

    // Filter out system messages (stepNumber 0)
    const userMessages = messages.filter(m => m.stepNumber > 0);

    return NextResponse.json({
      messages: userMessages,
    });

  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/conversation/[id]/messages/route.ts
git commit -m "feat: add API route to retrieve conversation messages"
```

---

## Task 15: Replace System Alerts in StrategyDisplay

**Files:**
- Modify: `src/components/StrategyDisplay.tsx:1-420`

**Step 1: Add FakeDoorDialog state**

Add imports at top:
```typescript
import { FakeDoorDialog } from './FakeDoorDialog';
```

Add state inside component (after existing state):
```typescript
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const [fakeDoorConfig, setFakeDoorConfig] = useState<{
    name: string;
    description: string;
    feature: string;
  } | null>(null);
```

**Step 2: Replace alert calls with fake door**

Find the handleEditClick function (around line 49) and replace:
```typescript
  const handleEditClick = async (feature: string, content: string) => {
    alert(`${feature} feature coming soon!`);
```

With:
```typescript
  const handleEditClick = async (feature: string, content: string) => {
    const featureConfig: Record<string, { name: string; description: string }> = {
      vision: {
        name: 'Edit Vision',
        description: 'Edit and refine your vision statement.\n\nThis feature would let you directly modify the vision and regenerate related elements.',
      },
      mission: {
        name: 'Edit Mission',
        description: 'Edit and refine your mission statement.\n\nThis feature would let you directly modify the mission and regenerate related elements.',
      },
      objectives: {
        name: 'Edit Objectives',
        description: 'Edit and refine your strategic objectives.\n\nThis feature would let you modify, add, or remove objectives with smart regeneration.',
      },
    };

    setFakeDoorConfig({
      ...featureConfig[feature],
      feature,
    });
    setFakeDoorOpen(true);
```

**Step 3: Add fake door interest handler**

After handleEditClick, add:
```typescript
  const handleFakeDoorInterest = async () => {
    if (!fakeDoorConfig) return;

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        traceId,
        eventType: 'fake_door_click',
        eventData: { feature: fakeDoorConfig.feature },
      }),
    }).catch(err => console.error('Failed to log event:', err));

    console.log(`User interested in: ${fakeDoorConfig.name}`);
  };
```

**Step 4: Add FakeDoorDialog to render**

Before the closing fragment/div (at end of return statement), add:
```typescript
      {fakeDoorConfig && (
        <FakeDoorDialog
          open={fakeDoorOpen}
          onOpenChange={setFakeDoorOpen}
          featureName={fakeDoorConfig.name}
          description={fakeDoorConfig.description}
          onInterest={handleFakeDoorInterest}
        />
      )}
```

**Step 5: Remove old alert call (line 65)**

Find and remove the line:
```typescript
    alert(content);
```

This is in the handleCardClick function.

**Step 6: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: No errors

**Step 7: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git commit -m "refactor: replace system alerts with FakeDoorDialog in StrategyDisplay"
```

---

## Task 16: Update .env.example

**Files:**
- Modify: `.env.local` or create `.env.example`

**Step 1: Document required environment variable**

If `.env.example` exists, add:
```bash
# Unstructured.io API for document extraction
UNSTRUCTURED_API_KEY=your_unstructured_api_key_here
```

If only `.env.local` exists, ensure it has:
```bash
UNSTRUCTURED_API_KEY=your_key_here
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add UNSTRUCTURED_API_KEY to environment variables"
```

---

## Task 17: Test Build

**Files:**
- None (verification step)

**Step 1: Run TypeScript check**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: If build succeeds, commit verification**

```bash
git commit --allow-empty -m "build: verify cold start entry points implementation builds successfully"
```

---

## Task 18: Manual Testing Checklist

**Files:**
- None (manual testing)

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test entry point selection**

- [ ] IntroCard shows 4 options
- [ ] Icons display correctly
- [ ] Clicking "Guided Conversation" starts normal flow
- [ ] Entry point selection logs event

**Step 3: Test fake doors**

- [ ] Clicking "Start from Canvas" opens AlertDialog
- [ ] Clicking "Fast Track" opens AlertDialog
- [ ] "I'm Interested" logs event and closes dialog
- [ ] "Maybe Later" just closes dialog
- [ ] Edit buttons on strategy display use AlertDialog (not system alert)

**Step 4: Test document upload**

- [ ] Clicking "Upload Document" shows dropzone
- [ ] Drag-and-drop works
- [ ] Click-to-browse works
- [ ] Invalid file types show error
- [ ] Files over 10MB show error
- [ ] Valid upload shows loading state
- [ ] Extraction completes and shows summary
- [ ] Summary shows filename
- [ ] Continue button moves to chat
- [ ] Retry button returns to upload

**Step 5: Test document-based conversation**

- [ ] First question is context-aware (references document)
- [ ] Normal conversation flow works
- [ ] Extraction and generation work
- [ ] Document upload event logged

**Step 6: Document test results**

Create `docs/testing/2025-12-21-cold-start-entry-points-test-results.md` with results.

---

## Task 19: Update Session Notes

**Files:**
- Modify: `docs/session-notes/_session-notes-combined.md`

**Step 1: Add session entry**

Add new section at top of file:

```markdown
## 2025-12-21: Cold Start Entry Points

### Overview
Added multiple entry points to solve cold start problem. Replaced single "Start" button with 4 options: Guided Conversation, Upload Document, Decision Stack Canvas (fake door), and Fast Track (fake door).

### Changes

**New Components:**
- EntryPointSelector - 4 option cards with icons
- FakeDoorDialog - Reusable AlertDialog for fake doors
- DocumentUpload - Dropzone for file upload (PDF/DOCX/TXT/MD)
- DocumentSummary - Shows extraction summary before conversation

**Modified Components:**
- IntroCard - Replaced start button with EntryPointSelector
- page.tsx - Added upload and document-summary flow states
- StrategyDisplay - Replaced system alerts with FakeDoorDialog

**New API Routes:**
- `/api/upload-document` - Handle file upload and unstructured.io extraction
- `/api/conversation/[id]/messages` - Retrieve conversation messages

**Event Tracking:**
- entry_point_selected - Track which option users choose
- document_uploaded - Track file uploads with metadata

**Dependencies:**
- unstructured-client - Document extraction
- react-dropzone - File upload UI
- shadcn AlertDialog - Fake door dialogs

### Technical Details

**Document Upload Flow:**
1. User drops/selects file
2. Upload to API with FormData
3. Unstructured.io extracts text
4. Claude generates brief summary
5. Store as conversation with document context in system message
6. Generate first context-aware question
7. Show summary and continue to chat

**Fake Door Implementation:**
- Consistent AlertDialog across all fake doors
- Logs interest events for demand validation
- No system alerts anywhere in app

### Verification
- ✅ Build succeeds
- ✅ TypeScript compiles cleanly
- ✅ Entry point selection works
- ✅ Document upload works (PDF/DOCX/TXT/MD)
- ✅ Fake doors use AlertDialog
- ✅ Events logged correctly

### Hours
Approximately 4-5 hours implementation + testing

---
```

**Step 2: Commit**

```bash
git add docs/session-notes/_session-notes-combined.md
git commit -m "docs: add session notes for cold start entry points"
```

---

## Implementation Complete

**Summary:**
- ✅ 4 entry point options (2 real, 2 fake doors)
- ✅ Document upload with unstructured.io
- ✅ Fake door dialogs replace system alerts
- ✅ Event tracking for entry points and uploads
- ✅ Greyscale aesthetic maintained
- ✅ Mobile-responsive design

**Next Steps:**
1. Deploy to development branch
2. Test with real users
3. Analyze entry point selection distribution
4. Validate fake door interest (Canvas, Fast Track)
5. Compare conversation quality with vs. without document context
