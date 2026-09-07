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
import { Check, X, PenLine, ArrowRight, Sparkles, ChevronDown, ChevronRight, FileText, MessageSquare, Package, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { SETS, groupByDimension, type GateItem, type GateModel } from './derive'

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

/**
 * Tri-state, ILS-style: the chosen control fills; clicking it again clears the verdict.
 *
 * The three states are visually distinct, not just present/absent (Jonny, 2026-09-07):
 *
 *   at rest    outlined, dark grey — a real affordance rather than a ghost you have to hunt for
 *   kept       filled GOLD (`--luna`), the product's affirmative colour, dark text on it
 *   dropped    filled dark grey — the same weight as a keep, so neither reads as the default
 *
 * Filled-vs-outlined is what carries the state; colour only says WHICH. That keeps it legible
 * without relying on hue alone, and it is why drop is a fill rather than a red.
 */
function VerdictControls({
  verdict, onSet, size = 'default', withEdit = true,
}: {
  verdict: Verdict | undefined
  onSet: (v: Verdict | undefined) => void
  size?: 'default' | 'sm'
  /** Rows drop it: three verdict icons plus a disclosure chevron is one control too many. */
  withEdit?: boolean
}) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5'
  const opts: { v: Verdict; Icon: typeof Check; label: string }[] = [
    { v: 'keep', Icon: Check, label: 'Keep' },
    { v: 'drop', Icon: X, label: 'Drop' },
    ...(withEdit ? [{ v: 'fixed' as Verdict, Icon: PenLine, label: 'Not quite — say it my way' }] : []),
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
            verdict === v && v === 'keep' && 'border-luna bg-luna text-luna-foreground',
            verdict === v && v === 'drop' && 'border-foreground/80 bg-foreground/80 text-background',
            verdict === v && v === 'fixed' && 'border-luna-dark bg-luna-dark text-white',
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
  item, verdict, onSet, showEvidence, onOpen, hideDimension, editing, onStartEdit, draft, setDraft, onSaveEdit, onCancelEdit, correction,
}: {
  item: GateItem
  verdict: Verdict | undefined
  onSet: (v: Verdict | undefined) => void
  showEvidence: boolean
  onOpen?: () => void
  /** Suppressed inside a grouped list, where the subheading already says it. */
  hideDimension?: boolean
  editing?: boolean
  onStartEdit?: () => void
  draft?: string
  setDraft?: (s: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  correction?: string
}) {
  const shown = correction ?? item.claim

  return (
    <div className="flex items-start gap-2 py-2.5">
      <VerdictControls verdict={verdict} onSet={onSet} size="sm" withEdit={false} />
      {/* Disclosure, not decoration: without it a row gave no sign it had anything behind it. */}
      {onOpen && (
        <button onClick={onOpen} aria-label={showEvidence ? 'Hide the evidence' : 'Show the evidence'}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground">
          {showEvidence ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        {/* IN-PLACE EDIT. The claim is replaced by an input occupying the same line at the same
            size, so "not quite" is visibly a correction of THIS sentence rather than a form that
            opened underneath it. Nothing below moves; §10's in-place editing, minus the diffing. */}
        {editing ? (
          <div className="space-y-1.5">
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft?.(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onSaveEdit?.()
                if (e.key === 'Escape') onCancelEdit?.()
              }}
              className="w-full rounded-sm border-b-2 border-luna bg-transparent pb-0.5 text-sm leading-snug outline-none"
            />
            <div className="flex items-center gap-3 text-xs">
              <button onClick={onSaveEdit} disabled={!draft?.trim()}
                className="font-medium text-luna disabled:opacity-40">Use my words</button>
              <button onClick={onCancelEdit} className="text-muted-foreground">Cancel</button>
              <span className="text-muted-foreground/60">↵ to save · esc to cancel</span>
            </div>
          </div>
        ) : (
          /* Claim and source share one line: the source was doubling every row's height for a
             label that only needs to be glanceable. */
          <button
            onClick={onOpen}
            disabled={!onOpen}
            className={cn('flex w-full items-baseline justify-between gap-4 text-left text-sm leading-snug',
              verdict === 'drop' ? 'text-muted-foreground line-through' : 'text-foreground',
              onOpen && 'hover:text-luna')}
          >
            <span className="min-w-0">
              {item.dimensionLabel && !hideDimension && (
                <span className="mr-1.5 text-muted-foreground">{item.dimensionLabel} ·</span>
              )}
              {shown}
              {correction && <span className="ml-2 text-xs font-medium text-luna">your words</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-normal text-muted-foreground/70"
              title={item.sourceName}>
              {(() => { const I = SOURCE_ICON[item.sourceKind]; return <I className="h-3.5 w-3.5" /> })()}
              {item.sourceShort}
            </span>
          </button>
        )}

        {item.reason && !editing && (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
        )}

        {showEvidence && item.evidence && !editing && (
          /* ONE quotation device, not three. It was carrying a border, curly quotes AND a quote
             icon for a single idea. The rule alone says "these are the words". */
          <div className="mt-2">
            <p className={cn('border-l-2 pl-3 text-sm italic',
              item.weakReason === 'failed' ? 'border-destructive/40 text-muted-foreground' : 'border-luna')}>
              {item.evidence}
            </p>
            <div className="mt-1.5 flex items-center gap-3 pl-3">
              <p className="text-xs text-muted-foreground/70">{item.sourceName}</p>
              {onStartEdit && (
                <button onClick={onStartEdit} className="text-xs font-medium text-luna">
                  Not quite — say it my way
                </button>
              )}
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

  function itemOf(id: string) {
    return [...weak, ...confident].find(x => x.id === id)
  }

  function claimOf(id: string) {
    const it = itemOf(id)
    // Editing a derived-title fragment edits the whole claim, not the label cut from it.
    return corrections[id] ?? (it?.titleIsDerived ? it.detail : it?.claim) ?? ''
  }

  /** Saving a correction is the only place a verdict is set by something other than a control. */
  function saveEdit(id: string) {
    setCorrections(c => ({ ...c, [id]: draft.trim() }))
    setVerdicts(v => ({ ...v, [id]: 'fixed' }))
    setEditing(null)
    if (stage === 'weak' && current?.id === id) advance()
  }

  function cancelEdit(id: string) {
    setEditing(null)
    // Cancelling must not leave the row marked 'fixed' by the click that opened the editor.
    setVerdicts(v => {
      if (v[id] !== 'fixed' || corrections[id]) return v
      const next = { ...v }; delete next[id]; return next
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
                    editing={editing === example.id}
                    onStartEdit={() => set(example.id, 'fixed')}
                    draft={draft} setDraft={setDraft}
                    correction={corrections[example.id]}
                    onSaveEdit={() => saveEdit(example.id)}
                    onCancelEdit={() => cancelEdit(example.id)}
                  />
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
                {current.dimensionLabel && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {current.dimensionLabel}
                  </p>
                )}
                {/* Never a truncated heading. Where the fragment has no real title, the claim IS
                    the content, so it is presented whole rather than cut mid-word. */}
                {editing === current.id ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus rows={3} value={draft} onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(current.id)
                        if (e.key === 'Escape') cancelEdit(current.id)
                      }}
                      className="w-full resize-none rounded-md border-2 border-luna bg-transparent p-2 text-base font-medium leading-relaxed outline-none"
                    />
                    <div className="flex items-center gap-3 text-xs">
                      <button onClick={() => saveEdit(current.id)} disabled={!draft.trim()}
                        className="font-medium text-luna disabled:opacity-40">Use my words</button>
                      <button onClick={() => cancelEdit(current.id)} className="text-muted-foreground">Cancel</button>
                      <span className="text-muted-foreground/60">⌘↵ to save · esc to cancel</span>
                    </div>
                  </div>
                ) : corrections[current.id] ? (
                  <p className="text-base font-medium leading-relaxed">
                    {corrections[current.id]}
                    <span className="ml-2 text-xs font-medium text-luna">your words</span>
                  </p>
                ) : current.titleIsDerived
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
              <div className="space-y-5">
                {groupByDimension(list).map(g => (
                  <div key={g.dimension ?? 'none'}>
                    <h3 className="border-b pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </h3>
                    <div className="divide-y divide-border">
                      {g.items.map(c => (
                        <div key={c.id}>
                          <FragmentRow
                            item={c}
                            verdict={verdicts[c.id]}
                            onSet={v => set(c.id, v)}
                            showEvidence={expanded === c.id}
                            onOpen={() => setExpanded(expanded === c.id ? null : c.id)}
                            hideDimension
                            editing={editing === c.id}
                            onStartEdit={() => set(c.id, 'fixed')}
                            draft={draft} setDraft={setDraft}
                            correction={corrections[c.id]}
                            onSaveEdit={() => saveEdit(c.id)}
                            onCancelEdit={() => cancelEdit(c.id)}
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
                    className="text-xs text-muted-foreground underline underline-offset-4">
                    {stage === 'all' ? `${SETS.confident} only (${confident.length})` : `See all ${total}`}
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

