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
 * ONE BAR, TWO STATES. This is the third attempt and the reasoning is worth keeping. Muted dots
 * read as three similar things rather than a path with a position on it. Per-step segments in
 * three different colours read as a rainbow — done, current and upcoming each shouting a different
 * hue, which makes the eye compare them instead of reading progress.
 *
 * So the track is ONE continuous bar filled to the current step, which is a shape people already
 * know, and the labels carry only *reached* or *not yet* — a completed step and the current step
 * are the same thing to a reader who wants to know how far along they are. Where you are is the
 * edge of the fill, which needs no colour of its own.
 *
 * The bar is the shipped `Progress` (Radix, `bg-primary` on `bg-primary/20`) rather than a
 * hand-rolled track: same component the rest of the app uses, so the fill matches everything else
 * that reports progress.
 *
 * Deliberately NOT interactive. A step indicator says where you are; navigating between phases is
 * the host's job and differs per flow.
 */
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

export interface StepsProps {
  /** Ordered labels, shortest that still reads. Three to six works; more wants a different device. */
  steps: readonly string[]
  /** Zero-based index of the step the user is on. */
  current: number
  className?: string
}

export function Steps({ steps, current, className }: StepsProps) {
  const pct = steps.length === 0 ? 0 : ((current + 1) / steps.length) * 100

  return (
    <div className={cn('w-full', className)}>
      <Progress
        value={pct}
        className="h-1.5"
        aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current] ?? ''}`}
      />
      <ol className="mt-2 flex w-full items-baseline">
        {steps.map((label, i) => {
          const reached = i <= current
          return (
            <li
              key={label}
              className="flex flex-1 items-baseline gap-1.5"
              aria-current={i === current ? 'step' : undefined}
            >
              <span
                aria-hidden
                className={cn('font-mono text-[10px] tabular-nums',
                  reached ? 'text-foreground' : 'text-foreground/40')}
              >
                {i + 1}
              </span>
              <span
                className={cn('font-mono text-[10px] uppercase tracking-wider',
                  reached ? 'text-foreground' : 'text-foreground/40')}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
