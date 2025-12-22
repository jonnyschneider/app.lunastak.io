# Cold Start Solution: Entry Point Options

**Date:** 2025-12-21
**Status:** Design Complete, Ready for Implementation
**Purpose:** Address cold start problem with multiple entry points for different user preferences

---

## Problem Statement

Current cold start experience is off-putting:
- Users see blank chat input and don't know what to say
- Unclear what depth/format is expected
- No context for what they'll get out of the tool
- Single entry point doesn't accommodate different user preferences

This affects conversion and first-response quality. We need multiple on-ramps to reduce friction.

---

## Solution Overview

Replace single "Start" button with 4 entry point options:

1. **Guided Conversation** - Current baseline flow (real feature)
2. **Upload Document** - Extract from existing docs, then clarifying questions (real feature)
3. **Decision Stack Canvas** - Blank template to fill in (fake door)
4. **Fast Track** - Quick multiple choice with targeted follow-ups (fake door)

**Philosophy:** Build just enough to measure and learn. Use fake doors where uncertain about demand.

---

## Design Details

### Overall Flow

**Current:**
```
Landing → IntroCard → [Click Start] → ChatInterface (blank)
```

**New:**
```
Landing → IntroCard → EntryPointSelector (4 options) → Selected Flow
```

### Entry Point Cards

**UI Implementation:**
- shadcn Card component in outline variant
- Vertical stack with spacing
- Greyscale aesthetic (consistent with current design)
- Icons from @heroicons/react
- Full width on mobile, constrained on desktop

**Card Structure:**
```tsx
<Card variant="outline" className="cursor-pointer hover:border-zinc-400">
  <CardContent className="flex items-start gap-4 p-4">
    <Icon className="w-6 h-6 text-zinc-600" />
    <div>
      <h3 className="font-medium text-zinc-900">{title}</h3>
      <p className="text-sm text-zinc-600">{description}</p>
    </div>
  </CardContent>
</Card>
```

### Option 1: Guided Conversation

- **Icon:** ChatBubbleIcon
- **Title:** "Guided Conversation"
- **Description:** "Answer a few questions to help us understand your business"
- **Action:** Starts existing adaptive 3-10 question flow
- **Implementation:** No changes needed, just wire up click handler

### Option 2: Upload Document (NEW)

- **Icon:** DocumentIcon
- **Title:** "Upload Document"
- **Description:** "Start with an existing strategy doc or business plan"
- **Action:** Shows document upload interface

**File Upload UI:**
- shadcn Dropzone component
- Accepts: PDF, DOCX, DOC, TXT, MD
- Max file size: 10MB
- Drag-and-drop with click-to-browse fallback
- Client-side validation via Dropzone

**Processing Flow:**
1. User drops/selects file
2. Show loading: "Extracting content from {filename}..."
3. Upload to `/api/upload-document`
4. API extracts text using unstructured.io
5. API generates summary using Claude
6. Return summary to frontend
7. Show: "We've read your document: {summary}"
8. Continue → adaptive conversation flow with document context

**Error Handling:**
- Invalid file type/size: Dropzone shows inline error
- Extraction fails: "We couldn't read that file. Please try another file."
- Retry button returns to upload UI

### Option 3: Decision Stack Canvas (FAKE DOOR)

- **Icon:** GridIcon
- **Title:** "Start from Canvas"
- **Description:** "Build your strategy using a blank Decision Stack template"
- **Action:** Shows alert dialog explaining feature, logs interest event

### Option 4: Fast Track (FAKE DOOR)

- **Icon:** BoltIcon
- **Title:** "Fast Track"
- **Description:** "Quick multiple choice questions with targeted follow-ups"
- **Action:** Shows alert dialog explaining feature, logs interest event

---

## Fake Door Implementation

**Refactor from system alerts to shadcn AlertDialog:**

Replace all system `alert()` and `confirm()` calls with consistent AlertDialog component.

**AlertDialog Structure:**
```tsx
<AlertDialog open={showFakeDoor} onOpenChange={setShowFakeDoor}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{Feature Name} - Coming Soon</AlertDialogTitle>
      <AlertDialogDescription>
        {Feature description and why it would be useful}
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
```

**Behavior:**
- "I'm Interested" → logs event → closes dialog
- "Maybe Later" → just closes dialog
- Both stay on current page
- Events logged to Event model with type `fake_door_click`

**Scope:**
- Create reusable `<FakeDoorDialog>` component
- Use for Options 3 & 4
- Replace existing fake doors (edit buttons on StrategyDisplay)

---

## Backend Implementation

### New API Endpoint: `/api/upload-document`

```typescript
POST /api/upload-document
Content-Type: multipart/form-data

Request: FormData with file

Response: {
  success: true,
  summary: string,           // Brief summary from Claude
  extractedText: string,     // Full text from unstructured.io
  conversationId: string     // New conversation with document context
}
```

**Processing Steps:**

1. Receive file (Next.js handles multipart/form-data)
2. Extract text using unstructured.io API
3. Summarize with Claude: "Briefly summarize this business document in 1-2 sentences. Focus on what business/product it's about."
4. Create conversation with document context
5. Return summary and conversationId

**Unstructured.io Integration:**
- Install: `npm install unstructured-client`
- Environment variable: `UNSTRUCTURED_API_KEY`
- Handles complex layouts, tables, multi-column
- Process in-memory, no file storage
- File discarded after extraction

### Modified API Endpoint: `/api/conversation/start`

Add optional parameter for document context:

```typescript
POST /api/conversation/start
{
  userId: string,
  experimentVariant: string,
  documentContext?: {
    extractedText: string,
    filename: string
  }
}
```

**Conversation Initialization with Document:**

Add document as system message:
```typescript
messages = [
  {
    role: 'system',
    content: `Context from uploaded document (${filename}):

    ${extractedText}

    Use this as background context. Ask clarifying questions to fill gaps
    and deepen understanding. Don't rehash what's already clear from the document.`
  },
  ...conversationHistory
]
```

**First Question Generation:**
- Claude reads document context
- Asks targeted question based on gaps/unclear areas
- More specific than generic opening question

**Adaptive Flow:**
- Same 3-10 question range
- Same confidence scoring
- Document provides better starting context
- May reach high confidence faster

---

## Implementation Scope

### New Components

1. **EntryPointSelector.tsx**
   - 4 option cards
   - Click handlers for each option
   - Replaces Start button in IntroCard

2. **FakeDoorDialog.tsx**
   - Reusable alert dialog
   - Configurable title, description, feature name
   - Logs interest events

3. **DocumentUpload.tsx**
   - shadcn Dropzone integration
   - File validation (type, size)
   - Upload progress state
   - Error handling

4. **DocumentSummary.tsx**
   - Shows extraction summary
   - Continue button to start conversation
   - Retry option if needed

### Modified Components

1. **IntroCard.tsx**
   - Remove Start button
   - Add EntryPointSelector

2. **page.tsx**
   - Handle new flow states: 'upload', 'document-summary'
   - Wire up entry point selection
   - Pass document context to conversation

3. **StrategyDisplay.tsx**
   - Replace system alerts with FakeDoorDialog

### New API Routes

1. `/api/upload-document`
   - File upload handling
   - Unstructured.io extraction
   - Claude summarization
   - Conversation creation

### Modified API Routes

1. `/api/conversation/start`
   - Accept optional documentContext
   - Add system message with document text

### Dependencies

```json
{
  "unstructured-client": "^latest"
}
```

Shadcn components (install if not present):
- Dropzone
- AlertDialog

### Environment Variables

```bash
UNSTRUCTURED_API_KEY=your_key_here
```

---

## Event Tracking

New events to log:

1. **entry_point_selected**
   - eventType: 'entry_point_selected'
   - eventData: { option: 'guided' | 'document' | 'canvas' | 'fast-track' }

2. **document_uploaded**
   - eventType: 'document_uploaded'
   - eventData: { fileType: string, fileSize: number }

Existing events to reuse:

3. **fake_door_click**
   - eventType: 'fake_door_click'
   - eventData: { feature: 'canvas' | 'fast-track' | 'edit-vision' | etc. }

---

## Feature Backlog (Not This Session)

### Privacy & Legal
1. Privacy Policy outlining PII handling
2. Terms of Use with indemnification clauses
3. Content moderation considerations for uploads

### UX Enhancements
4. Remember uploaded filename for user reference
5. Show filename in conversation context

### Voice Memos (Future Major Feature)
6. **Voice Memo Guided Capture**
   - Serial question prompts (3-5 questions or 10min total)
   - Skip functionality, stop when done
   - Full-screen minimal UI for focus
   - Questions pulled from collection (varied experience)
   - Optional: Upload recording at end OR save placeholder with metadata
   - Metadata tracks which questions were asked
   - Voice-to-text extraction (Whisper API, Deepgram, etc.)
   - Async processing (not realtime conversation)
   - Mobile-first consideration (record on phone, upload later option)

---

## Success Metrics

**Measure:**
- Entry point selection distribution (which option users choose)
- Fake door interest clicks (demand validation for Canvas & Fast Track)
- Document upload success rate
- Conversation quality with vs. without document context
- Completion rates by entry point

**Compare:**
- Baseline conversation flow vs. document-assisted flow
- Quality ratings across entry points
- User feedback (helpful %) by entry point

---

## Notes

- This is baseline infrastructure, not experiment-specific
- All experiments can use these entry points
- Document upload is hypothesis-neutral (just better starting context)
- Fake doors validate demand before committing to UI/features
- Greyscale aesthetic maintained throughout
- Mobile-responsive design required

---

**Next Steps:**
1. Create git worktree for isolated development
2. Write detailed implementation plan
3. Execute with TDD approach
4. Test across entry points
5. Deploy to development branch
