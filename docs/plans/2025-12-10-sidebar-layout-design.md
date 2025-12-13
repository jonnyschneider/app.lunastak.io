# Sidebar Layout & Tailwind Cleanup Design

**Date:** 2025-12-10
**Status:** Validated, ready for implementation

## Overview

Modernize Tailwind setup and implement Catalyst UI sidebar layout with minimal navigation structure. Maintains greyscale aesthetic while establishing proper app shell for future features.

## Goals

1. Clean up Tailwind configuration to follow modern conventions (CSS custom properties in globals.css)
2. Remove leftover ReactFlow styles
3. Implement Catalyst sidebar-only layout (no top header)
4. Add placeholder authentication UI (anonymous user + logout)
5. Establish component structure for future navigation features

## Architecture Decisions

### Layout Pattern: Sidebar-Only (Option C)
- **Rationale:** Cleanest approach for focused single-flow app
- Sidebar contains branding in SidebarHeader
- Navbar only shows on mobile (hamburger menu)
- SidebarFooter has user profile and logout
- No competing headers in main content area

### Branding Location: Sidebar Only (Option A)
- **Rationale:** Standard Catalyst pattern, cleaner separation
- "Decision Stack" text in SidebarHeader
- Remove h1 title from page.tsx main content
- Main content becomes pure workspace

### Component Folder: `ui/` (not `catalyst/`)
- **Rationale:** Modern convention (shadcn/ui pattern)
- Clear semantic meaning
- Matches contemporary Next.js projects

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Update: Add Catalyst HTML classes
│   └── page.tsx                # Update: Use AppLayout, remove h1
├── components/
│   ├── ui/                     # NEW: Headless UI wrapper components
│   │   ├── button.tsx          # Catalyst Button
│   │   ├── input.tsx           # Catalyst Input
│   │   ├── avatar.tsx          # Catalyst Avatar
│   │   ├── dropdown.tsx        # Catalyst Dropdown system
│   │   ├── sidebar.tsx         # Catalyst Sidebar system
│   │   └── navbar.tsx          # Catalyst Navbar system
│   ├── layout/                 # NEW: App layout components
│   │   └── app-layout.tsx      # Wrapper around SidebarLayout
│   ├── ChatInterface.tsx       # Existing
│   ├── ExtractionConfirm.tsx   # Existing
│   ├── StrategyDisplay.tsx     # Existing
│   └── FeedbackButtons.tsx     # Existing
└── styles/
    └── globals.css             # Update: Add CSS variables, remove ReactFlow
```

## Tailwind Setup (Modern Convention)

### globals.css Changes

**Remove:**
- Lines 5-20: ReactFlow leftover styles (.flow-container, .flow-instance, .react-flow__node)

**Add:**
```css
@layer base {
  :root {
    --background: 0 0% 100%;           /* white */
    --foreground: 0 0% 9%;             /* zinc-900 */
    --muted: 0 0% 96%;                 /* zinc-100 */
    --muted-foreground: 0 0% 45%;      /* zinc-500 */
    --border: 0 0% 90%;                /* zinc-200 */
    --input: 0 0% 90%;                 /* zinc-200 */
    --ring: 0 0% 9%;                   /* zinc-900 */
  }

  .dark {
    --background: 0 0% 9%;             /* zinc-900 */
    --foreground: 0 0% 98%;            /* zinc-50 */
    --muted: 0 0% 15%;                 /* zinc-800 */
    --muted-foreground: 0 0% 64%;      /* zinc-400 */
    --border: 0 0% 27%;                /* zinc-700 */
    --input: 0 0% 27%;                 /* zinc-700 */
    --ring: 0 0% 83%;                  /* zinc-300 */
  }
}
```

### tailwind.config.ts Changes

Keep minimal - only borderRadius extension, colors come from CSS variables:
```typescript
theme: {
  extend: {
    colors: {
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      muted: {
        DEFAULT: "hsl(var(--muted))",
        foreground: "hsl(var(--muted-foreground))",
      },
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
    },
    borderRadius: {
      'sm': '0.25rem',
      'DEFAULT': '0.375rem',
      'md': '0.375rem',
      'lg': '0.5rem',
      'xl': '0.75rem',
      '2xl': '1rem',
    },
  },
}
```

## Sidebar Content Structure

### SidebarHeader (top, always visible)
- "Decision Stack" text branding
- Simple, clean presentation
- Greyscale styling (zinc-900 text on white bg, inverse in dark mode)

### SidebarBody (main navigation)
- Minimal for now
- Uses SidebarSpacer to push footer to bottom
- Ready for future navigation items:
  - Conversation history
  - Settings
  - Help/documentation

### SidebarFooter (bottom, user profile)
- Avatar component with placeholder initials or icon
- "Anonymous User" display name (temp until auth implemented)
- Dropdown menu on click:
  - "Logout" option (UI only, non-functional)
  - Future: Settings, Profile options
- Greyscale styling, subtle hover states

### Mobile Behavior (Catalyst responsive pattern)
- Navbar at top with hamburger menu icon
- Sidebar slides in from left on hamburger click
- Auto-closes after interaction (mobile only)
- Desktop (lg+): sidebar always visible, navbar hidden

## Dependencies

**To Install:**
- `@headlessui/react` - Core headless UI primitives
- `@heroicons/react` - Icon library (16/solid and 20/solid)

**Already Installed:**
- `clsx` - Conditional className merging
- `tailwind-merge` - Tailwind class conflict resolution

## Catalyst Components to Implement

All components copied from Catalyst docs (MIT license, copy-paste ready):

**ui/button.tsx**
- Base Button component
- Variants: solid (default), outline, plain
- Color support (greyscale focus: zinc, dark/zinc)

**ui/input.tsx**
- Text input with Catalyst styling
- Focus states, disabled states
- Integrates with form validation

**ui/avatar.tsx**
- User avatar display
- Supports initials, images, icons
- Size variants

**ui/dropdown.tsx**
- DropdownButton - Trigger element
- DropdownMenu - Menu container
- DropdownItem - Individual menu items
- DropdownDivider - Visual separator
- DropdownLabel - Section headers

**ui/sidebar.tsx**
- SidebarLayout - Root layout wrapper
- Sidebar - Main sidebar container
- SidebarHeader - Top section (branding)
- SidebarBody - Main navigation area
- SidebarFooter - Bottom section (user profile)
- SidebarSection - Groups related items
- SidebarItem - Individual navigation links
- SidebarLabel - Text labels
- SidebarSpacer - Vertical spacing

**ui/navbar.tsx**
- Navbar - Mobile top bar
- NavbarSection - Groups navbar items
- NavbarItem - Individual navbar elements
- NavbarSpacer - Distributes space

## Layout Integration

### src/app/layout.tsx
Update HTML element classes for Catalyst background pattern:
```tsx
<html
  lang="en"
  className={`${inter.className} bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950`}
>
```

### src/components/layout/app-layout.tsx (NEW)
Wrapper around SidebarLayout with Decision Stack-specific structure:
```tsx
import { SidebarLayout } from '@/components/ui/sidebar'
import { Navbar } from '@/components/ui/navbar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarLayout
      navbar={<AppNavbar />}
      sidebar={<AppSidebar />}
    >
      {children}
    </SidebarLayout>
  )
}

function AppNavbar() {
  // Mobile hamburger menu
}

function AppSidebar() {
  // SidebarHeader: "Decision Stack" branding
  // SidebarBody: Empty with SidebarSpacer
  // SidebarFooter: Anonymous user + logout dropdown
}
```

### src/app/page.tsx
Update to use AppLayout and remove h1:
```tsx
import { AppLayout } from '@/components/layout/app-layout'

export default function Home() {
  // ... existing state and logic

  return (
    <AppLayout>
      {/* Remove: <h1>Decision Stack</h1> */}
      {/* Keep: flowStep conditionals */}
    </AppLayout>
  )
}
```

## Color Adaptation

Staying with greyscale (zinc palette) to maintain recent UI simplification work:
- Primary buttons: zinc-800/900 backgrounds
- Borders: zinc-200/700 (light/dark)
- Text: zinc-900/50 (light/dark)
- Hover states: zinc-700/800
- No custom color palette yet (can add later if needed)

Catalyst components will be adapted to use zinc instead of default blue/indigo.

## Implementation Notes

**Phase 1: Cleanup & Foundation**
1. Update globals.css (remove ReactFlow, add CSS variables)
2. Update tailwind.config.ts (add CSS variable references)
3. Install dependencies (@headlessui/react, @heroicons/react)
4. Verify build succeeds

**Phase 2: Catalyst Components**
5. Copy Catalyst components to src/components/ui/
6. Adapt colors to greyscale (zinc palette)
7. Verify components compile

**Phase 3: Layout Integration**
8. Create AppLayout component
9. Update app/layout.tsx HTML classes
10. Update app/page.tsx to use AppLayout
11. Test responsive behavior (mobile hamburger, desktop sidebar)

**Phase 4: Verification**
12. Manual testing: sidebar navigation, mobile menu, logout dropdown
13. Check dark mode styling
14. Verify existing features still work (chat, extraction, strategy display)

## Success Criteria

- ✅ ReactFlow CSS removed from globals.css
- ✅ Modern CSS custom properties theme system in place
- ✅ @headlessui/react and @heroicons/react installed
- ✅ All Catalyst components in src/components/ui/
- ✅ AppLayout renders with sidebar on desktop
- ✅ Mobile hamburger menu works
- ✅ "Decision Stack" branding in SidebarHeader
- ✅ Anonymous user + logout dropdown in SidebarFooter
- ✅ Existing conversation flow unchanged and functional
- ✅ Greyscale aesthetic maintained
- ✅ No TypeScript errors
- ✅ No console warnings

## Future Considerations

**Navigation Items (Phase 2)**
- Conversation history list
- Settings page link
- Help/documentation

**Authentication (Phase 2)**
- Replace anonymous user with real auth (NextAuth magic links per README)
- Functional logout
- User profile management

**Responsive Refinements**
- Consider collapsible sidebar on desktop for more content space
- Add keyboard shortcuts for navigation
- Improve mobile menu animations
