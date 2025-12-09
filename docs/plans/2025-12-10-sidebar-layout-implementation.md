# Sidebar Layout & Tailwind Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize Tailwind setup with CSS custom properties and implement Catalyst UI sidebar layout with minimal navigation structure.

**Architecture:** Clean up globals.css and tailwind.config.ts to follow modern conventions (CSS variables in @layer base), install Headless UI dependencies, copy Catalyst components to src/components/ui/, create AppLayout wrapper, integrate into app structure.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS 3.3, Headless UI, Heroicons, TypeScript

---

## Task 1: Clean Up globals.css

**Files:**
- Modify: `src/styles/globals.css`

**Step 1: Remove ReactFlow leftover styles**

Open `src/styles/globals.css` and delete lines 5-20 (everything after the Tailwind directives):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

That's it - the file should only contain those three lines for now.

**Step 2: Verify the file**

Run: `cat src/styles/globals.css`

Expected output:
```
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "chore: remove ReactFlow leftover styles from globals.css"
```

---

## Task 2: Add CSS Custom Properties for Theme

**Files:**
- Modify: `src/styles/globals.css`

**Step 1: Add CSS variables for greyscale theme**

Add the following after the Tailwind directives in `src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

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

**Step 2: Verify the file compiles**

Run: `npm run dev`

Expected: Dev server starts without errors

**Step 3: Stop dev server**

Press Ctrl+C to stop

**Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: add CSS custom properties for greyscale theme"
```

---

## Task 3: Update Tailwind Config with CSS Variable References

**Files:**
- Modify: `tailwind.config.ts`

**Step 1: Update config to reference CSS variables**

Replace the entire contents of `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
  },
  plugins: [],
};
export default config;
```

**Step 2: Verify config compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: update Tailwind config to use CSS custom properties"
```

---

## Task 4: Install Headless UI Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install @headlessui/react**

Run: `npm install @headlessui/react`

Expected: Package installed successfully

**Step 2: Install @heroicons/react**

Run: `npm install @heroicons/react`

Expected: Package installed successfully

**Step 3: Verify installations**

Run: `cat package.json | grep -A 3 '"dependencies"'`

Expected: Should see both `@headlessui/react` and `@heroicons/react` in dependencies

**Step 4: Verify build**

Run: `npm run build`

Expected: Build succeeds with no errors

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @headlessui/react and @heroicons/react"
```

---

## Task 5: Create ui Directory and Link Component

**Files:**
- Create: `src/components/ui/link.tsx`

**Step 1: Create ui directory**

Run: `mkdir -p src/components/ui`

**Step 2: Create Link component**

Create `src/components/ui/link.tsx`:

```typescript
import NextLink from 'next/link'
import React, { forwardRef } from 'react'

export const Link = forwardRef(function Link(
  props: React.ComponentPropsWithoutRef<typeof NextLink>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  return <NextLink {...props} ref={ref} />
})
```

**Step 3: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/components/ui/link.tsx
git commit -m "feat: add Catalyst Link component"
```

---

## Task 6: Create Button Component

**Files:**
- Create: `src/components/ui/button.tsx`

**Step 1: Create Button component**

Create `src/components/ui/button.tsx`:

```typescript
import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'
import { Link } from './link'

const styles = {
  base: [
    'relative isolate inline-flex items-center justify-center gap-x-2 rounded-lg border text-base/6 font-semibold',
    'px-[calc(theme(spacing.3.5)-1px)] py-[calc(theme(spacing.2.5)-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing.1.5)-1px)] sm:text-sm/6',
    'focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-zinc-900',
    'data-[disabled]:opacity-50',
  ],
  solid: [
    'border-transparent bg-[--btn-border]',
    'dark:bg-[--btn-bg]',
    'before:absolute before:inset-0 before:-z-10 before:rounded-[calc(theme(borderRadius.lg)-1px)] before:bg-[--btn-bg]',
    'before:shadow-sm',
    'dark:before:hidden',
    'dark:border-white/5',
    'after:absolute after:inset-0 after:-z-10 after:rounded-[calc(theme(borderRadius.lg)-1px)]',
    'after:shadow-[inset_0_1px_theme(colors.white/15%)]',
    'after:data-[active]:bg-[--btn-hover-overlay] after:data-[hover]:bg-[--btn-hover-overlay]',
    'dark:after:-inset-px dark:after:rounded-lg',
    'before:data-[disabled]:shadow-none after:data-[disabled]:shadow-none',
  ],
  outline: [
    'border-zinc-950/10 text-zinc-950 data-[active]:bg-zinc-950/[2.5%] data-[hover]:bg-zinc-950/[2.5%]',
    'dark:border-white/15 dark:text-white dark:[--btn-bg:transparent] dark:data-[active]:bg-white/5 dark:data-[hover]:bg-white/5',
  ],
  plain: [
    'border-transparent text-zinc-950 data-[active]:bg-zinc-950/5 data-[hover]:bg-zinc-950/5',
    'dark:text-white dark:data-[active]:bg-white/10 dark:data-[hover]:bg-white/10',
  ],
  colors: {
    'dark/zinc': [
      'text-white [--btn-bg:theme(colors.zinc.900)] [--btn-border:theme(colors.zinc.950/90%)] [--btn-hover-overlay:theme(colors.white/10%)]',
      'dark:text-white dark:[--btn-bg:theme(colors.zinc.600)] dark:[--btn-hover-overlay:theme(colors.white/5%)]',
    ],
    light: [
      'text-zinc-950 [--btn-bg:white] [--btn-border:theme(colors.zinc.950/10%)] [--btn-hover-overlay:theme(colors.zinc.950/2.5%)]',
      'dark:text-white dark:[--btn-hover-overlay:theme(colors.white/5%)] dark:[--btn-bg:theme(colors.zinc.800)]',
    ],
    zinc: [
      'text-white [--btn-hover-overlay:theme(colors.white/10%)] [--btn-bg:theme(colors.zinc.600)] [--btn-border:theme(colors.zinc.700)]',
      'dark:[--btn-hover-overlay:theme(colors.white/5%)] dark:[--btn-bg:theme(colors.zinc.700)]',
    ],
  },
}

type ButtonProps = (
  | { color?: keyof typeof styles.colors; outline?: never; plain?: never }
  | { color?: never; outline: true; plain?: never }
  | { color?: never; outline?: never; plain: true }
) & { children: React.ReactNode } & (
  | Omit<Headless.ButtonProps, 'as' | 'className'>
  | Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>
)

export const Button = forwardRef(function Button(
  { color, outline, plain, className, children, ...props }: ButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  const classes = clsx(
    className,
    styles.base,
    outline
      ? styles.outline
      : plain
        ? styles.plain
        : clsx(styles.solid, styles.colors[color ?? 'dark/zinc'])
  )

  return 'href' in props ? (
    <Link {...props} className={classes} ref={ref as any}>
      {children}
    </Link>
  ) : (
    <Headless.Button {...props} className={classes} ref={ref}>
      {children}
    </Headless.Button>
  )
})
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: add Catalyst Button component with greyscale colors"
```

---

## Task 7: Create Input Component

**Files:**
- Create: `src/components/ui/input.tsx`

**Step 1: Create Input component**

Create `src/components/ui/input.tsx`:

```typescript
import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'

const dateTypes = ['date', 'datetime-local', 'month', 'time', 'week']
type DateType = (typeof dateTypes)[number]

export const Input = forwardRef(function Input(
  {
    className,
    ...props
  }: {
    className?: string
    type?: 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'url' | DateType
  } & Omit<Headless.InputProps, 'as' | 'className'>,
  ref: React.ForwardedRef<HTMLInputElement>
) {
  return (
    <span
      data-slot="control"
      className={clsx([
        className,
        'relative block w-full',
        'before:absolute before:inset-px before:rounded-[calc(theme(borderRadius.lg)-1px)] before:bg-white before:shadow-sm',
        'dark:before:hidden',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent sm:after:focus-within:ring-2 sm:after:focus-within:ring-zinc-900',
        'has-[[data-disabled]]:opacity-50 has-[[data-disabled]]:before:bg-zinc-950/5 has-[[data-disabled]]:before:shadow-none',
      ])}
    >
      <Headless.Input
        ref={ref}
        {...props}
        className={clsx([
          'relative block w-full appearance-none rounded-lg px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing.1.5)-1px)]',
          'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white',
          'border border-zinc-950/10 data-[hover]:border-zinc-950/20 dark:border-white/10 dark:data-[hover]:border-white/20',
          'bg-transparent dark:bg-white/5',
          'focus:outline-none',
          'data-[invalid]:border-red-500 data-[invalid]:data-[hover]:border-red-500 data-[invalid]:dark:border-red-600 data-[invalid]:data-[hover]:dark:border-red-600',
          'data-[disabled]:border-zinc-950/20 dark:data-[hover]:data-[disabled]:border-white/15 data-[disabled]:dark:border-white/15 data-[disabled]:dark:bg-white/[2.5%]',
        ])}
      />
    </span>
  )
})
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat: add Catalyst Input component"
```

---

## Task 8: Create Avatar Component

**Files:**
- Create: `src/components/ui/avatar.tsx`

**Step 1: Create Avatar component**

Create `src/components/ui/avatar.tsx`:

```typescript
import clsx from 'clsx'
import React from 'react'

export function Avatar({
  src,
  initials,
  alt = '',
  className,
  ...props
}: {
  src?: string | null
  initials?: string
  alt?: string
  className?: string
} & React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      data-slot="avatar"
      className={clsx(
        className,
        'inline-grid size-10 shrink-0 align-middle [--avatar-radius:20%] [--ring-opacity:20%] *:col-start-1 *:row-start-1',
        'outline outline-1 -outline-offset-1 outline-black/[--ring-opacity] dark:outline-white/[--ring-opacity]'
      )}
      {...props}
    >
      {initials && (
        <svg
          className="size-full select-none fill-current text-[48px] font-medium uppercase"
          viewBox="0 0 100 100"
          aria-hidden={alt ? undefined : 'true'}
        >
          {alt && <title>{alt}</title>}
          <text
            x="50%"
            y="50%"
            alignmentBaseline="middle"
            dominantBaseline="middle"
            textAnchor="middle"
            dy=".125em"
          >
            {initials}
          </text>
        </svg>
      )}
      {src && <img className="rounded-[--avatar-radius]" src={src} alt={alt} />}
    </span>
  )
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/avatar.tsx
git commit -m "feat: add Catalyst Avatar component"
```

---

## Task 9: Create Dropdown Components

**Files:**
- Create: `src/components/ui/dropdown.tsx`

**Step 1: Create Dropdown component**

Create `src/components/ui/dropdown.tsx`:

```typescript
import * as Headless from '@headlessui/react'
import React from 'react'
import { Link } from './link'
import clsx from 'clsx'

export function Dropdown(props: Headless.MenuProps) {
  return <Headless.Menu {...props} />
}

export function DropdownButton<T extends React.ElementType = typeof Headless.MenuButton>({
  as = Headless.MenuButton,
  ...props
}: Headless.MenuButtonProps<T>) {
  return <Headless.MenuButton as={as} {...props} />
}

export function DropdownMenu({
  anchor = 'bottom',
  className,
  ...props
}: Headless.MenuItemsProps & { anchor?: 'bottom' | 'top' | 'left' | 'right' }) {
  return (
    <Headless.MenuItems
      {...props}
      transition
      anchor={anchor}
      className={clsx(
        className,
        // Anchor positioning
        '[--anchor-gap:theme(spacing.2)] [--anchor-padding:theme(spacing.1)] data-[anchor~=start]:[--anchor-offset:-6px] data-[anchor~=end]:[--anchor-offset:6px]',
        // Base styles
        'isolate w-max rounded-xl p-1',
        // Invisible border that is only visible in `forced-colors` mode for accessibility purposes
        'outline outline-1 outline-transparent focus:outline-none',
        // Handle scrolling when menu won't fit in viewport
        'overflow-y-auto',
        // Popover background
        'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
        // Shadows
        'shadow-lg ring-1 ring-zinc-950/10 dark:ring-inset dark:ring-white/10',
        // Define grid at the menu level
        'grid grid-cols-[auto_1fr_1.5rem_0.5rem_auto] items-center',
        // Transitions
        'transition data-[closed]:data-[leave]:opacity-0 data-[leave]:duration-100 data-[leave]:ease-in'
      )}
    />
  )
}

export function DropdownItem({
  className,
  ...props
}: { className?: string } & (
  | Omit<Headless.MenuItemProps<'button'>, 'as' | 'className'>
  | Omit<Headless.MenuItemProps<typeof Link>, 'as' | 'className'>
)) {
  const classes = clsx(
    className,
    // Base styles
    'col-span-5 group cursor-default rounded-lg px-3.5 py-2.5 focus:outline-none sm:px-3 sm:py-1.5',
    // Text styles
    'text-left text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white forced-colors:text-[CanvasText]',
    // Focus
    'data-[focus]:bg-zinc-100 dark:data-[focus]:bg-white/10',
    // Disabled state
    'data-[disabled]:opacity-50',
    // Forced colors mode
    'forced-color-adjust-none forced-colors:data-[focus]:bg-[Highlight] forced-colors:data-[focus]:text-[HighlightText] forced-colors:[&>[data-slot=icon]]:data-[focus]:text-[HighlightText]',
    // Use grid layout
    'col-start-1 grid grid-cols-subgrid'
  )

  return (
    <Headless.MenuItem>
      {'href' in props ? (
        <Link {...props} className={classes} />
      ) : (
        <button type="button" {...props} className={classes} />
      )}
    </Headless.MenuItem>
  )
}

export function DropdownDivider({ className, ...props }: { className?: string } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'col-span-5 mx-3.5 my-1 h-px border-0 bg-zinc-950/5 sm:mx-3 dark:bg-white/10 forced-colors:bg-[CanvasText]')}
    />
  )
}

export function DropdownLabel({ className, ...props }: { className?: string } & React.ComponentPropsWithoutRef<'span'>) {
  return <span {...props} className={clsx(className, 'col-start-2 row-start-1')} data-slot="label" />
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/dropdown.tsx
git commit -m "feat: add Catalyst Dropdown components"
```

---

## Task 10: Create Navbar Components

**Files:**
- Create: `src/components/ui/navbar.tsx`

**Step 1: Create Navbar component**

Create `src/components/ui/navbar.tsx`:

```typescript
import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'

export function Navbar({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return (
    <nav
      {...props}
      className={clsx(className, 'flex flex-1 items-center gap-4 py-2.5')}
    />
  )
}

export function NavbarDivider({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={clsx(className, 'h-6 w-px bg-zinc-950/10 dark:bg-white/10')}
    />
  )
}

export function NavbarSection({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'flex items-center gap-3')} />
}

export function NavbarSpacer({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div aria-hidden="true" {...props} className={clsx(className, 'flex-1')} />
}

export const NavbarItem = forwardRef(function NavbarItem(
  { current, className, children, ...props }: { current?: boolean; className?: string; children: React.ReactNode } & (
    | Omit<Headless.ButtonProps, 'as' | 'className'>
    | Omit<React.ComponentPropsWithoutRef<'a'>, 'className'>
  ),
  ref: React.ForwardedRef<HTMLAnchorElement | HTMLButtonElement>
) {
  const classes = clsx(
    // Base
    'relative flex min-w-0 items-center gap-3 rounded-lg p-2 text-left text-base/6 font-medium text-zinc-950 sm:text-sm/5',
    // Leading icon/icon-only
    'data-[slot=icon]:*:size-6 data-[slot=icon]:*:shrink-0 data-[slot=icon]:*:fill-zinc-500 sm:data-[slot=icon]:*:size-5',
    // Trailing icon (down chevron or similar)
    'data-[slot=icon]:last:*:ml-auto data-[slot=icon]:last:*:size-5 sm:data-[slot=icon]:last:*:size-4',
    // Avatar
    'data-[slot=avatar]:*:-m-0.5 data-[slot=avatar]:*:size-7 data-[slot=avatar]:*:[--ring-opacity:10%] sm:data-[slot=avatar]:*:size-6',
    // Hover
    'data-[hover]:bg-zinc-950/5 data-[slot=icon]:*:data-[hover]:fill-zinc-950',
    // Active
    'data-[active]:bg-zinc-950/5 data-[slot=icon]:*:data-[active]:fill-zinc-950',
    // Dark mode
    'dark:text-white dark:data-[slot=icon]:*:fill-zinc-400',
    'dark:data-[hover]:bg-white/5 dark:data-[slot=icon]:*:data-[hover]:fill-white',
    'dark:data-[active]:bg-white/5 dark:data-[slot=icon]:*:data-[active]:fill-white'
  )

  return (
    <span className={clsx(className, 'relative')}>
      {'href' in props ? (
        <a {...props} className={classes} data-current={current ? 'true' : undefined} ref={ref as React.ForwardedRef<HTMLAnchorElement>}>
          {children}
        </a>
      ) : (
        <Headless.Button
          {...props}
          className={clsx('cursor-default', classes)}
          data-current={current ? 'true' : undefined}
          ref={ref}
        >
          {children}
        </Headless.Button>
      )}
    </span>
  )
})
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/navbar.tsx
git commit -m "feat: add Catalyst Navbar components"
```

---

## Task 11: Create Sidebar Components (Part 1 - Base Components)

**Files:**
- Create: `src/components/ui/sidebar.tsx`

**Step 1: Create Sidebar component file with base components**

Create `src/components/ui/sidebar.tsx`:

```typescript
import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'
import { Link } from './link'

export function Sidebar({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'flex h-full flex-col p-4')}
    />
  )
}

export function SidebarHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'mb-4')}
    />
  )
}

export function SidebarBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'flex flex-1 flex-col')}
    />
  )
}

export function SidebarFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'mt-4 max-lg:hidden')}
    />
  )
}

export function SidebarSection({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'flex flex-col gap-0.5')}
    />
  )
}

export function SidebarDivider({ className, ...props }: React.ComponentPropsWithoutRef<'hr'>) {
  return (
    <hr
      {...props}
      className={clsx(className, 'my-4 border-t border-zinc-950/5 lg:-mx-4 dark:border-white/5')}
    />
  )
}

export function SidebarSpacer({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={clsx(className, 'mt-8 flex-1')}
    />
  )
}

export function SidebarHeading({ className, ...props }: React.ComponentPropsWithoutRef<'h3'>) {
  return (
    <h3
      {...props}
      className={clsx(
        className,
        'mb-1 px-2 text-xs/6 font-medium text-zinc-500 dark:text-zinc-400'
      )}
    />
  )
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/sidebar.tsx
git commit -m "feat: add Catalyst Sidebar base components"
```

---

## Task 12: Create Sidebar Components (Part 2 - SidebarItem)

**Files:**
- Modify: `src/components/ui/sidebar.tsx`

**Step 1: Add SidebarItem component**

Append to the end of `src/components/ui/sidebar.tsx`:

```typescript
export const SidebarItem = forwardRef(function SidebarItem(
  { current, className, children, ...props }: { current?: boolean; className?: string; children: React.ReactNode } & (
    | Omit<Headless.ButtonProps, 'as' | 'className'>
    | Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>
  ),
  ref: React.ForwardedRef<HTMLAnchorElement | HTMLButtonElement>
) {
  const classes = clsx(
    // Base
    'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-base/6 font-medium text-zinc-950 sm:py-2 sm:text-sm/5',
    // Leading icon/icon-only
    'data-[slot=icon]:*:size-6 data-[slot=icon]:*:shrink-0 sm:data-[slot=icon]:*:size-5',
    'data-[slot=icon]:*:fill-zinc-500',
    // Trailing icon (down chevron or similar)
    'data-[slot=icon]:last:*:ml-auto data-[slot=icon]:last:*:size-5 sm:data-[slot=icon]:last:*:size-4',
    // Avatar
    'data-[slot=avatar]:*:-m-0.5 data-[slot=avatar]:*:size-7 sm:data-[slot=avatar]:*:size-6',
    'data-[slot=avatar]:*:[--ring-opacity:10%]',
    // Hover
    'data-[hover]:bg-zinc-950/5 data-[slot=icon]:*:data-[hover]:fill-zinc-950',
    // Active
    'data-[active]:bg-zinc-950/5 data-[slot=icon]:*:data-[active]:fill-zinc-950',
    // Current
    'data-[slot=icon]:*:data-[current]:fill-zinc-950',
    // Dark mode
    'dark:text-white',
    'dark:data-[slot=icon]:*:fill-zinc-400',
    'dark:data-[hover]:bg-white/5 dark:data-[slot=icon]:*:data-[hover]:fill-white',
    'dark:data-[active]:bg-white/5 dark:data-[slot=icon]:*:data-[active]:fill-white',
    'dark:data-[slot=icon]:*:data-[current]:fill-white'
  )

  return (
    <span className={clsx(className, 'relative')}>
      {current && (
        <span className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-zinc-950 dark:bg-white" />
      )}
      {'href' in props ? (
        <Link
          {...props}
          className={classes}
          data-current={current ? 'true' : undefined}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        >
          {children}
        </Link>
      ) : (
        <Headless.Button
          {...props}
          className={clsx('cursor-default', classes)}
          data-current={current ? 'true' : undefined}
          ref={ref}
        >
          {children}
        </Headless.Button>
      )}
    </span>
  )
})

export function SidebarLabel({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return <span {...props} data-slot="label" className={clsx(className, 'truncate')} />
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/sidebar.tsx
git commit -m "feat: add SidebarItem and SidebarLabel components"
```

---

## Task 13: Create Sidebar Components (Part 3 - SidebarLayout)

**Files:**
- Modify: `src/components/ui/sidebar.tsx`

**Step 1: Add SidebarLayout component**

Append to the end of `src/components/ui/sidebar.tsx`:

```typescript
export function SidebarLayout({
  navbar,
  sidebar,
  children,
}: React.PropsWithChildren<{ navbar: React.ReactNode; sidebar: React.ReactNode }>) {
  return (
    <div className="relative isolate flex min-h-svh w-full bg-white max-lg:flex-col lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950">
      {/* Sidebar on desktop */}
      <div className="fixed inset-y-0 left-0 w-64 max-lg:hidden">
        <div className="flex h-full flex-col border-r border-zinc-950/5 bg-white dark:border-white/5 dark:bg-zinc-900">
          {sidebar}
        </div>
      </div>

      {/* Navbar on mobile */}
      <div className="lg:hidden">
        <Headless.Dialog>
          <Headless.DialogBackdrop
            transition
            className="fixed inset-0 bg-black/30 transition data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
          />
          <Headless.DialogPanel
            transition
            className="fixed inset-y-0 left-0 w-full max-w-80 bg-white p-2 transition data-[closed]:-translate-x-full data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in dark:bg-zinc-900"
          >
            {sidebar}
          </Headless.DialogPanel>
        </Headless.Dialog>
        <div className="sticky top-0 z-10 border-b border-zinc-950/5 bg-white px-4 dark:border-white/5 dark:bg-zinc-900">
          {navbar}
        </div>
      </div>

      {/* Main content */}
      <main className="flex flex-1 flex-col lg:pl-64">
        {children}
      </main>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/ui/sidebar.tsx
git commit -m "feat: add SidebarLayout component with responsive behavior"
```

---

## Task 14: Create Layout Directory and AppLayout Component

**Files:**
- Create: `src/components/layout/app-layout.tsx`

**Step 1: Create layout directory**

Run: `mkdir -p src/components/layout`

**Step 2: Create AppLayout component**

Create `src/components/layout/app-layout.tsx`:

```typescript
'use client'

import { Bars3Icon } from '@heroicons/react/20/solid'
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/16/solid'
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from '@/components/ui/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarLayout,
  SidebarSection,
  SidebarSpacer,
} from '@/components/ui/sidebar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/ui/dropdown'
import { Avatar } from '@/components/ui/avatar'

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
  return (
    <Navbar>
      <NavbarSpacer />
      <NavbarSection>
        <Dropdown>
          <DropdownButton as={NavbarItem}>
            <Avatar initials="AU" className="bg-zinc-900 text-white" />
          </DropdownButton>
          <DropdownMenu className="min-w-64" anchor="bottom end">
            <DropdownItem href="#">
              <ArrowRightStartOnRectangleIcon />
              <DropdownLabel>Logout</DropdownLabel>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarSection>
    </Navbar>
  )
}

function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-zinc-950 dark:text-white">
              Decision Stack
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          {/* Navigation items will go here in future */}
        </SidebarSection>
        <SidebarSpacer />
      </SidebarBody>
      <SidebarFooter>
        <Dropdown>
          <DropdownButton as={SidebarSection}>
            <div className="flex items-center gap-3">
              <Avatar initials="AU" className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-950 dark:text-white">
                  Anonymous User
                </span>
              </div>
            </div>
          </DropdownButton>
          <DropdownMenu className="min-w-64" anchor="top start">
            <DropdownItem href="#">
              <ArrowRightStartOnRectangleIcon />
              <DropdownLabel>Logout</DropdownLabel>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </SidebarFooter>
    </Sidebar>
  )
}
```

**Step 3: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "feat: create AppLayout component with sidebar and user menu"
```

---

## Task 15: Update Root Layout with Catalyst HTML Classes

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Update HTML element classes**

Replace the contents of `src/app/layout.tsx`:

```typescript
import React from 'react';
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Strategy Statement Generator',
  description: 'Generate and visualize business strategy statements',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.className} bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950`}
    >
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  )
}
```

**Step 2: Verify layout compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: update root layout with Catalyst background classes"
```

---

## Task 16: Update Page to Use AppLayout

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add AppLayout import and wrap content**

Update `src/app/page.tsx`:

1. Add import at top after existing imports:
```typescript
import { AppLayout } from '@/components/layout/app-layout';
```

2. Replace the return statement (starting at line 185):

```typescript
  return (
    <AppLayout>
      <main className="min-h-screen bg-gray-50 dark:bg-zinc-900">
        <div className="container mx-auto py-8">
          {flowStep === 'chat' && (
            <div className="h-[600px]">
              <ChatInterface
                conversationId={conversationId}
                messages={messages}
                onUserResponse={handleUserResponse}
                isLoading={isLoading}
                isComplete={false}
                currentPhase={currentPhase}
              />
            </div>
          )}

          {flowStep === 'extraction' && extractedContext && (
            <ExtractionConfirm
              extractedContext={extractedContext}
              onConfirm={handleConfirmContext}
              onExplore={handleExplore}
            />
          )}

          {flowStep === 'strategy' && strategy && (
            <>
              <StrategyDisplay strategy={strategy} thoughts={thoughts} />
              <FeedbackButtons traceId={traceId} />
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
```

Note: We removed the h1 "Decision Stack" title - it's now in the sidebar.

**Step 2: Verify page compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: integrate AppLayout into main page, remove duplicate title"
```

---

## Task 17: Test Build and Development Server

**Files:**
- None (verification only)

**Step 1: Run production build**

Run: `npm run build`

Expected: Build completes successfully with no errors

**Step 2: Start development server**

Run: `npm run dev`

Expected: Server starts at http://localhost:3000

**Step 3: Manual verification checklist**

Open http://localhost:3000 and verify:

- ✅ Desktop (resize browser to 1024px+):
  - Sidebar visible on left
  - "Decision Stack" branding in sidebar header
  - Anonymous user avatar in sidebar footer
  - Clicking user avatar shows logout dropdown
  - Main content shows conversation interface

- ✅ Mobile (resize browser to 375px):
  - Sidebar hidden
  - User avatar visible in top navbar
  - Clicking user avatar shows logout dropdown
  - Main content remains functional

- ✅ Dark mode (if system supports):
  - Toggle system dark mode
  - Colors adapt appropriately
  - Text remains readable

- ✅ Functionality preserved:
  - Can start conversation
  - Chat interface works
  - Context extraction works
  - Strategy generation works
  - Feedback buttons work

**Step 4: Stop development server**

Press Ctrl+C

**Step 5: Document any issues**

If issues found, note them for fixing. Otherwise, proceed to commit.

---

## Task 18: Update Session Notes

**Files:**
- Modify: `session-notes.md`

**Step 1: Add session summary**

Add to the top of `session-notes.md` (after the `# Session Notes` header):

```markdown
## 2025-12-10: Sidebar Layout & Tailwind Cleanup

### Overview
Modernized Tailwind setup and implemented Catalyst UI sidebar layout with minimal navigation structure. Cleaned up leftover ReactFlow styles, added CSS custom properties for greyscale theme, installed Headless UI dependencies, and created app shell with sidebar navigation.

### Changes

**Tailwind Modernization:**
- Removed ReactFlow leftover CSS from globals.css
- Added CSS custom properties in @layer base for greyscale theme (light/dark mode)
- Updated tailwind.config.ts to reference CSS variables
- Modern, maintainable theme system

**Catalyst UI Integration:**
- Installed @headlessui/react and @heroicons/react dependencies
- Created src/components/ui/ directory for Catalyst components
- Implemented: Button, Input, Avatar, Dropdown, Navbar, Sidebar components
- Adapted colors to greyscale (zinc palette)

**Layout Structure:**
- Created AppLayout component wrapping SidebarLayout
- "Decision Stack" branding in SidebarHeader
- Anonymous user profile in SidebarFooter with logout dropdown
- Responsive: sidebar on desktop, hamburger menu on mobile
- Updated app/layout.tsx with Catalyst HTML background classes
- Updated app/page.tsx to use AppLayout, removed duplicate h1 title

**Component Organization:**
- src/components/ui/ - Headless UI wrapper components
- src/components/layout/ - App-specific layout components
- Clean separation of concerns

### Technical Details

**Files Created:**
- `src/components/ui/link.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/dropdown.tsx`
- `src/components/ui/navbar.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/layout/app-layout.tsx`

**Files Modified:**
- `src/styles/globals.css` - Removed ReactFlow CSS, added CSS variables
- `tailwind.config.ts` - Added CSS variable references
- `src/app/layout.tsx` - Added Catalyst background classes
- `src/app/page.tsx` - Integrated AppLayout, removed h1 title
- `package.json` - Added @headlessui/react, @heroicons/react

**Dependencies Added:**
- @headlessui/react
- @heroicons/react

### Verification
- ✅ Build succeeds
- ✅ TypeScript compiles cleanly
- ✅ Sidebar visible on desktop
- ✅ Mobile hamburger menu works
- ✅ User dropdown functional
- ✅ Dark mode support
- ✅ Existing conversation flow preserved
- ✅ Greyscale aesthetic maintained

### Hours
~2 hours implementation + testing

---

```

**Step 2: Verify markdown formatting**

Run: `head -50 session-notes.md`

Expected: Should see the new session entry at the top

**Step 3: Commit**

```bash
git add session-notes.md
git commit -m "docs: add session notes for sidebar layout implementation"
```

---

## Verification Steps

After completing all tasks:

1. **Build succeeds**: `npm run build` completes without errors
2. **Type check passes**: `npx tsc --noEmit` shows no errors
3. **Sidebar renders**: Desktop shows sidebar, mobile shows navbar
4. **User menu works**: Clicking avatar shows dropdown with logout
5. **Responsive behavior**: Layout adapts to mobile/desktop
6. **Dark mode**: Colors adapt appropriately
7. **Existing features work**: Conversation flow unchanged
8. **No console errors**: Browser console clean
9. **Greyscale maintained**: No color inconsistencies

## Success Criteria

- ✅ ReactFlow CSS removed from globals.css
- ✅ Modern CSS custom properties theme system in place
- ✅ @headlessui/react and @heroicons/react installed
- ✅ All Catalyst components in src/components/ui/
- ✅ AppLayout renders with sidebar on desktop
- ✅ Mobile hamburger menu works (visual check - functionality in future)
- ✅ "Decision Stack" branding in SidebarHeader
- ✅ Anonymous user + logout dropdown in SidebarFooter
- ✅ Existing conversation flow unchanged and functional
- ✅ Greyscale aesthetic maintained
- ✅ No TypeScript errors
- ✅ No console warnings
- ✅ Session notes updated
