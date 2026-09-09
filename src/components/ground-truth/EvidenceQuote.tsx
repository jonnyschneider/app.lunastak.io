'use client'

/**
 * ONE quotation device, used by every surface that shows a span back to the user.
 *
 * The rule (not a card, not a blockquote, not a background tint) is the whole treatment: a span is
 * the user's own words, and the screen already has enough boxes. The one variation that matters is
 * verification — a span that did NOT match its source carries a destructive rule instead of the
 * luna one, because rendering it as "your words" would be false attribution, which this thread has
 * on record as worse than an honest summary.
 *
 * It lives here rather than in `ui/` because the rule is bound to `Evidence.verification` — it is
 * a ground-truth component, not a generic quote.
 */
import { cn } from '@/lib/utils'

export function EvidenceQuote({
  text,
  verification,
  className,
}: {
  text: string
  verification: string | null
  className?: string
}) {
  return (
    <p
      className={cn(
        'border-l-2 pl-3 italic',
        verification === 'failed' ? 'border-destructive/40 text-foreground/60' : 'border-luna',
        className,
      )}
    >
      {text}
    </p>
  )
}
