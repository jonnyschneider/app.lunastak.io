# Async Document Processing Design

**Date:** 2026-02-06
**Status:** Approved
**Problem:** Document upload times out (504) because processing runs synchronously

## Problem

The `/api/documents/upload` endpoint processes documents synchronously:
1. Upload file
2. Extract text via Unstructured API (slow)
3. Extract themes via Claude API (slow)
4. Create fragments
5. Return response

If Unstructured or Claude takes too long, Vercel returns a 504 Gateway Timeout. The client receives a non-JSON error and crashes.

## Solution

Decouple upload from processing using the same pattern as `/api/generate`:
- Upload returns immediately with document ID
- Processing runs in background via `waitUntil`
- Client polls for status

## API Changes

### Upload Endpoint (Modified)

`POST /api/documents/upload`

**Current:** Processes synchronously, returns final status
**New:** Creates record, schedules background task, returns immediately

```typescript
// Response (immediate)
{
  status: 'started',
  documentId: string,
  fileName: string,
}
```

Background task:
```typescript
waitUntil(processDocument(document.id, fileBuffer, fileType, uploadContext))
```

### Status Endpoint (New)

`GET /api/documents/[id]/status`

Returns current document status from database:

```typescript
{
  status: 'pending' | 'processing' | 'complete' | 'failed',
  fileName: string,
  errorMessage?: string,
  processedAt?: string,
}
```

## Client Changes

### Hook: `useDocumentStatus`

Mirrors `useGenerationStatus` pattern:

```typescript
interface UseDocumentStatusOptions {
  pollInterval?: number;           // Default: 2000ms
  onComplete?: (documentId: string) => void;
  onError?: (error: string) => void;
}

interface UseDocumentStatusReturn {
  status: DocumentStatus | null;
  isPolling: boolean;
  startPolling: (documentId: string) => void;
  stopPolling: () => void;
}
```

### Dialog Flow

1. User selects file, clicks Upload
2. Dialog shows "Uploading..." (brief network request)
3. API returns `{ status: 'started', documentId }`
4. Dialog closes immediately
5. Toast: "Processing document..."
6. Background polling starts
7. On complete: toast "Document ready" + trigger `onUploadComplete`
8. On error: toast with error message

### Document List

Shows processing indicator for documents with `status: 'processing'` so users see progress after navigating away.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| User closes browser | Processing continues, status updated in DB |
| User returns later | Document list shows current status |
| Unstructured API slow | No timeout—background task runs independently |
| Polling endpoint fails | Hook retries on next interval |

## No Schema Changes

Document model already has required fields:
- `status`: 'pending' | 'processing' | 'complete' | 'failed'
- `errorMessage`: String (nullable)
- `processedAt`: DateTime (nullable)

## Files to Change

1. `src/app/api/documents/upload/route.ts` - Return immediately, use waitUntil
2. `src/app/api/documents/[id]/status/route.ts` - New polling endpoint
3. `src/hooks/use-document-status.ts` - New hook
4. `src/components/document-upload-dialog.tsx` - Use hook, close immediately
5. `src/lib/contracts/document-status.ts` - Status contracts (optional, for consistency)

## Implementation Notes

- Reuse `waitUntil` from `@vercel/functions` (already used in generate/extract)
- Document processing function (`processDocument`) unchanged
- Poll interval: 2 seconds (matches generation)
