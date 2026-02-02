# Simplified First-Time Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the overwhelming demo-first guest experience with a clean empty state that lets users start immediately, with demo available on-demand.

**Architecture:** New `FirstTimeEmptyState` component with inline chat that expands in-place. Guest init creates empty project instead of demo. Demo created on-demand via "See an example" button. Guest save banner on strategy page.

**Tech Stack:** React, Next.js, TypeScript, Tailwind CSS, existing chat/conversation APIs

---

## Task 1: Create GuestSaveBanner Component

**Files:**
- Create: `src/components/GuestSaveBanner.tsx`

**Step 1: Create the banner component**

```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface GuestSaveBannerProps {
  onDismiss?: () => void
}

export function GuestSaveBanner({ onDismiss }: GuestSaveBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const handleSignIn = () => {
    signIn(undefined, { callbackUrl: window.location.href })
  }

  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between flex-1 ml-2">
        <span className="text-amber-800">
          Your strategy isn't saved yet. Create an account to keep your work.
        </span>
        <div className="flex items-center gap-2 ml-4">
          <Button size="sm" onClick={handleSignIn}>
            Create Account
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-amber-600" />
          </button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
```

**Step 2: Verify file created**

Run: `ls -la src/components/GuestSaveBanner.tsx`
Expected: File exists

**Step 3: Commit**

```bash
git add src/components/GuestSaveBanner.tsx
git commit -m "feat: add GuestSaveBanner component for guest strategy pages"
```

---

## Task 2: Add Banner to Strategy Page

**Files:**
- Modify: `src/app/strategy/[traceId]/page.tsx`

**Step 1: Add guest detection and banner**

Add imports at top of file:
```tsx
import { useSession } from 'next-auth/react'
import { GuestSaveBanner } from '@/components/GuestSaveBanner'
```

Inside the component, after existing state declarations, add:
```tsx
const { data: session } = useSession()
const isGuest = !session
```

In the return statement, after the header `<div className="space-y-2">` section and before `{/* Strategy Content */}`, add:
```tsx
{/* Guest Save Banner */}
{isGuest && <GuestSaveBanner />}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/strategy/[traceId]/page.tsx
git commit -m "feat: show save banner for guests on strategy page"
```

---

## Task 3: Create API Endpoint for On-Demand Demo

**Files:**
- Create: `src/app/api/demo/create/route.ts`

**Step 1: Create the endpoint**

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { seedDemoProject } from '@/lib/seed-demo'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * POST /api/demo/create
 * Creates a demo project on-demand for the current user (guest or authenticated)
 */
export async function POST() {
  // Get user ID from session or guest cookie
  const session = await getServerSession(authOptions)
  let userId = session?.user?.id

  if (!userId) {
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)
    if (guestCookie?.value) {
      // Verify it's a valid guest
      const user = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { email: true },
      })
      if (user && isGuestUser(user.email)) {
        userId = guestCookie.value
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user already has a demo project
  const existingDemo = await prisma.project.findFirst({
    where: { userId, isDemo: true },
    select: { id: true },
  })

  if (existingDemo) {
    return NextResponse.json({ projectId: existingDemo.id, existed: true })
  }

  // Create new demo project
  const projectId = await seedDemoProject(userId)

  return NextResponse.json({ projectId, existed: false })
}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/demo/create/route.ts
git commit -m "feat: add API endpoint for on-demand demo project creation"
```

---

## Task 4: Modify Guest Init to Create Empty Project

**Files:**
- Modify: `src/app/api/guest/init/route.ts`
- Modify: `src/lib/projects.ts`

**Step 1: Add createEmptyGuestProject function to projects.ts**

Add this new function after `createGuestUser`:

```ts
/**
 * Create an empty project for a guest user (no demo data)
 */
export async function createEmptyGuestProject(userId: string): Promise<string> {
  const project = await prisma.project.create({
    data: {
      userId,
      name: 'My Strategy',
      status: 'active',
    },
  })

  // Initialize synthesis records
  const records = TIER_1_DIMENSIONS.map(dimension => ({
    projectId: project.id,
    dimension,
    summary: null,
    keyThemes: [],
    keyQuotes: [],
    gaps: [],
    contradictions: [],
    confidence: 'LOW' as const,
    fragmentCount: 0,
    lastSynthesizedAt: new Date(),
    synthesizedBy: 'init',
  }))

  await prisma.dimensionalSynthesis.createMany({
    data: records,
    skipDuplicates: true,
  })

  return project.id
}
```

**Step 2: Update guest init route**

Replace the entire content of `src/app/api/guest/init/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createGuestUser, createEmptyGuestProject } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * GET /api/guest/init
 * Creates a new guest user with empty project, sets cookie, redirects to project.
 */
export async function GET(request: NextRequest) {
  // Create new guest user
  const guestUser = await createGuestUser()

  // Create empty project (not demo)
  const projectId = await createEmptyGuestProject(guestUser.id)

  // Set guest cookie
  const cookieStore = await cookies()
  cookieStore.set(GUEST_COOKIE_NAME, guestUser.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  // Redirect to project
  const origin = request.nextUrl.origin
  return NextResponse.redirect(new URL(`/project/${projectId}`, origin))
}
```

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/projects.ts src/app/api/guest/init/route.ts
git commit -m "refactor: guest init creates empty project instead of demo"
```

---

## Task 5: Create InlineChat Component

**Files:**
- Create: `src/components/InlineChat.tsx`

**Step 1: Create the inline chat component**

This component handles chat in-place, then transitions to ChatSheet for extraction:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Message, ConversationPhase } from '@/lib/types'
import { ChatSheet } from '@/components/chat-sheet'

interface InlineChatProps {
  projectId: string
  initialMessage?: string
  onConversationStart?: (conversationId: string) => void
}

export function InlineChat({ projectId, initialMessage, onConversationStart }: InlineChatProps) {
  const [input, setInput] = useState(initialMessage || '')
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL')
  const [experimentVariant, setExperimentVariant] = useState<string>('baseline-v1')

  // Transition to sheet for extraction
  const [showSheet, setShowSheet] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check if we should transition to sheet (ready for extraction)
  const shouldTransitionToSheet = currentPhase === 'EXTRACTION' ||
    messages.filter(m => m.role === 'user').length >= 3

  useEffect(() => {
    if (shouldTransitionToSheet && conversationId && !showSheet) {
      setShowSheet(true)
    }
  }, [shouldTransitionToSheet, conversationId, showSheet])

  const startConversation = async (firstMessage: string) => {
    setIsLoading(true)
    setIsExpanded(true)

    try {
      const response = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      const data = await response.json()
      setConversationId(data.conversationId)
      setExperimentVariant(data.experimentVariant || 'baseline-v1')
      onConversationStart?.(data.conversationId)

      // Set initial assistant message
      if (data.message) {
        setMessages([{
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.message,
        }])
      }
      setCurrentPhase(data.phase || 'QUESTIONING')

      // Send the user's first message
      await sendMessage(data.conversationId, firstMessage)
    } catch (error) {
      console.error('Failed to start conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (convId: string, content: string) => {
    // Add user message optimistically
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/conversation/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          response: content,
        }),
      })

      const data = await response.json()

      if (data.message) {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.message,
        }])
      }

      if (data.phase) {
        setCurrentPhase(data.phase)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const message = input.trim()
    setInput('')

    if (!conversationId) {
      await startConversation(message)
    } else {
      await sendMessage(conversationId, message)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // If transitioned to sheet, render sheet instead
  if (showSheet && conversationId) {
    return (
      <ChatSheet
        projectId={projectId}
        open={true}
        onOpenChange={() => {}}
        resumeConversationId={conversationId}
        hasExistingStrategy={false}
      />
    )
  }

  return (
    <div className={`transition-all duration-300 ${isExpanded ? 'min-h-[400px]' : ''}`}>
      {/* Messages area - only show when expanded */}
      {isExpanded && messages.length > 0 && (
        <div className="mb-4 space-y-4 max-h-[300px] overflow-y-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="relative">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell me about your strategic challenge..."
          className="min-h-[80px] pr-12 resize-none"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="icon"
          className="absolute bottom-2 right-2"
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/InlineChat.tsx
git commit -m "feat: add InlineChat component for first-time experience"
```

---

## Task 6: Create FirstTimeEmptyState Component

**Files:**
- Create: `src/components/FirstTimeEmptyState.tsx`

**Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { Upload, Info, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InlineChat } from '@/components/InlineChat'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'

interface FirstTimeEmptyStateProps {
  projectId: string
  onUploadComplete?: () => void
}

export function FirstTimeEmptyState({ projectId, onUploadComplete }: FirstTimeEmptyStateProps) {
  const router = useRouter()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [isLoadingDemo, setIsLoadingDemo] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  const handleSeeExample = async () => {
    setIsLoadingDemo(true)
    try {
      const response = await fetch('/api/demo/create', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        // Navigate to demo project
        router.push(`/project/${data.projectId}`)
      }
    } catch (error) {
      console.error('Failed to create demo:', error)
    } finally {
      setIsLoadingDemo(false)
    }
  }

  const handleUploadComplete = (fileName?: string) => {
    setUploadDialogOpen(false)
    if (fileName) {
      setUploadedFileName(fileName)
      setChatStarted(true)
    }
    onUploadComplete?.()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hi, I'm Luna. Let's clarify your strategic thinking.
          </h1>
          <p className="text-muted-foreground">
            To start, tell me about your strategic challenge, upload an existing doc and we can
            brainstorm from there, or check out an example to see what the output looks like.
          </p>
        </div>

        {/* Inline Chat */}
        <InlineChat
          projectId={projectId}
          initialMessage={uploadedFileName ? `I've uploaded ${uploadedFileName}. Let's discuss it.` : undefined}
          onConversationStart={() => setChatStarted(true)}
        />

        {/* Action buttons - hide once chat started */}
        {!chatStarted && (
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload existing doc
            </Button>
            <Button
              variant="outline"
              onClick={handleSeeExample}
              disabled={isLoadingDemo}
              className="flex items-center gap-2"
            >
              {isLoadingDemo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              {isLoadingDemo ? 'Setting up example...' : 'See an example'}
            </Button>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        projectId={projectId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/FirstTimeEmptyState.tsx
git commit -m "feat: add FirstTimeEmptyState component with inline chat"
```

---

## Task 7: Update Project Page to Use New Empty State

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Replace ProjectEmptyState import**

Change:
```tsx
import { ProjectEmptyState } from '@/components/ProjectEmptyState'
```

To:
```tsx
import { FirstTimeEmptyState } from '@/components/FirstTimeEmptyState'
```

**Step 2: Update empty state rendering**

Find the section (around line 444-491):
```tsx
if (isEmpty && projectData) {
  return (
    <AppLayout>
      <ProjectEmptyState
        projectId={projectId}
        onStartConversation={() => {
          ...
        }}
        onUploadDocument={() => {
          ...
        }}
      />
      ...
    </AppLayout>
  )
}
```

Replace with:
```tsx
if (isEmpty && projectData) {
  return (
    <AppLayout>
      <FirstTimeEmptyState
        projectId={projectId}
        onUploadComplete={() => fetchProjectData()}
      />
    </AppLayout>
  )
}
```

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Test manually**

Run: `npm run dev`
- Clear guest cookie in browser
- Visit `/`
- Should see new empty state with inline chat
- Type a message, should expand inline
- After 3+ exchanges, should transition to sheet

**Step 5: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat: use FirstTimeEmptyState for empty projects"
```

---

## Task 8: Update DocumentUploadDialog to Return Filename

**Files:**
- Modify: `src/components/document-upload-dialog.tsx`

**Step 1: Check current onUploadComplete signature**

The current signature is likely `onUploadComplete?: () => void`. Update to:
```tsx
onUploadComplete?: (fileName?: string) => void
```

**Step 2: Pass filename on completion**

In the upload success handler, call:
```tsx
onUploadComplete?.(file.name)
```

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No errors (may need to update other call sites if they exist)

**Step 4: Commit**

```bash
git add src/components/document-upload-dialog.tsx
git commit -m "feat: pass filename to onUploadComplete callback"
```

---

## Task 9: Clean Up Old ProjectEmptyState

**Files:**
- Delete: `src/components/ProjectEmptyState.tsx`

**Step 1: Check for other usages**

Run: `grep -r "ProjectEmptyState" src/`
Expected: No results (already replaced in Task 7)

**Step 2: Delete the file**

Run: `rm src/components/ProjectEmptyState.tsx`

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused ProjectEmptyState component"
```

---

## Task 10: Final Integration Test

**Step 1: Run full verification**

Run: `npm run verify`
Expected: All checks pass

**Step 2: Manual testing checklist**

- [ ] New guest lands on empty state with inline chat
- [ ] Typing in input expands to chat
- [ ] After 3+ exchanges, transitions to ChatSheet
- [ ] "Upload existing doc" opens upload dialog
- [ ] After upload, chat auto-starts with file context
- [ ] "See an example" creates demo and navigates to it
- [ ] Demo project appears in sidebar after creation
- [ ] Guest viewing strategy sees save banner
- [ ] Banner dismisses but reappears on page refresh
- [ ] Authenticated user with empty project sees same empty state
- [ ] Authenticated user doesn't see save banner on strategy page

**Step 3: Commit any fixes**

If any issues found, fix and commit individually.

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create GuestSaveBanner component |
| 2 | Add banner to strategy page |
| 3 | Create on-demand demo API endpoint |
| 4 | Modify guest init for empty project |
| 5 | Create InlineChat component |
| 6 | Create FirstTimeEmptyState component |
| 7 | Update project page to use new empty state |
| 8 | Update DocumentUploadDialog to return filename |
| 9 | Clean up old ProjectEmptyState |
| 10 | Final integration test |
