# Document Workflow Integration: Interaction Model Uncertainty

**Date:** 2026-01-03
**Status:** Open Questions - Interaction Model Needs Design

---

## The Core Tension

**Your current workflow**: Document upload → Conversation → Clarifying questions → Extraction

**The uncertainty**: Is conversation always necessary? Or should documents support:
- **Mode A**: Document → Direct extraction → User reviews/edits fragments
- **Mode B**: Document → Conversation → Extraction (current)
- **Mode C**: Hybrid - quick review, then optional conversation

**Your instinct**: "It's unlikely people will upload docs and simply accept extracted fragments without interaction."

This is a **product design question**, not just a schema question.

---

## Current Implementation (What Exists)

### Document Upload Flow
1. User uploads PDF/DOCX/TXT/MD
2. **Unstructured.io** extracts text
3. **Creates Conversation** (not Document entity)
4. Stores extracted text as **Message (stepNumber: 0)**
5. Claude generates first question based on document
6. User has **interactive conversation** about document
7. Extraction happens **after conversation** (like normal flow)

### Code
- Component: `src/components/DocumentUpload.tsx`
- API: `src/app/api/upload-document/route.ts`

```typescript
// Current: Document seeds conversation
const conversation = await prisma.conversation.create({
  data: { userId, status: 'in_progress' }
})

await prisma.message.create({
  data: {
    conversationId: conversation.id,
    role: 'assistant',
    content: `Context from uploaded document (${file.name}):\n\n${extractedText}`,
    stepNumber: 0,  // System message with document context
  }
})
```

**This works.** Documents are conversation starters, extraction happens via conversation.

---

## Three Interaction Models to Consider

### Mode A: Conversation-First (Current) ✅

**Flow:**
```
Upload doc → Extract text → Create conversation →
Ask clarifying questions → User responds →
Extraction happens (fragments + synthesis)
```

**Pros:**
- Matches how you work with Claude today
- Clarifies ambiguities before extraction
- User guides what's important
- Enriches document context with conversation

**Cons:**
- Slower (requires interaction before extraction)
- Friction if document is comprehensive
- User might not want to answer questions

**Best for:**
- Incomplete documents (pitch decks, notes)
- Documents that need context (market research without company context)
- Users who want to guide extraction

---

### Mode B: Direct Extraction with Review

**Flow:**
```
Upload doc → Extract text → Auto-extract fragments →
Show fragments to user → User reviews/edits/approves →
Update synthesis
```

**Pros:**
- Fast (no conversation needed)
- Good for comprehensive documents
- User sees extracted themes immediately
- Can still edit/refine

**Cons:**
- **Assumes extraction quality is high**
- No opportunity to clarify before extraction
- User must review fragments (could be many)
- What if extraction misses key points?

**Best for:**
- Complete strategy documents
- Pitch decks with clear structure
- Users who want speed over depth

**The risk**: "Unlikely people will simply accept extracted fragments" — you're skeptical extraction quality will be good enough.

---

### Mode C: Quick Preview + Optional Conversation

**Flow:**
```
Upload doc → Extract text → Show AI summary + key themes →
User chooses:
  - "Looks good, extract it" → Direct extraction
  - "I want to clarify" → Start conversation
  - "Edit themes first" → Edit preview, then extract
```

**Pros:**
- Best of both worlds
- User sees what will be extracted before committing
- Conversation is optional, not forced
- Faster path for good documents

**Cons:**
- More complex UX
- Need to build preview UI
- Partial extraction might be confusing

**Best for:**
- Flexibility (supports both use cases)
- Users who know what they want

---

## The Schema Question

All three modes can work with the same schema. The question is: **do you need Document model NOW?**

### Option 1: Keep Current (Conversation-First)

**Schema changes:**
- ✅ Add `projectId` to Conversation
- ❌ No Document model needed

**Code changes:**
```typescript
// Minimal change to upload-document/route.ts
const project = await getOrCreateDefaultProject(userId)
const conversation = await prisma.conversation.create({
  data: {
    projectId: project.id,  // 👈 Only addition
    userId,
    status: 'in_progress',
  }
})
// Rest stays same
```

**Migration:**
- Phase 1-4: Add Project, Fragment, Synthesis models
- Phase 5: Update conversation creation to include projectId
- Document upload keeps working exactly as today

**When to add Document model**: Later, if you want Mode B or Mode C.

---

### Option 2: Add Document Model (Enables Flexibility)

**Schema changes:**
- ✅ Add `projectId` to Conversation
- ✅ Add Document model
- ✅ Link Conversation → Document (optional)

**Code changes:**
```typescript
// Create Document record
const document = await prisma.document.create({
  data: {
    projectId,
    userId,
    sourceType: 'uploaded_document',
    originalFileName: file.name,
    extractedText,
    status: 'ready',
  }
})

// EITHER: Mode A (conversation)
const conversation = await prisma.conversation.create({
  data: {
    projectId,
    userId,
    status: 'in_progress',
  }
})

await prisma.message.create({
  data: {
    conversationId: conversation.id,
    content: extractedText,
    annotations: JSON.stringify({ documentId: document.id }),  // Link
  }
})

// OR: Mode B (direct extraction)
const fragments = await extractFragmentsDirectly(document)
// No conversation needed
```

**Migration:**
- Phase 1: Add Document model
- Phase 5: Create Document records on upload
- Choose Mode A (conversation) or Mode B (direct) in UI

**Benefits:**
- Supports both interaction modes
- Can switch between modes later
- Better lineage (which fragments came from which document)

**Cost:**
- More entities to manage
- Need to decide interaction model NOW (or build both)

---

## The Unresolved Design Question

**You said**: "It's unlikely people will upload docs and simply accept extracted fragments."

This suggests:
1. **Extraction quality won't be perfect** (needs human review)
2. **Interaction is necessary** (but what kind?)
3. **Conversation might be heavy** (but direct extraction might be insufficient)

**The question**: What's the RIGHT interaction model for documents?

### Hypothesis 1: Preview + Edit Model

User uploads doc → AI extracts themes → User sees preview:
```
┌─────────────────────────────────────┐
│ Extracted from "Strategy Doc.pdf"  │
├─────────────────────────────────────┤
│ Customer & Market:                  │
│ • Enterprise SaaS companies         │
│ • Struggle with data integration    │
│                                     │
│ Value Proposition:                  │
│ • Real-time data synchronization    │
│ • No-code integration platform      │
│                                     │
│ [Edit these themes] [Ask questions] │
│ [Extract to my strategy]            │
└─────────────────────────────────────┘
```

User can:
- Edit themes inline (fix extraction errors)
- Ask questions (clarify ambiguities)
- Approve and extract

**This requires**: Preview UI + ability to edit before extraction

---

### Hypothesis 2: Conversation with Document Context

Current model, but make it feel lighter:
- Don't ask 5-10 questions
- Ask 1-2 targeted questions
- Then extract

**This requires**: Tuning question generation to be brief

---

### Hypothesis 3: Assisted Review

After extraction, show fragments to user:
```
┌─────────────────────────────────────┐
│ I extracted 15 themes from your doc │
│                                     │
│ ✓ Customer segment (confidence: HIGH)│
│ ⚠ Value prop (needs clarification)  │
│ ✓ Pricing model (confidence: HIGH)  │
│                                     │
│ [Review flagged items] [Looks good] │
└─────────────────────────────────────┘
```

Only ask about **low-confidence** extractions.

**This requires**: Confidence scoring + selective questioning

---

## Recommendation: Defer Document Model, Prototype Interaction

### Short-term (This Week)
1. ✅ **Keep current conversation-first model**
2. ✅ **Add projectId to conversations** (minimal migration)
3. ✅ **Defer Document model** until interaction model is clear
4. ✅ **Test current doc upload flow** with new schema

### Medium-term (Next 2 Weeks)
5. 🧪 **Prototype Mode C** (preview + optional conversation)
   - After upload, show extracted themes
   - User chooses: "Start conversation" or "Extract now"
6. 🧪 **Test with real users** - do they want conversation or direct extraction?
7. 📊 **Track conversion**: Upload → Conversation started vs. Upload → Direct extract

### Based on Learning
8. **If conversation is always needed**: Keep current model, improve question quality
9. **If direct extraction works**: Add Document model, build Mode B
10. **If both are needed**: Build Mode C (hybrid)

---

## What the Schema Enables (Regardless of Interaction Model)

The V1 schema supports ALL three modes:

**Mode A (Conversation):**
```
Document upload → Conversation (with projectId) →
Extraction (creates Fragments) → Synthesis
```

**Mode B (Direct):**
```
Document upload → Document record →
Direct extraction (creates Fragments) → Synthesis
```

**Mode C (Hybrid):**
```
Document upload → Document record →
Preview extraction → User choice:
  → Conversation OR Direct extraction
```

**The schema doesn't force an interaction model.** It's flexible.

---

## Decision Framework

**Add Document model NOW if:**
- ✅ You want to prototype Mode B or C soon
- ✅ You want voice memo support (transcriptions need Document model)
- ✅ You want better lineage (track which doc → which fragments)

**Defer Document model if:**
- ✅ Current conversation-first model is working
- ✅ You want to learn more about user preferences first
- ✅ You want to minimize migration complexity

**My recommendation**: **Defer Document model** for now. Reasons:
1. Current doc upload works (conversation-first)
2. Interaction model is uncertain (need to prototype)
3. Simpler migration (one less table in Phase 1)
4. Can add Document later when:
   - Voice memo feature is built
   - Interaction model is validated
   - Direct extraction quality is proven

---

## Updated Migration Plan (Without Document Model)

### Phase 1: Add Core Tables
- ✅ Project
- ✅ Fragment
- ✅ FragmentDimensionTag
- ✅ DimensionalSynthesis
- ✅ GeneratedOutput
- ✅ ExtractionRun
- ❌ ~~Document~~ (deferred)

### Phase 5: Update Document Upload
```typescript
// src/app/api/upload-document/route.ts

// Only change needed:
const project = await getOrCreateDefaultProject(userId)

const conversation = await prisma.conversation.create({
  data: {
    projectId: project.id,  // 👈 Add this line
    userId,
    status: 'in_progress',
  }
})

// Rest of code stays exactly the same
```

**Impact**: Minimal. Document uploads create conversations in projects instead of for users.

---

## Guest User Support

```typescript
async function getOrCreateDefaultProject(userId: string | null) {
  if (!userId) {
    // Guest user - create/reuse anonymous project
    // Option: Store session ID in cookie, create project per session
    const sessionId = getSessionId()  // From cookie

    let project = await prisma.project.findFirst({
      where: {
        userId: null,
        name: `guest-${sessionId}`,
      }
    })

    if (!project) {
      project = await prisma.project.create({
        data: {
          userId: null,
          name: `guest-${sessionId}`,
          description: 'Guest session',
        }
      })
    }

    return project
  }

  // Authenticated user - default project
  let project = await prisma.project.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        userId,
        name: 'My Strategy',
      }
    })
  }

  return project
}
```

---

## Summary

**Current state:**
- ✅ Document upload creates conversations with extracted text as context
- ✅ Works well for conversation-first interaction model

**V1 schema integration:**
- ✅ Add `projectId` to Conversation (minimal change)
- ⏸️ Defer Document model (not needed yet)
- ✅ Document upload keeps working exactly as today

**Open question:**
- ❓ Should documents always require conversation?
- ❓ Or support direct extraction with review?
- ❓ Or hybrid (preview + choose)?

**Recommendation:**
1. Keep conversation-first model (current)
2. Add projectId to conversations (migration)
3. Prototype alternative interaction models
4. Add Document model later if needed

**The schema is ready for any interaction model you choose.**

---

## Next Actions

1. ✅ Review this document
2. ✅ Decide: Keep current conversation-first model?
3. ✅ Update `proposed-schema-v1.prisma` (remove Document for now, or keep for future)
4. ✅ Proceed with migration Phases 1-4
5. 🧪 Prototype alternative interaction models (optional)
6. 📊 Gather user feedback on interaction preferences

**Bottom line**: Document workflow uncertainty doesn't block schema migration. You can migrate now, experiment with interaction models later.
