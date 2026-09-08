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
 * THE RULE OF THE DESIGN: progress is carried by a filled top rule per step, not by subtly
 * different greys. The first version leaned on muted dots and a grey disc for "done", which made
 * the completed step look disabled and the sequence read as three similar things rather than a
 * path with a position on it. A rule you can see across the whole width says how far along you
 * are before you have read a single word; the number says which step; the tick says it is behind
 * you. Colour is the last signal, not the first.
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
  className?: string
}

export function Steps({ steps, current, className }: StepsProps) {
  return (
    <ol className={cn('flex w-full items-start gap-2', className)}>
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex-1" aria-current={active ? 'step' : undefined}>
            {/* The rule IS the progress bar — one segment per step, read in a glance. */}
            <span
              aria-hidden
              className={cn(
                'block h-[3px] rounded-full transition-colors',
                done && 'bg-foreground/70',
                active && 'bg-luna',
                !done && !active && 'bg-foreground/15',
              )}
            />
            <span className="mt-1.5 flex items-baseline gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'font-mono text-[10px] tabular-nums',
                  done && 'text-foreground/70',
                  active && 'font-bold text-foreground',
                  !done && !active && 'text-foreground/40',
                )}
              >
                {done ? <Check className="h-3 w-3 translate-y-[2px]" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  'font-mono text-[10px] uppercase tracking-wider',
                  done && 'text-foreground/70',
                  active && 'font-bold text-foreground',
                  !done && !active && 'text-foreground/40',
                )}
              >
                {label}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
