import * as React from 'react'
import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A quiet, stateful pointer from an object to the place you act on it — the guidance register's
 * "state, not a prompt" shape (first used for row 4, "5 changes since v3").
 *
 * It states a fact about the thing it sits beside and offers the one next step. No dismissal: it is
 * shown for exactly as long as the fact is true. If a row genuinely needs dismissing, it is a prompt,
 * and wants a different component.
 *
 * Amber (`luna-dark`) because that is the knowledgebase's "your stack is behind" colour — the
 * Rebuild button it leads to wears it — so the pointer and its destination read as one signal.
 * `detail` is the long form, for the tooltip and screen readers; the visible label stays short
 * enough to sit under a version control.
 */
export interface GuidanceLinkProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  detail?: string
}

export const GuidanceLink = React.forwardRef<HTMLButtonElement, GuidanceLinkProps>(
  ({ label, detail, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      title={detail}
      aria-label={detail ? `${detail}. See what changed` : undefined}
      className={cn(
        'group inline-flex items-center gap-1.5 text-xs font-medium text-luna-dark',
        'underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none',
        className
      )}
      {...props}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-luna-dark" />
      {label}
      <ArrowRight aria-hidden className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
)
GuidanceLink.displayName = 'GuidanceLink'
