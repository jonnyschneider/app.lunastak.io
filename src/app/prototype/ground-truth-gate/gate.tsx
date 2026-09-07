'use client'

/**
 * PROTOTYPE: the ground truth gate. Disposable — built to decide layout, affordances and editing
 * in context. Design: docs/_plans/2026-09-06-ground-truth-gate-interaction-design.md
 *
 * Real components and tokens throughout, so layout judgements transfer. Real project data via
 * `derive.ts`. No writes: verdicts live in component state, because this build exists to decide
 * what the interaction should be, not to archive anything.
 */
import { useState } from 'react'
import { Check, X, PenLine, ArrowRight, Quote, Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { GateItem, GateModel } from './derive'

type Verdict = 'keep' | 'drop' | 'fixed'
type Stage = 'open' | 'weak' | 'confident' | 'all' | 'close'

/**
 * The question depends on how the fragment was made (§16.1) — but a fragment with no evidence
 * cannot be asked either of those. "You said this" is a lie when we just admitted we cannot find
 * their words, and "I read this from what you said" implies a reading we cannot show.
 */
function question(item: GateItem): string {
  if (item.weakReason === 'no-evidence') return 'Keep it anyway?'
  if (item.weakReason === 'unsaid') return 'Is that a fair read of what you meant?'
  if (item.weakReason === 'failed') return "I can't tie this back to your words. Does it still stand?"
  return item.type === 'verbatim'
    ? 'You said this — does it still matter?'
    : 'I read this from what you said — fair?'
}

export function GroundTruthGate({ model, projectId }: { model: GateModel; projectId: string }) {
  const { weak, confident, total, example, counts } = model

  const [stage, setStage] = useState<Stage>('open')
  const [i, setI] = useState(0)
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [seen, setSeen] = useState<Set<string>>(new Set())

  // Door 3 shows everything; the post-walk list shows only what was not just walked.
  const list = stage === 'all' ? [...weak, ...confident] : confident
  const kept = Object.values(verdicts).filter(v => v === 'keep').length
  const dropped = Object.values(verdicts).filter(v => v === 'drop').length
  const fixes = Object.values(verdicts).filter(v => v === 'fixed').length
  // Confirmed = anything looked at, whatever was decided. Denominator is the ORIGINAL count so
  // dropping can never inflate it — §8.
  const confirmed = new Set([...Object.keys(verdicts), ...Array.from(seen)]).size
  const remaining = total - dropped

  const current = weak[i]

  function rule(item: GateItem, v: Verdict) {
    setVerdicts(s => ({ ...s, [item.id]: v }))
    setEditing(null); setDraft('')
    if (i + 1 < weak.length) setI(i + 1)
    else setStage('confident')
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Prototype · ground truth gate · real data · {projectId.slice(0, 10)}…
        </p>

        {stage === 'open' && (
          <Card>
            <CardContent className="space-y-6 p-8">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Before I build your strategy</h1>
                <p className="text-muted-foreground">
                  I took <strong className="text-foreground">{total} things</strong> from what you told me.
                  Here&rsquo;s one, so you can see how I&rsquo;m reading you:
                </p>
              </div>

              {example && (
                <div className="rounded-lg border bg-card p-5">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">You said</p>
                  <blockquote className="border-l-2 border-luna pl-3 text-sm italic">
                    &ldquo;{example.evidence}&rdquo;
                  </blockquote>
                  <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">So I took</p>
                  <p className="text-sm font-medium">{example.claim}</p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{confident.length} of the {total}</strong> are grounded like that one.
                {weak.length > 0 && <> <strong className="text-foreground">{weak.length}</strong> I&rsquo;m less sure about.</>}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {/* The weak set is the designed path, so it leads. */}
                {weak.length > 0 && (
                  <Button onClick={() => setStage('weak')}>
                    Check those {weak.length} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
                <Button variant={weak.length ? 'outline' : 'default'} onClick={() => setStage('close')}>
                  Looks right — build it
                </Button>
                <Button variant="ghost" onClick={() => setStage('all')}>See all {total}</Button>
              </div>

              {/* Prototype instrument, not product: the weak set's composition, which the design
                  has been reasoning about without ever having seen it. */}
              <p className="border-t pt-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                weak {weak.length} = thin {counts.thin} · made up {counts.failed} · luna&rsquo;s words {counts.unsaid} · no evidence {counts['no-evidence']}
              </p>
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
              <CardContent className="space-y-5 p-8">
                <h2 className="text-lg font-semibold leading-snug">{current.claim}</h2>

                {current.evidence && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {current.weakReason === 'failed' ? 'It quoted'
                        : current.weakReason === 'unsaid' ? 'I said' : 'You said'}
                    </p>
                    <blockquote className={cn('border-l-2 pl-3 text-sm italic',
                      current.weakReason === 'failed' ? 'border-destructive/40'
                        : current.weakReason === 'unsaid' ? 'border-muted-foreground/40' : 'border-luna')}>
                      &ldquo;{current.evidence}&rdquo;
                    </blockquote>
                  </div>
                )}

                {/* The flag reason is the system showing its working — the trust mechanism. */}
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  {current.weakReason === 'failed'
                    ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    : <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  {current.reason}
                </p>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm">{question(current)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => rule(current, 'keep')}>
                      <Check className="mr-1 h-4 w-4" /> Keep
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rule(current, 'drop')}>
                      <X className="mr-1 h-4 w-4" /> Drop
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => { setEditing(current.id); setDraft(current.claim) }}>
                      <PenLine className="mr-1 h-4 w-4" /> Not quite
                    </Button>
                  </div>

                  {editing === current.id && (
                    <div className="space-y-2">
                      {/* Prefilled: "not quite" means nearly right, so the ask is an edit rather
                          than a rewrite from a blank box. */}
                      <Textarea autoFocus rows={3} value={draft} onChange={e => setDraft(e.target.value)}
                        placeholder="Say it the way you'd say it." />
                      <Button size="sm" disabled={!draft.trim() || draft.trim() === current.claim}
                        onClick={() => rule(current, 'fixed')}>
                        Use my words
                      </Button>
                    </div>
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
            <CardContent className="space-y-5 p-8">
              <div>
                <h2 className="text-lg font-semibold">
                  {stage === 'all' ? `All ${total} things I took.` : `${confident.length} more, all well-grounded.`}
                </h2>
                <p className="text-sm text-muted-foreground">Skim if you like. Anything look off? Tap it to see what it&rsquo;s built on.</p>
              </div>

              {/* Recognition, not judgement — headings only, evidence one tap away. */}
              <div className="relative">
                <div className="-mx-2 max-h-[26rem] divide-y divide-border overflow-y-auto">
                  {list.map(c => (
                    <div key={c.id} className="px-2">
                      <button
                        onClick={() => { setExpanded(expanded === c.id ? null : c.id); setSeen(s => new Set(s).add(c.id)) }}
                        className={cn('flex w-full items-start gap-3 py-2.5 text-left text-sm hover:text-foreground',
                          verdicts[c.id] === 'drop' ? 'text-muted-foreground line-through' : 'text-foreground')}
                      >
                        <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          seen.has(c.id) ? 'bg-luna' : 'bg-border')} />
                        <span className="flex-1">{c.claim}</span>
                      </button>
                      {expanded === c.id && (
                        <div className="space-y-3 pb-3 pl-6">
                          {c.evidence ? (
                            <blockquote className="border-l-2 border-luna pl-3 text-sm italic text-muted-foreground">
                              &ldquo;{c.evidence}&rdquo;
                            </blockquote>
                          ) : (
                            <p className="text-sm text-muted-foreground">{c.reason}</p>
                          )}
                          <div className="flex items-center gap-2">
                            {/* Drop toggles — a one-way drop inside a scan list is a trap. */}
                            <Button size="sm" variant="outline"
                              onClick={() => setVerdicts(s => {
                                const next = { ...s }
                                if (next[c.id] === 'drop') delete next[c.id]
                                else next[c.id] = 'drop'
                                return next
                              })}>
                              {verdicts[c.id] === 'drop'
                                ? <><Check className="mr-1 h-3.5 w-3.5" /> Undo</>
                                : <><X className="mr-1 h-3.5 w-3.5" /> Drop this</>}
                            </Button>
                            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                              {c.sourceName}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* The list scrolls nine rows into a much longer set with nothing saying so. */}
                {list.length > 9 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
                )}
              </div>

              {list.length > 9 && (
                <p className="text-center text-xs text-muted-foreground">
                  {list.length} in the list — scroll for the rest
                </p>
              )}

              <div className="flex items-center justify-between gap-4">
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
                  <span className="font-mono text-sm">{confirmed} of {total}</span>
                </div>
                <Progress value={(confirmed / total) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {confirmed < total
                    ? `You can come back to the ${total - confirmed} you haven't seen any time — the more confirmed, the better this gets.`
                    : 'Everything confirmed.'}
                </p>
              </div>

              <Button variant="outline"
                onClick={() => { setStage('open'); setI(0); setVerdicts({}); setSeen(new Set()); setExpanded(null) }}>
                Run it again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
