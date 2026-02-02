# Simplified First-Time Experience

**Date:** 2025-01-22
**Status:** Approved

## Problem

The current first-time guest experience is overwhelming. Guests land on a fully populated demo project with conversations, fragments, and strategies. While this showcases the product's capabilities, it's the opposite of progressive disclosure and doesn't let users start with their own work.

## Solution

Simplify the entry point: all users with empty projects see a clean starting screen with an inline chat. The demo becomes opt-in via "See an example" rather than the default landing.

## Design

### 1. Entry Flow

All users with empty projects (guest or authenticated) see a simplified empty state:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Hi, I'm Luna. Let's clarify your strategic         │
│  thinking.                                          │
│                                                     │
│  To start, tell me about your strategic challenge,  │
│  upload an existing doc and we can brainstorm from  │
│  there, or check out an example to see what the     │
│  output looks like.                                 │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Tell me about your strategic challenge...     │  │
│  │                                           [↑] │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [ Upload existing doc ]    [ See an example ]      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. Inline Chat Behavior

When user submits text or uploads a document:

- Input area expands into full inline chat interface
- Chat happens in-place on the page (no sheet/modal)
- User has conversation with Luna (Q&A flow)
- When conversation reaches extraction point → transition to ChatSheet for extraction confirmation and strategy generation
- This transition "trains" users on the sheet pattern for subsequent chats

**After document upload:**
- Document upload dialog opens (existing component)
- On completion, inline chat auto-opens with context about the uploaded file
- Conversation proceeds inline, same flow

### 3. Demo Project Behavior

**On-demand creation (not pre-loaded):**
- Guest arrives → empty project only (no background seeding)
- User clicks "See an example" → create demo project, hydrate with data, add to sidebar
- Brief loading state while hydrating ("Setting up example...")
- Then navigates to demo project

**For authenticated users:**
- Same "See an example" button available
- Clicking it creates/loads a demo project for them
- Appears in sidebar, fully explorable

### 4. Guest-to-Authenticated Transition

After guest generates their first strategy:
- Strategy page displays with dismissable alert banner at top
- Banner encourages creating an account to save work
- Banner reappears each time they view the strategy (until signed up)
- Once signed up, guest data transfers to their account (existing migration)

**Banner copy:**
> "Your strategy isn't saved yet. Create an account to keep your work."
> [Create Account] [Dismiss]

### 5. What Stays The Same

- **ChatSheet for subsequent chats** - After first strategy, all new conversations use the sheet
- **Full project page** - Once user has content, they see the existing project dashboard
- **Demo project functionality** - Fully interactive when loaded
- **Document upload dialog** - Reused, just triggered from empty state
- **Extraction/generation flow** - Same experience, entered via sheet transition

## Scope Summary

| Change | Description |
|--------|-------------|
| New empty state component | Replaces `ProjectEmptyState` with inline chat UI |
| Inline chat for first conversation | Expands in-place, transitions to sheet for extraction |
| On-demand demo creation | Remove background seeding, create when requested |
| Sidebar demo visibility | Demo project appears only after user requests it |
| Guest save banner | Dismissable alert on strategy page, reappears each visit |
| Remove auto-redirect to demo | Guests land on empty project, not populated demo |

## Technical Notes

- Inline chat will need to reuse conversation API logic from ChatSheet
- Demo hydration uses existing `seedDemoProject()` function
- Guest save banner should check `isGuestUser()` before rendering
- Banner dismiss state can be session-based (reappears on new session/page load)
