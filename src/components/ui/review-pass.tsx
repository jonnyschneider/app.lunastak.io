'use client'

import * as React from 'react'
import { Check, X, Minus, ChevronDown, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * A review pass: walk model output one item at a time, take a verdict plus an
 * optional remark, batch the walk so stopping early is a normal outcome.
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
  /**
   * Fires per item, never per batch — a user who rules six and closes the tab
   * keeps all six. Rejecting holds the walk on the current item.
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

const VERDICTS: { verdict: Verdict; label: string; icon: typeof Check; className: string }[] = [
  {
    verdict: 'yes',
    label: 'Yes',
    icon: Check,
    className: 'hover:border-emerald-600/50 hover:bg-emerald-600/10 hover:text-emerald-700',
  },
  {
    verdict: 'no',
    label: 'No',
    icon: X,
    className: 'hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive',
  },
  {
    verdict: 'not_quite',
    label: 'Not quite right',
    icon: Minus,
    className: 'hover:border-amber-600/50 hover:bg-amber-600/10 hover:text-amber-700',
  },
]

export function ReviewPass({
  items,
  batchSize = 10,
  onRule,
  onBatchEnd,
  onReveal,
  copy,
  className,
}: ReviewPassProps) {
  const [index, setIndex] = React.useState(0)
  const [remark, setRemark] = React.useState('')
  const [remarkOpen, setRemarkOpen] = React.useState(false)
  const [receiptOpen, setReceiptOpen] = React.useState(false)
  const revealed = React.useRef(new Set<string>())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  /** Set when a batch boundary is reached; cleared when the host resumes. */
  const [paused, setPaused] = React.useState<ReviewProgress | null>(null)

  // A pass walks a FIXED list. Hosts naturally re-derive `items` from what has
  // been ruled, which would shrink the list under an advancing index and skip
  // items silently — so the list is snapshotted once, on mount.
  const walk = React.useRef(items)
  const item = walk.current[index]
  const total = walk.current.length

  async function rule(verdict: Verdict) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onRule(item.id, verdict, remark.trim() || undefined)
    } catch {
      // Hold on this item — advancing would silently lose the ruling.
      setError('That ruling did not save. Try again.')
      setSaving(false)
      return
    }
    setSaving(false)

    const reviewed = index + 1
    const progress: ReviewProgress = {
      reviewed,
      total,
      remaining: total - reviewed,
      complete: reviewed === total,
    }

    setRemark('')
    setRemarkOpen(false)
    setReceiptOpen(false)
    setIndex(reviewed)

    if (progress.complete || reviewed % batchSize === 0) {
      setPaused(progress)
      onBatchEnd(progress)
    }
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
            <Button variant="outline" onClick={() => setPaused(null)}>
              Keep going
            </Button>
          </>
        )}
      </div>
    )
  }

  if (!item) return null

  return (
    // Fixed height with the verdicts pinned to the bottom: the click target
    // holds still whether or not the receipt is open, and whether the statement
    // runs to one line or three.
    <div className={cn('flex min-h-[17rem] flex-col gap-6', className)}>
      <div className="flex items-baseline gap-2 border-b pb-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {item.group && <span>{item.group}</span>}
        <span className="ml-auto">
          {index + 1} of {total}
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{copy.itemPrompt}</p>
        <p className="text-lg font-medium leading-snug">{item.statement}</p>

        {item.receipt && (
          <div>
            <button
              type="button"
              onClick={() => {
                setReceiptOpen((open) => !open)
                if (!revealed.current.has(item.id)) {
                  revealed.current.add(item.id)
                  onReveal?.(item.id)
                }
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              because you said
              <ChevronDown className={cn('size-3 transition-transform', receiptOpen && 'rotate-180')} />
            </button>
            {receiptOpen && (
              <blockquote className="mt-2 max-h-16 overflow-y-auto border-l-2 pl-3 text-sm italic text-muted-foreground">
                {item.receipt}
              </blockquote>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex flex-wrap gap-2">
          {VERDICTS.map(({ verdict, label, icon: Icon, className: tone }) => (
            <Button
              key={verdict}
              variant="outline"
              disabled={saving}
              onClick={() => rule(verdict)}
              className={tone}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Icon />}
              {label}
            </Button>
          ))}
        </div>

        {!remarkOpen ? (
          <button
            type="button"
            onClick={() => setRemarkOpen(true)}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {copy.remarkPrompt}
          </button>
        ) : (
          <Textarea
            autoFocus
            rows={3}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={copy.remarkPrompt}
            className="text-sm"
          />
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
