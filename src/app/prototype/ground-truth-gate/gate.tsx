'use client'

/**
 * PROTOTYPE: the ground truth gate. Disposable — built to decide layout, affordances and editing
 * in context, before implementation. Design: docs/_plans/2026-09-06-ground-truth-gate-interaction-design.md
 *
 * Real components and tokens throughout, so layout judgements transfer.
 * No DB, no writes, no pipeline. Fixture is real material from a real bundle + two real documents.
 */
import { useState } from 'react'
import { Check, X, PenLine, ArrowRight, Quote, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export type Item = {
  id: string
  claim: string
  area: string
  source: string
  evidence: string | null
  spans: number
  verification: 'verified' | 'unverifiable' | 'none'
  type: 'verbatim' | 'interpretation'
  weak: boolean
  reason: string | null
}
export type Fixture = { provenance: string; total: number; weak: Item[]; confident: Item[] }

type Verdict = 'keep' | 'drop' | 'fixed'
type Stage = 'open' | 'weak' | 'confident' | 'all' | 'close'

/**
 * The question depends on how the fragment was made — §16.1 — but a fragment with NO evidence
 * cannot be asked either of those. "You said this" is a lie when we just admitted we can't find
 * their words; "I read this from what you said" implies a reading we cannot show. So the
 * no-evidence case gets its own honest question.
 */
const question = (item: Item) =>
  !item.evidence
    ? 'Keep it anyway?'   // the reason line above already says why we're asking
    : item.type === 'verbatim'
      ? 'You said this — does it still matter?'
      : 'I read this from what you said — fair?'

export function GroundTruthGate({ fixture }: { fixture: Fixture }) {
  const [stage, setStage] = useState<Stage>('open')
  const [i, setI] = useState(0)
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [seen, setSeen] = useState<Set<string>>(new Set())

  const { weak, confident, total } = fixture
  const example = confident[0]

  // Door 3 shows everything; the post-walk list shows only what was not just walked.
  const list = stage === 'all' ? [...weak, ...confident] : confident

  const kept = Object.values(verdicts).filter(v => v === 'keep').length
  const dropped = Object.values(verdicts).filter(v => v === 'drop').length
  const fixes = Object.values(verdicts).filter(v => v === 'fixed').length
  // Confirmed = anything looked at, whatever was decided. Denominator is the ORIGINAL count so
  // dropping can never inflate it — §8 of the design.
  const confirmed = new Set([...Object.keys(verdicts), ...Array.from(seen)]).size
  const remaining = total - dropped

  function rule(item: Item, v: Verdict, text?: string) {
    setVerdicts(s => ({ ...s, [item.id]: v }))
    if (text) setCorrections(s => ({ ...s, [item.id]: text }))
    setEditing(null); setDraft('')
    if (i + 1 < weak.length) setI(i + 1)
    else setStage('confident')
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Prototype · ground truth gate · disposable
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
            </CardContent>
          </Card>
        )}

        {stage === 'weak' && weak[i] && (
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
                {/* No type badge. `verbatim`/`interpretation` is our vocabulary, not the user's,
                    and it read as a contradiction next to "I couldn't find your own words". The
                    type still decides the question asked — which is all it was ever for. */}
                <h2 className="text-lg font-semibold leading-snug">{weak[i].claim}</h2>

                {weak[i].evidence ? (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">You said</p>
                    <blockquote className="border-l-2 border-luna pl-3 text-sm italic">&ldquo;{weak[i].evidence}&rdquo;</blockquote>
                  </div>
                ) : null}

                {/* The flag reason is the system showing its working — the trust mechanism. */}
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Quote className="h-3.5 w-3.5 shrink-0" /> {weak[i].reason}
                </p>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm">{question(weak[i])}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => rule(weak[i], 'keep')}>
                      <Check className="mr-1 h-4 w-4" /> Keep
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rule(weak[i], 'drop')}>
                      <X className="mr-1 h-4 w-4" /> Drop
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => { setEditing(weak[i].id); setDraft(weak[i].claim) }}>
                      <PenLine className="mr-1 h-4 w-4" /> Not quite
                    </Button>
                  </div>

                  {editing === weak[i].id && (
                    <div className="space-y-2">
                      {/* Prefilled with the claim. "Not quite" means *nearly* right — asking for
                          a blank-box rewrite is a bigger ask than the verdict it sits beside. */}
                      <Textarea autoFocus rows={3} value={draft} onChange={e => setDraft(e.target.value)}
                        placeholder="Say it the way you'd say it." />
                      <Button size="sm" disabled={!draft.trim() || draft.trim() === weak[i].claim}
                        onClick={() => rule(weak[i], 'fixed', draft)}>
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
                  {stage === 'all'
                    ? `All ${total} things I took.`
                    : `${confident.length} more, all well-grounded.`}
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
                            {/* Drop toggles. A one-way drop inside a scan list is a trap: the row
                                goes line-through and there is no way back. */}
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
                              {c.source}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* The list scrolls nine rows into a fifty-seven row set with nothing saying so. */}
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
                {dropped === 0 && fixes === 0 && kept === 0 && <p>Nothing changed — building from all {total}.</p>}
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

              <Button variant="outline" onClick={() => { setStage('open'); setI(0); setVerdicts({}); setSeen(new Set()); setExpanded(null) }}>
                Run it again
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-xs text-muted-foreground">{fixture.provenance}</p>
      </div>
    </div>
  )
}
