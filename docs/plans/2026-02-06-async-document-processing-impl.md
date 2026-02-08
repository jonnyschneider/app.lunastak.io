# Async Document Processing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 504 timeouts on document upload by processing asynchronously via waitUntil.

**Architecture:** Upload endpoint returns immediately with document ID. Background task processes via waitUntil. Client polls new status endpoint until complete/failed.

**Tech Stack:** Next.js API routes, Vercel waitUntil, React hooks, Prisma

---

## Task 1: Document Status Endpoint

**Files:**
- Create: `src/app/api/documents/[id]/status/route.ts`

**Step 1: Create the status endpoint**

```typescript
// src/app/api/documents/[id]/status/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/documents/[id]/status
 * Polling endpoint for document processing status.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Document ID is required' },
      { status: 400 }
    )
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      fileName: true,
      errorMessage: true,
      processedAt: true,
    },
  })

  if (!document) {
    return NextResponse.json(
      { error: 'Document not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    status: document.status,
    fileName: document.fileName,
    errorMessage: document.errorMessage,
    processedAt: document.processedAt?.toISOString(),
  })
}
```

**Step 2: Test manually**

Run: `npm run dev`
Test: `curl http://localhost:3000/api/documents/some-id/status`
Expected: 404 "Document not found" (confirms endpoint works)

**Step 3: Commit**

```bash
git add src/app/api/documents/[id]/status/route.ts
git commit -m "feat(api): add document status polling endpoint"
```

---

## Task 2: Make Upload Endpoint Async

**Files:**
- Modify: `src/app/api/documents/upload/route.ts`

**Step 1: Update upload route to use waitUntil**

Replace the synchronous processing block with fire-and-forget:

```typescript
// At top, add import:
import { waitUntil } from '@vercel/functions'

// Replace lines 84-106 (from "// Get file content" to the return) with:

    // Get file content as buffer for processing
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Update status to processing before starting background task
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'processing' },
    })

    // Process document in background - continues after response sent
    waitUntil(
      processDocument(document.id, fileBuffer, fileType, uploadContext || undefined)
        .catch((error) => {
          console.error('[Upload] Background processing failed:', error)
          // Status already set to 'failed' by processDocument
        })
    )

    // Return immediately
    return NextResponse.json({
      status: 'started',
      documentId: document.id,
      fileName: document.fileName,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

**Step 2: Remove maxDuration (no longer needed)**

Delete line 7: `export const maxDuration = 300 // 5 minutes for Pro plan`

The endpoint now returns in <1 second, so default timeout is fine.

**Step 3: Test manually**

Upload a document via the UI. Should return immediately instead of waiting.

**Step 4: Commit**

```bash
git add src/app/api/documents/upload/route.ts
git commit -m "feat(api): make document upload async via waitUntil"
```

---

## Task 3: Document Status Hook

**Files:**
- Create: `src/hooks/use-document-status.ts`

**Step 1: Create the hook**

```typescript
// src/hooks/use-document-status.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type DocumentStatus = 'pending' | 'processing' | 'complete' | 'failed'

interface DocumentStatusResponse {
  status: DocumentStatus
  fileName: string
  errorMessage?: string
  processedAt?: string
}

interface UseDocumentStatusOptions {
  /** Polling interval in ms. Default: 2000 (2 seconds) */
  pollInterval?: number
  /** Called when processing completes successfully */
  onComplete?: (documentId: string) => void
  /** Called when processing fails */
  onError?: (error: string) => void
}

interface UseDocumentStatusReturn {
  /** Current document status */
  status: DocumentStatus | null
  /** Error message (available when failed) */
  error: string | null
  /** Whether polling is active */
  isPolling: boolean
  /** Start polling for a document ID */
  startPolling: (documentId: string) => void
  /** Stop polling */
  stopPolling: () => void
}

const DEFAULT_POLL_INTERVAL = 2000

/**
 * Hook to poll for document processing status.
 *
 * Usage:
 * ```tsx
 * const { status, isPolling, startPolling } = useDocumentStatus({
 *   onComplete: () => toast.success('Document processed'),
 *   onError: (error) => toast.error(error),
 * })
 *
 * // After upload returns
 * startPolling(documentId)
 * ```
 */
export function useDocumentStatus(
  options: UseDocumentStatusOptions = {}
): UseDocumentStatusReturn {
  const { pollInterval = DEFAULT_POLL_INTERVAL, onComplete, onError } = options

  const [documentId, setDocumentId] = useState<string | null>(null)
  const [status, setStatus] = useState<DocumentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  onCompleteRef.current = onComplete
  onErrorRef.current = onError

  const stopPolling = useCallback(() => {
    setDocumentId(null)
    setIsPolling(false)
  }, [])

  const startPolling = useCallback((id: string) => {
    setDocumentId(id)
    setStatus('processing')
    setError(null)
    setIsPolling(true)
  }, [])

  useEffect(() => {
    if (!documentId || !isPolling) {
      return
    }

    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/status`)

        if (!response.ok) {
          console.error('[useDocumentStatus] Poll failed:', response.status)
          if (isMounted && isPolling) {
            timeoutId = setTimeout(poll, pollInterval)
          }
          return
        }

        const data: DocumentStatusResponse = await response.json()

        if (!isMounted) return

        setStatus(data.status)

        if (data.status === 'complete') {
          setIsPolling(false)
          onCompleteRef.current?.(documentId)
        } else if (data.status === 'failed') {
          setError(data.errorMessage || 'Processing failed')
          setIsPolling(false)
          onErrorRef.current?.(data.errorMessage || 'Processing failed')
        } else {
          timeoutId = setTimeout(poll, pollInterval)
        }
      } catch (err) {
        console.error('[useDocumentStatus] Poll error:', err)
        if (isMounted && isPolling) {
          timeoutId = setTimeout(poll, pollInterval)
        }
      }
    }

    poll()

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [documentId, isPolling, pollInterval])

  return {
    status,
    error,
    isPolling,
    startPolling,
    stopPolling,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-document-status.ts
git commit -m "feat(hooks): add useDocumentStatus polling hook"
```

---

## Task 4: Update Upload Dialog

**Files:**
- Modify: `src/components/document-upload-dialog.tsx`

**Step 1: Add hook and toast imports**

At top of file, add:

```typescript
import { useDocumentStatus } from '@/hooks/use-document-status'
import { toast } from 'sonner'
```

**Step 2: Add hook usage in component**

Inside `DocumentUploadDialog` function, after the `fileInputRef` line (around line 45), add:

```typescript
  const { startPolling } = useDocumentStatus({
    onComplete: (docId) => {
      toast.success('Document processed successfully')
      onUploadComplete(selectedFile?.name)
    },
    onError: (err) => {
      toast.error(`Document processing failed: ${err}`)
    },
  })
```

**Step 3: Update handleUpload function**

Replace the success handling (lines 111-125) with:

```typescript
      const data = await response.json()

      // Start polling for processing status
      startPolling(data.documentId)

      // Close dialog immediately - polling continues in background
      toast('Processing document...', { duration: 3000 })
      onOpenChange(false)
      resetState()
    } catch (err) {
```

**Step 4: Remove unused states**

The `'processing'` and `'complete'` states in the dialog are no longer needed since we close immediately. The UI blocks for these can be removed, but leaving them is harmless.

**Step 5: Test manually**

1. Upload a document
2. Dialog should close immediately with "Processing document..." toast
3. After processing completes, "Document processed successfully" toast appears

**Step 6: Commit**

```bash
git add src/components/document-upload-dialog.tsx
git commit -m "feat(ui): close upload dialog immediately, poll in background"
```

---

## Task 5: Fix processDocument Status Update

**Files:**
- Modify: `src/lib/document-processing.ts`

**Step 1: Remove redundant status update**

The upload route now sets `status: 'processing'` before calling `processDocument`. Remove the duplicate update at line 111-114:

```typescript
// DELETE these lines (111-114):
    // Update status to processing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    })
```

**Step 2: Commit**

```bash
git add src/lib/document-processing.ts
git commit -m "refactor: remove duplicate processing status update"
```

---

## Task 6: Final Verification

**Step 1: Run type check**

```bash
npm run type-check
```

Expected: No errors

**Step 2: Run tests**

```bash
npm run test
```

Expected: All pass

**Step 3: Manual E2E test**

1. Create new project (or use existing)
2. Upload a PDF document
3. Verify: Dialog closes immediately
4. Verify: "Processing document..." toast appears
5. Verify: After ~5-10 seconds, "Document processed successfully" toast
6. Verify: Document appears in project with fragments

**Step 4: Final commit (if any cleanup needed)**

```bash
npm run verify
git push
```
