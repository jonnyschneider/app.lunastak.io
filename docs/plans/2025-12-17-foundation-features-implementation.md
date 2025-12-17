# Foundation Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build core product foundations: authentication (NextAuth + Resend), saved strategies, guest-to-registered conversion, feedback collection, and cold start validation.

**Architecture:** Add NextAuth with Email provider, extend Prisma schema for User and Feedback models, create intro card before conversation starts, add collapsible sidebar with saved strategies, prompt guests to register after generation, collect qualitative feedback after 90s idle.

**Tech Stack:** Next.js 14, NextAuth.js 4, Resend API, Prisma ORM, TypeScript, React 18

---

## Task 1: Install Dependencies and Environment Setup

**Files:**
- Modify: `package.json`
- Modify: `.env.local`

**Step 1: Install Resend package**

Run: `npm install resend`
Expected: Package installed successfully

**Step 2: Add environment variables to .env.local**

Add these lines to `.env.local`:

```bash
# NextAuth
NEXTAUTH_SECRET=generate-me-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Resend
RESEND_API_KEY=your-resend-api-key-here
RESEND_FROM_EMAIL=noreply@humventures.com.au
```

Note: User needs to:
1. Generate NEXTAUTH_SECRET: `openssl rand -base64 32`
2. Get RESEND_API_KEY from Resend dashboard

**Step 3: Verify installation**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "chore: install Resend and add auth environment variables"
```

---

## Task 2: Database Schema - Add User and Feedback Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add User model**

Add after Event model in `prisma/schema.prisma`:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  createdAt     DateTime @default(now())

  conversations Conversation[]
  traces        Trace[]
  feedbacks     Feedback[]
  accounts      Account[]
  sessions      Session[]

  @@index([email])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Feedback {
  id           String   @id @default(cuid())
  traceId      String
  userId       String?
  responseText String   @db.Text
  createdAt    DateTime @default(now())

  trace        Trace    @relation(fields: [traceId], references: [id], onDelete: Cascade)
  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([traceId])
  @@index([userId])
  @@index([createdAt])
}
```

**Step 2: Update Conversation model to reference User**

Change line 12 in `prisma/schema.prisma` from:
```prisma
  userId    String
```

To:
```prisma
  userId    String?  // Nullable for guest sessions
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
```

**Step 3: Update Trace model to reference User**

Change line 54 in `prisma/schema.prisma` from:
```prisma
  userId              String
```

To:
```prisma
  userId              String?  // Nullable for guests
  user                User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
```

Add after line 87:
```prisma
  feedbacks           Feedback[]
```

**Step 4: Generate migration**

Run: `npx prisma migrate dev --name add_user_and_feedback_models`
Expected: Migration created and applied

**Step 5: Verify schema**

Run: `npx prisma generate`
Expected: Prisma Client regenerated successfully

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add User and Feedback models with NextAuth schema"
```

---

## Task 3: NextAuth Configuration

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Step 1: Create auth configuration**

Create `src/lib/auth.ts`:

```typescript
import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import EmailProvider from 'next-auth/providers/email';
import { prisma } from '@/lib/db';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: 'smtp.resend.com',
        port: 465,
        auth: {
          user: 'resend',
          pass: process.env.RESEND_API_KEY,
        },
      },
      from: process.env.RESEND_FROM_EMAIL || 'noreply@humventures.com.au',
      async sendVerificationRequest({ identifier: email, url }) {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@humventures.com.au',
            to: email,
            subject: 'Sign in to Strategist',
            html: `
              <p>Hi there,</p>
              <p>Click the link below to sign in to Strategist:</p>
              <p><a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #18181b; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Sign in to Strategist</a></p>
              <p>Or copy and paste this URL into your browser:<br/>
              <code>${url}</code></p>
              <p>This link expires in 24 hours.</p>
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
              <p style="color: #71717a; font-size: 12px;">Humble Ventures<br/>
              <a href="https://humventures.com.au" style="color: #71717a;">https://humventures.com.au</a></p>
            `,
          });
        } catch (error) {
          console.error('Failed to send verification email:', error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
```

**Step 2: Create NextAuth API route**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

**Step 3: Update types for session**

Create `src/types/next-auth.d.ts`:

```typescript
import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}
```

**Step 4: Verify NextAuth setup**

Run: `npm run type-check`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth src/types/next-auth.d.ts
git commit -m "feat: configure NextAuth with Email provider and Resend"
```

---

## Task 4: Session Provider Wrapper

**Files:**
- Create: `src/components/providers/session-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create session provider component**

Create `src/components/providers/session-provider.tsx`:

```typescript
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

**Step 2: Read current layout**

Run: `cat src/app/layout.tsx`

**Step 3: Wrap app with SessionProvider**

In `src/app/layout.tsx`, import SessionProvider and wrap children:

```typescript
import { SessionProvider } from '@/components/providers/session-provider';

// In the return statement, wrap {children} with:
<SessionProvider>
  {children}
</SessionProvider>
```

**Step 4: Verify setup**

Run: `npm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/providers/session-provider.tsx src/app/layout.tsx
git commit -m "feat: add NextAuth SessionProvider wrapper"
```

---

## Task 5: Intro Card Component

**Files:**
- Create: `src/components/IntroCard.tsx`

**Step 1: Create intro card component**

Create `src/components/IntroCard.tsx`:

```typescript
'use client';

interface IntroCardProps {
  onStart: () => void;
  onAlternativeClick: () => void;
}

export default function IntroCard({ onStart, onAlternativeClick }: IntroCardProps) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-12 shadow-sm text-center space-y-6">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          Ready to develop your Decision Stack?
        </h1>

        <div className="text-zinc-700 dark:text-zinc-300 space-y-2">
          <p>
            I'll ask 3-10 questions to understand your business, then generate
            your Vision, Mission, and Objectives.
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Takes about 5-10 minutes.
          </p>
        </div>

        <button
          onClick={onStart}
          className="w-full max-w-xs mx-auto px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium text-lg transition-colors"
        >
          Let's start
        </button>

        <button
          onClick={onAlternativeClick}
          className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm underline"
        >
          Other ways to get started? →
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify component**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/IntroCard.tsx
git commit -m "feat: add IntroCard component for cold start priming"
```

---

## Task 6: Update Main Page with Intro Flow

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/lib/events.ts`

**Step 1: Update flow state to include intro**

In `src/app/page.tsx`, change line 11:

From:
```typescript
type FlowStep = 'chat' | 'extraction' | 'strategy';
```

To:
```typescript
type FlowStep = 'intro' | 'chat' | 'extraction' | 'strategy';
```

**Step 2: Change initial flow step**

In `src/app/page.tsx`, change line 18:

From:
```typescript
const [flowStep, setFlowStep] = useState<FlowStep>('chat');
```

To:
```typescript
const [flowStep, setFlowStep] = useState<FlowStep>('intro');
```

**Step 3: Remove auto-start conversation**

In `src/app/page.tsx`, delete lines 26-29:

```typescript
// Delete this:
useEffect(() => {
  startConversation();
}, []);
```

**Step 4: Add handlers for intro card**

In `src/app/page.tsx`, add after the `startConversation` function:

```typescript
const handleIntroStart = async () => {
  // Log cold start event
  await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId: null,
      eventType: 'cold_start_initiated',
      eventData: { timestamp: new Date().toISOString() },
    }),
  });

  // Start conversation
  setFlowStep('chat');
  startConversation();
};

const handleAlternativeClick = async () => {
  // Log fake door click
  await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId: null,
      eventType: 'alternative_start_clicked',
      eventData: { timestamp: new Date().toISOString() },
    }),
  });

  // Show toast (we'll add toast library later, for now just alert)
  alert("Thanks for your interest! We're exploring different ways to help you get started. We'll let you know when we have options.");
};
```

**Step 5: Import IntroCard component**

Add to imports at top of `src/app/page.tsx`:

```typescript
import IntroCard from '@/components/IntroCard';
```

**Step 6: Add intro step to render logic**

In the return statement, before the existing content, add:

```typescript
{flowStep === 'intro' && (
  <IntroCard
    onStart={handleIntroStart}
    onAlternativeClick={handleAlternativeClick}
  />
)}
```

**Step 7: Verify changes**

Run: `npm run type-check`
Expected: No errors

**Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add intro flow with cold start tracking"
```

---

## Task 7: Registration Banner Component

**Files:**
- Create: `src/components/RegistrationBanner.tsx`

**Step 1: Create registration banner**

Create `src/components/RegistrationBanner.tsx`:

```typescript
'use client';

import { useState } from 'react';

interface RegistrationBannerProps {
  onEmailSubmit: (email: string) => void;
}

export default function RegistrationBanner({ onEmailSubmit }: RegistrationBannerProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    await onEmailSubmit(email);
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <p className="text-center text-green-800 dark:text-green-200">
          ✓ Check your email for the login link
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mb-6 p-6 bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">✨</span>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Save this strategy
        </h3>
      </div>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
        Create your account to access this later
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          required
          className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending...' : 'Send magic link'}
        </button>
      </form>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
        We'll email you a login link - no password needed
      </p>
    </div>
  );
}
```

**Step 2: Verify component**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/RegistrationBanner.tsx
git commit -m "feat: add RegistrationBanner component for guest conversion"
```

---

## Task 8: Feedback Modal Component

**Files:**
- Create: `src/components/FeedbackModal.tsx`

**Step 1: Create feedback modal**

Create `src/components/FeedbackModal.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface FeedbackModalProps {
  traceId: string;
  userId?: string;
  onClose: () => void;
  onSubmit: (feedback: string) => void;
}

export default function FeedbackModal({
  traceId,
  userId,
  onClose,
  onSubmit,
}: FeedbackModalProps) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setSubmitting(true);
    await onSubmit(feedback);
    setSubmitting(false);
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem(`feedback_skipped_${traceId}`, 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Quick question
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p className="text-zinc-700 dark:text-zinc-300 mb-4">
            Is this good enough that you'd use it for strategy development? Why or why not?
          </p>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Your thoughts..."
            rows={4}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
          />

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={submitting || !feedback.trim()}
              className="flex-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify component**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/FeedbackModal.tsx
git commit -m "feat: add FeedbackModal component for qual feedback"
```

---

## Task 9: Feedback API Route

**Files:**
- Create: `src/app/api/feedback/route.ts`

**Step 1: Create feedback API**

Create `src/app/api/feedback/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { traceId, userId, responseText } = await req.json();

    if (!traceId || !responseText) {
      return NextResponse.json(
        { error: 'traceId and responseText are required' },
        { status: 400 }
      );
    }

    // Create feedback record
    const feedback = await prisma.feedback.create({
      data: {
        traceId,
        userId: userId || null,
        responseText,
      },
    });

    // Log event
    await prisma.event.create({
      data: {
        conversationId: '', // Will be updated when we have conversation context
        traceId,
        eventType: 'feedback_submitted',
        eventData: {
          feedbackId: feedback.id,
          userId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ success: true, feedbackId: feedback.id });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify API**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: add feedback submission API endpoint"
```

---

## Task 10: Update Main Page with Registration and Feedback

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Import new components**

Add to imports in `src/app/page.tsx`:

```typescript
import { useSession, signIn } from 'next-auth/react';
import RegistrationBanner from '@/components/RegistrationBanner';
import FeedbackModal from '@/components/FeedbackModal';
```

**Step 2: Add state for feedback modal and registration**

Add after existing state declarations:

```typescript
const { data: session } = useSession();
const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [feedbackShown, setFeedbackShown] = useState(false);
```

**Step 3: Add idle detection for feedback**

Add this useEffect after other useEffects:

```typescript
// Idle detection for feedback modal
useEffect(() => {
  if (flowStep !== 'strategy' || !traceId || feedbackShown) return;

  const feedbackSkipped = localStorage.getItem(`feedback_skipped_${traceId}`);
  if (feedbackSkipped) return;

  let idleTimer: NodeJS.Timeout;
  let isIdle = false;

  const resetTimer = () => {
    if (isIdle) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      isIdle = true;
      setShowFeedbackModal(true);
      setFeedbackShown(true);
    }, 90000); // 90 seconds
  };

  // Track user activity
  const handleActivity = () => resetTimer();

  window.addEventListener('mousemove', handleActivity);
  window.addEventListener('keypress', handleActivity);
  window.addEventListener('scroll', handleActivity);

  resetTimer();

  return () => {
    clearTimeout(idleTimer);
    window.removeEventListener('mousemove', handleActivity);
    window.removeEventListener('keypress', handleActivity);
    window.removeEventListener('scroll', handleActivity);
  };
}, [flowStep, traceId, feedbackShown]);
```

**Step 4: Add registration handler**

Add after other handler functions:

```typescript
const handleRegistration = async (email: string) => {
  // Log registration initiation event
  await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      traceId,
      eventType: 'registration_initiated',
      eventData: {
        email,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  // Trigger NextAuth sign in
  await signIn('email', { email, callbackUrl: `/strategy/${traceId}` });
};

const handleFeedbackSubmit = async (feedback: string) => {
  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      traceId,
      userId: session?.user?.id,
      responseText: feedback,
    }),
  });
};
```

**Step 5: Add registration banner to strategy step**

In the return statement, add before StrategyDisplay:

```typescript
{flowStep === 'strategy' && !session && (
  <RegistrationBanner onEmailSubmit={handleRegistration} />
)}
```

**Step 6: Add feedback modal to render**

At the end of the return statement, add:

```typescript
{showFeedbackModal && (
  <FeedbackModal
    traceId={traceId}
    userId={session?.user?.id}
    onClose={() => setShowFeedbackModal(false)}
    onSubmit={handleFeedbackSubmit}
  />
)}
```

**Step 7: Verify changes**

Run: `npm run type-check`
Expected: No errors

**Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: integrate registration banner and feedback modal"
```

---

## Task 11: Update Sidebar for Saved Strategies

**Files:**
- Modify: `src/components/layout/app-layout.tsx`
- Create: `src/components/SavedStrategyList.tsx`

**Step 1: Create SavedStrategyList component**

Create `src/components/SavedStrategyList.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface SavedStrategy {
  id: string;
  name: string;
  createdAt: string;
}

export default function SavedStrategyList() {
  const { data: session } = useSession();
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    fetchStrategies();
  }, [session]);

  const fetchStrategies = async () => {
    try {
      const response = await fetch('/api/user/strategies');
      const data = await response.json();
      setStrategies(data.strategies || []);
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return null;
  }

  if (loading) {
    return (
      <div className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
        Loading...
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
        No saved strategies yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {strategies.map((strategy) => (
        <Link
          key={strategy.id}
          href={`/strategy/${strategy.id}`}
          className="block px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
        >
          <div className="font-medium">{strategy.name}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {new Date(strategy.createdAt).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

**Step 2: Update AppSidebar to show saved strategies**

In `src/components/layout/app-layout.tsx`, import SavedStrategyList:

```typescript
import SavedStrategyList from '@/components/SavedStrategyList';
```

In the AppSidebar function, replace the SidebarSection content (around line 81-83):

```typescript
<SidebarSection>
  <div className="px-4 py-2">
    <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
      Recent Strategies
    </h3>
    <SavedStrategyList />
  </div>
</SidebarSection>
```

**Step 3: Verify changes**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/SavedStrategyList.tsx src/components/layout/app-layout.tsx
git commit -m "feat: add saved strategies list to sidebar"
```

---

## Task 12: User Strategies API

**Files:**
- Create: `src/app/api/user/strategies/route.ts`

**Step 1: Create strategies API**

Create `src/app/api/user/strategies/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const maxDuration = 60;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ strategies: [] });
    }

    // Get user's traces with generated strategies
    const traces = await prisma.trace.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10,
      select: {
        id: true,
        output: true,
        timestamp: true,
      },
    });

    // Format strategies with system-generated names
    const strategies = traces.map((trace) => {
      const output = trace.output as any;
      const vision = output?.vision || '';

      // Extract first 3-4 words from vision
      const words = vision.split(' ').slice(0, 4);
      const name = words.length > 0
        ? words.join(' ').replace(/[^a-zA-Z0-9 ]/g, '')
        : `Strategy - ${new Date(trace.timestamp).toLocaleDateString()}`;

      return {
        id: trace.id,
        name,
        createdAt: trace.timestamp,
      };
    });

    return NextResponse.json({ strategies });
  } catch (error) {
    console.error('Failed to fetch strategies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify API**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/user/strategies/route.ts
git commit -m "feat: add user strategies API endpoint"
```

---

## Task 13: Strategy View Page

**Files:**
- Create: `src/app/strategy/[traceId]/page.tsx`

**Step 1: Create strategy view page**

Create `src/app/strategy/[traceId]/page.tsx`:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import StrategyDisplay from '@/components/StrategyDisplay';
import { AppLayout } from '@/components/layout/app-layout';

export default async function StrategyPage({
  params,
}: {
  params: { traceId: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/');
  }

  const trace = await prisma.trace.findUnique({
    where: {
      id: params.traceId,
    },
  });

  if (!trace || trace.userId !== session.user.id) {
    redirect('/');
  }

  const strategy = trace.output as any;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Your Decision Stack
            </h1>
            <button
              onClick={() => {
                // Fake door for "Continue this strategy"
                fetch('/api/events', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    conversationId: trace.conversationId,
                    traceId: trace.id,
                    eventType: 'continue_strategy_clicked',
                    eventData: { timestamp: new Date().toISOString() },
                  }),
                });
                alert('Coming soon! We\\'re building the ability to refine your strategy over multiple sessions.');
              }}
              className="px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              Continue this strategy
            </button>
          </div>

          <StrategyDisplay
            thoughts={trace.claudeThoughts || ''}
            statements={strategy}
            conversationId={trace.conversationId}
            traceId={trace.id}
          />
        </div>
      </div>
    </AppLayout>
  );
}
```

**Step 2: Verify page**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/strategy
git commit -m "feat: add strategy view page for saved strategies"
```

---

## Task 14: Update Conversation Start for Auth

**Files:**
- Modify: `src/app/api/conversation/start/route.ts`

**Step 1: Update conversation start to use authenticated user ID**

In `src/app/api/conversation/start/route.ts`, add import:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
```

Update the POST function to check for authenticated user:

```typescript
export async function POST(req: Request) {
  try {
    const { userId: guestUserId } = await req.json();

    // Check for authenticated user
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || guestUserId;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Rest of the function stays the same...
```

**Step 2: Verify changes**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/conversation/start/route.ts
git commit -m "feat: update conversation start to use authenticated user"
```

---

## Task 15: Auto-Save Strategy on Registration

**Files:**
- Create: `src/app/api/auth/transfer-session/route.ts`

**Step 1: Create session transfer API**

Create `src/app/api/auth/transfer-session/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { guestUserId } = await req.json();

    if (!guestUserId) {
      return NextResponse.json(
        { error: 'guestUserId required' },
        { status: 400 }
      );
    }

    // Transfer conversations from guest to authenticated user
    await prisma.conversation.updateMany({
      where: { userId: guestUserId },
      data: { userId: session.user.id },
    });

    // Transfer traces
    await prisma.trace.updateMany({
      where: { userId: guestUserId },
      data: { userId: session.user.id },
    });

    // Log conversion event
    await prisma.event.create({
      data: {
        conversationId: '', // Generic event
        eventType: 'guest_registered',
        eventData: {
          guestUserId,
          userId: session.user.id,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session transfer error:', error);
    return NextResponse.json(
      { error: 'Failed to transfer session' },
      { status: 500 }
    );
  }
}
```

**Step 2: Update registration handler in main page**

In `src/app/page.tsx`, update the `handleRegistration` function to transfer session after sign in:

```typescript
const handleRegistration = async (email: string) => {
  const guestUserId = userId; // Save guest ID before auth

  // Log registration initiation event
  await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      traceId,
      eventType: 'registration_initiated',
      eventData: {
        email,
        guestUserId,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  // Store guest ID for transfer after auth
  localStorage.setItem('transfer_guest_id', guestUserId);

  // Trigger NextAuth sign in
  await signIn('email', { email, callbackUrl: `/strategy/${traceId}` });
};
```

**Step 3: Add session transfer on mount**

In `src/app/page.tsx`, add useEffect to handle session transfer:

```typescript
// Transfer guest session on auth
useEffect(() => {
  if (!session?.user?.id) return;

  const guestUserId = localStorage.getItem('transfer_guest_id');
  if (!guestUserId) return;

  // Transfer session
  fetch('/api/auth/transfer-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestUserId }),
  }).then(() => {
    localStorage.removeItem('transfer_guest_id');
  });
}, [session]);
```

**Step 4: Verify changes**

Run: `npm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/auth/transfer-session src/app/page.tsx
git commit -m "feat: auto-transfer guest session on registration"
```

---

## Task 16: Add Collapsible Sidebar Toggle

**Files:**
- Modify: `src/components/ui/sidebar.tsx`

**Step 1: Read existing sidebar component**

Run: `cat src/components/ui/sidebar.tsx | head -100`

**Step 2: Add collapsed state and toggle**

In `src/components/ui/sidebar.tsx`, import icons and add state:

```typescript
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
```

In the SidebarLayout component, add state:

```typescript
const [collapsed, setCollapsed] = useState(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('sidebar_collapsed') === 'true';
});

useEffect(() => {
  localStorage.setItem('sidebar_collapsed', collapsed.toString());
}, [collapsed]);
```

Add toggle button to sidebar header:

```typescript
<button
  onClick={() => setCollapsed(!collapsed)}
  className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
>
  {collapsed ? (
    <ChevronRightIcon className="w-5 h-5" />
  ) : (
    <ChevronLeftIcon className="w-5 h-5" />
  )}
</button>
```

Update sidebar className to handle collapsed state:

```typescript
className={`... ${collapsed ? 'w-0 -translate-x-full' : 'w-64'} transition-all duration-200`}
```

**Step 3: Verify changes**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/ui/sidebar.tsx
git commit -m "feat: add collapsible sidebar with arrow toggle"
```

---

## Task 17: Testing and Verification

**Files:**
- Create: `docs/testing/foundation-features-test-plan.md`

**Step 1: Document testing checklist**

Create `docs/testing/foundation-features-test-plan.md`:

```markdown
# Foundation Features Testing Plan

## Manual Testing Checklist

### Authentication Flow

- [ ] Can request magic link with email
- [ ] Magic link email received via Resend
- [ ] Clicking magic link authenticates user
- [ ] Session persists across page reloads
- [ ] User avatar/name displays in sidebar

### Intro Card & Cold Start

- [ ] Intro card displays on first visit
- [ ] "Let's start" logs `cold_start_initiated` event
- [ ] "Other ways" logs `alternative_start_clicked` event
- [ ] "Other ways" shows appropriate toast message
- [ ] Conversation starts after clicking "Let's start"

### Guest Flow

- [ ] Guest can complete full conversation as anonymous
- [ ] Guest can generate Decision Stack
- [ ] Registration banner appears for guests
- [ ] Registration banner hidden for authenticated users

### Registration & Conversion

- [ ] Email submission triggers magic link
- [ ] Banner shows "Check your email" after submission
- [ ] After auth, guest's strategy auto-saved to account
- [ ] `guest_registered` event logged
- [ ] Sidebar appears with saved strategy

### Saved Strategies

- [ ] Sidebar shows "Recent Strategies" for authenticated users
- [ ] Sidebar hidden for guests
- [ ] Strategies list shows last 10 with system-generated names
- [ ] Clicking strategy navigates to `/strategy/[traceId]`
- [ ] Strategy view page displays full Decision Stack
- [ ] "Continue this strategy" logs fake door event
- [ ] Only user's own strategies accessible (security check)

### Feedback Collection

- [ ] Feedback modal appears after 90s idle on strategy page
- [ ] Modal shows for both guests and authenticated users
- [ ] "Skip" closes modal and sets localStorage flag
- [ ] Submit saves feedback to database
- [ ] `feedback_submitted` event logged
- [ ] Modal doesn't re-appear after skip/submit

### Sidebar Collapse

- [ ] Arrow toggle collapses/expands sidebar
- [ ] Collapsed state persists in localStorage
- [ ] Smooth transition animation
- [ ] Content adjusts when sidebar toggles

## API Testing

### GET /api/user/strategies
- [ ] Returns empty array for unauthenticated
- [ ] Returns user's strategies when authenticated
- [ ] Strategies have system-generated names
- [ ] Limited to 10 most recent

### POST /api/feedback
- [ ] Creates Feedback record
- [ ] Logs event
- [ ] Links to trace and user (if authenticated)

### POST /api/auth/transfer-session
- [ ] Transfers conversations from guest to user
- [ ] Transfers traces from guest to user
- [ ] Logs `guest_registered` event
- [ ] Requires authentication

## Event Tracking Verification

Query database to verify events logged:
- `cold_start_initiated`
- `alternative_start_clicked`
- `registration_initiated`
- `guest_registered`
- `feedback_submitted`
- `continue_strategy_clicked`

## Edge Cases

- [ ] Multiple guest sessions on same device
- [ ] Registering with email already in system
- [ ] Accessing strategy that doesn't belong to user
- [ ] Network errors during magic link send
- [ ] Expired magic links (24 hours)
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Test locally**

Run: `npm run dev`
Expected: Server starts on port 3000

**Step 5: Commit**

```bash
git add docs/testing/foundation-features-test-plan.md
git commit -m "docs: add foundation features testing plan"
```

---

## Task 18: Final Documentation and Deployment Notes

**Files:**
- Create: `docs/deployment/FOUNDATION_FEATURES_DEPLOYMENT.md`

**Step 1: Create deployment guide**

Create `docs/deployment/FOUNDATION_FEATURES_DEPLOYMENT.md`:

```markdown
# Foundation Features Deployment Guide

## Prerequisites

1. **Resend Account**
   - Domain: humventures.com.au verified
   - API key obtained
   - From address: noreply@humventures.com.au configured

2. **Environment Variables**
   ```bash
   NEXTAUTH_SECRET=<generate-with-openssl>
   NEXTAUTH_URL=https://strategist.humventures.com.au
   RESEND_API_KEY=<from-resend-dashboard>
   RESEND_FROM_EMAIL=noreply@humventures.com.au
   ```

## Deployment Steps

### 1. Database Migration

```bash
# Run migration
npx prisma migrate deploy

# Verify schema
npx prisma generate
```

### 2. Environment Setup in Vercel

```bash
# Add environment variables
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
vercel env add RESEND_API_KEY
vercel env add RESEND_FROM_EMAIL
```

### 3. Deploy

```bash
# Push to main triggers deployment
git push origin main
```

### 4. Verify Deployment

- [ ] Visit https://strategist.humventures.com.au
- [ ] Test magic link flow
- [ ] Verify Resend email delivery
- [ ] Check database for User records

## Rollback Plan

If issues occur:

1. **Revert git commit** on main
2. **Vercel auto-deploys** previous version
3. **Database migration** cannot be easily reverted
   - User/Feedback tables remain
   - Conversation/Trace relations nullable, so no data loss

## Monitoring

### Check User Registration

```sql
SELECT COUNT(*) as total_users,
       DATE(created_at) as date
FROM "User"
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Check Conversion Rate

```sql
WITH guests AS (
  SELECT COUNT(*) as total
  FROM "Event"
  WHERE event_type = 'registration_initiated'
),
registered AS (
  SELECT COUNT(*) as total
  FROM "Event"
  WHERE event_type = 'guest_registered'
)
SELECT
  registered.total * 100.0 / guests.total as conversion_rate
FROM guests, registered;
```

### Check Feedback Collection

```sql
SELECT COUNT(*) as total_feedback,
       DATE(created_at) as date
FROM "Feedback"
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Known Limitations

1. **No password recovery** - Magic links only (feature, not bug)
2. **No user profile editing** - Name optional, email immutable
3. **No strategy deletion** - Users can only view saved strategies
4. **Single session only** - Multi-session iteration is future feature

## Success Metrics (Week 1)

- **Users registered:** Target > 5
- **Conversion rate:** Target > 20%
- **Feedback responses:** Target > 30%
- **Abandonment rate:** Measure baseline
- **Alternative demand:** Measure fake door clicks
```

**Step 2: Commit**

```bash
git add docs/deployment/FOUNDATION_FEATURES_DEPLOYMENT.md
git commit -m "docs: add foundation features deployment guide"
```

**Step 3: Create final summary commit**

```bash
git commit --allow-empty -m "feat: foundation features complete

Implemented core product foundations:
- NextAuth.js with Resend magic links
- User and Feedback database models
- Intro card with cold start priming and fake door
- Registration banner for guest conversion
- Feedback modal (90s idle trigger)
- Saved strategies in collapsible sidebar
- Strategy view page with fake door for iteration
- Session transfer on registration
- Comprehensive event tracking

Ready for UAT and production deployment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Post-Implementation Checklist

**Before deploying:**

1. **Environment Setup**
   - [ ] Generate NEXTAUTH_SECRET
   - [ ] Obtain RESEND_API_KEY
   - [ ] Verify domain in Resend

2. **Local Testing**
   - [ ] Complete manual testing checklist
   - [ ] Test magic link flow end-to-end
   - [ ] Verify guest-to-registered conversion
   - [ ] Test feedback submission

3. **Database**
   - [ ] Run migration on production
   - [ ] Verify schema with `npx prisma studio`

4. **Deployment**
   - [ ] Add env vars to Vercel
   - [ ] Deploy to production
   - [ ] Monitor for errors

---

## Summary

This plan implements foundation features with:
- **18 tasks** covering all functionality
- **Bite-sized steps** (2-5 minutes each)
- **Complete code** in each task
- **Exact file paths** and commands
- **Testing and deployment** guides

**Total estimated time:** 4-6 hours for experienced developer
**Complexity:** Medium-High (auth integration, session management, multi-component coordination)
