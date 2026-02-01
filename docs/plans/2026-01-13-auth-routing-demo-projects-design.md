# Auth Routing & Demo Projects Design

**Date:** 2026-01-13
**Status:** Approved
**Scope:** Demo project seeding, project limits/paywall, auth routing refactor, project management

## Problem

The homepage has a ~1 second delay for authenticated users where:
1. Page renders as guest view
2. `useSession()` loads (loading state)
3. `/api/projects` fetches
4. Redirect fires

Users can click during this window, then get confused when the page abruptly changes.

## Solution Overview

1. Seed demo projects on account creation for immediate value
2. Refactor homepage to hybrid server/client architecture (no flash)
3. Add universal paywall infrastructure for future monetization
4. Enable project creation/deletion with appropriate limits

## Architecture Decision: Hybrid Server/Client

**Decision:** Use server component wrapper with client component children for auth-gated pages.

**Rationale:** The homepage has significant client-side state (conversation flow, extraction, etc.). Pure server rendering would require major refactor. Pure client with skeleton still shows wrong content briefly.

**Trade-off accepted:** Stateful client-side app is not optimized, but enables fast iteration during validation phase. Optimization comes after product-market fit.

**Pattern:**
```typescript
// page.tsx (server)
export default async function Page() {
  const session = await getServerSession(authOptions)
  return <HomePage session={session} />
}

// HomePage.tsx (client)
'use client'
export function HomePage({ session }: { session: Session | null }) {
  // No useSession() loading state - session is already resolved
}
```

## Data Model Changes

```prisma
model Project {
  // ... existing fields
  isDemo     Boolean  @default(false)
}

model User {
  // ... existing fields
  isPaid     Boolean  @default(false)
}
```

**Implementation note:** Lead with contract definition and integration tests before schema migration.

## Demo Project Seeding

**Trigger:** NextAuth `events.createUser` callback

**Flow:**
1. User signs up via magic link
2. NextAuth creates User record
3. `createUser` event fires
4. `seedDemoProject(userId)` hydrates `demo-simulated.json` fixture
5. Project created with `isDemo: true`, name "Demo: Catalyst Strategy"

**Failure handling:** Log error, don't block account creation.

```typescript
// src/lib/auth.ts
events: {
  createUser: async ({ user }) => {
    await seedDemoProject(user.id).catch(err =>
      console.error('Failed to seed demo project:', err)
    )
  }
}
```

## Universal Paywall API

**Endpoint:** `POST /api/paywall/prompt`

**Request:**
```typescript
{
  feature: string       // e.g., "create_project"
  context?: object      // Optional metadata
}
```

**Response:**
```typescript
{
  blocked: boolean
  modal: {
    title: string
    message: string
    ctaLabel: string
    ctaUrl: string      // Points to lunastak.io/pricing
  }
}
```

**Behavior:**
- Checks `user.isPaid`
- Logs upgrade intent event if blocked
- Returns modal content (hardcoded for now)

**Client hook:** `usePaywall()` with `triggerPaywall(feature)` function and `<PaywallModal />` component.

## Project Limits

| User Type | Demo Project | User Projects |
|-----------|--------------|---------------|
| Free | 1 (seeded) | 1 max |
| Paid | 1 (seeded) | Unlimited |

- Demo project doesn't count toward limit
- Demo can be deleted and restored
- Paywall triggers when free user tries to create second project

## Homepage Routing

**File structure:**
```
src/app/page.tsx              → Server component (auth check)
src/components/HomePage.tsx   → Client component (existing logic)
```

**Behavior by auth state:**

| State | Content |
|-------|---------|
| Guest | IntroCard with "Start Guided Conversation" |
| Authenticated | Auth-aware CTAs: "Explore Demo Project" / "Go to My Strategy" |

**Removed:** The `useEffect` redirect to `/project/{id}`. Users choose where to go.

## Project Management APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/projects` | Create | New project (paywall if limit reached) |
| `DELETE /api/projects/[id]` | Delete | Hard delete with cascade |
| `POST /api/projects/restore-demo` | Create | Re-seed demo for user |

**Delete cascade:** conversations, messages, traces, fragments, dimension tags, deep dives, documents, synthesis records.

**Empty state:** When user has no projects, show CTAs for "Create My Strategy" and "Restore Demo Project".

## Implementation Order

1. Contracts & tests for new schema fields
2. Schema migration (`isDemo`, `isPaid`)
3. `seedDemoProject()` function (reuses hydrate logic)
4. Auth `createUser` hook
5. Paywall API + hook + modal
6. Project CRUD APIs
7. Homepage server/client refactor
8. Empty state UI
9. Project context menu (delete, rename)

## Out of Scope

- Stripe integration (deferred to marketing site)
- User tiers beyond paid/free boolean
- Project versioning/recovery
- Rename project UI (nice-to-have via context menu)
