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
