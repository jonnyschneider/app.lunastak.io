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
) & { children: React.ReactNode; className?: string } & (
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
