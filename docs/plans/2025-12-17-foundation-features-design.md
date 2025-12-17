# Foundation Features Design

**Date:** 2025-12-17
**Status:** Design Complete, Ready for Implementation

---

## Overview

Build core product foundations to support real users: authentication, conversation persistence, guest-to-registered conversion, and qualitative feedback collection. Keep everything brutally simple - ship the minimum that enables real user testing.

---

## Core Goals

1. **Authentication** - Magic link auth via NextAuth.js + Resend
2. **Saved Strategies** - Let authenticated users view past Decision Stacks
3. **Guest Flow** - Let guests complete full flow, then prompt registration
4. **Feedback Collection** - Single pointed question after strategy generation
5. **Cold Start Validation** - Measure abandonment and demand for alternative entry points

---

## Architecture Overview

### Database Changes

**Add User Model:**
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  createdAt     DateTime @default(now())
  conversations Conversation[]
  traces        Trace[]
  feedbacks     Feedback[]
}
```

**Update Existing Models:**
```prisma
model Conversation {
  userId    String
  user      User   @relation(fields: [userId], references: [id])
  // ... existing fields
}

model Trace {
  userId    String
  user      User   @relation(fields: [userId], references: [id])
  // ... existing fields
}
```

**Add Feedback Model:**
```prisma
model Feedback {
  id           String   @id @default(cuid())
  traceId      String
  userId       String?
  responseText String   @db.Text
  createdAt    DateTime @default(now())

  trace        Trace    @relation(fields: [traceId], references: [id])
  user         User?    @relation(fields: [userId], references: [id])

  @@index([traceId])
  @@index([userId])
  @@index([createdAt])
}
```

**Migration Strategy:**
- Existing temp userId strings become orphaned (acceptable - no real users in beta)
- All new conversations link to authenticated User.id
- Guests create conversations with temporary session ID, linked to User on registration

### Authentication Stack

**NextAuth.js Configuration:**
- Email provider with magic links
- Resend API for email delivery
- JWT sessions (NextAuth default)
- 24-hour link expiration
- No passwords, no OAuth complexity

**Environment Variables:**
```bash
NEXTAUTH_SECRET=generated-secret
NEXTAUTH_URL=https://strategist.humventures.com.au
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=noreply@humventures.com.au
```

**API Routes:**
- `/api/auth/[...nextauth]` - NextAuth handler
- `/api/auth/signin` - Magic link request
- `/api/auth/callback/email` - Email verification

### UI Architecture

**Flow States:**
```typescript
type FlowStep = 'intro' | 'chat' | 'extraction' | 'strategy';
```

**New Components:**
- `IntroCard` - Cold start priming with fake door
- `RegistrationBanner` - Guest conversion prompt
- `FeedbackModal` - Qual feedback collection (90s idle trigger)
- `Sidebar` - Collapsible saved strategies list
- `StrategyListItem` - Individual saved strategy entry

**Layout Changes:**
- Collapsible sidebar (arrow icon: `<` or `>`)
- State persists in localStorage
- Mobile: Closed by default, overlay when open
- Desktop: Open by default, pushes content

---

## Feature 1: Authentication

### User Flow

**New User (Guest → Registered):**
1. Complete conversation as guest (temp session ID)
2. Generate Decision Stack
3. See registration banner
4. Enter email → receive magic link
5. Click link → authenticated
6. Strategy auto-saved to new User account
7. Sidebar appears with saved strategy

**Returning User:**
1. Visit site → redirected to sign in if not authenticated
2. Enter email → receive magic link
3. Click link → authenticated
4. See sidebar with saved strategies
5. Click "Start New" or select existing strategy

### Session Management

**Guest Sessions:**
- Anonymous session ID stored in cookie
- Conversations linked to session ID
- On registration, transfer session's conversations to User

**Authenticated Sessions:**
- NextAuth JWT in httpOnly cookie
- Server-side session validation
- Conversations always linked to User.id

### Email Template

**Magic Link Email (via Resend):**
```
Subject: Your login link for Strategist

Hi there,

Click the link below to sign in to Strategist:

[Sign in to Strategist] → https://strategist.humventures.com.au/api/auth/callback/email?token=...

This link expires in 24 hours.

---
Humble Ventures
https://humventures.com.au
```

---

## Feature 2: Saved Strategies

### Sidebar Design

**Collapsible Behavior:**
- Toggle button in top-left (arrow icon: `<` when open, `>` when closed)
- State persists in localStorage: `sidebar_collapsed`
- Smooth transition animation (200ms)

**Content Structure:**
```
┌─────────────────────┐
│ Recent Strategies   │
│ ─────────────────── │
│ • Dec 17, 2025      │  ← System-generated name
│   Growth Strategy   │
│                     │
│ • Dec 15, 2025      │
│   Market Expansion  │
│                     │
│ • Dec 10, 2025      │
│   Product Vision    │
│                     │
│ [+ Start New]       │
└─────────────────────┘
```

**Visibility Rules:**
- Hidden for guests (no strategies to show)
- Appears after registration with newly-saved strategy
- Shows most recent 10 strategies (oldest dropped)

### Naming Convention

**System-Generated Names:**
1. Extract first 3-4 words from Vision statement
2. Fallback: "Strategy - [Month Day]" if Vision unavailable
3. No user editing (keep simple, can add later)

**Examples:**
- Vision: "To be the trusted strategic partner..." → "Trusted Strategic Partner"
- Vision: "Empowering growth-stage SaaS teams..." → "Empowering Growth Stage"

### Strategy View

**URL Pattern:**
- `/strategy/[traceId]` - Individual saved strategy

**Page Content:**
- Read-only StrategyDisplay component
- Shows Vision, Mission, Objectives (full output)
- "Continue this strategy" button → Fake door
  - Logs `continue_strategy_clicked` event
  - Toast: "Coming soon! We're building the ability to refine your strategy over multiple sessions."

**Data Loading:**
```typescript
// API: GET /api/strategy/[traceId]
// Returns: { trace: Trace, strategy: StrategyStatements }
// Auth: Requires userId matches trace.userId
```

---

## Feature 3: Guest Flow & Conversion

### Registration Banner

**Placement:**
- Appears immediately after strategy generation
- Above the Decision Stack output
- Persistent until dismissed or user registers

**Design:**
```
┌──────────────────────────────────────────────────┐
│ ✨ Save this strategy                            │
│                                                  │
│ Create your account to access this later        │
│ [Email address            ] [Send magic link]   │
│                                                  │
│ We'll email you a login link - no password needed │
└──────────────────────────────────────────────────┘
```

**Interaction Flow:**
1. User enters email
2. Click "Send magic link"
3. API: POST `/api/auth/signin` with email
4. Banner updates: "Check your email for login link"
5. User clicks link in email
6. NextAuth authenticates, creates User record
7. Transfer guest session's conversation to User
8. Redirect to `/strategy/[traceId]`
9. Sidebar appears with saved strategy

### Conversion Tracking

**Events:**
- `registration_banner_shown` - Banner displayed to guest
- `registration_initiated` - Email submitted
- `guest_registered` - Magic link clicked, user created
- Metadata: `conversionTimeMs` (banner shown → registered)

**Metric:**
- Registration rate: `guest_registered / registration_banner_shown`
- Validates: Higher quality outputs → higher registration

---

## Feature 4: Feedback Collection

### Feedback Modal

**Trigger:**
- 90 seconds idle on strategy screen
- Both guests and authenticated users
- Once per strategy (don't re-trigger)

**Design:**
```
┌──────────────────────────────────────────────────┐
│ Quick question                               [×] │
│                                                  │
│ Is this good enough that you'd use it for       │
│ strategy development? Why or why not?           │
│                                                  │
│ [Text area - 3-4 rows                          ] │
│                                                  │
│ [Skip]                      [Submit feedback]    │
└──────────────────────────────────────────────────┘
```

**Idle Detection:**
```typescript
// Track user activity (mouse move, scroll, keypress)
// Reset timer on activity
// After 90s idle → show modal
// localStorage flag: `feedback_shown_${traceId}` to prevent re-show
```

**Submission:**
```typescript
// API: POST /api/feedback
// Body: { traceId, responseText, userId? }
// Creates Feedback record
// Closes modal, shows toast: "Thanks for your feedback!"
```

**Skip Behavior:**
- Closes modal
- Sets localStorage flag (don't show again)
- No event logged (implicit "not interested")

### Data Analysis

**Feedback Schema:**
```typescript
interface Feedback {
  id: string;
  traceId: string;
  userId?: string;
  responseText: string;
  createdAt: Date;
}
```

**Analysis Queries:**
- All feedback responses (manual review)
- Keyword search for patterns ("too generic", "not specific", "helpful")
- Link feedback to quality ratings and experiment variants
- Identify themes for future improvements

---

## Feature 5: Cold Start Priming & Validation

### Intro Card

**Replaces immediate first question:**

Shows on page load, before conversation starts:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  Ready to develop your Decision Stack?          │
│                                                  │
│  I'll ask 3-10 questions to understand your     │
│  business, then generate your Vision, Mission,  │
│  and Objectives.                                 │
│                                                  │
│  Takes about 5-10 minutes.                      │
│                                                  │
│  [Let's start]                                   │
│                                                  │
│  Other ways to get started? →                   │  ← Fake door
│                                                  │
└──────────────────────────────────────────────────┘
```

**Implementation:**
- New flow state: `intro` (before `chat`)
- No API call until "Let's start" clicked
- Reduces unnecessary API calls from bounces

### User Actions

**"Let's start" Button:**
1. Log event: `cold_start_initiated`
2. Call API: POST `/api/conversation/start`
3. Transition to `chat` state with first question
4. Begin conversation flow

**"Other ways to get started?" Link (Fake Door):**
1. Log event: `alternative_start_clicked`
2. Show toast: "Thanks for your interest! We're exploring different ways to help you get started. We'll let you know when we have options."
3. Stay on intro card (don't start conversation)

### Validation Metrics

**Abandonment Rate:**
```
abandonment_rate = 1 - (strategy_generated / cold_start_initiated)
```

**Interpretation:**
- Low abandonment (<20%) → Current flow works, no urgency for alternatives
- Medium abandonment (20-40%) → Consider alternatives, but not critical
- High abandonment (>40%) → Strong signal to build structured intake

**Alternative Demand:**
```
alternative_demand = alternative_start_clicked / cold_start_initiated
```

**Interpretation:**
- Low demand (<10%) → Current approach sufficient
- Medium demand (10-25%) → Some interest, monitor feedback themes
- High demand (>25%) → Strong signal to prioritize alternative entry modes

---

## Implementation Scope

### Must Have (Foundation MVP)

1. **Authentication**
   - NextAuth.js setup with Email provider
   - Resend integration for magic links
   - User model and migrations
   - Session management

2. **Saved Strategies**
   - Collapsible sidebar (arrow toggle)
   - List recent strategies (system-named)
   - View saved strategy page (`/strategy/[traceId]`)
   - "Continue this strategy" fake door

3. **Guest Flow**
   - Registration banner after generation
   - Guest → User conversion flow
   - Auto-save on registration

4. **Feedback Collection**
   - 90s idle trigger
   - Single question modal
   - Submit to Feedback table

5. **Cold Start Priming**
   - Intro card before conversation
   - "Let's start" button
   - "Other ways" fake door
   - Event tracking for validation

### Explicitly Out of Scope

- User profile editing
- Password-based auth
- OAuth providers
- Email export / PDF generation
- Strategy editing or deletion
- Multi-session iteration (continue strategy)
- Alternative intake modes (fake door only)
- User name collection (optional field, not required)

---

## Event Tracking

### New Events

```typescript
// Cold Start
'cold_start_initiated'          // Clicked "Let's start"
'alternative_start_clicked'     // Clicked "Other ways" fake door

// Registration
'registration_banner_shown'     // Banner displayed to guest
'registration_initiated'        // Email submitted
'guest_registered'              // User created via magic link

// Saved Strategies
'strategy_viewed'               // Clicked saved strategy in sidebar
'continue_strategy_clicked'     // Clicked "Continue" fake door

// Feedback
'feedback_modal_shown'          // Modal displayed after 90s idle
'feedback_submitted'            // User submitted feedback
```

### Event Data Schema

```typescript
interface Event {
  id: string;
  conversationId: string;
  traceId?: string;
  timestamp: Date;
  eventType: string;
  eventData: {
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  };
}
```

---

## Success Metrics

### Conversion Funnel

```
Cold Start Initiated (100%)
    ↓
Strategy Generated (target: >60%)    ← Abandonment signal
    ↓
Registration Banner Shown (guests only)
    ↓
Guest Registered (target: >30%)      ← Quality signal
```

### Engagement Metrics

- **Saved strategies viewed** - Do users return to past work?
- **Continue strategy clicks** - Demand for iteration feature?
- **Alternative start clicks** - Need for different entry mode?
- **Feedback response rate** - User engagement with qual collection?

### Quality Signals

- **Registration rate** - Proxy for output quality
- **Feedback sentiment** - Manual coding of "yes/no" on qual question
- **Return rate** - Do registered users come back?

---

## Technical Dependencies

### NPM Packages

```json
{
  "next-auth": "^4.24.5",        // Already in package.json
  "resend": "^3.0.0",             // New - email delivery
  "@auth/prisma-adapter": "^1.0.0" // New - NextAuth Prisma integration
}
```

### Environment Setup

**Required:**
- Resend API key (existing account: humventures.com.au)
- NextAuth secret (generate via `openssl rand -base64 32`)
- NextAuth URL (https://strategist.humventures.com.au)

**Optional:**
- RESEND_FROM_EMAIL (defaults to noreply@humventures.com.au)

---

## Migration & Rollout

### Database Migration Steps

1. Create User model
2. Add User relations to Conversation and Trace
3. Create Feedback model
4. Run migration: `npx prisma migrate dev --name add-auth-and-feedback`
5. Existing temp userId strings become orphaned (acceptable)

### Feature Flag Strategy

**No flags needed** - These are foundational features:
- Auth is opt-in (guests can still use without signing up)
- Sidebar only shows when authenticated
- Feedback modal is gentle (can skip)
- Intro card replaces immediate conversation start

### Rollout Plan

1. Deploy to production (all features live)
2. Test auth flow with team
3. Monitor event tracking for first week
4. Review abandonment and conversion metrics
5. Decide on next priorities based on data

---

## Future Enhancements (Post-Foundation)

**Based on validation signals:**

1. **If high abandonment** → Build structured intake alternatives
2. **If high continue_strategy_clicked** → Build multi-session iteration
3. **If low registration** → Consider email export as alternative save
4. **If feedback reveals patterns** → Address specific quality issues

**General improvements:**
- User profile page (name, email, settings)
- Delete saved strategies
- Export strategy to PDF/email
- Share strategy with link
- Rename strategies
- Multi-session strategy development

---

## Cross-References

- **Experiment Context:** E1a emergent extraction builds on these foundations
- **Future Vision:** Multi-session iteration mentioned in `docs/feature-backlog/future-improvements.md`
- **UI Foundation:** Sidebar layout designed in `docs/plans/2025-12-10-sidebar-layout-design.md`

---

**Design validated:** 2025-12-17
**Next step:** Implementation planning
