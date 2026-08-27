'use client'

import * as React from 'react'

import {
  ReviewPass,
  type ReviewItem,
  type ReviewProgress,
  type Verdict,
} from '@/components/ui/review-pass'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/** One ruling, plus everything the pre-registered questions need to read. */
interface Ruling {
  id: string
  group: string
  statement: string
  verdict: Verdict
  remark?: string
  /** Was the receipt opened before this ruling? — question 3. */
  receiptRevealed: boolean
  /** Seconds spent on the item — question 1's real cost. */
  seconds: number
  /** Which layout this ruling was made under, so the two can be compared. */
  layout: Layout
  at: string
}

export interface Fixture {
  generatedFrom: string
  note: string
  itemCount: number
  withReceipt: number
  withEvidenceReceipt: number
  groups: { dimension: string; themeCount: number; fragmentCount: number }[]
  items: (ReviewItem & { receiptSource: 'evidence' | 'claim' | null })[]
}

type Layout = 'card' | 'list'

const STORAGE_KEY = 'prototype:ground-truth:v1'

const LAYOUT_BLURB: Record<Layout, string> = {
  card: 'One at a time — full attention per item, but 56 of them is a long walk.',
  list: 'Ten at a time — same three choices on every row, ruled in any order, skippable.',
}

const COPY = {
  intro: 'Confirm your ground truths',
  itemPrompt: 'What I took from your material',
  remarkPrompt: 'something else?',
}

const VERDICT_LABEL: Record<Verdict, string> = {
  yes: 'Yes',
  no: 'No',
  not_quite: 'Not quite right',
}

export function GroundTruthPreflight({ fixture }: { fixture: Fixture }) {
  const [started, setStarted] = React.useState(false)
  const [layout, setLayout] = React.useState<Layout>('list')
  const [rulings, setRulings] = React.useState<Ruling[]>([])
  const [progress, setProgress] = React.useState<ReviewProgress | null>(null)
  const [stopped, setStopped] = React.useState(false)
  const [debrief, setDebrief] = React.useState('')

  const items = fixture.items
  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  // Per-item timing and reveals, kept out of state so they never trigger a render.
  const itemStart = React.useRef(Date.now())
  const revealed = React.useRef(new Set<string>())

  // Restore an in-progress pass — partial completion is the expected case, so
  // the prototype has to survive a reload the way the real thing would.
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as {
          rulings: Ruling[]
          debrief?: string
          layout?: Layout
        }
        if (parsed.rulings?.length) {
          setRulings(parsed.rulings)
          setDebrief(parsed.debrief ?? '')
        }
        if (parsed.layout) setLayout(parsed.layout)
      }
    } catch {
      /* a corrupt prototype cache is not worth handling */
    }
  }, [])

  const persist = React.useCallback((next: Ruling[], nextDebrief: string, nextLayout: Layout) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rulings: next, debrief: nextDebrief, layout: nextLayout })
      )
    } catch {
      /* ignore */
    }
  }, [])

  const onRule = React.useCallback(
    async (id: string, verdict: Verdict, remark?: string) => {
      const item = byId.get(id)
      const ruling: Ruling = {
        id,
        group: item?.group ?? '',
        statement: item?.statement ?? '',
        verdict,
        remark,
        receiptRevealed: revealed.current.has(id),
        seconds: Math.round((Date.now() - itemStart.current) / 100) / 10,
        layout,
        at: new Date().toISOString(),
      }
      itemStart.current = Date.now()
      setRulings((prev) => {
        // Re-ruling a row in list layout replaces, rather than double-counts.
        const next = [...prev.filter((r) => r.id !== id), ruling]
        persist(next, debrief, layout)
        return next
      })
    },
    [byId, debrief, layout, persist]
  )

  // The remaining items to walk — so a resumed pass does not re-ask what was ruled.
  const ruledIds = React.useMemo(() => new Set(rulings.map((r) => r.id)), [rulings])
  const remaining = React.useMemo(() => items.filter((i) => !ruledIds.has(i.id)), [items, ruledIds])

  if (!started) {
    return (
      <Shell fixture={fixture} rulings={rulings}>
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">{COPY.intro}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Luna made <strong className="text-foreground">{items.length} interpretations</strong> of
            what you said. Your strategy is built on them — and opportunities will be built on top of
            that again.
            <br />
            Scoring them is the fastest way to make all of it better.
          </p>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                itemStart.current = Date.now()
                setStarted(true)
              }}
            >
              Start reviewing
            </Button>
            <button className="text-sm text-muted-foreground underline underline-offset-4">
              Skip for now
            </button>
          </div>

          {/* Prototype-only: the two layouts are the thing being compared. */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                Layout
              </span>
              {(['list', 'card'] as Layout[]).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setLayout(option)
                    persist(rulings, debrief, option)
                  }}
                  className={
                    layout === option
                      ? 'rounded-md border border-foreground/30 bg-muted px-2 py-1 text-xs font-medium'
                      : 'rounded-md border border-transparent px-2 py-1 text-xs text-muted-foreground hover:bg-muted'
                  }
                >
                  {option === 'list' ? 'Ten at a time' : 'One at a time'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{LAYOUT_BLURB[layout]}</p>
          </div>
          {rulings.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {rulings.length} already ruled in a previous sitting — the walk resumes where it
              stopped.
            </p>
          )}
        </div>
      </Shell>
    )
  }

  if (stopped || remaining.length === 0) {
    return (
      <Shell fixture={fixture} rulings={rulings}>
        <Findings
          fixture={fixture}
          rulings={rulings}
          debrief={debrief}
          onDebrief={(v) => {
            setDebrief(v)
            persist(rulings, v, layout)
          }}
          onReset={() => {
            localStorage.removeItem(STORAGE_KEY)
            setRulings([])
            setStopped(false)
            setStarted(false)
            setProgress(null)
            setDebrief('')
            revealed.current = new Set()
          }}
        />
      </Shell>
    )
  }

  return (
    <Shell fixture={fixture} rulings={rulings}>
      <div className="rounded-lg border p-6">
        <ReviewPass
          layout={layout}
          items={remaining}
          copy={COPY}
          onRule={onRule}
          onReveal={(id) => revealed.current.add(id)}
          onBatchEnd={setProgress}
        />
        {progress && !progress.complete && (
          <div className="mt-4 border-t pt-4">
            <button
              onClick={() => setStopped(true)}
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              Stop here and regenerate
            </button>
          </div>
        )}
      </div>
      <button
        onClick={() => setStopped(true)}
        className="text-xs text-muted-foreground underline underline-offset-4"
      >
        stop and show findings
      </button>
    </Shell>
  )
}

function Shell({
  fixture,
  rulings,
  children,
}: {
  fixture: Fixture
  rulings: Ruling[]
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Prototype · ground truth preflight · disposable
        </p>
        <p className="text-xs text-muted-foreground">
          {fixture.generatedFrom} — {fixture.itemCount} interpretations, {fixture.withReceipt} with a
          receipt ({fixture.withEvidenceReceipt} quoting evidence). {rulings.length} ruled.
        </p>
      </header>
      {children}
    </main>
  )
}

/** The instrument: reads the five pre-registered questions off the rulings. */
function Findings({
  fixture,
  rulings,
  debrief,
  onDebrief,
  onReset,
}: {
  fixture: Fixture
  rulings: Ruling[]
  debrief: string
  onDebrief: (v: string) => void
  onReset: () => void
}) {
  const counts = { yes: 0, no: 0, not_quite: 0 } as Record<Verdict, number>
  for (const r of rulings) counts[r.verdict] += 1

  const revealedRulings = rulings.filter((r) => r.receiptRevealed)
  const remarks = rulings.filter((r) => r.remark)
  const seconds = rulings.map((r) => r.seconds).sort((a, b) => a - b)
  const median = seconds.length ? seconds[Math.floor(seconds.length / 2)] : 0
  const totalMinutes = Math.round((rulings.reduce((n, r) => n + r.seconds, 0) / 60) * 10) / 10

  const share = (n: number) =>
    rulings.length ? `${Math.round((n / rulings.length) * 100)}%` : '—'

  // Verdict mix on items whose receipt was opened, against those it was not.
  const mix = (rs: Ruling[]) =>
    rs.length
      ? (['yes', 'no', 'not_quite'] as Verdict[])
          .map((v) => `${rs.filter((r) => r.verdict === v).length} ${VERDICT_LABEL[v].toLowerCase()}`)
          .join(' · ')
      : '—'

  const groupsTouched = new Set(rulings.map((r) => r.group))

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Where the pass stopped</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {rulings.length} of {fixture.itemCount} ruled, across {groupsTouched.size} of{' '}
          {fixture.groups.length} dimensions — {totalMinutes} minutes, median {median}s per item.
        </p>
      </div>

      <Question n={1} title="Volume — does the set read as reasonable, or as a wall?">
        Stopped at <strong>{rulings.length}</strong> of {fixture.itemCount}
        {rulings.length % 10 === 0 && rulings.length > 0 ? (
          <> — exactly on a batch boundary, so the boundary predicted the stop.</>
        ) : (
          <>
            {' '}
            — not on a batch boundary ({Math.floor(rulings.length / 10)} full batch
            {Math.floor(rulings.length / 10) === 1 ? '' : 'es'} done).
          </>
        )}{' '}
        At {median}s per item the full {fixture.itemCount} costs about{' '}
        {Math.round((median * fixture.itemCount) / 6) / 10} minutes. The design assumed ~32; this
        real capture run produced <strong>{fixture.itemCount}</strong>.
      </Question>

      <Question n={2} title="Verdicts — do three hold, or does a fourth appear unbidden?">
        {VERDICT_LABEL.yes} {counts.yes} ({share(counts.yes)}) · {VERDICT_LABEL.no} {counts.no} (
        {share(counts.no)}) · {VERDICT_LABEL.not_quite} {counts.not_quite} (
        {share(counts.not_quite)}).{' '}
        {counts.not_quite > 0 ? (
          <>
            &ldquo;Not quite right&rdquo; absorbed {share(counts.not_quite)} of rulings — check the
            remarks below for a fourth verdict trying to get out.
          </>
        ) : (
          <>The third verdict went unused.</>
        )}
      </Question>

      <Question
        n={3}
        title="The receipt — is it opened, and does opening change a verdict? (worth more than the other four combined)"
      >
        Opened on <strong>{revealedRulings.length}</strong> of {rulings.length} rulings (
        {share(revealedRulings.length)}).
        <br />
        Opened: {mix(revealedRulings)}
        <br />
        Not opened: {mix(rulings.filter((r) => !r.receiptRevealed))}
        <br />
        <span className="text-muted-foreground">
          This is the sole driver of the schema change (FragmentDerivation.excerpt). Note also that{' '}
          {fixture.withReceipt - fixture.withEvidenceReceipt} of {fixture.withReceipt} receipts only
          restate the fragment&rsquo;s own claim rather than quoting evidence.
        </span>
      </Question>

      <Question n={4} title="Remarks — do they appear, and are they corrections or reactions?">
        {remarks.length} remark{remarks.length === 1 ? '' : 's'} on {rulings.length} rulings (
        {share(remarks.length)}).
        {remarks.length > 0 && (
          <ul className="mt-2 space-y-2">
            {remarks.map((r) => (
              <li key={r.id} className="border-l-2 pl-3 text-sm">
                <span className="text-muted-foreground">
                  {VERDICT_LABEL[r.verdict]} · {r.statement}
                </span>
                <br />
                <span className="italic">&ldquo;{r.remark}&rdquo;</span>
              </li>
            ))}
          </ul>
        )}
      </Question>

      <LayoutComparison rulings={rulings} />

      <Question n={5} title="Grouping — does walking by dimension feel coherent?">
        Walked {groupsTouched.size} dimensions in fixture order:{' '}
        {Array.from(groupsTouched).join(' → ') || '—'}.
      </Question>

      <div className="space-y-2 rounded-lg border p-6">
        <label className="text-sm font-medium">What the numbers cannot say</label>
        <p className="text-xs text-muted-foreground">
          Whether opening a receipt actually changed your mind, whether a fourth verdict was wanted,
          whether the grouping helped — write it here; it goes into Phase 2.
        </p>
        <Textarea rows={5} value={debrief} onChange={(e) => onDebrief(e.target.value)} />
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify({ fixture: fixture.generatedFrom, rulings, debrief }, null, 2)],
              { type: 'application/json' }
            )
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'ground-truth-prototype-run.json'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export the run
        </Button>
        <button onClick={onReset} className="text-sm text-muted-foreground underline underline-offset-4">
          Start over
        </button>
      </div>
    </div>
  )
}

/** Prototype-only: the cost of each layout, side by side. */
function LayoutComparison({ rulings }: { rulings: Ruling[] }) {
  const rows = (['list', 'card'] as Layout[]).map((layout) => {
    const mine = rulings.filter((r) => r.layout === layout)
    const secs = mine.map((r) => r.seconds).sort((a, b) => a - b)
    return {
      layout,
      count: mine.length,
      median: secs.length ? secs[Math.floor(secs.length / 2)] : 0,
      revealed: mine.filter((r) => r.receiptRevealed).length,
      remarks: mine.filter((r) => r.remark).length,
    }
  })

  return (
    <div className="rounded-lg border p-6">
      <h3 className="text-sm font-semibold">
        <span className="mr-2 font-mono text-muted-foreground">A/B</span>
        Layout — what did ten-at-a-time actually cost or save?
      </h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="pb-1 font-normal">Layout</th>
            <th className="pb-1 font-normal">Ruled</th>
            <th className="pb-1 font-normal">Median</th>
            <th className="pb-1 font-normal">Receipts</th>
            <th className="pb-1 font-normal">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.layout} className="border-t">
              <td className="py-1.5">{r.layout === 'list' ? 'Ten at a time' : 'One at a time'}</td>
              <td className="py-1.5">{r.count || '—'}</td>
              <td className="py-1.5">{r.count ? `${r.median}s` : '—'}</td>
              <td className="py-1.5">{r.count ? r.revealed : '—'}</td>
              <td className="py-1.5">{r.count ? r.remarks : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Speed is the obvious axis. The one that matters is whether the compact layout drops the
        receipt and remark rates — the two signals the whole design is buying.
      </p>
    </div>
  )
}

function Question({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-6">
      <h3 className="text-sm font-semibold">
        <span className="mr-2 font-mono text-muted-foreground">Q{n}</span>
        {title}
      </h3>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </div>
  )
}
