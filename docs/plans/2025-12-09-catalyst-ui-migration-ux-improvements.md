# Catalyst UI Kit Migration & UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate to Tailwind Catalyst UI Kit, implement button-based interactions, auto-scroll, loading indicators, and replace ReactFlow with card-based Decision Stack layout using kernco.com.au design system.

**Architecture:** Copy Catalyst TypeScript components into project, update Tailwind config with kernco colors (coral palette), refactor ChatInterface for button interactions + auto-scroll + typing indicators, completely rebuild StrategyDisplay with card-based layout, remove ReactFlow dependency.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS 3.3, Headless UI (via Catalyst), kernco.com.au color palette

---

## Task 1: Set Up Catalyst UI Components

**Files:**
- Create: `src/components/catalyst/button.tsx`
- Create: `src/components/catalyst/input.tsx`
- Create: `src/components/catalyst/text.tsx`
- Create: `src/components/catalyst/link.tsx`
- Modify: `package.json`

**Step 1: Install Headless UI dependency**

```bash
npm install @headlessui/react
```

Expected: Package installed successfully

**Step 2: Copy Catalyst Button component**

Create `src/components/catalyst/button.tsx`:

```typescript
import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'
import { Link } from './link'

const styles = {
  base: [
    'relative isolate inline-flex items-center justify-center gap-x-2 rounded-lg border text-base/6 font-semibold',
    'px-[calc(theme(spacing.3.5)-1px)] py-[calc(theme(spacing.2.5)-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing.1.5)-1px)] sm:text-sm/6',
    'focus:outline-none data-focus:outline data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-coral-500',
    'data-disabled:opacity-50',
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
    'after:data-active:bg-[--btn-hover-overlay] after:data-hover:bg-[--btn-hover-overlay]',
    'dark:after:-inset-px dark:after:rounded-lg',
    'before:data-disabled:shadow-none after:data-disabled:shadow-none',
  ],
  outline: [
    'border-zinc-950/10 text-zinc-950 data-active:bg-zinc-950/[2.5%] data-hover:bg-zinc-950/[2.5%]',
    'dark:border-white/15 dark:text-white dark:[--btn-bg:transparent] dark:data-active:bg-white/5 dark:data-hover:bg-white/5',
  ],
  plain: [
    'border-transparent text-zinc-950 data-active:bg-zinc-950/5 data-hover:bg-zinc-950/5',
    'dark:text-white dark:data-active:bg-white/10 dark:data-hover:bg-white/10',
  ],
  colors: {
    coral: [
      'text-white [--btn-bg:theme(colors.coral.500)] [--btn-border:theme(colors.coral.600)] [--btn-hover-overlay:theme(colors.white/10%)]',
      'dark:[--btn-hover-overlay:theme(colors.white/5%)]',
    ],
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
        : clsx(styles.solid, styles.colors[color ?? 'coral'])
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

**Step 3: Copy Catalyst Input component**

Create `src/components/catalyst/input.tsx`:

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
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent sm:after:focus-within:ring-2 sm:after:focus-within:ring-coral-500',
        'has-[[data-disabled]]:opacity-50 has-[[data-disabled]]:before:bg-zinc-950/5 has-[[data-disabled]]:before:shadow-none',
      ])}
    >
      <Headless.Input
        ref={ref}
        {...props}
        className={clsx([
          'relative block w-full appearance-none rounded-lg px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing.1.5)-1px)]',
          'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white',
          'border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20',
          'bg-transparent dark:bg-white/5',
          'focus:outline-none',
          'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 data-invalid:dark:border-red-600 data-invalid:data-hover:dark:border-red-600',
          'data-disabled:border-zinc-950/20 dark:data-hover:data-disabled:border-white/15 data-disabled:dark:border-white/15 data-disabled:dark:bg-white/[2.5%]',
        ])}
      />
    </span>
  )
})
```

**Step 4: Copy Catalyst Text component**

Create `src/components/catalyst/text.tsx`:

```typescript
import clsx from 'clsx'
import React from 'react'

export function Text({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return (
    <p
      {...props}
      data-slot="text"
      className={clsx(className, 'text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400')}
    />
  )
}

export function TextLink({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <a
      {...props}
      className={clsx(
        className,
        'text-zinc-950 underline decoration-zinc-950/50 data-hover:decoration-zinc-950 dark:text-white dark:decoration-white/50 dark:data-hover:decoration-white'
      )}
    />
  )
}
```

**Step 5: Copy Catalyst Link component**

Create `src/components/catalyst/link.tsx`:

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

**Step 6: Verify components compile**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 7: Commit**

```bash
git add src/components/catalyst package.json package-lock.json
git commit -m "feat: add Catalyst UI components (Button, Input, Text, Link)"
```

---

## Task 2: Update Tailwind Config with kernco Colors

**Files:**
- Modify: `tailwind.config.ts`

**Step 1: Update Tailwind config with kernco colors**

Replace entire `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sans: ["var(--font-sans)", "sans-serif"],
      display: ["var(--font-display)", "sans-serif"],
      serif: ["ui-serif", "Georgia", "serif"],
      mono: ["ui-monospace", "SFMono-Regular", "monospace"],
    },
    extend: {
      colors: {
        // Kernco Brand Color - coral/salmon
        coral: {
          50: '#fff5f5',
          100: '#ffe3e3',
          200: '#ffcdcd',
          300: '#ffabab',
          400: '#ff7a7f',
          500: '#FF5E65',  // Primary brand color
          600: '#f03e46',
          700: '#d92730',
          800: '#b91f26',
          900: '#991f24',
        },
        // Semantic aliases
        primary: {
          50: '#fff5f5',
          100: '#ffe3e3',
          200: '#ffcdcd',
          300: '#ffabab',
          400: '#ff7a7f',
          500: '#FF5E65',
          600: '#f03e46',
          700: '#d92730',
          800: '#b91f26',
          900: '#991f24',
        },
      },
      borderRadius: {
        'sm': '0.25rem',
        'DEFAULT': '0.375rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px',
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-dot": {
          "0%, 80%, 100%": { opacity: "0.4" },
          "40%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;
```

**Step 2: Verify config compiles**

```bash
npm run dev
```

Expected: Dev server starts without errors

**Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: update Tailwind config with kernco coral palette and animations"
```

---

## Task 3: Create Typing Indicator Component

**Files:**
- Create: `src/components/catalyst/typing-indicator.tsx`

**Step 1: Create typing indicator component**

Create `src/components/catalyst/typing-indicator.tsx`:

```typescript
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div
        className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
        style={{
          animation: 'pulse-dot 1.4s ease-in-out 0s infinite',
        }}
      />
      <div
        className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
        style={{
          animation: 'pulse-dot 1.4s ease-in-out 0.2s infinite',
        }}
      />
      <div
        className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
        style={{
          animation: 'pulse-dot 1.4s ease-in-out 0.4s infinite',
        }}
      />
    </div>
  );
}
```

**Step 2: Verify component renders**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/catalyst/typing-indicator.tsx
git commit -m "feat: add typing indicator component with animated dots"
```

---

## Task 4: Refactor ChatInterface - Part 1 (Button Interactions)

**Files:**
- Modify: `src/components/ChatInterface.tsx`

**Step 1: Update imports and add button helper**

At top of `src/components/ChatInterface.tsx`, replace imports:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, ConversationPhase } from '@/lib/types';
import { Button } from './catalyst/button';
import { Input } from './catalyst/input';
import { TypingIndicator } from './catalyst/typing-indicator';

// Lens selection options
const LENS_OPTIONS = [
  { key: 'A', label: 'Competitive Advantage' },
  { key: 'B', label: 'Customer-Centric' },
  { key: 'C', label: 'Innovation-Driven' },
  { key: 'D', label: 'Operations Excellence' },
  { key: 'E', label: 'Growth & Scale' },
];

// Early exit options
const EARLY_EXIT_OPTIONS = [
  { key: 'A', label: 'Continue exploring' },
  { key: 'B', label: 'Generate strategy' },
];
```

**Step 2: Add auto-scroll ref**

After `const [userInput, setUserInput] = useState('');`, add:

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};

useEffect(() => {
  scrollToBottom();
}, [messages]);
```

**Step 3: Update render to include typing indicator**

Find the messages map section and update:

```typescript
{/* Messages */}
<div className="flex-1 overflow-y-auto p-6 space-y-4">
  {messages.map((message) => (
    <div
      key={message.id}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          message.role === 'user'
            ? 'bg-coral-500 text-white'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  ))}

  {/* Typing indicator */}
  {isLoading && (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-lg bg-zinc-100 dark:bg-zinc-800">
        <TypingIndicator />
      </div>
    </div>
  )}

  <div ref={messagesEndRef} />
</div>
```

**Step 4: Verify changes compile**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/components/ChatInterface.tsx
git commit -m "feat: add auto-scroll and typing indicator to ChatInterface"
```

---

## Task 5: Refactor ChatInterface - Part 2 (Button UI)

**Files:**
- Modify: `src/components/ChatInterface.tsx`

**Step 1: Add helper to detect if buttons should show**

After the `useEffect`, add:

```typescript
const shouldShowButtons = () => {
  if (isLoading || isComplete) return false;

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant') return false;

  // Show lens selection buttons
  if (currentPhase === 'LENS_SELECTION') {
    return LENS_OPTIONS;
  }

  // Show early exit buttons if prompted
  if (currentPhase === 'QUESTIONING' && lastMessage.content.includes('A) Continue exploring')) {
    return EARLY_EXIT_OPTIONS;
  }

  return false;
};

const buttonOptions = shouldShowButtons();
```

**Step 2: Replace form section with conditional rendering**

Replace the entire form section (from `{/* Input Form */}` to end of component):

```typescript
{/* Input Form or Buttons */}
{buttonOptions && Array.isArray(buttonOptions) ? (
  <div className="border-t p-4 bg-white dark:bg-zinc-900">
    <div className="flex flex-wrap gap-2 justify-center">
      {buttonOptions.map((option) => (
        <Button
          key={option.key}
          onClick={() => onUserResponse(option.key)}
          disabled={isLoading}
        >
          {option.label}
        </Button>
      ))}
    </div>
  </div>
) : (
  <form onSubmit={handleSubmit} className="border-t p-4 bg-white dark:bg-zinc-900">
    <div className="flex gap-2">
      <Input
        type="text"
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        placeholder={currentPhase === 'EXTRACTION' ? 'Reviewing context...' : 'Type your response...'}
        disabled={isLoading || isComplete}
        className="flex-1"
      />
      <Button
        type="submit"
        disabled={isLoading || isComplete || !userInput.trim()}
      >
        Send
      </Button>
    </div>
  </form>
)}
```

**Step 3: Remove old placeholder helper**

Delete the `getPlaceholderText` function (no longer needed).

**Step 4: Test locally**

```bash
npm run dev
```

Visit http://localhost:3000 and verify:
- Buttons appear for lens selection
- Buttons appear for early exit
- Text input appears for open-ended questions
- Typing indicator shows when loading
- Auto-scroll works

**Step 5: Commit**

```bash
git add src/components/ChatInterface.tsx
git commit -m "feat: replace letter codes with button interactions in ChatInterface"
```

---

## Task 6: Create Card-Based Strategy Components

**Files:**
- Create: `src/components/DecisionStackCard.tsx`

**Step 1: Create objective card component**

Create `src/components/DecisionStackCard.tsx`:

```typescript
import React from 'react';

interface DecisionStackCardProps {
  title?: string;
  content: string;
  variant?: 'vision' | 'mission' | 'objective';
}

export function DecisionStackCard({ title, content, variant = 'objective' }: DecisionStackCardProps) {
  if (variant === 'vision') {
    return (
      <div className="w-full bg-gradient-to-r from-coral-600 to-coral-500 rounded-lg p-6 shadow-sm">
        <p className="text-lg font-medium text-white leading-relaxed">
          {content}
        </p>
      </div>
    );
  }

  if (variant === 'mission') {
    return (
      <div className="w-full bg-gradient-to-r from-zinc-700 to-zinc-600 rounded-lg p-6 shadow-sm">
        <p className="text-lg font-medium text-white leading-relaxed">
          {content}
        </p>
      </div>
    );
  }

  // Objective card
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm hover:shadow-md transition-shadow">
      {title && (
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
          {title}
        </h3>
      )}
      <p className="text-base text-zinc-900 dark:text-zinc-100 leading-relaxed">
        {content}
      </p>
    </div>
  );
}
```

**Step 2: Verify component compiles**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/DecisionStackCard.tsx
git commit -m "feat: create DecisionStackCard component for vision/mission/objective display"
```

---

## Task 7: Rebuild StrategyDisplay with Card Layout

**Files:**
- Modify: `src/components/StrategyDisplay.tsx`
- Delete: `src/components/StrategyFlow.tsx`

**Step 1: Replace entire StrategyDisplay component**

Replace entire contents of `src/components/StrategyDisplay.tsx`:

```typescript
'use client';

import { StrategyStatements } from '@/lib/types';
import { DecisionStackCard } from './DecisionStackCard';

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  thoughts?: string;
}

export default function StrategyDisplay({ strategy, thoughts }: StrategyDisplayProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Thoughts (optional) */}
      {thoughts && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Strategic Thinking:
          </h3>
          <p className="text-blue-800 dark:text-blue-200 whitespace-pre-wrap text-sm">
            {thoughts}
          </p>
        </div>
      )}

      {/* Decision Stack */}
      <div className="space-y-4">
        {/* Vision */}
        <DecisionStackCard
          variant="vision"
          content={strategy.vision}
        />

        {/* Mission */}
        <DecisionStackCard
          variant="mission"
          content={strategy.mission}
        />

        {/* Objectives */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategy.objectives.map((objective, index) => (
            <DecisionStackCard
              key={index}
              title={`Objective ${index + 1}`}
              content={objective}
              variant="objective"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Delete StrategyFlow component**

```bash
rm src/components/StrategyFlow.tsx
```

**Step 3: Verify component compiles**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/components/StrategyDisplay.tsx
git add src/components/StrategyFlow.tsx
git commit -m "feat: rebuild StrategyDisplay with card-based layout, remove ReactFlow"
```

---

## Task 8: Remove ReactFlow Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Uninstall ReactFlow packages**

```bash
npm uninstall reactflow @reactflow/node-resizer
```

Expected: Packages removed from package.json and node_modules

**Step 2: Verify app still compiles**

```bash
npm run type-check
npm run build
```

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove ReactFlow dependencies"
```

---

## Task 9: Update ExtractionConfirm with Catalyst Components

**Files:**
- Modify: `src/components/ExtractionConfirm.tsx`

**Step 1: Read current ExtractionConfirm**

```bash
cat src/components/ExtractionConfirm.tsx
```

**Step 2: Update imports**

At top of file, replace imports:

```typescript
'use client';

import { EnhancedExtractedContext } from '@/lib/types';
import { Button } from './catalyst/button';
```

**Step 3: Update button styling**

Find the two buttons ("Keep Exploring" and "Generate my strategy") and replace with:

```typescript
<div className="flex gap-3 justify-end">
  <Button
    onClick={onExploreMore}
    outline
  >
    Keep Exploring
  </Button>
  <Button
    onClick={onConfirm}
  >
    Generate my strategy
  </Button>
</div>
```

**Step 4: Update card styling to match kernco**

Find the main card div and update background/border:

```typescript
<div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 shadow-sm space-y-6">
```

**Step 5: Verify component compiles**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add src/components/ExtractionConfirm.tsx
git commit -m "feat: update ExtractionConfirm with Catalyst buttons and kernco styling"
```

---

## Task 10: Update FeedbackButtons with Catalyst Components

**Files:**
- Modify: `src/components/FeedbackButtons.tsx`

**Step 1: Read current FeedbackButtons**

```bash
cat src/components/FeedbackButtons.tsx
```

**Step 2: Update imports**

At top of file:

```typescript
'use client';

import { useState } from 'react';
import { Button } from './catalyst/button';
```

**Step 3: Replace buttons**

Find the button elements and replace with:

```typescript
<div className="flex gap-3 justify-center">
  <Button
    onClick={() => handleFeedback(true)}
    disabled={submitted}
    outline
  >
    👍 Helpful
  </Button>
  <Button
    onClick={() => handleFeedback(false)}
    disabled={submitted}
    outline
  >
    👎 Not helpful
  </Button>
</div>

{submitted && (
  <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center mt-2">
    Thanks for your feedback!
  </p>
)}
```

**Step 4: Verify component compiles**

```bash
npm run type-check
```

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/components/FeedbackButtons.tsx
git commit -m "feat: update FeedbackButtons with Catalyst button components"
```

---

## Task 11: End-to-End Testing

**Files:**
- None (testing only)

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Manual UAT checklist**

Test the following flow:

1. ✅ Start conversation - initial question appears
2. ✅ Type response and submit - auto-scrolls to show AI response
3. ✅ Lens selection - buttons appear with keywords (not letter codes)
4. ✅ Click lens button - conversation continues
5. ✅ Answer questions - typing indicator appears while loading
6. ✅ Auto-scroll - latest message always visible
7. ✅ Early exit prompt - "Continue exploring" / "Generate strategy" buttons appear
8. ✅ Click "Generate strategy" - extraction confirm shows
9. ✅ Extraction confirm - Catalyst buttons match design
10. ✅ Click "Generate my strategy" - strategy displays
11. ✅ Strategy display - Vision/Mission bars + Objective cards show correctly
12. ✅ Responsive - cards stack properly on mobile width
13. ✅ Feedback buttons - Catalyst styled, work correctly

**Step 3: Test dark mode (if applicable)**

Toggle dark mode and verify:
- All Catalyst components adapt to dark mode
- Colors remain readable
- Cards have appropriate dark mode styling

**Step 4: Test on different screen sizes**

Resize browser to verify:
- Mobile (320px): All elements stack vertically
- Tablet (768px): Objective cards show 2 columns
- Desktop (1024px+): Objective cards show 3 columns

**Step 5: Document any issues**

Create `docs/ux-migration-test-results.md` if issues found:

```markdown
# UX Migration Test Results

## Issues Found
1. [Description of issue]
   - Steps to reproduce
   - Expected vs actual
   - Screenshot (if applicable)

## Passed Tests
- [List of successful test cases]
```

**Step 6: Commit test results (if created)**

```bash
git add docs/ux-migration-test-results.md
git commit -m "docs: add UX migration test results"
```

---

## Task 12: Final Polish & Documentation

**Files:**
- Modify: `README.md` (if exists)
- Modify: `session-notes.md`

**Step 1: Update session notes**

Add to `session-notes.md`:

```markdown
## 2025-12-09 (Session 3): Catalyst UI Migration & UX Improvements

### Session Overview

Complete UI/UX overhaul: migrated to Tailwind Catalyst UI Kit, adopted kernco.com.au design system, replaced letter-code interactions with buttons, implemented auto-scroll and typing indicators, and rebuilt strategy visualization with card-based layout (removed ReactFlow).

### Key Accomplishments

**1. Catalyst UI Kit Integration**
- Copied and adapted Catalyst TypeScript components (Button, Input, Text, Link)
- Installed @headlessui/react dependency
- Components styled with kernco coral palette (#FF5E65)

**2. Design System Migration**
- Updated Tailwind config with kernco.com.au colors
- Added coral palette as both `coral` and semantic `primary` aliases
- Configured custom border radius matching kernco style
- Added pulse-dot animation for typing indicator

**3. Chat Interface Enhancements**
- **Button interactions**: Lens selection and early exit now use keyword buttons instead of letter codes
- **Auto-scroll**: Messages automatically scroll into view on updates
- **Typing indicator**: Three-dot animation shows AI is processing
- **Catalyst components**: Replaced all form elements with Catalyst Input/Button

**4. Strategy Display Rebuild**
- **Removed ReactFlow**: Eliminated complex graph visualization dependency
- **Card-based layout**: Vision/Mission full-width bars + Objective cards
- **Responsive grid**: 1 column mobile, 2 tablet, 3 desktop
- **kernco styling**: Coral gradient for vision, zinc for mission, white cards for objectives

**5. Component Updates**
- ExtractionConfirm: Migrated to Catalyst buttons
- FeedbackButtons: Migrated to Catalyst buttons
- All components: Updated to use kernco color palette

### Technical Details

**Files Modified:**
- `src/components/ChatInterface.tsx` - Button UI, auto-scroll, typing indicator
- `src/components/StrategyDisplay.tsx` - Complete rebuild with cards
- `src/components/ExtractionConfirm.tsx` - Catalyst migration
- `src/components/FeedbackButtons.tsx` - Catalyst migration
- `tailwind.config.ts` - kernco colors and animations
- `package.json` - Added @headlessui/react, removed ReactFlow

**Files Created:**
- `src/components/catalyst/button.tsx`
- `src/components/catalyst/input.tsx`
- `src/components/catalyst/text.tsx`
- `src/components/catalyst/link.tsx`
- `src/components/catalyst/typing-indicator.tsx`
- `src/components/DecisionStackCard.tsx`

**Files Deleted:**
- `src/components/StrategyFlow.tsx`

**Dependencies:**
- Added: @headlessui/react
- Removed: reactflow, @reactflow/node-resizer

### Hours
~2-3 hours implementation + testing
```

**Step 2: Commit documentation**

```bash
git add session-notes.md
git commit -m "docs: add session notes for Catalyst UI migration"
```

**Step 3: Push to development**

```bash
git push origin development
```

---

## Verification Steps

After completing all tasks:

1. **Build succeeds**: `npm run build` completes without errors
2. **Type check passes**: `npm run type-check` shows no errors
3. **All interactions work**: Buttons, typing indicator, auto-scroll functional
4. **Visual consistency**: kernco coral palette applied throughout
5. **No ReactFlow**: Dependency removed, strategy shows as cards
6. **Responsive**: Layout adapts to mobile/tablet/desktop

## Success Criteria

- ✅ All Catalyst components integrated and working
- ✅ kernco.com.au color palette applied (coral as primary)
- ✅ Button interactions replace letter codes for all choices
- ✅ Auto-scroll keeps latest message visible
- ✅ Typing indicator shows during AI processing
- ✅ ReactFlow completely removed
- ✅ Strategy displays as Vision bar + Mission bar + Objective cards
- ✅ Responsive layout works on all screen sizes
- ✅ All existing features still functional
- ✅ No console errors or warnings
- ✅ TypeScript compiles cleanly
