'use client'

import * as React from 'react'
import { Check, X, Minus, ChevronDown, Loader2, Quote, PenLine } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * A review pass: walk model output, take a verdict plus an optional remark,
 * batch the walk so stopping early is a normal outcome.
 *
 * Two layouts over the same semantics:
 *   'card' — one item at a time, full attention per item.
 *   'list' — the whole batch as a matrix, ruled in any order, minimised.
 * Both rule per item, never per batch.
 *
 * Knows nothing about what it is reviewing. The ground truth preflight is the
 * first caller; opportunity headings and an interactive Decision Stack are the
 * intended next ones.
 */

export type Verdict = 'yes' | 'no' | 'not_quite'

export interface ReviewItem {
  id: string
  /** The interpretation being ruled on — one sentence. */
  statement: string
  /** "because you said…" — the source excerpt. Collapsed, and optional. */
  receipt?: string | null
  /** Dimension label, used to batch the walk into one frame of mind. */
  group?: string
}

export interface ReviewProgress {
  reviewed: number
  total: number
  remaining: number
  complete: boolean
}

export interface ReviewPassCopy {
  intro: string
  itemPrompt: string
  remarkPrompt: string
}

export interface ReviewPassProps {
  items: ReviewItem[]
  batchSize?: number
  layout?: 'card' | 'list'
  /**
   * Fires per item, never per batch — a user who rules six and closes the tab
   * keeps all six. Rejecting holds the ruling back.
   */
  onRule: (id: string, verdict: Verdict, remark?: string) => Promise<void>
  /** The host decides what to offer at a boundary; this only reports. */
  onBatchEnd: (progress: ReviewProgress) => void
  /**
   * Fires the first time an item's receipt is opened. Whether receipts get
   * opened at all is the question that decides if provenance is worth storing.
   */
  onReveal?: (id: string) => void
  copy: ReviewPassCopy
  className?: string
}

const VERDICTS: { verdict: Verdict; label: string; icon: typeof Check; tone: string; on: string }[] = [
  {
    verdict: 'yes',
    label: 'Yes',
    icon: Check,
    tone: 'hover:border-emerald-600/50 hover:bg-emerald-600/10 hover:text-emerald-700',
    on: 'border-emerald-600/60 bg-emerald-600/15 text-emerald-700',
  },
  {
    verdict: 'no',
    label: 'No',
    icon: X,
    tone: 'hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive',
    on: 'border-destructive/60 bg-destructive/15 text-destructive',
  },
  {
    verdict: 'not_quite',
    label: 'Not quite right',
    icon: Minus,
    tone: 'hover:border-amber-600/50 hover:bg-amber-600/10 hover:text-amber-700',
    on: 'border-amber-600/60 bg-amber-600/15 text-amber-700',
  },
]

export function ReviewPass({
  items,
  batchSize = 10,
  layout = 'card',
  onRule,
  onBatchEnd,
  onReveal,
  copy,
  className,
}: ReviewPassProps) {
  // A pass walks a FIXED list. Hosts naturally re-derive `items` from what has
  // been ruled, which would shrink the list under an advancing cursor and skip
  // items silently — so the list is snapshotted once, on mount.
  const walk = React.useRef(items)
  const total = walk.current.length

  /** How far into the walk this pass has got — the batch cursor. */
  const [cursor, setCursor] = React.useState(0)
  const [ruled, setRuled] = React.useState<Map<string, Verdict>>(new Map())
  const [remarks, setRemarks] = React.useState<Map<string, string>>(new Map())
  const [openRemark, setOpenRemark] = React.useState<string | null>(null)
  const [openReceipt, setOpenReceipt] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  /** Set when a batch boundary is reached; cleared when the host resumes. */
  const [paused, setPaused] = React.useState<ReviewProgress | null>(null)

  const revealed = React.useRef(new Set<string>())

  const batch = walk.current.slice(cursor, cursor + batchSize)

  function reveal(id: string) {
    setOpenReceipt((open) => (open === id ? null : id))
    if (!revealed.current.has(id)) {
      revealed.current.add(id)
      onReveal?.(id)
    }
  }

  function progressAt(reviewed: number): ReviewProgress {
    return {
      reviewed,
      total,
      remaining: total - reviewed,
      complete: reviewed === total,
    }
  }

  /** Record a ruling. Returns false if it could not be saved. */
  async function rule(id: string, verdict: Verdict): Promise<boolean> {
    if (saving) return false
    setSaving(id)
    setError(null)
    try {
      await onRule(id, verdict, remarks.get(id)?.trim() || undefined)
    } catch {
      // Hold the ruling back — recording it locally would claim a save that
      // did not happen, and a lost pass is this feature's worst failure.
      setError('That ruling did not save. Try again.')
      setSaving(null)
      return false
    }
    setSaving(null)
    setRuled((prev) => new Map(prev).set(id, verdict))
    return true
  }

  function finishBatch(reviewed: number) {
    const progress = progressAt(reviewed)
    setPaused(progress)
    onBatchEnd(progress)
  }

  if (total === 0) return null

  if (paused) {
    return (
      <div className={cn('space-y-4 text-sm', className)} role="status">
        {paused.complete ? (
          <p className="text-muted-foreground">
            All {paused.total} reviewed. Nothing left to rule.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">
              {paused.reviewed} done, {paused.remaining} to go.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setCursor(cursor + batchSize)
                setPaused(null)
              }}
            >
              Keep going
            </Button>
          </>
        )}
      </div>
    )
  }

  return layout === 'list' ? (
    <ListLayout
      batch={batch}
      total={total}
      cursor={cursor}
      ruled={ruled}
      remarks={remarks}
      setRemarks={setRemarks}
      openRemark={openRemark}
      setOpenRemark={setOpenRemark}
      openReceipt={openReceipt}
      reveal={reveal}
      saving={saving}
      error={error}
      copy={copy}
      className={className}
      onRule={async (id, verdict) => {
        const saved = await rule(id, verdict)
        if (!saved) return
        const done = new Set(ruled.keys()).add(id)
        const inBatch = batch.filter((i) => done.has(i.id)).length
        if (inBatch === batch.length) finishBatch(cursor + inBatch)
      }}
      onFinishEarly={() => {
        const inBatch = batch.filter((i) => ruled.has(i.id)).length
        finishBatch(cursor + inBatch)
      }}
    />
  ) : (
    <CardLayout
      batch={batch}
      total={total}
      cursor={cursor}
      ruled={ruled}
      remarks={remarks}
      setRemarks={setRemarks}
      openRemark={openRemark}
      setOpenRemark={setOpenRemark}
      openReceipt={openReceipt}
      reveal={reveal}
      saving={saving}
      error={error}
      copy={copy}
      className={className}
      onRule={async (id, verdict) => {
        const saved = await rule(id, verdict)
        if (!saved) return
        setOpenRemark(null)
        const reviewed = cursor + batch.findIndex((i) => i.id === id) + 1
        if (reviewed === total || reviewed % batchSize === 0) finishBatch(reviewed)
      }}
    />
  )
}

interface LayoutProps {
  batch: ReviewItem[]
  total: number
  cursor: number
  ruled: Map<string, Verdict>
  remarks: Map<string, string>
  setRemarks: React.Dispatch<React.SetStateAction<Map<string, string>>>
  openRemark: string | null
  setOpenRemark: (id: string | null) => void
  openReceipt: string | null
  reveal: (id: string) => void
  saving: string | null
  error: string | null
  copy: ReviewPassCopy
  className?: string
  onRule: (id: string, verdict: Verdict) => void
}

/** One item at a time. Full attention per item; slow over a large set. */
function CardLayout(props: LayoutProps) {
  const { batch, total, cursor, ruled, openReceipt, reveal, saving, error, copy, className } = props
  const item = batch.find((i) => !ruled.has(i.id))
  if (!item) return null
  const position = cursor + batch.findIndex((i) => i.id === item.id) + 1

  return (
    // Fixed height with the verdicts pinned to the bottom: the click target
    // holds still whether or not the receipt is open, and whether the statement
    // runs to one line or three.
    <div className={cn('flex min-h-[17rem] flex-col gap-6', className)}>
      <div className="flex items-baseline gap-2 border-b pb-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {item.group && <span>{item.group}</span>}
        <span className="ml-auto">
          {position} of {total}
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{copy.itemPrompt}</p>
        <p className="text-lg font-medium leading-snug">{item.statement}</p>

        {item.receipt && (
          <div>
            <button
              type="button"
              onClick={() => reveal(item.id)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              because you said
              <ChevronDown
                className={cn('size-3 transition-transform', openReceipt === item.id && 'rotate-180')}
              />
            </button>
            {openReceipt === item.id && (
              <blockquote className="mt-2 max-h-16 overflow-y-auto border-l-2 pl-3 text-sm italic text-muted-foreground">
                {item.receipt}
              </blockquote>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex flex-wrap gap-2">
          {VERDICTS.map(({ verdict, label, icon: Icon, tone }) => (
            <Button
              key={verdict}
              variant="outline"
              disabled={saving !== null}
              onClick={() => props.onRule(item.id, verdict)}
              className={tone}
            >
              {saving === item.id ? <Loader2 className="animate-spin" /> : <Icon />}
              {label}
            </Button>
          ))}
        </div>
        <RemarkField {...props} id={item.id} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The whole batch as a matrix. Same three choices on every row, ruled in any
 * order, skippable — the cost of a 50-item set is the reason this exists.
 */
function ListLayout(props: LayoutProps & { onFinishEarly: () => void }) {
  const { batch, total, cursor, ruled, openReceipt, reveal, saving, error, copy, className } = props
  const doneHere = batch.filter((i) => ruled.has(i.id)).length

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-baseline gap-2 border-b pb-2 text-sm">
        <span className="text-muted-foreground">{copy.itemPrompt}</span>
        <span className="ml-auto font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {cursor + 1}–{cursor + batch.length} of {total}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-1">
        {/* Labelled once, at the top — not repeated on every row. */}
        <div />
        <div />
        {VERDICTS.map(({ verdict, label }) => (
          <div
            key={verdict}
            className="w-16 pb-2 text-center font-mono text-[10px] uppercase leading-tight tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}

        {batch.map((item, i) => {
          const groupChanged = i === 0 || item.group !== batch[i - 1].group
          const verdict = ruled.get(item.id)
          return (
            <React.Fragment key={item.id}>
              {groupChanged && item.group && (
                <div className="col-span-5 pb-1 pt-5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  {item.group}
                </div>
              )}

              <div className="col-span-5 border-t" />

              <p
                className={cn(
                  'py-2 pr-4 text-sm leading-snug transition-colors',
                  verdict && 'text-muted-foreground'
                )}
              >
                {item.statement}
              </p>

              <div className="flex items-center gap-0.5 py-2 pr-2">
                {item.receipt ? (
                  <button
                    type="button"
                    aria-label="because you said"
                    onClick={() => reveal(item.id)}
                    className={cn(
                      'rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground',
                      openReceipt === item.id && 'bg-muted text-foreground'
                    )}
                  >
                    <Quote className="size-3.5" />
                  </button>
                ) : (
                  <span className="size-3.5 p-1" />
                )}
                <button
                  type="button"
                  aria-label={copy.remarkPrompt}
                  onClick={() => props.setOpenRemark(props.openRemark === item.id ? null : item.id)}
                  className={cn(
                    'rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground',
                    (props.openRemark === item.id || props.remarks.get(item.id)) &&
                      'bg-muted text-foreground'
                  )}
                >
                  <PenLine className="size-3.5" />
                </button>
              </div>

              <div
                role="radiogroup"
                aria-label={item.statement}
                className="col-span-3 grid grid-cols-3 py-2"
              >
                {VERDICTS.map(({ verdict: v, label, icon: Icon, tone, on }) => (
                  <label
                    key={v}
                    className={cn(
                      'mx-auto flex size-8 cursor-pointer items-center justify-center rounded-md border transition-colors',
                      verdict === v ? on : 'border-transparent text-muted-foreground/60',
                      !saving && tone
                    )}
                  >
                    <input
                      type="radio"
                      name={`verdict-${item.id}`}
                      aria-label={label}
                      className="sr-only"
                      checked={verdict === v}
                      disabled={saving !== null}
                      onChange={() => props.onRule(item.id, v)}
                    />
                    {saving === item.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </label>
                ))}
              </div>

              {(openReceipt === item.id || props.openRemark === item.id) && (
                <div className="col-span-5 space-y-2 pb-3">
                  {openReceipt === item.id && item.receipt && (
                    <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">
                      {item.receipt}
                    </blockquote>
                  )}
                  {props.openRemark === item.id && <RemarkField {...props} id={item.id} bare />}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      <div className="flex items-center gap-4 border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          {doneHere} of {batch.length} on this page
        </span>
        {doneHere > 0 && doneHere < batch.length && (
          <Button variant="outline" size="sm" onClick={props.onFinishEarly} className="ml-auto">
            Done with these
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** The remark: demoted to a link, never a field sitting open asking to be filled. */
function RemarkField({
  id,
  copy,
  remarks,
  setRemarks,
  openRemark,
  setOpenRemark,
  bare,
}: LayoutProps & { id: string; bare?: boolean }) {
  const open = bare || openRemark === id
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpenRemark(id)}
        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {copy.remarkPrompt}
      </button>
    )
  }
  return (
    <Textarea
      autoFocus
      rows={3}
      value={remarks.get(id) ?? ''}
      onChange={(e) =>
        setRemarks((prev) => new Map(prev).set(id, e.target.value))
      }
      placeholder={copy.remarkPrompt}
      className="text-sm"
    />
  )
}
