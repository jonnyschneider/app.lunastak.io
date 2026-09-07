'use client'

/**
 * PROTOTYPE: the ground truth gate. Disposable — built to decide layout, affordances and editing
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
import { Check, X, PenLine, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { SETS, type GateItem, type GateModel } from './derive'

type Verdict = 'keep' | 'drop' | 'fixed'
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

/** Tri-state, ILS-style: the chosen control fills; clicking it again clears the verdict. */
function VerdictControls({
  verdict, onSet, size = 'default',
}: { verdict: Verdict | undefined; onSet: (v: Verdict | undefined) => void; size?: 'default' | 'sm' }) {
  const pad = size === 'sm' ? 'p-2' : 'p-2.5'
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'
  const opts: { v: Verdict; Icon: typeof Check; label: string }[] = [
    { v: 'keep', Icon: Check, label: 'Keep' },
    { v: 'drop', Icon: X, label: 'Drop' },
    { v: 'fixed', Icon: PenLine, label: 'Not quite — say it my way' },
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
          className={cn('rounded-md transition-colors', pad,
            verdict === v ? 'bg-luna text-white' : 'text-muted-foreground/50 hover:bg-muted hover:text-foreground')}
        >
          <Icon className={icon} strokeWidth={2} />
        </button>
      ))}
    </div>
  )
}

/**
 * One fragment. `detail` opens the evidence; the weak walk passes it always-open because the
 * evidence IS the reason it was pulled out.
 */
function FragmentRow({
  item, verdict, onSet, showEvidence, onOpen,
}: {
  item: GateItem
  verdict: Verdict | undefined
  onSet: (v: Verdict | undefined) => void
  showEvidence: boolean
  onOpen?: () => void
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <VerdictControls verdict={verdict} onSet={onSet} size="sm" />
      <div className="min-w-0 flex-1">
        <button
          onClick={onOpen}
          disabled={!onOpen}
          className={cn('block w-full text-left text-sm leading-snug',
            verdict === 'drop' ? 'text-muted-foreground line-through' : 'text-foreground',
            onOpen && 'hover:text-luna')}
        >
          {item.claim}
        </button>

        {/* The source belongs on the CLOSED row: it is the cheapest orientation available, and
            hiding it behind the accordion meant a row gave no clue where it came from. */}
        <p className="mt-1 text-xs text-muted-foreground">
          {item.sourceName}
          {item.reason && <span className="ml-2 text-muted-foreground/70">· {item.reason}</span>}
        </p>

        {showEvidence && item.evidence && (
          /* ONE quotation device, not three. It was carrying a border, curly quotes AND a quote
             icon for a single idea. The rule alone says "these are the words". */
          <p className={cn('mt-2 border-l-2 pl-3 text-sm italic',
            item.weakReason === 'failed' ? 'border-destructive/40 text-muted-foreground' : 'border-luna')}>
            {item.evidence}
          </p>
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
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
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
  const fixes = Object.values(verdicts).filter(v => v === 'fixed').length
  // Confirmed = anything looked at, whatever was decided. Denominator is the ORIGINAL count, so
  // dropping can never inflate it — §8.
  const reviewed = presented.size
  const changed = dropped + fixes
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
    if (v === 'fixed') { setEditing(id); setDraft(corrections[id] ?? claimOf(id)) }
    else setEditing(cur => (cur === id ? null : cur))
  }

  function claimOf(id: string) {
    return [...weak, ...confident].find(x => x.id === id)?.claim ?? ''
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
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
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
              <span className="border-l pl-3 font-mono text-xs tabular-nums text-luna">{changed} changed</span>
            )}
          </div>
        )}

        {stage === 'open' && (
          <Card>
            <CardContent className="space-y-6 p-8">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Before I build your strategy</h1>
                <p className="text-muted-foreground">
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
                  {editing === example.id && (
                    <CorrectionBox
                      draft={draft} setDraft={setDraft} claim={example.claim}
                      onSave={() => { setCorrections(c => ({ ...c, [example.id]: draft })); setEditing(null) }}
                    />
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
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
                <span className="text-muted-foreground"> — where it matters most.</span>
              </p>
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {i + 1} of {weak.length}
              </span>
            </div>

            <Card>
              <CardContent className="space-y-4 p-8">
                {/* Never a truncated heading. Where the fragment has no real title, the claim IS
                    the content, so it is presented whole rather than cut mid-word. */}
                {current.titleIsDerived
                  ? <p className="text-base font-medium leading-relaxed">{current.detail}</p>
                  : <h2 className="text-lg font-semibold leading-snug">{current.claim}</h2>}

                {current.evidence && (
                  <p className={cn('border-l-2 pl-3 text-sm italic',
                    current.weakReason === 'failed' ? 'border-destructive/40 text-muted-foreground' : 'border-luna')}>
                    {current.evidence}
                  </p>
                )}

                {/* The flag reason is the system showing its working — the trust mechanism. */}
                <p className="text-sm text-muted-foreground">
                  {current.reason}
                  <span className="ml-2 text-muted-foreground/70">· {current.sourceName}</span>
                </p>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm">{question(current)}</p>
                    <VerdictControls
                      verdict={verdicts[current.id]}
                      onSet={v => { set(current.id, v); if (v && v !== 'fixed') advance() }}
                    />
                  </div>

                  {editing === current.id && (
                    <CorrectionBox
                      draft={draft} setDraft={setDraft} claim={current.claim}
                      onSave={() => { setCorrections(c => ({ ...c, [current.id]: draft })); setEditing(null); advance() }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Named, so it cannot be read as "skip everything" and then surprise the user with
                twenty-five more. It says exactly where it goes and how many are there. */}
            <button onClick={() => setStage('confident')}
              className="text-sm text-muted-foreground underline underline-offset-4">
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
                <p className="text-sm text-muted-foreground">
                  {stage === 'all'
                    ? `${SETS.weak} first, then ${SETS.confident.toLowerCase()}. `
                    : 'Nothing here needs a decision. '}
                  Skim it; tap one to see what it&rsquo;s built on.
                </p>
              </div>

              {/* Full flow, no scroll box. The constrained-height version hid most of the list
                  behind an invisible scroll and made the count on screen contradict the heading. */}
              <div className="divide-y divide-border">
                {list.map(c => (
                  <div key={c.id}>
                    <FragmentRow
                      item={c}
                      verdict={verdicts[c.id]}
                      onSet={v => set(c.id, v)}
                      showEvidence={expanded === c.id}
                      onOpen={() => setExpanded(expanded === c.id ? null : c.id)}
                    />
                    {editing === c.id && (
                      <CorrectionBox
                        draft={draft} setDraft={setDraft} claim={c.claim}
                        onSave={() => { setCorrections(cs => ({ ...cs, [c.id]: draft })); setEditing(null) }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <Button onClick={() => setStage('close')}>Build my strategy</Button>
                {stage === 'confident' && weak.length > 0 ? (
                  <button onClick={() => setStage('all')}
                    className="text-xs text-muted-foreground underline underline-offset-4">
                    Show {SETS.weak.toLowerCase()} here too
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">you can tweak these any time</span>
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
                {dropped > 0 && <p>Dropped <strong>{dropped}</strong>.</p>}
                {fixes > 0 && <p>Added <strong>{fixes}</strong> correction{fixes > 1 ? 's' : ''} in your words.</p>}
                {kept === 0 && dropped === 0 && fixes === 0 && <p>Nothing changed — building from all {total}.</p>}
                <p className="text-muted-foreground">Building from {remaining}.</p>
              </div>

              <div className="space-y-2 rounded-lg border bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Seen</span>
                  <span className="font-mono text-sm tabular-nums">{reviewed} of {total}</span>
                </div>
                <Progress value={(reviewed / total) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {weakReviewed === weak.length && weak.length > 0
                    ? `You looked at all ${weak.length} I flagged. ${reviewed < total ? `The other ${total - reviewed} are there whenever you want them.` : ''}`
                    : `You can come back to the ${total - reviewed} you haven't seen any time.`}
                </p>
              </div>

              <Button variant="outline"
                onClick={() => { setStage('open'); setI(0); setVerdicts({}); setPresented(new Set()); setExpanded(null); setEditing(null) }}>
                Run it again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

/** Prefilled: "not quite" means nearly right, so the ask is an edit, not a blank-box rewrite. */
function CorrectionBox({
  draft, setDraft, claim, onSave,
}: { draft: string; setDraft: (s: string) => void; claim: string; onSave: () => void }) {
  return (
    <div className="space-y-2 pb-3 pl-11">
      <Textarea autoFocus rows={3} value={draft} onChange={e => setDraft(e.target.value)}
        placeholder="Say it the way you'd say it." />
      <div className="flex justify-end">
        <Button size="sm" disabled={!draft.trim() || draft.trim() === claim} onClick={onSave}>
          Use my words
        </Button>
      </div>
    </div>
  )
}
