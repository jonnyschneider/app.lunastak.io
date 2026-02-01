# Background Strategy Generation

**Status:** Design complete, ready for implementation
**Created:** 2026-01-31
**Context:** Users wait 15-30s while extraction + generation blocks the browser. This design eliminates the generation wait by running it in the background with notifications.

## Problem

Current flow holds browser hostage:
- Extraction: ~5-10s (blocking)
- Generation: ~10-20s (blocking)
- **Total: 15-30s of staring at a spinner**

Previous optimization (v1.7.5) removed the confirmation screen but didn't reduce actual wait time.

## Solution

Fire-and-forget generation with background processing and notifications.

**Result:** User waits ~5-10s for extraction, then is free to browse while generation happens in background.

## User Flow

1. User finishes conversation, extraction completes (~5-10s, still blocking)
2. UI redirects to project page ("Your Thinking")
3. Three concurrent indicators appear:
   - **Knowledge status bar:** "adding to knowledgebase..." (animated Luna logomark)
   - **Sidebar strategy slot:** animated Luna + "generating your strategy..."
   - Generation runs in background via `waitUntil()`
4. On completion:
   - **Toast notification:** "Your strategy is ready" (shadcn/ui toast)
   - **Sidebar updates:** animated Luna becomes solid dot (unseen indicator), shows strategy link
   - **Knowledge status bar:** updates fragment count
5. User clicks sidebar or toast → lands on strategy page, dot dismisses

### Indicator States

| State | Sidebar | Knowledge Bar |
|-------|---------|---------------|
| Generating | Animated Luna + "generating..." | Animated Luna + "adding to knowledgebase..." |
| Complete, unseen | Solid Luna dot + strategy link | Fragment count |
| Complete, viewed | Strategy link (no dot) | Fragment count |
| Failed | Error state + retry | Normal |

## Technical Implementation

### Schema Changes

Add to `GeneratedOutput` model:

```prisma
model GeneratedOutput {
  // ...existing fields
  status      String    @default("pending")  // pending | generating | complete | failed
  startedAt   DateTime?
  viewedAt    DateTime?  // null = unseen, set on first view
}
```

### API Changes

**`/api/generate` (modified)**
- Validates inputs (conversationId, extractedContext)
- Creates GeneratedOutput with `status: 'generating'`, `startedAt: now()`
- Starts generation via `waitUntil()`
- Returns `{ status: 'started', generationId }` immediately
- Background task updates GeneratedOutput on completion/failure

**`/api/generation-status/[id]` (new)**
- Polling endpoint
- Returns `{ status, traceId?, error? }`
- Client polls every 2-3 seconds

**`/api/generation/[id]/viewed` (new)**
- POST to mark strategy as viewed
- Sets `viewedAt` timestamp
- Called when user visits strategy page

### Client-Side

**`useGenerationStatus(generationId)` hook**
- Manages polling lifecycle
- Returns `{ status, traceId, error, isPolling }`
- Auto-starts polling when generationId provided
- Stops on complete/failed/unmount

**Entry Points (both must be updated):**
- `InlineChat.tsx` - first-time experience
- `ChatSheet.tsx` - side sheet for returning users
- Share generation logic, don't duplicate

### UI Components

**New:**
- `GenerationStatusIndicator` - Luna logomark with animation states
- shadcn/ui Toast - for completion notification

**Modified:**
- Sidebar strategy slot - show indicator during generation
- Knowledge status bar - show "adding to knowledgebase..." state

## Edge Cases

**Generation fails:**
- Status becomes `failed`, polling stops
- Sidebar shows error state + retry button
- Toast: "Something went wrong. Tap to retry."

**User navigates away mid-generation:**
- Generation continues server-side
- On return: check for pending/complete generation
- If complete but unseen: solid Luna dot indicator
- If pending: resume polling

**User closes browser:**
- Generation completes server-side (`waitUntil`)
- Next visit: strategy waiting, solid Luna dot

**Timeout (>60s):**
- Mark as `failed`
- Show timeout error with retry option

**Multiple concurrent generations:**
- Allowed - each conversation has its own generation
- Each tracked independently

## Implementation Phases

### Phase 1: Archive & Contracts
- Archive current `/api/extract` logic to `/lib/extraction/v1/`
- Archive current `/api/generate` logic to `/lib/generation/v1/`
- Document contracts and behavior for backtesting
- Define `GenerationStatusContract` for new API responses
- Write contract tests

### Phase 2: Schema & API
- Add status, startedAt, viewedAt to GeneratedOutput
- Modify `/api/generate` to fire-and-forget
- Create `/api/generation-status/[id]` polling endpoint
- Create `/api/generation/[id]/viewed` endpoint
- Test against contracts

### Phase 3: UI Components
- Add shadcn/ui toast system
- Create `useGenerationStatus` hook
- Create `GenerationStatusIndicator` with Luna logomark
- Wire up sidebar and knowledge status bar

### Phase 4: Integration
- Update `InlineChat.tsx` for background generation
- Update `ChatSheet.tsx` for background generation
- Ensure shared logic, not duplicated
- End-to-end testing
- Polish animations and transitions

## Archive Policy (New Standard)

**Before modifying core extraction/generation logic:**
1. Move current implementation to versioned folder (`/lib/extraction/v1/`, `/lib/generation/v1/`)
2. Document the contract and behavior
3. New implementation creates v2 or imports from v1
4. Never destroy - enables backtesting and quality comparison

This supports A/B testing prompt changes and comparing output quality over time.

## Future Enhancements

- **Progressive loading:** Stream vision/strategy/objectives as they generate (requires prompt restructuring)
- **Email notification:** For users who leave the site entirely
- **Incremental extraction:** Combine with this for near-zero perceived wait time

## Related

- `docs/in-progress/incremental-extraction.md` - the other half of the UX optimization
- `docs/plans/2026-01-31-extraction-flow-analysis.md` - analysis that led to this work
