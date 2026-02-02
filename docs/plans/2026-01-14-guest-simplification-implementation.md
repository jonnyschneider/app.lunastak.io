# Guest Flow Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace complex guest-to-auth data migration with demo project hydration and cascade delete on signup.

**Architecture:** Add `apiCallCount` to User schema for rate limiting guests. Modify guest creation to hydrate demo project. Replace transfer logic with cascade delete. Add DemoModeBadge UI component.

**Tech Stack:** Prisma, Next.js, shadcn/ui (Popover, Badge), Jest

---

### Task 1: Update User Contract and Schema

**Files:**
- Modify: `src/lib/contracts/user.ts`
- Modify: `src/lib/__tests__/contracts/user-contracts.test.ts`
- Modify: `prisma/schema.prisma`

**Step 1: Update UserContract to include apiCallCount**

```typescript
// src/lib/contracts/user.ts - add to UserContract interface and schema
apiCallCount: z.number().int().min(0).default(0),
```

Add `apiCallCount` field to the zod schema and interface.

**Step 2: Run contract tests to see them fail**

Run: `npm test -- --testPathPattern=user-contracts`
Expected: FAIL (apiCallCount not in test fixtures)

**Step 3: Update user contract tests**

```typescript
// src/lib/__tests__/contracts/user-contracts.test.ts
const validUser: UserContract = {
  id: 'user_abc123',
  email: 'test@example.com',
  isPaid: false,
  apiCallCount: 0,  // Add this
};

// Add new test
it('should validate user with apiCallCount', () => {
  const userWithCalls = { ...validUser, apiCallCount: 15 };
  expect(validateUser(userWithCalls)).toBe(true);
});

it('should reject user with negative apiCallCount', () => {
  const invalid = { ...validUser, apiCallCount: -1 };
  expect(validateUser(invalid)).toBe(false);
});
```

**Step 4: Run contract tests to verify pass**

Run: `npm test -- --testPathPattern=user-contracts`
Expected: PASS

**Step 5: Update Prisma schema**

```prisma
// prisma/schema.prisma - in User model, after isPaid
apiCallCount Int @default(0)
```

**Step 6: Generate Prisma client**

Run: `npx prisma generate`
Expected: Success

**Step 7: Push schema to dev database**

Run: `npx prisma db push`
Expected: Success (adds column with default 0)

**Step 8: Commit**

```bash
git add src/lib/contracts/user.ts src/lib/__tests__/contracts/user-contracts.test.ts prisma/schema.prisma
git commit -m "feat: add apiCallCount to User schema and contract"
```

---

### Task 2: Add API Limit Check Test

**Files:**
- Create: `src/lib/__tests__/api-limit.test.ts`
- Modify: `src/lib/projects.ts` (if needed for helper)

**Step 1: Write the API limit check test**

```typescript
// src/lib/__tests__/api-limit.test.ts
import { isGuestUser } from '@/lib/projects';

describe('API Limit Check', () => {
  describe('isGuestUser', () => {
    it('should return true for guest email', () => {
      expect(isGuestUser('guest_abc123@guest.lunastak.io')).toBe(true);
    });

    it('should return false for regular email', () => {
      expect(isGuestUser('user@example.com')).toBe(false);
    });
  });

  describe('API limit logic', () => {
    const API_LIMIT = 20;

    it('should allow calls under limit', () => {
      const user = { email: 'guest_abc@guest.lunastak.io', apiCallCount: 19 };
      const isBlocked = isGuestUser(user.email) && user.apiCallCount >= API_LIMIT;
      expect(isBlocked).toBe(false);
    });

    it('should block calls at limit', () => {
      const user = { email: 'guest_abc@guest.lunastak.io', apiCallCount: 20 };
      const isBlocked = isGuestUser(user.email) && user.apiCallCount >= API_LIMIT;
      expect(isBlocked).toBe(true);
    });

    it('should not limit authenticated users', () => {
      const user = { email: 'user@example.com', apiCallCount: 100 };
      const isBlocked = isGuestUser(user.email) && user.apiCallCount >= API_LIMIT;
      expect(isBlocked).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --testPathPattern=api-limit`
Expected: PASS (logic is simple, no implementation needed)

**Step 3: Commit**

```bash
git add src/lib/__tests__/api-limit.test.ts
git commit -m "test: add API limit check tests"
```

---

### Task 3: Create DemoModeBadge Component

**Files:**
- Create: `src/components/DemoModeBadge.tsx`

**Step 1: Create the DemoModeBadge component**

```typescript
// src/components/DemoModeBadge.tsx
'use client';

import { signIn } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function DemoModeBadge() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-accent"
        >
          Demo Mode
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You're exploring a demo project. Create an account to build your own strategy.
          </p>
          <Button
            onClick={() => signIn()}
            className="w-full"
            size="sm"
          >
            Create Account
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/DemoModeBadge.tsx
git commit -m "feat: add DemoModeBadge component"
```

---

### Task 4: Integrate DemoModeBadge into Sidebar

**Files:**
- Modify: `src/components/layout/app-layout.tsx`

**Step 1: Import and add DemoModeBadge to AppSidebar**

In `src/components/layout/app-layout.tsx`:

1. Add import at top:
```typescript
import { DemoModeBadge } from '@/components/DemoModeBadge';
```

2. Find the SidebarHeader section and add DemoModeBadge for unauthenticated users:
```typescript
// Inside SidebarHeader, after the project combobox or logo
{!session && <DemoModeBadge />}
```

**Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "feat: show DemoModeBadge for unauthenticated users"
```

---

### Task 5: Modify Guest Creation to Hydrate Demo

**Files:**
- Modify: `src/lib/projects.ts`

**Step 1: Update getOrCreateDefaultProject to hydrate demo for guests**

In `src/lib/projects.ts`, modify the guest user creation block:

```typescript
import { seedDemoProject } from '@/lib/seed-demo';

// In getOrCreateDefaultProject, replace the guest project creation:
if (!userId) {
  // Create guest user
  const guestUser = await createGuestUser();

  // Hydrate demo project instead of creating empty project
  const projectId = await seedDemoProject(guestUser.id);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });

  return {
    userId: guestUser.id,
    project,
    isGuest: true,
  };
}
```

Remove the old code that creates an empty "Guest Strategy" project and initializes synthesis records (seedDemoProject handles this).

**Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS

**Step 3: Run tests**

Run: `npm test -- --testPathPattern=projects`
Expected: May need to update mocks - fix any failures

**Step 4: Commit**

```bash
git add src/lib/projects.ts
git commit -m "feat: hydrate demo project for guest users"
```

---

### Task 6: Add API Call Limiting to Routes

**Files:**
- Modify: `src/app/api/conversation/continue/route.ts`
- Modify: `src/app/api/extract/route.ts`
- Modify: `src/app/api/generate/route.ts`

**Step 1: Create a helper for API limit checking**

Add to `src/lib/projects.ts`:

```typescript
export const GUEST_API_LIMIT = 20;

export async function checkAndIncrementGuestApiCalls(userId: string): Promise<{ blocked: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, apiCallCount: true },
  });

  if (!user) return { blocked: false };
  if (!isGuestUser(user.email)) return { blocked: false };

  if (user.apiCallCount >= GUEST_API_LIMIT) {
    return { blocked: true };
  }

  // Increment counter
  await prisma.user.update({
    where: { id: userId },
    data: { apiCallCount: { increment: 1 } },
  });

  return { blocked: false };
}
```

**Step 2: Add limit check to conversation/continue route**

In `src/app/api/conversation/continue/route.ts`, after getting userId:

```typescript
import { checkAndIncrementGuestApiCalls } from '@/lib/projects';

// Early in the handler, after determining userId:
const { blocked } = await checkAndIncrementGuestApiCalls(userId);
if (blocked) {
  return NextResponse.json(
    { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
    { status: 429 }
  );
}
```

**Step 3: Add limit check to extract route**

Same pattern in `src/app/api/extract/route.ts`.

**Step 4: Add limit check to generate route**

Same pattern in `src/app/api/generate/route.ts`.

**Step 5: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/projects.ts src/app/api/conversation/continue/route.ts src/app/api/extract/route.ts src/app/api/generate/route.ts
git commit -m "feat: add API call limiting for guest users"
```

---

### Task 7: Replace Transfer Logic with Cascade Delete

**Files:**
- Modify: `src/components/providers/SessionTransferProvider.tsx`
- Modify: `src/app/api/transfer-session/route.ts`
- Delete: `src/lib/transferSession.ts`

**Step 1: Simplify the transfer-session API route**

Replace contents of `src/app/api/transfer-session/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGuestUser } from '@/lib/projects';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guestUserId } = await req.json();
    if (!guestUserId) {
      return NextResponse.json({ error: 'Missing guestUserId' }, { status: 400 });
    }

    // Verify it's actually a guest user
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserId },
      select: { email: true },
    });

    if (!guestUser || !isGuestUser(guestUser.email)) {
      return NextResponse.json({ error: 'Invalid guest user' }, { status: 400 });
    }

    // Cascade delete the guest user and all their data
    await prisma.user.delete({
      where: { id: guestUserId },
    });

    console.log(`[Transfer] Deleted guest user ${guestUserId} on signup`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Transfer session error:', error);
    return NextResponse.json({ error: 'Failed to process signup' }, { status: 500 });
  }
}
```

**Step 2: Delete the old transferSession.ts file**

```bash
rm src/lib/transferSession.ts
```

**Step 3: Update SessionTransferProvider (if any imports need fixing)**

Check `src/components/providers/SessionTransferProvider.tsx` - it should still work since it just calls the API route. No changes needed if it doesn't import transferSession.ts directly.

**Step 4: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/transfer-session/route.ts
git rm src/lib/transferSession.ts
git commit -m "refactor: replace guest transfer with cascade delete"
```

---

### Task 8: Simplify HomePage (Remove Guest-Specific UI)

**Files:**
- Modify: `src/components/HomePage.tsx`

**Step 1: Remove RegistrationBanner import and usage**

In `src/components/HomePage.tsx`:

1. Remove import:
```typescript
// DELETE: import { RegistrationBanner } from '@/components/RegistrationBanner';
```

2. Remove state:
```typescript
// DELETE: const [showRegistrationBanner, setShowRegistrationBanner] = useState(false);
```

3. Remove effect that shows registration banner:
```typescript
// DELETE the useEffect that sets showRegistrationBanner based on flowStep
```

4. Remove the RegistrationBanner JSX from the render.

**Step 2: Simplify guest flow to redirect to demo project**

For unauthenticated users without projects, they should see the demo project. Update the redirect logic:

The current flow already handles this via `getOrCreateDefaultProject` which will now hydrate demo. No additional changes needed here - guests will get their demo project automatically when any API is called.

**Step 3: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/HomePage.tsx
git commit -m "refactor: remove RegistrationBanner from HomePage"
```

---

### Task 9: Delete RegistrationBanner Component

**Files:**
- Delete: `src/components/RegistrationBanner.tsx`

**Step 1: Delete the file**

```bash
rm src/components/RegistrationBanner.tsx
```

**Step 2: Search for any remaining imports**

Run: `grep -r "RegistrationBanner" src/`
Expected: No results

**Step 3: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git rm src/components/RegistrationBanner.tsx
git commit -m "chore: delete unused RegistrationBanner component"
```

---

### Task 10: Full Verification and Final Commit

**Step 1: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 2: Run all tests**

Run: `npm test`
Expected: PASS

**Step 3: Run smoke tests**

Run: `npm run smoke`
Expected: PASS

**Step 4: Run full verify**

Run: `npm run verify`
Expected: PASS

**Step 5: Manual verification checklist**

- [ ] Start dev server: `npm run dev`
- [ ] Open incognito browser
- [ ] Visit app - should see demo project (not IntroCard)
- [ ] DemoModeBadge visible in sidebar
- [ ] Click badge - popover shows with CTA
- [ ] Can interact with demo (start conversation)
- [ ] Sign in flow works
- [ ] After sign in - lands in empty state (demo deleted)

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address verification issues"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | User contract + schema | 5 min |
| 2 | API limit tests | 3 min |
| 3 | DemoModeBadge component | 5 min |
| 4 | Integrate badge in sidebar | 3 min |
| 5 | Guest demo hydration | 5 min |
| 6 | API rate limiting | 10 min |
| 7 | Replace transfer with delete | 5 min |
| 8 | Simplify HomePage | 5 min |
| 9 | Delete RegistrationBanner | 2 min |
| 10 | Full verification | 10 min |

**Total: ~53 minutes**
