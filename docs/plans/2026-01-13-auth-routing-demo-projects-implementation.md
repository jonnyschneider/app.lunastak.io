# Auth Routing & Demo Projects Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the 1-second auth flash on homepage by refactoring to hybrid server/client architecture, seeding demo projects on account creation, and adding project management with paywall infrastructure.

**Architecture:** Server component checks auth and passes session to client components. Demo projects seeded via NextAuth createUser event. Universal paywall API logs intent for future Stripe integration.

**Tech Stack:** Next.js 14, NextAuth, Prisma, React, TypeScript

---

## Task 1: Project Contract - isDemo Field

**Files:**
- Modify: `src/lib/contracts/persistence.ts`
- Modify: `src/lib/__tests__/contracts/persistence-contracts.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/__tests__/contracts/persistence-contracts.test.ts`:

```typescript
describe('ProjectContract', () => {
  const validProject = {
    id: 'proj_abc123',
    userId: 'user_xyz789',
    name: 'My Strategy',
    status: 'active',
    isDemo: false,
  };

  it('should validate a correct project', () => {
    expect(validateProject(validProject)).toBe(true);
  });

  it('should validate a demo project', () => {
    const demoProject = { ...validProject, isDemo: true, name: 'Demo: Catalyst Strategy' };
    expect(validateProject(demoProject)).toBe(true);
  });

  it('should reject project with missing id', () => {
    const { id, ...invalid } = validProject;
    expect(validateProject(invalid)).toBe(false);
  });

  it('should reject project with missing userId', () => {
    const { userId, ...invalid } = validProject;
    expect(validateProject(invalid)).toBe(false);
  });

  it('should reject project with missing name', () => {
    const { name, ...invalid } = validProject;
    expect(validateProject(invalid)).toBe(false);
  });

  it('should reject project with invalid status', () => {
    const invalid = { ...validProject, status: 'invalid' };
    expect(validateProject(invalid)).toBe(false);
  });

  it('should reject project with non-boolean isDemo', () => {
    const invalid = { ...validProject, isDemo: 'true' };
    expect(validateProject(invalid)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/__tests__/contracts/persistence-contracts.test.ts --testNamePattern="ProjectContract"`

Expected: FAIL with "validateProject is not defined"

**Step 3: Write minimal implementation**

Add to `src/lib/contracts/persistence.ts`:

```typescript
// Project status values
export const PROJECT_STATUSES = ['active', 'archived', 'deleted'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

// Project record
export interface ProjectContract {
  id: string;
  userId: string;
  name: string;
  status: ProjectStatus;
  isDemo: boolean;
  description?: string;
}

export function isValidProjectStatus(status: string): status is ProjectStatus {
  return PROJECT_STATUSES.includes(status as ProjectStatus);
}

export function validateProject(data: unknown): data is ProjectContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.userId !== 'string' || !obj.userId) return false;
  if (typeof obj.name !== 'string' || !obj.name) return false;
  if (typeof obj.status !== 'string' || !isValidProjectStatus(obj.status)) return false;
  if (typeof obj.isDemo !== 'boolean') return false;

  // Optional fields
  if (obj.description !== undefined && obj.description !== null && typeof obj.description !== 'string') return false;

  return true;
}
```

**Step 4: Update test imports**

Update imports in test file:

```typescript
import {
  // ... existing imports ...
  validateProject,
  isValidProjectStatus,
  PROJECT_STATUSES,
  ProjectContract,
} from '@/lib/contracts/persistence';
```

**Step 5: Run test to verify it passes**

Run: `npm run test -- src/lib/__tests__/contracts/persistence-contracts.test.ts --testNamePattern="ProjectContract"`

Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/contracts/persistence.ts src/lib/__tests__/contracts/persistence-contracts.test.ts
git commit -m "feat(contracts): add ProjectContract with isDemo field"
```

---

## Task 2: User Contract - isPaid Field

**Files:**
- Create: `src/lib/contracts/user.ts`
- Create: `src/lib/__tests__/contracts/user-contracts.test.ts`
- Modify: `src/lib/contracts/index.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/contracts/user-contracts.test.ts`:

```typescript
import {
  validateUser,
  UserContract,
} from '@/lib/contracts/user';

describe('UserContract', () => {
  const validUser: UserContract = {
    id: 'user_abc123',
    email: 'test@example.com',
    isPaid: false,
  };

  it('should validate a correct user', () => {
    expect(validateUser(validUser)).toBe(true);
  });

  it('should validate a paid user', () => {
    const paidUser = { ...validUser, isPaid: true };
    expect(validateUser(paidUser)).toBe(true);
  });

  it('should validate user with optional name', () => {
    const userWithName = { ...validUser, name: 'Test User' };
    expect(validateUser(userWithName)).toBe(true);
  });

  it('should reject user with missing id', () => {
    const { id, ...invalid } = validUser;
    expect(validateUser(invalid)).toBe(false);
  });

  it('should reject user with missing email', () => {
    const { email, ...invalid } = validUser;
    expect(validateUser(invalid)).toBe(false);
  });

  it('should reject user with non-boolean isPaid', () => {
    const invalid = { ...validUser, isPaid: 'false' };
    expect(validateUser(invalid)).toBe(false);
  });

  it('should reject user with invalid email format', () => {
    const invalid = { ...validUser, email: 'not-an-email' };
    expect(validateUser(invalid)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/__tests__/contracts/user-contracts.test.ts`

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/lib/contracts/user.ts`:

```typescript
// src/lib/contracts/user.ts
/**
 * User Contracts
 *
 * Defines user-related data structures for auth and subscription.
 */

export interface UserContract {
  id: string;
  email: string;
  isPaid: boolean;
  name?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateUser(data: unknown): data is UserContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.email !== 'string' || !isValidEmail(obj.email)) return false;
  if (typeof obj.isPaid !== 'boolean') return false;

  // Optional fields
  if (obj.name !== undefined && obj.name !== null && typeof obj.name !== 'string') return false;

  return true;
}
```

**Step 4: Update contracts index**

Modify `src/lib/contracts/index.ts`:

```typescript
// src/lib/contracts/index.ts
export * from './extraction';
export * from './generation';
export * from './persistence';
export * from './deep-dive';
export * from './user';
```

**Step 5: Run test to verify it passes**

Run: `npm run test -- src/lib/__tests__/contracts/user-contracts.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/contracts/user.ts src/lib/__tests__/contracts/user-contracts.test.ts src/lib/contracts/index.ts
git commit -m "feat(contracts): add UserContract with isPaid field"
```

---

## Task 3: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add fields to schema**

Modify `prisma/schema.prisma`:

In the `User` model, add after `createdAt`:
```prisma
  isPaid        Boolean   @default(false)
```

In the `Project` model, add after `status`:
```prisma
  isDemo      Boolean  @default(false)
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add-is-demo-and-is-paid`

Expected: Migration created successfully

**Step 3: Generate Prisma client**

Run: `npx prisma generate`

Expected: Prisma client generated

**Step 4: Verify types**

Run: `npm run type-check`

Expected: PASS (no type errors)

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add isDemo to Project and isPaid to User"
```

---

## Task 4: Seed Demo Project Function

**Files:**
- Create: `src/lib/seed-demo.ts`
- Create: `src/lib/__tests__/seed-demo.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/seed-demo.test.ts`:

```typescript
import { loadDemoFixture, transformFixtureForUser } from '@/lib/seed-demo';

describe('seedDemoProject', () => {
  describe('loadDemoFixture', () => {
    it('should load the demo-simulated fixture', async () => {
      const fixture = await loadDemoFixture();
      expect(fixture).toBeDefined();
      expect(fixture.template.name).toBe('demo-simulated');
      expect(fixture.projects.length).toBeGreaterThan(0);
    });
  });

  describe('transformFixtureForUser', () => {
    it('should replace user ID and generate new project IDs', async () => {
      const fixture = await loadDemoFixture();
      const userId = 'user_test123';

      const transformed = transformFixtureForUser(fixture, userId);

      expect(transformed.userId).toBe(userId);
      expect(transformed.projects[0].userId).toBe(userId);
      expect(transformed.projects[0].isDemo).toBe(true);
      expect(transformed.projects[0].name).toBe('Demo: Catalyst Strategy');
      // IDs should be new CUIDs, not template placeholders
      expect(transformed.projects[0].id).not.toContain('{{');
    });

    it('should generate unique IDs for each call', async () => {
      const fixture = await loadDemoFixture();
      const userId = 'user_test123';

      const first = transformFixtureForUser(fixture, userId);
      const second = transformFixtureForUser(fixture, userId);

      expect(first.projects[0].id).not.toBe(second.projects[0].id);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/__tests__/seed-demo.test.ts`

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/lib/seed-demo.ts`:

```typescript
// src/lib/seed-demo.ts
/**
 * Demo Project Seeding
 *
 * Loads demo-simulated fixture and hydrates it for a specific user.
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/db';
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions';
import type { Fixture } from '../../scripts/seed/types';

const FIXTURES_DIR = path.join(process.cwd(), 'scripts/seed/fixtures');
const DEMO_FIXTURE = 'demo-simulated.json';

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

export async function loadDemoFixture(): Promise<Fixture> {
  const fixturePath = path.join(FIXTURES_DIR, DEMO_FIXTURE);
  const content = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(content);
}

export interface TransformedFixture {
  userId: string;
  projects: Array<{
    id: string;
    userId: string;
    name: string;
    status: string;
    isDemo: boolean;
    description?: string;
    knowledgeSummary?: string;
    suggestedQuestions?: string[];
    conversations: any[];
    fragments: any[];
    deepDives: any[];
    documents: any[];
  }>;
}

export function transformFixtureForUser(fixture: Fixture, userId: string): TransformedFixture {
  const idMap = new Map<string, string>();

  // Generate new IDs for all entities
  fixture.projects.forEach((p) => {
    idMap.set(p.id, generateCuid());
    p.conversations.forEach((c) => idMap.set(c.id, generateCuid()));
    p.fragments.forEach((f) => idMap.set(f.id, generateCuid()));
    p.deepDives?.forEach((dd) => idMap.set(dd.id, generateCuid()));
    p.documents?.forEach((d) => idMap.set(d.id, generateCuid()));
  });

  const resolveId = (id: string): string => idMap.get(id) || generateCuid();

  return {
    userId,
    projects: fixture.projects.map((p) => ({
      id: resolveId(p.id),
      userId,
      name: 'Demo: Catalyst Strategy',
      status: p.status,
      isDemo: true,
      description: p.description,
      knowledgeSummary: p.knowledgeSummary,
      suggestedQuestions: p.suggestedQuestions,
      conversations: p.conversations.map((c) => ({
        ...c,
        id: resolveId(c.id),
      })),
      fragments: p.fragments.map((f) => ({
        ...f,
        id: resolveId(f.id),
        conversationId: f.conversationId ? resolveId(f.conversationId) : undefined,
        documentId: f.documentId ? resolveId(f.documentId) : undefined,
      })),
      deepDives: (p.deepDives || []).map((dd) => ({
        ...dd,
        id: resolveId(dd.id),
      })),
      documents: (p.documents || []).map((d) => ({
        ...d,
        id: resolveId(d.id),
        deepDiveId: d.deepDiveId ? resolveId(d.deepDiveId) : undefined,
      })),
    })),
  };
}

async function initializeSynthesisRecords(projectId: string): Promise<void> {
  const records = TIER_1_DIMENSIONS.map((dimension) => ({
    projectId,
    dimension,
    summary: null,
    keyThemes: [],
    keyQuotes: [],
    gaps: [],
    contradictions: [],
    confidence: 'LOW' as const,
    fragmentCount: 0,
    lastSynthesizedAt: new Date(),
    synthesizedBy: 'demo-seed',
  }));

  await prisma.dimensionalSynthesis.createMany({
    data: records,
    skipDuplicates: true,
  });
}

export async function seedDemoProject(userId: string): Promise<string> {
  const fixture = await loadDemoFixture();
  const transformed = transformFixtureForUser(fixture, userId);

  for (const projectData of transformed.projects) {
    const project = await prisma.project.create({
      data: {
        id: projectData.id,
        userId: projectData.userId,
        name: projectData.name,
        status: projectData.status,
        isDemo: projectData.isDemo,
        description: projectData.description,
        knowledgeSummary: projectData.knowledgeSummary,
        suggestedQuestions: projectData.suggestedQuestions || [],
      },
    });

    // Create deep dives first
    for (const dd of projectData.deepDives) {
      await prisma.deepDive.create({
        data: {
          id: dd.id,
          projectId: project.id,
          topic: dd.topic,
          notes: dd.notes,
          status: dd.status,
          origin: dd.origin,
        },
      });
    }

    // Create conversations
    for (const conv of projectData.conversations) {
      const conversation = await prisma.conversation.create({
        data: {
          id: conv.id,
          userId,
          projectId: project.id,
          title: conv.title,
          status: conv.status,
          currentPhase: conv.currentPhase,
          selectedLens: conv.selectedLens,
          questionCount: conv.questionCount,
          experimentVariant: conv.experimentVariant,
        },
      });

      // Create messages
      for (const msg of conv.messages) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: msg.role,
            content: msg.content,
            stepNumber: msg.stepNumber,
            confidenceScore: msg.confidenceScore,
            confidenceReasoning: msg.confidenceReasoning,
          },
        });
      }

      // Create traces
      for (const trace of conv.traces) {
        await prisma.trace.create({
          data: {
            conversationId: conversation.id,
            userId,
            extractedContext: trace.extractedContext,
            dimensionalCoverage: trace.dimensionalCoverage,
            output: trace.output,
            claudeThoughts: trace.claudeThoughts,
            modelUsed: trace.modelUsed,
            totalTokens: trace.totalTokens,
            promptTokens: trace.promptTokens,
            completionTokens: trace.completionTokens,
            latencyMs: trace.latencyMs,
            starred: trace.starred,
            starredAt: trace.starred ? new Date() : undefined,
          },
        });
      }
    }

    // Create fragments
    for (const frag of projectData.fragments) {
      const fragment = await prisma.fragment.create({
        data: {
          id: frag.id,
          projectId: project.id,
          conversationId: frag.conversationId,
          documentId: frag.documentId,
          content: frag.content,
          contentType: frag.contentType,
          status: frag.status,
          confidence: frag.confidence,
        },
      });

      // Create dimension tags
      for (const tag of frag.dimensionTags || []) {
        await prisma.fragmentDimensionTag.create({
          data: {
            fragmentId: fragment.id,
            dimension: tag.dimension,
            confidence: tag.confidence,
          },
        });
      }
    }

    // Initialize synthesis records
    await initializeSynthesisRecords(project.id);

    return project.id;
  }

  throw new Error('No projects in fixture');
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/__tests__/seed-demo.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed-demo.ts src/lib/__tests__/seed-demo.test.ts
git commit -m "feat: add seedDemoProject function for demo project hydration"
```

---

## Task 5: NextAuth createUser Event Hook

**Files:**
- Modify: `src/lib/auth.ts`

**Step 1: Add import and event hook**

Modify `src/lib/auth.ts`:

```typescript
import type { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { resend, EMAIL_CONFIG } from "@/lib/resend"
import { seedDemoProject } from "@/lib/seed-demo"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: "",
      from: EMAIL_CONFIG.from,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await resend.emails.send({
          from: EMAIL_CONFIG.from,
          replyTo: EMAIL_CONFIG.replyTo,
          to: email,
          subject: "Sign in to Lunastak",
          html: `
            <p>Click the link below to sign in:</p>
            <a href="${url}">Sign in to Lunastak</a>
            <p>If you did not request this email, you can safely ignore it.</p>
          `,
        })
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
  },
  events: {
    createUser: async ({ user }) => {
      // Seed demo project for new users
      await seedDemoProject(user.id).catch((err) =>
        console.error('Failed to seed demo project:', err)
      );
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
}
```

**Step 2: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): seed demo project on user creation"
```

---

## Task 6: Paywall Contract

**Files:**
- Create: `src/lib/contracts/paywall.ts`
- Create: `src/lib/__tests__/contracts/paywall-contracts.test.ts`
- Modify: `src/lib/contracts/index.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/contracts/paywall-contracts.test.ts`:

```typescript
import {
  validatePaywallRequest,
  validatePaywallResponse,
  PaywallRequestContract,
  PaywallResponseContract,
  PAYWALL_FEATURES,
} from '@/lib/contracts/paywall';

describe('PaywallContracts', () => {
  describe('PaywallRequestContract', () => {
    const validRequest: PaywallRequestContract = {
      feature: 'create_project',
    };

    it('should validate correct request', () => {
      expect(validatePaywallRequest(validRequest)).toBe(true);
    });

    it('should validate request with context', () => {
      const withContext = { ...validRequest, context: { projectCount: 1 } };
      expect(validatePaywallRequest(withContext)).toBe(true);
    });

    it('should reject request with missing feature', () => {
      expect(validatePaywallRequest({})).toBe(false);
    });

    it('should reject request with invalid feature', () => {
      expect(validatePaywallRequest({ feature: 'invalid_feature' })).toBe(false);
    });
  });

  describe('PaywallResponseContract', () => {
    const validResponse: PaywallResponseContract = {
      blocked: true,
      modal: {
        title: 'Upgrade to Pro',
        message: 'Create multiple projects with a Pro subscription.',
        ctaLabel: 'Learn More',
        ctaUrl: 'https://lunastak.io/pricing',
      },
    };

    it('should validate correct blocked response', () => {
      expect(validatePaywallResponse(validResponse)).toBe(true);
    });

    it('should validate unblocked response without modal', () => {
      const unblocked = { blocked: false };
      expect(validatePaywallResponse(unblocked)).toBe(true);
    });

    it('should reject blocked response without modal', () => {
      const invalid = { blocked: true };
      expect(validatePaywallResponse(invalid)).toBe(false);
    });

    it('should reject response with incomplete modal', () => {
      const invalid = {
        blocked: true,
        modal: { title: 'Upgrade' },
      };
      expect(validatePaywallResponse(invalid)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/__tests__/contracts/paywall-contracts.test.ts`

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/lib/contracts/paywall.ts`:

```typescript
// src/lib/contracts/paywall.ts
/**
 * Paywall Contracts
 *
 * Defines request/response shapes for the universal paywall API.
 */

export const PAYWALL_FEATURES = [
  'create_project',
  'export_pdf',
  'add_team_member',
  'advanced_analytics',
] as const;

export type PaywallFeature = typeof PAYWALL_FEATURES[number];

export interface PaywallRequestContract {
  feature: PaywallFeature;
  context?: Record<string, unknown>;
}

export interface PaywallModalContract {
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
}

export interface PaywallResponseContract {
  blocked: boolean;
  modal?: PaywallModalContract;
}

export function isValidPaywallFeature(feature: string): feature is PaywallFeature {
  return PAYWALL_FEATURES.includes(feature as PaywallFeature);
}

export function validatePaywallRequest(data: unknown): data is PaywallRequestContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.feature !== 'string' || !isValidPaywallFeature(obj.feature)) return false;

  // context is optional
  if (obj.context !== undefined && (typeof obj.context !== 'object' || obj.context === null)) {
    return false;
  }

  return true;
}

export function validatePaywallModal(data: unknown): data is PaywallModalContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== 'string' || !obj.title) return false;
  if (typeof obj.message !== 'string' || !obj.message) return false;
  if (typeof obj.ctaLabel !== 'string' || !obj.ctaLabel) return false;
  if (typeof obj.ctaUrl !== 'string' || !obj.ctaUrl) return false;

  return true;
}

export function validatePaywallResponse(data: unknown): data is PaywallResponseContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.blocked !== 'boolean') return false;

  // If blocked, modal is required
  if (obj.blocked && !validatePaywallModal(obj.modal)) return false;

  // If not blocked, modal should be absent or valid
  if (!obj.blocked && obj.modal !== undefined && !validatePaywallModal(obj.modal)) return false;

  return true;
}
```

**Step 4: Update contracts index**

Add to `src/lib/contracts/index.ts`:

```typescript
export * from './paywall';
```

**Step 5: Run test to verify it passes**

Run: `npm run test -- src/lib/__tests__/contracts/paywall-contracts.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/contracts/paywall.ts src/lib/__tests__/contracts/paywall-contracts.test.ts src/lib/contracts/index.ts
git commit -m "feat(contracts): add PaywallRequest and PaywallResponse contracts"
```

---

## Task 7: Paywall API Endpoint

**Files:**
- Create: `src/app/api/paywall/prompt/route.ts`

**Step 1: Create the API route**

Create `src/app/api/paywall/prompt/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  validatePaywallRequest,
  PaywallResponseContract,
  PaywallFeature,
} from '@/lib/contracts/paywall';

const MODAL_CONTENT: Record<PaywallFeature, { title: string; message: string }> = {
  create_project: {
    title: 'Upgrade to Pro',
    message: 'Free accounts are limited to one project. Upgrade to Pro for unlimited projects and more features.',
  },
  export_pdf: {
    title: 'Upgrade to Pro',
    message: 'PDF exports are available on Pro plans. Upgrade to download your strategy as a PDF.',
  },
  add_team_member: {
    title: 'Upgrade to Team',
    message: 'Invite team members to collaborate on your strategy with a Team plan.',
  },
  advanced_analytics: {
    title: 'Upgrade to Pro',
    message: 'Access advanced analytics and insights with a Pro subscription.',
  },
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!validatePaywallRequest(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Check if user is paid
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPaid: true },
  });

  if (user?.isPaid) {
    const response: PaywallResponseContract = { blocked: false };
    return NextResponse.json(response);
  }

  // Log the upgrade intent
  await prisma.event.create({
    data: {
      conversationId: (body.context?.conversationId as string) || 'system',
      eventType: 'paywall_prompt',
      eventData: {
        feature: body.feature,
        context: body.context,
        userId: session.user.id,
      },
    },
  }).catch((err) => console.error('Failed to log paywall event:', err));

  // Return blocked response with modal
  const modalContent = MODAL_CONTENT[body.feature];
  const response: PaywallResponseContract = {
    blocked: true,
    modal: {
      title: modalContent.title,
      message: modalContent.message,
      ctaLabel: 'Learn More',
      ctaUrl: 'https://lunastak.io/pricing',
    },
  };

  return NextResponse.json(response);
}
```

**Step 2: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/paywall/prompt/route.ts
git commit -m "feat(api): add paywall prompt endpoint"
```

---

## Task 8: Paywall Hook and Modal

**Files:**
- Create: `src/hooks/use-paywall.ts`
- Create: `src/components/PaywallModal.tsx`

**Step 1: Create the hook**

Create `src/hooks/use-paywall.ts`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import type { PaywallFeature, PaywallModalContract } from '@/lib/contracts/paywall';

interface UsePaywallReturn {
  isOpen: boolean;
  modal: PaywallModalContract | null;
  triggerPaywall: (feature: PaywallFeature, context?: Record<string, unknown>) => Promise<boolean>;
  closePaywall: () => void;
}

export function usePaywall(): UsePaywallReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [modal, setModal] = useState<PaywallModalContract | null>(null);

  const triggerPaywall = useCallback(async (
    feature: PaywallFeature,
    context?: Record<string, unknown>
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/paywall/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, context }),
      });

      if (!response.ok) {
        console.error('Paywall API error:', response.status);
        return false; // Allow action on API error
      }

      const data = await response.json();

      if (data.blocked) {
        setModal(data.modal);
        setIsOpen(true);
        return true; // Blocked
      }

      return false; // Not blocked
    } catch (error) {
      console.error('Paywall check failed:', error);
      return false; // Allow action on error
    }
  }, []);

  const closePaywall = useCallback(() => {
    setIsOpen(false);
    setModal(null);
  }, []);

  return { isOpen, modal, triggerPaywall, closePaywall };
}
```

**Step 2: Create the modal component**

Create `src/components/PaywallModal.tsx`:

```typescript
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PaywallModalContract } from '@/lib/contracts/paywall';

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modal: PaywallModalContract | null;
}

export function PaywallModal({ open, onOpenChange, modal }: PaywallModalProps) {
  if (!modal) return null;

  const handleLearnMore = () => {
    window.open(modal.ctaUrl, '_blank');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{modal.title}</AlertDialogTitle>
          <AlertDialogDescription>{modal.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Maybe Later</AlertDialogCancel>
          <AlertDialogAction onClick={handleLearnMore}>
            {modal.ctaLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 3: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 4: Commit**

```bash
git add src/hooks/use-paywall.ts src/components/PaywallModal.tsx
git commit -m "feat: add usePaywall hook and PaywallModal component"
```

---

## Task 9: Project Create API

**Files:**
- Modify: `src/app/api/projects/route.ts`

**Step 1: Add POST handler**

Add to `src/app/api/projects/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

async function initializeSynthesisRecords(projectId: string): Promise<void> {
  const records = TIER_1_DIMENSIONS.map((dimension) => ({
    projectId,
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
  }));

  await prisma.dimensionalSynthesis.createMany({
    data: records,
    skipDuplicates: true,
  });
}

/**
 * GET /api/projects
 * Fetches the user's projects list with summary stats
 */
export async function GET() {
  // ... existing GET implementation unchanged ...
}

/**
 * POST /api/projects
 * Creates a new project (checks paywall limits)
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check existing non-demo projects
  const existingProjects = await prisma.project.count({
    where: {
      userId: session.user.id,
      isDemo: false,
      status: 'active',
    },
  })

  // Check if user is paid
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPaid: true },
  })

  // Free users limited to 1 non-demo project
  if (!user?.isPaid && existingProjects >= 1) {
    return NextResponse.json({
      error: 'Project limit reached',
      paywall: {
        blocked: true,
        modal: {
          title: 'Upgrade to Pro',
          message: 'Free accounts are limited to one project. Upgrade to Pro for unlimited projects.',
          ctaLabel: 'Learn More',
          ctaUrl: 'https://lunastak.io/pricing',
        },
      },
    }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const name = body.name || 'My Strategy'

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name,
        status: 'active',
        isDemo: false,
      },
    })

    await initializeSynthesisRecords(project.id)

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        isDemo: project.isDemo,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
```

**Step 2: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/projects/route.ts
git commit -m "feat(api): add project creation with paywall check"
```

---

## Task 10: Project Delete API

**Files:**
- Create: `src/app/api/projects/[id]/route.ts`

**Step 1: Create the delete endpoint**

Create `src/app/api/projects/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: { id: string };
}

/**
 * DELETE /api/projects/[id]
 * Hard deletes a project and all related data
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  // Verify ownership
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: session.user.id,
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    // Delete in correct order to respect foreign keys
    // 1. Delete dimensional synthesis records
    await prisma.dimensionalSynthesis.deleteMany({
      where: { projectId },
    });

    // 2. Delete fragment dimension tags (via fragment cascade)
    // 3. Delete fragments
    await prisma.fragmentDimensionTag.deleteMany({
      where: { fragment: { projectId } },
    });
    await prisma.fragment.deleteMany({
      where: { projectId },
    });

    // 4. Delete conversation-related data
    const conversations = await prisma.conversation.findMany({
      where: { projectId },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    if (conversationIds.length > 0) {
      // Delete events
      await prisma.event.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });

      // Delete traces and feedbacks
      await prisma.feedback.deleteMany({
        where: { trace: { conversationId: { in: conversationIds } } },
      });
      await prisma.trace.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });

      // Delete messages
      await prisma.message.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });

      // Delete extraction runs
      await prisma.extractionRun.deleteMany({
        where: { projectId },
      });

      // Delete conversations
      await prisma.conversation.deleteMany({
        where: { projectId },
      });
    }

    // 5. Delete documents
    await prisma.document.deleteMany({
      where: { projectId },
    });

    // 6. Delete deep dives
    await prisma.deepDive.deleteMany({
      where: { projectId },
    });

    // 7. Delete generated outputs
    await prisma.generatedOutput.deleteMany({
      where: { projectId },
    });

    // 8. Delete user dismissals scoped to project
    await prisma.userDismissal.deleteMany({
      where: { projectId },
    });

    // 9. Finally delete the project
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
```

**Step 2: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/projects/[id]/route.ts
git commit -m "feat(api): add project deletion with cascade"
```

---

## Task 11: Restore Demo API

**Files:**
- Create: `src/app/api/projects/restore-demo/route.ts`

**Step 1: Create the restore endpoint**

Create `src/app/api/projects/restore-demo/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { seedDemoProject } from '@/lib/seed-demo';

/**
 * POST /api/projects/restore-demo
 * Re-seeds the demo project for a user
 */
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if demo already exists
  const existingDemo = await prisma.project.findFirst({
    where: {
      userId: session.user.id,
      isDemo: true,
    },
  });

  if (existingDemo) {
    return NextResponse.json(
      { error: 'Demo project already exists', projectId: existingDemo.id },
      { status: 409 }
    );
  }

  try {
    const projectId = await seedDemoProject(session.user.id);

    return NextResponse.json({
      success: true,
      projectId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error restoring demo project:', error);
    return NextResponse.json({ error: 'Failed to restore demo project' }, { status: 500 });
  }
}
```

**Step 2: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/projects/restore-demo/route.ts
git commit -m "feat(api): add restore demo project endpoint"
```

---

## Task 12: Homepage Server/Client Split

**Files:**
- Rename: `src/app/page.tsx` → `src/components/HomePage.tsx`
- Create: `src/app/page.tsx` (new server component)

**Step 1: Move existing page to component**

Rename `src/app/page.tsx` to `src/components/HomePage.tsx` and modify:

At the top, change to accept session as prop:

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { Session } from 'next-auth';
// Remove: import { useSession } from 'next-auth/react';
// ... rest of imports ...

type FlowStep = 'intro' | 'chat' | 'extracting' | 'extraction' | 'strategy';

interface HomePageProps {
  session: Session | null;
}

export function HomePage({ session }: HomePageProps) {
  // Remove: const { data: session, status } = useSession();
  const router = useRouter();
  // ... rest of state declarations ...
```

Remove the redirect useEffect (lines 56-76 in original) entirely - we'll handle this differently.

Update the useEffect that fetches projects (lines 85-96) to not depend on session loading:

```typescript
  // Fetch user's project ID for deep dive deferral
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/projects')
        .then(res => res.json())
        .then(data => {
          if (data.projects && data.projects.length > 0) {
            setUserProjectId(data.projects[0].id);
          }
        })
        .catch(err => console.error('Failed to fetch projects:', err));
    }
  }, [session?.user?.id]);
```

Update useEffects that check `status === 'loading'` to not need that check (session is already resolved):

```typescript
  // Auto-start conversation for authenticated users with projectId param
  useEffect(() => {
    if (!session) return;
    if (conversationId) return;

    const params = new URLSearchParams(window.location.search);
    // ... rest unchanged ...
  }, [session, conversationId]);
```

**Step 2: Create new server component page**

Create new `src/app/page.tsx`:

```typescript
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { HomePage } from '@/components/HomePage';

export default async function Page() {
  const session = await getServerSession(authOptions);

  return <HomePage session={session} />;
}
```

**Step 3: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 4: Test manually**

Run: `npm run dev`

Visit homepage as guest and authenticated user. Verify no flash/redirect.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/components/HomePage.tsx
git commit -m "refactor: split homepage into server/client components for instant auth"
```

---

## Task 13: Auth-Aware IntroCard

**Files:**
- Modify: `src/components/IntroCard.tsx`

**Step 1: Add session prop and auth-aware CTAs**

Modify `src/components/IntroCard.tsx`:

```typescript
'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Session } from 'next-auth';
import { EntryPointSelector } from './EntryPointSelector';
import { Button } from '@/components/ui/button';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface IntroCardProps {
  session?: Session | null;
  demoProjectId?: string | null;
  userProjectId?: string | null;
  onEntryPointSelect: (option: EntryPoint) => void;
  isLoading?: boolean;
}

export function IntroCard({
  session,
  demoProjectId,
  userProjectId,
  onEntryPointSelect,
  isLoading = false,
}: IntroCardProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto">
        <div className="flex-1 flex items-center justify-center p-6">
          <Image
            src="/animated-logo-glitch.svg"
            alt="Luna"
            width={48}
            height={48}
            className="animate-pulse"
          />
        </div>
      </div>
    );
  }

  // Authenticated user with projects
  if (session && (demoProjectId || userProjectId)) {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto">
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">
                Welcome back
              </h1>
              <p className="text-muted-foreground max-w-md">
                Continue working on your strategy or explore the demo.
              </p>
            </div>
            <Image
              src="/animated-logo-glitch.svg"
              alt="Luna"
              width={56}
              height={56}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            {demoProjectId && (
              <Button variant="outline" asChild>
                <Link href={`/project/${demoProjectId}`}>
                  Explore Demo Project
                </Link>
              </Button>
            )}
            {userProjectId && (
              <Button asChild>
                <Link href={`/project/${userProjectId}`}>
                  Go to My Strategy
                </Link>
              </Button>
            )}
            {!userProjectId && (
              <Button onClick={() => onEntryPointSelect('guided')}>
                Create My Strategy
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Guest or authenticated without projects - show original intro
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Let&apos;s clarify your strategy
            </h1>
            <p className="text-muted-foreground max-w-md">
              &#128075; I'm Luna, the green blob. I don't look very smart, but I ask great questions (and, I'm a really good listener).
            </p>
          </div>
          <Image
            src="/animated-logo-glitch.svg"
            alt="Luna"
            width={56}
            height={56}
          />
        </div>

        <div className="pt-4">
          <EntryPointSelector onSelect={onEntryPointSelect} />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update HomePage to pass session and project IDs**

In `src/components/HomePage.tsx`, update the IntroCard usage:

```typescript
// Add state for project IDs
const [demoProjectId, setDemoProjectId] = useState<string | null>(null);

// Fetch projects on mount for authenticated users
useEffect(() => {
  if (session?.user?.id) {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.projects) {
          const demo = data.projects.find((p: any) => p.isDemo);
          const userProj = data.projects.find((p: any) => !p.isDemo);
          if (demo) setDemoProjectId(demo.id);
          if (userProj) setUserProjectId(userProj.id);
        }
      })
      .catch(err => console.error('Failed to fetch projects:', err));
  }
}, [session?.user?.id]);

// Update IntroCard rendering
{showIntro && flowStep === 'intro' && (
  <IntroCard
    session={session}
    demoProjectId={demoProjectId}
    userProjectId={userProjectId}
    onEntryPointSelect={handleEntryPointSelect}
    isLoading={isLoading}
  />
)}
```

**Step 3: Update API to return isDemo flag**

In `src/app/api/projects/route.ts`, update the response format:

```typescript
const formattedProjects = projects.map((project) => ({
  id: project.id,
  name: project.name,
  isDemo: project.isDemo,
  fragmentCount: project._count.fragments,
  conversationCount: project._count.conversations,
  updatedAt: project.updatedAt.toISOString(),
}))
```

**Step 4: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/IntroCard.tsx src/components/HomePage.tsx src/app/api/projects/route.ts
git commit -m "feat: add auth-aware IntroCard with project CTAs"
```

---

## Task 14: Empty State Component

**Files:**
- Create: `src/components/EmptyProjectState.tsx`

**Step 1: Create the component**

Create `src/components/EmptyProjectState.tsx`:

```typescript
'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';

interface EmptyProjectStateProps {
  onCreateProject: () => void;
  onRestoreDemo: () => void;
  isCreating?: boolean;
  isRestoring?: boolean;
}

export function EmptyProjectState({
  onCreateProject,
  onRestoreDemo,
  isCreating = false,
  isRestoring = false,
}: EmptyProjectStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Image
        src="/animated-logo-glitch.svg"
        alt="Luna"
        width={64}
        height={64}
        className="mb-6"
      />
      <h2 className="text-xl font-semibold text-foreground mb-2">
        No projects yet
      </h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Create your first strategy project or restore the demo to explore what's possible.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onCreateProject} disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create My Strategy'}
        </Button>
        <Button variant="outline" onClick={onRestoreDemo} disabled={isRestoring}>
          {isRestoring ? 'Restoring...' : 'Restore Demo Project'}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/EmptyProjectState.tsx
git commit -m "feat: add EmptyProjectState component"
```

---

## Task 15: Wire Up Empty State

**Files:**
- Modify: `src/components/HomePage.tsx`

**Step 1: Add empty state handling**

Add to `src/components/HomePage.tsx`:

```typescript
import { EmptyProjectState } from '@/components/EmptyProjectState';
import { PaywallModal } from '@/components/PaywallModal';
import { usePaywall } from '@/hooks/use-paywall';

// Inside the component:
const { isOpen: paywallOpen, modal: paywallModal, triggerPaywall, closePaywall } = usePaywall();
const [hasNoProjects, setHasNoProjects] = useState(false);
const [isCreatingProject, setIsCreatingProject] = useState(false);
const [isRestoringDemo, setIsRestoringDemo] = useState(false);

// Update the projects fetch effect:
useEffect(() => {
  if (session?.user?.id) {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.projects && data.projects.length > 0) {
          const demo = data.projects.find((p: any) => p.isDemo);
          const userProj = data.projects.find((p: any) => !p.isDemo);
          if (demo) setDemoProjectId(demo.id);
          if (userProj) setUserProjectId(userProj.id);
          setHasNoProjects(false);
        } else {
          setHasNoProjects(true);
        }
      })
      .catch(err => console.error('Failed to fetch projects:', err));
  }
}, [session?.user?.id]);

// Add handlers:
const handleCreateProject = async () => {
  setIsCreatingProject(true);
  try {
    // Check paywall first
    const blocked = await triggerPaywall('create_project');
    if (blocked) {
      setIsCreatingProject(false);
      return;
    }

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      router.push(`/project/${data.project.id}`);
    } else if (response.status === 403) {
      const data = await response.json();
      if (data.paywall) {
        // Show paywall modal from response
      }
    }
  } catch (error) {
    console.error('Failed to create project:', error);
  } finally {
    setIsCreatingProject(false);
  }
};

const handleRestoreDemo = async () => {
  setIsRestoringDemo(true);
  try {
    const response = await fetch('/api/projects/restore-demo', {
      method: 'POST',
    });

    if (response.ok) {
      const data = await response.json();
      router.push(`/project/${data.projectId}`);
    }
  } catch (error) {
    console.error('Failed to restore demo:', error);
  } finally {
    setIsRestoringDemo(false);
  }
};

// Add to render, after showIntro check:
{session && hasNoProjects && flowStep === 'intro' && (
  <EmptyProjectState
    onCreateProject={handleCreateProject}
    onRestoreDemo={handleRestoreDemo}
    isCreating={isCreatingProject}
    isRestoring={isRestoringDemo}
  />
)}

// Add PaywallModal at the end of the component:
<PaywallModal
  open={paywallOpen}
  onOpenChange={closePaywall}
  modal={paywallModal}
/>
```

**Step 2: Verify types**

Run: `npm run type-check`

Expected: PASS

**Step 3: Manual test**

Run: `npm run dev`

Test the flow:
1. Sign in with new account → should see demo project
2. Delete demo project → should see empty state
3. Click "Create My Strategy" → should create project
4. Click "Restore Demo" → should restore demo

**Step 4: Commit**

```bash
git add src/components/HomePage.tsx
git commit -m "feat: wire up empty state with create/restore actions"
```

---

## Task 16: Project Delete in Context Menu

**Files:**
- Find and modify the project context menu component (likely in sidebar)

**Step 1: Locate the context menu**

Search for existing project context menu or dropdown in sidebar components.

**Step 2: Add delete action**

Add a "Delete Project" option that:
1. Shows confirmation dialog
2. Calls `DELETE /api/projects/[id]`
3. Refreshes sidebar on success

**Step 3: Verify types**

Run: `npm run type-check`

**Step 4: Commit**

```bash
git add <modified files>
git commit -m "feat: add delete project action to context menu"
```

---

## Task 17: Final Verification

**Step 1: Run all tests**

Run: `npm run test`

Expected: All tests pass

**Step 2: Run type check**

Run: `npm run type-check`

Expected: No errors

**Step 3: Run full verification**

Run: `npm run verify`

Expected: All checks pass

**Step 4: Manual E2E test**

1. Create new account → demo project seeded
2. Visit homepage → see auth-aware CTAs
3. Create project → works, or shows paywall
4. Delete project → works with cascade
5. Delete all projects → empty state shows
6. Restore demo → works

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for auth routing and demo projects"
```

---

## Summary

This plan implements:

1. **Contracts** for Project (isDemo) and User (isPaid)
2. **Schema migration** adding both fields
3. **Demo seeding** on account creation via NextAuth event
4. **Paywall infrastructure** with API, hook, and modal
5. **Project CRUD** with create, delete, and restore-demo endpoints
6. **Homepage refactor** to hybrid server/client architecture
7. **Auth-aware UI** with different CTAs for guests vs authenticated users
8. **Empty state** with create/restore options

Total: 17 tasks, each 2-10 minutes
