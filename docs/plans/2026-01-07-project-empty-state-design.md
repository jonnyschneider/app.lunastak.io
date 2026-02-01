# Project Empty State Design

**Goal:** Give cold authenticated users a clear, focused entry point instead of a blank Project View.

**Architecture:** Add empty state component to Project View. Authenticated users always land on Project View - when empty, show 2 CTAs; when populated, show normal view.

---

## User Flows

**Unauthenticated users:** Current homepage experience (IntroCard, guided conversation, doc/canvas gated behind sign-in).

**Authenticated users:** Always redirect to `/project/[id]`
- If empty → show `ProjectEmptyState` with 2 CTAs
- If has content → normal Project View

---

## Components

### ProjectEmptyState

Displays when project has no fragments AND no conversations.

**Content:**
- Headline: "Let's build your strategy"
- Subtext explaining the two paths
- Two cards side-by-side:
  - **Start a Conversation** → navigates to `/?projectId={id}`
  - **Upload a Document** → opens `DocumentUploadDialog`

**Detection logic:**
```typescript
if (fragments.length === 0 && conversations.length === 0) {
  return <ProjectEmptyState ... />
}
```

---

## Sidebar Consistency

Fix sidebar header buttons to use same routes as empty state:

- **New Chat** → `/?projectId={id}` (start conversation linked to project)
- **Upload** → opens `DocumentUploadDialog`

Empty state CTAs and sidebar buttons share handlers.

---

## Cleanup

With authenticated users never seeing homepage:

1. Remove `isAuthenticated` prop from `EntryPointSelector`
2. Remove `isAuthenticated` prop from `IntroCard`
3. Remove auth-conditional logic from `EntryPointSelector`
4. Keep `SignInGateDialog` (still used for guest gating)

Homepage becomes purely a guest experience.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Signs in mid-conversation | Lands on Project View with content (session transfer) |
| Has documents only | `fragments.length > 0` → normal view |
| Has conversations only | `conversations.length > 0` → normal view |

---

## Implementation Tasks

1. Create `ProjectEmptyState` component
2. Add conditional render in `/project/[id]/page.tsx`
3. Fix sidebar "New Chat" button route
4. Verify sidebar "Upload" button opens dialog
5. Remove `isAuthenticated` prop threading from homepage

## Not Changing

- Homepage guest experience
- Redirect logic (authenticated → Project View)
- Document upload dialog
- Conversation flow
