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
import { useState } from 'react'
import { Check, X, PenLine, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { GateItem, GateModel } from './derive'

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
  item, verdict, onSet, showEvidence, seen, onOpen,
}: {
  item: GateItem
  verdict: Verdict | undefined
  onSet: (v: Verdict | undefined) => void
  showEvidence: boolean
  seen?: boolean
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

        {showEvidence && (
          <div className="mt-2 space-y-2">
            {item.evidence ? (
              /* ONE quotation device, not three. The rule was previously carrying a border, a pair
                 of curly quotes AND a quote icon on the line beneath, which read as three separate
                 signals for one idea. The rule alone says "these are the words". */
              <p className={cn('border-l-2 pl-3 text-sm italic',
                item.weakReason === 'failed' ? 'border-destructive/40 text-muted-foreground' : 'border-luna')}>
                {item.evidence}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {item.reason ?? item.sourceName}
              {item.reason && <span className="ml-2 opacity-60">{item.sourceName}</span>}
            </p>
          </div>
        )}
      </div>
      {seen !== undefined && !showEvidence && (
        <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', seen ? 'bg-luna' : 'bg-transparent')} />
      )}
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
  const [seen, setSeen] = useState<Set<string>>(new Set())

  const list = stage === 'all' ? [...weak, ...confident] : confident
  const kept = Object.values(verdicts).filter(v => v === 'keep').length
  const dropped = Object.values(verdicts).filter(v => v === 'drop').length
  const fixes = Object.values(verdicts).filter(v => v === 'fixed').length
  // Confirmed = anything looked at, whatever was decided. Denominator is the ORIGINAL count, so
  // dropping can never inflate it — §8.
  const confirmed = new Set([...Object.keys(verdicts), ...Array.from(seen)]).size
  const remaining = total - dropped
  const current = weak[i]

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

        {/* The score is live and always on screen from the first action onward, so the very first
            interaction has a visible consequence — §7's "one action, visible consequence". */}
        {confirmed > 0 && stage !== 'close' && (
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
            <span className="text-xs font-medium">Confirmed by you</span>
            <Progress value={(confirmed / total) * 100} className="h-1.5 flex-1" />
            <span className="font-mono text-xs tabular-nums">{confirmed} of {total}</span>
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
                <strong className="text-foreground">{confident.length} of the {total}</strong> are grounded like that one.
                {weak.length > 0 && <> <strong className="text-foreground">{weak.length}</strong> I&rsquo;m less sure about.</>}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {weak.length > 0 && (
                  <Button onClick={() => setStage('weak')}>
                    {verdicts[example?.id ?? ''] ? 'Next — check those' : 'Check those'} {weak.length}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
                <Button variant={weak.length ? 'outline' : 'default'} onClick={() => setStage('close')}>
                  {verdicts[example?.id ?? ''] ? 'That\u2019s enough — build it' : 'Looks right — build it'}
                </Button>
                <Button variant="ghost" onClick={() => setStage('all')}>See all {total}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === 'weak' && current && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">
                These <strong className="text-foreground">{weak.length}</strong> are where it matters most — the rest I&rsquo;m confident about.
              </p>
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {i + 1} of {weak.length}
              </span>
            </div>

            <Card>
              <CardContent className="space-y-4 p-8">
                <h2 className="text-lg font-semibold leading-snug">{current.claim}</h2>

                {current.evidence && (
                  <p className={cn('border-l-2 pl-3 text-sm italic',
                    current.weakReason === 'failed' ? 'border-destructive/40 text-muted-foreground' : 'border-luna')}>
                    {current.evidence}
                  </p>
                )}

                {/* The flag reason is the system showing its working — the trust mechanism. */}
                <p className="text-sm text-muted-foreground">{current.reason}</p>

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

            <button onClick={() => setStage('confident')}
              className="text-sm text-muted-foreground underline underline-offset-4">
              Skip the rest of these
            </button>
          </div>
        )}

        {(stage === 'confident' || stage === 'all') && (
          <Card>
            <CardContent className="space-y-4 p-8">
              <div>
                <h2 className="text-lg font-semibold">
                  {stage === 'all' ? `All ${total} things I took.` : `${confident.length} more, all well-grounded.`}
                </h2>
                <p className="text-sm text-muted-foreground">Skim if you like. Tap one to see what it&rsquo;s built on.</p>
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
                      seen={seen.has(c.id)}
                      onOpen={() => { setExpanded(expanded === c.id ? null : c.id); setSeen(s => new Set(s).add(c.id)) }}
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
                <span className="text-xs text-muted-foreground">you can tweak these any time</span>
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
                  <span className="text-sm font-medium">Confirmed by you</span>
                  <span className="font-mono text-sm tabular-nums">{confirmed} of {total}</span>
                </div>
                <Progress value={(confirmed / total) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {confirmed < total
                    ? `You can come back to the ${total - confirmed} you haven't seen any time — the more confirmed, the better this gets.`
                    : 'Everything confirmed.'}
                </p>
              </div>

              <Button variant="outline"
                onClick={() => { setStage('open'); setI(0); setVerdicts({}); setSeen(new Set()); setExpanded(null); setEditing(null) }}>
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
      <Button size="sm" disabled={!draft.trim() || draft.trim() === claim} onClick={onSave}>
        Use my words
      </Button>
    </div>
  )
}
