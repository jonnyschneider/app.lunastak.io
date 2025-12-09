import * as Headless from '@headlessui/react'
import React from 'react'
import { Link } from './link'
import clsx from 'clsx'

export function Dropdown(props: Headless.MenuProps) {
  return <Headless.Menu {...props} />
}

export function DropdownButton<T extends React.ElementType = typeof Headless.MenuButton>({
  as,
  ...props
}: Headless.MenuButtonProps<T>) {
  return <Headless.MenuButton as={as as any} {...props} />
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
        <Link {...props as any} className={classes} />
      ) : (
        <button type="button" {...props as any} className={classes} />
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
