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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
type Stage = 'open' | 'list' | 'close'
/** One list; the filter chooses the view. */
type Filter = 'weak' | 'confident' | 'all'

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
  verdict, onSet, size = 'default', withKeep = true, reserveKeep = false,
}: {
  verdict: Verdict | undefined
  onSet: (v: Verdict | undefined) => void
  size?: 'default' | 'sm'
  /** Hold the missing slot open — only where both kinds of row sit in one list. */
  reserveKeep?: boolean
  /**
   * ASYMMETRIC BY DESIGN (Jonny, 2026-09-08). Only a flagged row gets a keep.
   *
   * The §22 test — name the reader of the field this control writes — kills the tick on a
   * well-grounded row: nothing downstream distinguishes kept from untouched (the pipeline reads
   * `active` vs `archived`), and §8 already settled that the score counts LOOKING rather than
   * deciding. So it would cost attention across 25 rows and buy nothing, while implying the user
   * ought to rule on every one.
   *
   * On a flagged row it is not redundant, because WE asserted the doubt. "I looked at the one you
   * flagged and it's fine" is an override of our own judgement, and there is no other way to get
   * it — a skim cannot say it and presentation-as-review cannot either, because we asked a
   * question. On the 25 we ask *did we get anything wrong?*; on the 7 we ask *you tell me*. Only
   * the second is a question, and only a question needs an answer.
   *
   * Silence is therefore the accept on a well-grounded row, and Build is the accept-all.
   */
  withKeep?: boolean
}) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5'
  const opts: { v: Verdict; Icon: typeof Check; label: string }[] = [
    ...(withKeep ? [{ v: 'keep' as Verdict, Icon: Check, label: 'This one is fine' }] : []),
    { v: 'drop', Icon: X, label: 'Discard' },
  ]
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {/* Keeps the claim's left edge steady whether a row has one control or two. Without it the
          flagged rows sit further right than the rest, which reads as subordinate — backwards. */}
      {!withKeep && reserveKeep && <span className={cn('shrink-0', box)} aria-hidden />}
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
  item, verdict, onSet, showEvidence, onOpen, hideDimension, reserveKeep,
}: {
  item: GateItem
  verdict: Verdict | undefined
  onSet: (v: Verdict | undefined) => void
  showEvidence: boolean
  onOpen?: () => void
  /** Suppressed inside a grouped list, where the subheading already says it. */
  hideDimension?: boolean
  reserveKeep?: boolean
}) {
  return (
    <div className="flex items-start gap-2 py-2.5">
      {/* A row with one control is offering an out; a row with two is asking a question. */}
      <VerdictControls verdict={verdict} onSet={onSet} size="sm"
        withKeep={!!item.weakReason} reserveKeep={reserveKeep} />

      <div className="min-w-0 flex-1">
        {(
          /* Claim and source share one line: the source was doubling every row's height for a
             label that only needs to be glanceable. */
          <button
            onClick={onOpen}
            disabled={!onOpen}
            className={cn('flex w-full items-center justify-between gap-3 text-left text-sm leading-snug transition-opacity',
              verdict === 'drop' ? 'opacity-45' : 'text-foreground',
              // Open row reads as the one in focus; medium is enough next to the other signals.
              showEvidence && 'font-medium')}
          >
            <span className="min-w-0">
              {/* Eyebrow, not an inline prefix: as a prefix it read as part of the claim, and the
                  claim is the thing being judged. */}
              {item.dimensionLabel && !hideDimension && (
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-foreground/45">
                  {item.dimensionLabel}
                </span>
              )}
              {item.claim}
            </span>
            {/* ONE axis: down to open, up to close. Right-then-down made a single control ask the
                eye to read two different gestures. Source moved out of the row entirely — on a
                scan list it was labelling rows that were not asking a question yet. */}
            {onOpen && !item.weakReason && (
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
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [skipOpen, setSkipOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('weak')
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

  const list = filter === 'weak' ? weak : filter === 'confident' ? confident : [...weak, ...confident]
  const kept = Object.values(verdicts).filter(v => v === 'keep').length
  const dropped = Object.values(verdicts).filter(v => v === 'drop').length
  // Confirmed = anything looked at, whatever was decided. Denominator is the ORIGINAL count, so
  // dropping can never inflate it — §8.
  const reviewed = presented.size
  const changed = dropped
  const remaining = total - dropped
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


  useEffect(() => { if (stage === 'open' && example) mark([example.id]) }, [stage, example?.id])
  useEffect(() => { if (stage === 'list') mark(list.map(x => x.id)) }, [stage, filter])

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-foreground/60">
          Prototype · ground truths · real data · {projectId.slice(0, 10)}…
        </p>

        {/* No running score. It was chrome that did not help anyone finish, and rewarding the
            review is a job for the close — where there is something to reward. */}

        {stage === 'open' && (
          <Card>
            <CardContent className="space-y-6 p-8">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Your ground truths</h1>
                <p className="text-foreground/60">
                  The <strong className="text-foreground">{total} things</strong> I took from what you told me.
                  Your strategy gets built from these — so it&rsquo;s worth a look before I do.
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

              {/* Confidence, then the action it recommends. The previous version explained its own
                  vocabulary — "I'll call those well grounded" — which is a tour of the interface,
                  not a reason to act. */}
              <div className="space-y-3 border-t pt-5">
                {weak.length > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm">
                      <strong>I&rsquo;m not confident about {weak.length}</strong> of them.
                    </p>
                    <Button onClick={() => { setFilter('weak'); setStage('list') }} className="shrink-0">
                      Check those {weak.length} <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-foreground/60">
                    The other {confident.length} look well grounded.
                  </p>
                  <Button variant="outline" onClick={() => { setFilter('confident'); setStage('list') }} className="shrink-0">
                    Scan them
                  </Button>
                </div>
              </div>

              <button onClick={() => setSkipOpen(true)}
                className="text-sm text-foreground/45 underline underline-offset-4 hover:text-foreground">
                Skip the review
              </button>
            </CardContent>
          </Card>
        )}

        {stage === 'list' && (
          <Card>
            <CardContent className="space-y-4 p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {filter === 'weak' ? `${weak.length} worth a look`
                    : filter === 'confident' ? `${confident.length} well grounded`
                    : `All ${total} ground truths`}
                </h2>
                {/* One list, three views. The split into a card-walk and a separate scan list made
                    the same material feel like two jobs; a filter makes it one with a focus. */}
                <div className="inline-flex overflow-hidden rounded-md border text-xs">
                  {([
                    ['weak', `Worth a look (${weak.length})`],
                    ['confident', `Well grounded (${confident.length})`],
                    ['all', `Everything (${total})`],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={cn('border-l px-3 py-1.5 font-medium transition-colors first:border-l-0',
                        filter === key ? 'bg-foreground text-background' : 'text-foreground/60 hover:bg-muted')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm text-foreground/60">
                {filter === 'confident'
                  ? 'Nothing here needs a decision — skim it, and discard anything I got wrong.'
                  : filter === 'weak'
                    ? 'These are the ones I’m unsure about. Tell me they’re fine, or discard them.'
                    : 'The ones I’m unsure about are open and ask a question. The rest just need a skim.'}
              </p>

              <div className="space-y-5">
                {groupByDimension(list).map(g => (
                  <div key={g.dimension ?? 'none'}>
                    <h3 className="border-b pb-1.5 text-xs font-medium uppercase tracking-wide text-foreground/60">
                      {g.label}
                    </h3>
                    <div className="divide-y divide-border">
                      {g.items.map(c => (
                        <div key={c.id}
                          className={cn('-mx-2 rounded px-2 transition-colors',
                            /* Discarded needs to be scannable, not inferred from a faded glyph. */
                            verdicts[c.id] === 'drop' ? 'bg-muted/70'
                              /* A washed gold field is what makes the extra control legible: the
                                 rows that ask a question look like a set, so a second affordance
                                 on them reads as belonging to that set rather than as an
                                 inconsistency. Gold because these are the ones that want the
                                 user; the saturated gold is still reserved for a resolved one. */
                              : c.weakReason ? 'bg-luna/[0.07] hover:bg-luna/[0.11]'
                              : 'hover:bg-muted/40')}>
                          <FragmentRow
                            item={c}
                            verdict={verdicts[c.id]}
                            onSet={v => set(c.id, v)}
                            /* A weak item opens itself: the evidence IS why it was pulled out, and
                               the extra height is a fair signal that it wants more attention. */
                            showEvidence={!!c.weakReason || expanded === c.id}
                            onOpen={c.weakReason ? undefined : () => setExpanded(expanded === c.id ? null : c.id)}
                            hideDimension
                            reserveKeep={filter === 'all'}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {list.length === 0 && (
                  <p className="py-6 text-center text-sm text-foreground/45">Nothing in this view.</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <Button onClick={() => setStage('close')}>Build my strategy</Button>
                <span className="text-xs text-foreground/45">you can change these any time</span>
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
              {/* A keep can now only come from a flagged row, so the number means something
                  specific: how many of OUR doubts the user resolved. */}
              <div className="space-y-1 text-sm">
                {kept > 0 && (
                  <p>Confirmed <strong>{kept}</strong> of the {weak.length} I flagged.</p>
                )}
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
                onClick={() => { setStage('open'); setFilter('weak'); setVerdicts({}); setPresented(new Set()); setExpanded(null) }}>
                Run it again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/*
        Skipping is a real choice and stays available — §4's "the skip is affirmative". But it was
        labelled "Looks right — build it", which asserts a judgement the user has not made. It is
        skipping, so it says so, and it gets one confirmation that explains the stake.

        ⚠ NO STATISTIC HERE, DELIBERATELY. §20 measured that EVIDENCE in generation takes not-clean
        output 25.0% → 0.0%. Nothing has ever measured that a USER REVIEWING changes anything — that
        experiment does not exist. "Users who check their ground truths get n% fewer inventions"
        would be exactly the invention this whole thread is about. The mechanism is true and worth
        stating; the number is not ours to claim yet.
      */}
      <AlertDialog open={skipOpen} onOpenChange={setSkipOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip the review?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                These {total} ground truths are the context your strategy is generated from. Anything
                wrong here can carry through into your vision, strategy, objectives and metrics.
              </span>
              <span className="block">
                You can fix them any time — but it&rsquo;s about thirty seconds now, and it&rsquo;s
                the single biggest influence on what you get back.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setFilter('weak'); setStage('list') }}>
              {weak.length > 0 ? `Check the ${weak.length} I flagged` : 'Take a look'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => setStage('close')}>Skip anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

