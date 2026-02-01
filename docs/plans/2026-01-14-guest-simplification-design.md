# Guest Flow Simplification Design

**Goal:** Remove guest-to-auth data migration complexity. Pre-load demo project for guests instead of letting them build their own data. Clean slate on signup.

**Architecture:** Guest users get demo project hydrated on creation. API call limit prevents abuse. On signup, cascade delete guest data and start fresh.

**Tech Stack:** Prisma cascade deletes, existing fixture system, shadcn Popover

---

## Current vs New Flow

### Current Flow (Complex)
1. Unauthenticated user lands → sees IntroCard
2. Clicks "Start" → guest user created → empty "Guest Strategy" project
3. User builds their own content through conversations
4. Signs up → complex data migration (`transferGuestSession`) to authenticated account
5. Guest user orphaned or cleaned up

### New Flow (Simple)
1. Unauthenticated user lands → guest user created → demo project hydrated (BuildFlow)
2. User explores/interacts with pre-populated demo
3. Signs up → guest user cascade deleted → lands in empty state
4. User creates their own project (or one auto-creates on first conversation)

**Key insight:** Pre-hydrated demo is better than user-built guest data because:
- Shows value immediately with zero effort
- No need to migrate imaginary company data
- Demo can be restored anytime via existing "Restore Demo" action

---

## UI Changes

### New: DemoModeBadge Component

Location: Top of sidebar (in `AppSidebar`)

```tsx
// Discrete badge with popover
<Popover>
  <PopoverTrigger>
    <Badge variant="outline">Demo Mode</Badge>
  </PopoverTrigger>
  <PopoverContent>
    <p>You're exploring a demo project.</p>
    <p>Create an account to build your own strategy.</p>
    <Button onClick={signIn}>Create Account</Button>
  </PopoverContent>
</Popover>
```

### Remove

- `src/components/RegistrationBanner.tsx` - Replaced by sidebar badge
- `IntroCard` for guests in `HomePage.tsx` - Guests go straight to demo project

### Simplify

- `SessionTransferProvider.tsx` - Just deletes guest user now (one line)
- `HomePage.tsx` - Remove guest-specific logic, registration banner state

---

## Data & API Changes

### Schema Change

```prisma
model User {
  // ... existing fields
  apiCallCount Int @default(0)  // NEW: Track API calls for guests
}
```

### Guest User Creation

In `getOrCreateDefaultProject()` when `userId` is null:

```typescript
// Current: Creates empty "Guest Strategy" project
// New: Hydrate demo project
const guestUser = await createGuestUser();
await seedDemoProject(guestUser.id);  // Uses demo-extended fixture
```

### API Call Limiting

Routes that increment counter (user-initiated Claude API calls):
- `/api/conversation/continue` - Conversation turns
- `/api/extract` - Extraction
- `/api/generate` - Strategy generation
- `/api/documents/process` - Document processing

Pattern:
```typescript
// At start of API route
if (isGuestUser(user.email) && user.apiCallCount >= 20) {
  return NextResponse.json({ error: 'limit_reached' }, { status: 429 });
}

// ... do work ...

// At end (only for guests)
if (isGuestUser(user.email)) {
  await prisma.user.update({
    where: { id: userId },
    data: { apiCallCount: { increment: 1 } }
  });
}
```

### At Limit Behavior

- Return 429 with `{ error: 'limit_reached' }`
- UI shows toast: "You've explored the demo fully. Sign up to continue."
- User can still navigate and view existing data
- No hard block on browsing

### On Signup

Replace `transferGuestSession` logic:

```typescript
// Old: Complex data migration
// New: Simple cascade delete
await prisma.user.delete({ where: { id: guestUserId } });
// Cascade handles: Project → Fragments, Documents, DeepDives, Conversations → Messages, Traces, etc.
```

---

## Code Cleanup

### Files to Delete
- `src/lib/transferSession.ts` - No longer needed

### Files to Simplify
- `src/components/providers/SessionTransferProvider.tsx` - Just delete guest user
- `src/components/HomePage.tsx` - Remove guest flow, IntroCard for guests, registration banner
- `src/lib/projects.ts` - `getOrCreateDefaultProject` calls `seedDemoProject` for guests

### New Files
- `src/components/DemoModeBadge.tsx` - Sidebar badge with popover

---

## Testing

### Contract Updates
- Add `apiCallCount: number` to `UserContract`
- Update `user-contracts.test.ts` to validate new field

### New Test
- API limit check test: verify 429 returned when `apiCallCount >= 20` for guest

### Existing Tests
- Smoke tests unchanged (critical paths still same)
- Fixture validation unchanged

---

## Migration Notes

### Schema Migration
```bash
npx prisma db push  # Adds apiCallCount with default 0
```

Safe migration - new field with default, no data transformation.

### Deployment Order
1. Deploy schema change (preview first)
2. Deploy code changes
3. Verify on preview
4. Deploy to production

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Guest with 19 calls signs up | Fine - gets fresh account |
| Guest hits limit, clears cookies | Gets new guest user, new 20 calls (acceptable) |
| Existing authenticated users | `apiCallCount` stays 0, never checked |
| Guest tries API after limit | 429 error, toast prompt to sign up |

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Guest onboarding | Build own content | Explore demo |
| Data on signup | Complex migration | Cascade delete |
| Abuse prevention | None | 20 API call limit |
| Code complexity | High (transfer logic) | Low (delete + hydrate) |
| UX | Friction at signup | Clean slate, restore demo available |
