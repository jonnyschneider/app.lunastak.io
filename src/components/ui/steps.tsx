'use client'

/**
 * Steps — a stepped phase indicator: where you are in a sequence, what came before, what's next.
 *
 * WHY THIS EXISTS IN THE LIBRARY. There were two bespoke implementations and no shared one:
 * `ExtractionProgress` (segmented pulsing bars — a BUSY indicator for in-flight work, not a phase
 * indicator for a screen you are standing on) and an inline stepper in
 * `project/[id]/template/page.tsx:189`. shadcn/ui ships no stepper and no registry is configured,
 * so per CLAUDE.md a bespoke component belongs here rather than being scattered a third time.
 *
 * Second caller to migrate: the template page's six-step builder, which this API covers.
 *
 * Deliberately NOT interactive. A step indicator says where you are; navigating between phases is
 * the host's job and differs per flow.
 */
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepsProps {
  /** Ordered labels, shortest that still reads. Three to six works; more wants a different device. */
  steps: readonly string[]
  /** Zero-based index of the step the user is on. */
  current: number
  /** Optional trailing note — e.g. "your turn" — for a phase that waits on the user. */
  hint?: string
  className?: string
}

export function Steps({ steps, current, hint, className }: StepsProps) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="h-px w-4 bg-foreground/20" />}
            <span
              className="flex items-center gap-1.5"
              aria-current={active ? 'step' : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]',
                  done && 'border-foreground/30 bg-foreground/25 text-background',
                  active && 'border-luna bg-luna text-white',
                  !done && !active && 'border-foreground/25',
                )}
              >
                {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  'font-mono text-[10px] uppercase tracking-wider',
                  active ? 'font-semibold text-foreground' : 'text-foreground/45',
                )}
              >
                {label}
              </span>
            </span>
          </li>
        )
      })}
      {hint && (
        <li className="ml-1 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
          · {hint}
        </li>
      )}
    </ol>
  )
}
