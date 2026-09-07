'use client'

/**
 * PROTOTYPE: the ground truth gate. Disposable — built to decide layout and affordances
 * in context. Design: docs/_plans/2026-09-06-ground-truth-gate-interaction-design.md
 *
 * Real components and tokens, real project data via `derive.ts`. No writes.
 *
 * THE ROW IS THE WHOLE INTERACTION. Every fragment — the one on the opening screen, the ones in
 * the weak walk, the ones in the scan list — is the same `FragmentRow` with the same three icon
 * controls. Borrowed from the ILS fitting checklist (`FittingChecklistInline.tsx`,
 * `DemoStepItem.tsx`): icons not text buttons, generous tap targets, selection shown as a filled
 * background, and clicking a chosen control again clears it. That is what lets the opening example
 * be *actionable* rather than a read-only demonstration, and it is why the scan list no longer has
 * a lonely "Drop this" that implies drop is the only thing you may do.
 */
import { useEffect, useState } from 'react'
import { Check, X, ArrowRight, Sparkles, ChevronDown, FileText, MessageSquare, Package, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { SETS, groupByDimension, type GateItem, type GateModel } from './derive'

/**
 * ⚠ COLOUR DOES NOT CARRY MEANING IN TEXT HERE (Jonny, 2026-09-08).
 *
 * Two things were wrong. Gold was creeping into links, badges and counters, so the one place it
 * MEANS something — a kept fragment — stopped standing out. And secondary text leaned on
 * `--muted-foreground`, which is `320 12% 38%`: a mulberry-tinted grey that reads as eggplant in
 * quantity. This file uses neutral `text-foreground/NN` for secondary text instead, and says
 * everything else with weight, underline, opacity or a background.
 *
 * Gold survives in exactly two places, both load-bearing: the fill on a KEPT control, and the rule
 * beside a verbatim span. That is a deliberate local deviation from the app's tokens — if it reads
 * better here, `--muted-foreground` is the thing to revisit, not this file.
 */

/**
 * Two verdicts, not three (Jonny, 2026-09-08). "Not quite" was removed rather than reworded.
 *
 * It only ever edited the CLAIM — the heading — while the evidence, the content and everything
 * generation actually reads stayed untouched. So it was relabelling a fragment, not correcting
 * one, at the cost of a third control, an editor, a draft, a saved-correction state and copy
 * ("not quite — say it my way", "use my words") that made the user work out what it did.
 *
 * Keep or discard is the whole ask. Anything the user wants to say in their own words is new
 * context, and adding context is a path that already exists and does not need the gate.
 */
type Verdict = 'keep' | 'drop'
type Stage = 'open' | 'weak' | 'confident' | 'all' | 'close'

/**
 * The question depends on how the fragment was made (§16.1) — but a fragment with no evidence can
 * be asked neither. "You said this" is a lie when we just admitted we cannot find their words.
 */
function question(item: GateItem): string {
  if (item.weakReason === 'no-evidence') return 'Keep it anyway?'
  if (item.weakReason === 'failed') return "I can't tie this back to your words. Does it still stand?"
  return item.type === 'verbatim'
    ? 'You said this — does it still matter?'
    : 'I read this from what you said — fair?'
}

/**
 * Tri-state, ILS-style: the chosen control fills; clicking it again clears the verdict.
 *
 * The three states are visually distinct, not just present/absent (Jonny, 2026-09-07):
 *
 *   at rest    outlined, dark grey — a real affordance rather than a ghost you have to hunt for
 *   kept       filled GOLD (`--luna`), white glyph — the ONLY saturated thing on the screen
 *   dropped    faint paper fill; the row recedes with it rather than being struck through
 *
 * Gold is reserved for keep so the eye can find what was kept at a glance; dropping recedes
 * instead of shouting. A strike-through was doing the shouting — it reads as an error or a
 * deletion, when dropping a fragment is an ordinary, reversible choice.
 */
function VerdictControls({
  verdict, onSet, size = 'default',
}: {
  verdict: Verdict | undefined
  onSet: (v: Verdict | undefined) => void
  size?: 'default' | 'sm'
}) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5'
  const opts: { v: Verdict; Icon: typeof Check; label: string }[] = [
    { v: 'keep', Icon: Check, label: 'Keep' },
    { v: 'drop', Icon: X, label: 'Discard' },
  ]
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {opts.map(({ v, Icon, label }) => (
        <button
          key={v}
          title={label}
          aria-label={label}
          aria-pressed={verdict === v}
          onClick={() => onSet(verdict === v ? undefined : v)}
          className={cn(
            'flex items-center justify-center rounded-md border transition-colors', box,
            verdict !== v && 'border-foreground/25 text-foreground/55 hover:border-foreground/50 hover:text-foreground',
            verdict === v && v === 'keep' && 'border-luna bg-luna text-white',
            verdict === v && v === 'drop' && 'border-foreground/15 bg-foreground/[0.07] text-foreground/60',
          )}
        >
          <Icon className={icon} strokeWidth={2.25} />
        </button>
      ))}
    </div>
  )
}

const SOURCE_ICON = {
  document: FileText,
  conversation: MessageSquare,
  bundle: Package,
  manual: PencilLine,
} as const

/**
 * One fragment. `detail` opens the evidence; the weak walk passes it always-open because the
 * evidence IS the reason it was pulled out.
 */
function FragmentRow({
  item, verdict, onSet, showEvidence, onOpen, hideDimension,
}: {
  item: GateItem
  verdict: Verdict | undefined
  onSet: (v: Verdict | undefined) => void
  showEvidence: boolean
  onOpen?: () => void
  /** Suppressed inside a grouped list, where the subheading already says it. */
  hideDimension?: boolean
}) {
  return (
    <div className="flex items-start gap-2 py-2.5">
      <VerdictControls verdict={verdict} onSet={onSet} size="sm" />

      <div className="min-w-0 flex-1">
        {(
          /* Claim and source share one line: the source was doubling every row's height for a
             label that only needs to be glanceable. */
          <button
            onClick={onOpen}
            disabled={!onOpen}
            className={cn('flex w-full items-center justify-between gap-3 text-left text-sm leading-snug transition-opacity',
              verdict === 'drop' ? 'opacity-45' : 'text-foreground',
              // Open row reads as the one in focus without adding a second signal.
              showEvidence && 'font-semibold')}
          >
            <span className="min-w-0">
              {item.dimensionLabel && !hideDimension && (
                <span className="mr-1.5 text-foreground/60">{item.dimensionLabel} ·</span>
              )}
              {item.claim}
            </span>
            {/* ONE axis: down to open, up to close. Right-then-down made a single control ask the
                eye to read two different gestures. Source moved out of the row entirely — on a
                scan list it was labelling rows that were not asking a question yet. */}
            {onOpen && (
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-foreground/45 transition-transform',
                  showEvidence && 'rotate-180')}
              />
            )}
          </button>
        )}

        {item.reason && (
          <p className="mt-0.5 text-xs text-foreground/60">{item.reason}</p>
        )}

        {showEvidence && item.evidence && (
          /* ONE quotation device, not three. It was carrying a border, curly quotes AND a quote
             icon for a single idea. The rule alone says "these are the words". */
          <div className="mt-2">
            <p className={cn('border-l-2 pl-3 text-sm italic',
              item.weakReason === 'failed' ? 'border-destructive/40 text-foreground/60' : 'border-luna')}>
              {item.evidence}
            </p>
            <div className="mt-1.5 flex items-center gap-3 pl-3">
              <p className="flex items-center gap-1.5 text-xs text-foreground/45">
                {(() => { const I = SOURCE_ICON[item.sourceKind]; return <I className="h-3.5 w-3.5" /> })()}
                {item.sourceName}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function GroundTruthGate({ model, projectId }: { model: GateModel; projectId: string }) {
  const { weak, confident, total, example } = model

  const [stage, setStage] = useState<Stage>('open')
  const [i, setI] = useState(0)
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  /**
   * ⚠ REVERSED, 2026-09-07. This used to count CLICKS, which made the number false in both
   * directions: a user who skims seven headings and is satisfied has reviewed them and scored zero,
   * while a tick on a row already opened moved nothing at all, because verdicts and views were
   * unioned into one set. Reviewing is being SHOWN something; it is not clicking.
   *
   * So `presented` is written when an item is actually put on screen, and acting on one is counted
   * separately as `changed`. Two honest numbers instead of one confused one.
   */
  const [presented, setPresented] = useState<Set<string>>(new Set())
  const mark = (ids: string[]) => setPresented(p => {
    const next = new Set(p); for (const id of ids) next.add(id); return next
  })

  const list = stage === 'all' ? [...weak, ...confident] : confident
  const kept = Object.values(verdicts).filter(v => v === 'keep').length
  const dropped = Object.values(verdicts).filter(v => v === 'drop').length
  // Confirmed = anything looked at, whatever was decided. Denominator is the ORIGINAL count, so
  // dropping can never inflate it — §8.
  const reviewed = presented.size
  const changed = dropped
  const remaining = total - dropped
  const current = weak[i]
  const weakReviewed = weak.filter(w => presented.has(w.id)).length

  /** Setting a verdict anywhere is the same call, so the score moves the same way everywhere. */
  function set(id: string, v: Verdict | undefined) {
    setVerdicts(s => {
      const next = { ...s }
      if (v === undefined) delete next[id]
      else next[id] = v
      return next
    })
  }


  // The weak walk shows one at a time; the lists show everything at once.
  useEffect(() => { if (stage === 'open' && example) mark([example.id]) }, [stage, example?.id])
  useEffect(() => { if (stage === 'weak' && current) mark([current.id]) }, [stage, current?.id])
  useEffect(() => {
    if (stage === 'confident' || stage === 'all') mark(list.map(x => x.id))
  }, [stage])

  function advance() {
    if (i + 1 < weak.length) setI(i + 1)
    else setStage('confident')
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-foreground/60">
          Prototype · ground truth gate · real data · {projectId.slice(0, 10)}…
        </p>

        {/* Live from the first screen on, so acting has a visible consequence — §7. Two numbers,
            because looking and changing are different things and one number conflated them. */}
        {reviewed > 0 && stage !== 'close' && (
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
            <span className="text-xs font-medium">Seen</span>
            <Progress value={(reviewed / total) * 100} className="h-1.5 flex-1" />
            <span className="font-mono text-xs tabular-nums">{reviewed} of {total}</span>
            {changed > 0 && (
              <span className="border-l pl-3 font-mono text-xs tabular-nums text-foreground">{changed} changed</span>
            )}
          </div>
        )}

        {stage === 'open' && (
          <Card>
            <CardContent className="space-y-6 p-8">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Before I build your strategy</h1>
                <p className="text-foreground/60">
                  I took <strong className="text-foreground">{total} things</strong> from what you told me.
                  Here&rsquo;s one — check it and I&rsquo;ll show you the rest:
                </p>
              </div>

              {example && (
                <div className="rounded-lg border bg-card px-4 py-1">
                  <FragmentRow
                    item={example}
                    verdict={verdicts[example.id]}
                    onSet={v => set(example.id, v)}
                    showEvidence
                  />
                </div>
              )}

              <p className="text-sm text-foreground/60">
                <strong className="text-foreground">{confident.length}</strong> are grounded like that one — I&rsquo;ll call those{' '}
                <strong className="text-foreground">{SETS.confident.toLowerCase()}</strong>.
                {weak.length > 0 && <> The other <strong className="text-foreground">{weak.length}</strong> are{' '}
                  <strong className="text-foreground">{SETS.weak.toLowerCase()}</strong>.</>}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {weak.length > 0 && (
                  <Button onClick={() => setStage('weak')}>
                    {SETS.weak} ({weak.length})
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" onClick={() => setStage('confident')}>
                  {SETS.confident} ({confident.length})
                </Button>
                <Button variant="ghost" onClick={() => setStage('close')}>
                  {verdicts[example?.id ?? ''] ? 'That\u2019s enough — build it' : 'Looks right — build it'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === 'weak' && current && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm">
                <strong>{SETS.weak}</strong>
                <span className="text-foreground/60"> — where it matters most.</span>
              </p>
              <span className="font-mono text-[10px] uppercase tracking-wide text-foreground/60">
                {i + 1} of {weak.length}
              </span>
            </div>

            <Card>
              <CardContent className="space-y-4 p-8">
                {current.dimensionLabel && (
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                    {current.dimensionLabel}
                  </p>
                )}
                {/* Never a truncated heading. Where the fragment has no real title, the claim IS
                    the content, so it is presented whole rather than cut mid-word. */}
                {current.titleIsDerived
                  ? <p className="text-base font-medium leading-relaxed">{current.detail}</p>
                  : <h2 className="text-lg font-semibold leading-snug">{current.claim}</h2>}

                {current.evidence && (
                  <p className={cn('border-l-2 pl-3 text-sm italic',
                    current.weakReason === 'failed' ? 'border-destructive/40 text-foreground/60' : 'border-luna')}>
                    {current.evidence}
                  </p>
                )}

                {/* The flag reason is the system showing its working — the trust mechanism. */}
                <p className="text-sm text-foreground/60">
                  {current.reason}
                  <span className="ml-2 text-foreground/45">· {current.sourceName}</span>
                </p>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm">{question(current)}</p>
                    <VerdictControls
                      verdict={verdicts[current.id]}
                      onSet={v => { set(current.id, v); if (v) advance() }}
                    />
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Named, so it cannot be read as "skip everything" and then surprise the user with
                twenty-five more. It says exactly where it goes and how many are there. */}
            <button onClick={() => setStage('confident')}
              className="text-sm text-foreground/60 underline underline-offset-4">
              Leave {SETS.weak.toLowerCase()} — go to {SETS.confident.toLowerCase()} ({confident.length})
            </button>
          </div>
        )}

        {(stage === 'confident' || stage === 'all') && (
          <Card>
            <CardContent className="space-y-4 p-8">
              <div>
                <h2 className="text-lg font-semibold">
                  {stage === 'all' ? `Everything — ${total}` : `${SETS.confident} — ${confident.length}`}
                </h2>
                <p className="text-sm text-foreground/60">
                  {stage === 'all'
                    ? `${SETS.weak} first, then ${SETS.confident.toLowerCase()}. `
                    : 'Nothing here needs a decision. '}
                  Skim it; tap one to see what it&rsquo;s built on.
                </p>
              </div>

              {/* Full flow, no scroll box. The constrained-height version hid most of the list
                  behind an invisible scroll and made the count on screen contradict the heading. */}
              <div className="space-y-5">
                {groupByDimension(list).map(g => (
                  <div key={g.dimension ?? 'none'}>
                    <h3 className="border-b pb-1.5 text-xs font-medium uppercase tracking-wide text-foreground/60">
                      {g.label}
                    </h3>
                    <div className="divide-y divide-border">
                      {g.items.map(c => (
                        <div key={c.id} className="-mx-2 rounded px-2 transition-colors hover:bg-muted/40">
                          <FragmentRow
                            item={c}
                            verdict={verdicts[c.id]}
                            onSet={v => set(c.id, v)}
                            showEvidence={expanded === c.id}
                            onOpen={() => setExpanded(expanded === c.id ? null : c.id)}
                            hideDimension
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <Button onClick={() => setStage('close')}>Build my strategy</Button>
                {weak.length > 0 ? (
                  <button onClick={() => setStage(stage === 'all' ? 'confident' : 'all')}
                    className="text-xs text-foreground/60 underline underline-offset-4">
                    {stage === 'all' ? `${SETS.confident} only (${confident.length})` : `See all ${total}`}
                  </button>
                ) : (
                  <span className="text-xs text-foreground/60">you can tweak these any time</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {stage === 'close' && (
          <Card>
            <CardContent className="space-y-6 p-8">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-luna" />
                <h2 className="text-lg font-semibold">Building your strategy</h2>
              </div>

              {/* Cause and effect, immediately — the thing the archive control never had. */}
              <div className="space-y-1 text-sm">
                {kept > 0 && <p>Kept <strong>{kept}</strong>.</p>}
                {dropped > 0 && <p>Discarded <strong>{dropped}</strong>.</p>}
                {kept === 0 && dropped === 0 && <p>Nothing changed — building from all {total}.</p>}
                <p className="text-foreground/60">Building from {remaining}.</p>
              </div>

              <div className="space-y-2 rounded-lg border bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Seen</span>
                  <span className="font-mono text-sm tabular-nums">{reviewed} of {total}</span>
                </div>
                <Progress value={(reviewed / total) * 100} className="h-1.5" />
                <p className="text-xs text-foreground/60">
                  {weakReviewed === weak.length && weak.length > 0
                    ? `You looked at all ${weak.length} I flagged. ${reviewed < total ? `The other ${total - reviewed} are there whenever you want them.` : ''}`
                    : `You can come back to the ${total - reviewed} you haven't seen any time.`}
                </p>
              </div>

              <Button variant="outline"
                onClick={() => { setStage('open'); setI(0); setVerdicts({}); setPresented(new Set()); setExpanded(null) }}>
                Run it again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

