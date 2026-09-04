'use client'

/**
 * PROTOTYPE: the ground truth check (phase 1 — fragments).
 *
 * Throwaway. No DB, no writes, no pipeline, no schema. Exists to answer the questions the
 * architecture in §13–§15 cannot: what does a row look like, and does the tranche walk hold
 * attention across 50+ items when a bundle lands.
 *
 * The one deliberately unsettled thing is the LAYOUT toggle — whether the user's own words
 * lead the row or our reading does. §10's precedent: instrument the comparison, walk one
 * tranche in each, decide from the run rather than from taste.
 */
import { useMemo, useState } from 'react'

export type Item = {
  id: string
  claim: string
  reading: string
  type: 'verbatim' | 'interpretation'
  excerpt: string
  verification: 'verified' | 'unverifiable' | 'failed'
  source: string
  kind: 'document' | 'bundle'
  area?: string
  tranche: 'strong' | 'middle' | 'weak'
}
export type Fixture = { generatedAt: string; provenance: string; counts: Record<string, number>; items: Item[] }

type Verdict = 'keep' | 'drop'
type Layout = 'words-first' | 'reading-first'

/** The framing per tranche. This IS the interaction — the tranche tells the user why they're being asked. */
const TRANCHE = {
  strong: {
    label: 'Straightforward',
    lead: "These quote you directly, and we checked the words are really there.",
    ask: 'Skim and keep. Drop anything that has stopped being true.',
  },
  middle: {
    label: 'Your call',
    lead: "These came from material we no longer hold, so we can't check them against a source.",
    ask: 'You are the only one who can tell. Do you recognise these as yours?',
  },
  weak: {
    label: 'We got a whiff',
    lead: 'Not much to go on here — the scent is weaker than the rest.',
    ask: 'Worth a closer look. Drop freely.',
  },
} as const

const QUESTION = {
  verbatim: 'You said this — does it still matter?',
  interpretation: 'We read this from what you gave us. Fair?',
} as const

export function GroundTruthCheck({ fixture }: { fixture: Fixture }) {
  const [layout, setLayout] = useState<Layout>('words-first')
  const [started, setStarted] = useState(false)
  const [tranche, setTranche] = useState<0 | 1 | 2>(0)
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [remark, setRemark] = useState<Record<string, string>>({})
  const [openRemark, setOpenRemark] = useState<string | null>(null)
  const [addition, setAddition] = useState('')

  const order = ['strong', 'middle', 'weak'] as const
  const groups = useMemo(
    () => order.map(t => ({ tranche: t, items: fixture.items.filter(i => i.tranche === t) })).filter(g => g.items.length),
    [fixture],
  )
  const current = groups[Math.min(tranche, groups.length - 1)]
  const ruled = Object.keys(verdicts).length
  const dropped = Object.values(verdicts).filter(v => v === 'drop').length

  if (!started) {
    return (
      <Shell fixture={fixture}>
        <h1 className="text-xl font-semibold">Before we build your strategy</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Luna took <strong className="text-foreground">{fixture.items.length} readings</strong> from what you
          gave it. Your strategy gets built on these, so it is worth a minute now.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          They are grouped by how much we have to back each one up — the easy ones first.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {groups.map(g => (
            <span key={g.tranche} className="rounded-full border border-border px-3 py-1 text-xs">
              {TRANCHE[g.tranche].label} · {g.items.length}
            </span>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button onClick={() => setStarted(true)} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
            Start
          </button>
          <button className="text-sm text-muted-foreground underline underline-offset-4">Skip for now</button>
        </div>
        <div className="mt-8 border-t border-border pt-4">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Layout (A/B)</span>
          <div className="mt-2 flex gap-2">
            {(['words-first', 'reading-first'] as Layout[]).map(l => (
              <button key={l} onClick={() => setLayout(l)}
                className={`rounded border px-3 py-1 text-xs ${layout === l ? 'border-foreground font-medium' : 'border-border text-muted-foreground'}`}>
                {l === 'words-first' ? 'Your words lead' : 'Our reading leads'}
              </button>
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  const t = TRANCHE[current.tranche]
  const allRuled = current.items.every(i => verdicts[i.id])

  return (
    <Shell fixture={fixture}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{t.label}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {tranche + 1} of {groups.length} · {current.items.length} items
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{t.lead}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t.ask}</p>

      <div className="mt-5 divide-y divide-border border-t border-border">
        {current.items.map(item => {
          const v = verdicts[item.id]
          return (
            <div key={item.id} className={`py-4 ${v === 'drop' ? 'opacity-40' : ''}`}>
              {layout === 'words-first' ? (
                <>
                  <Quote text={item.excerpt} verification={item.verification} source={item.source} />
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">So we took: </span>
                    <span className="font-medium">{item.claim}</span>
                  </p>
                  {item.reading && <p className="mt-1 text-xs text-muted-foreground">{item.reading}</p>}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">{item.claim}</p>
                  {item.reading && <p className="mt-1 text-xs text-muted-foreground">{item.reading}</p>}
                  <div className="mt-2">
                    <Quote text={item.excerpt} verification={item.verification} source={item.source} prefix="because you said" />
                  </div>
                </>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-muted-foreground">{QUESTION[item.type]}</span>
                <button onClick={() => setVerdicts(s => ({ ...s, [item.id]: 'keep' }))}
                  className={`rounded border px-3 py-1 text-xs ${v === 'keep' ? 'border-foreground font-medium' : 'border-border'}`}>
                  Keep
                </button>
                <button onClick={() => setVerdicts(s => ({ ...s, [item.id]: 'drop' }))}
                  className={`rounded border px-3 py-1 text-xs ${v === 'drop' ? 'border-foreground font-medium' : 'border-border'}`}>
                  Drop
                </button>
                <button onClick={() => setOpenRemark(openRemark === item.id ? null : item.id)}
                  className="text-xs text-muted-foreground underline underline-offset-4">
                  not quite
                </button>
              </div>

              {openRemark === item.id && (
                <textarea autoFocus rows={2} value={remark[item.id] ?? ''}
                  onChange={e => setRemark(s => ({ ...s, [item.id]: e.target.value }))}
                  placeholder="What would you say instead?"
                  className="mt-2 w-full rounded border border-border bg-background p-2 text-xs" />
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <label className="text-xs text-muted-foreground">Anything we missed here?</label>
        <textarea rows={2} value={addition} onChange={e => setAddition(e.target.value)}
          placeholder="In your own words — this gets added as new context."
          className="mt-1 w-full rounded border border-border bg-background p-2 text-xs" />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {ruled} ruled · {dropped} dropped{!allRuled && ' · unruled items are kept'}
        </span>
        <div className="flex gap-2">
          {tranche < groups.length - 1 ? (
            <button onClick={() => { setTranche((tranche + 1) as 0 | 1 | 2); setAddition('') }}
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
              Next: {TRANCHE[groups[tranche + 1].tranche].label}
            </button>
          ) : (
            <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">Build my strategy</button>
          )}
          <button className="rounded border border-border px-4 py-2 text-sm text-muted-foreground">
            Stop here and build
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Quote({ text, verification, source, prefix }: {
  text: string; verification: Item['verification']; source: string; prefix?: string
}) {
  return (
    <div>
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <blockquote className="mt-1 border-l-2 border-luna/40 pl-3 text-sm italic">&ldquo;{text}&rdquo;</blockquote>
      <span className="mt-1 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {source}
        {verification === 'verified' && ' · checked against your source'}
        {verification === 'unverifiable' && ' · we no longer hold the source'}
        {verification === 'failed' && ' · could not find this in your source'}
      </span>
    </div>
  )
}

function Shell({ children, fixture }: { children: React.ReactNode; fixture: Fixture }) {
  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Prototype · ground truth check · disposable
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{fixture.provenance}</p>
        <div className="mt-4 rounded-lg border border-border bg-card p-6">{children}</div>
      </div>
    </div>
  )
}
