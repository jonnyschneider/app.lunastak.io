'use client'

/**
 * The ground truth review — what a user sees before their first strategy is generated.
 *
 * ONE JOB: show what was taken from their own words, and let them discard anything wrong. Not a
 * grading exercise. §22 removed editing (it only ever wrote `Fragment.title`, which nothing reads)
 * and 2026-09-08 removed the confident/doubtful split, because the evidence layer left it with
 * almost no population — a post-change project flags roughly one row in twenty-six. The pipeline
 * does the heavy lifting; pruning is the user's whole job.
 *
 * THE LIST ONLY. The project page owns the heading, the Build action and the skip. Design:
 * `docs/_plans/2026-09-06-ground-truth-gate-interaction-design.md` §4–§7.
 */
import { useCallback, useEffect, useState } from 'react'
import { X, Check, ChevronDown, FileText, MessageSquare, Package, PencilLine, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildGateModel, groupByDimension, type ApiResponse, type GateItem } from './derive'

const SOURCE_ICON = {
  document: FileText,
  conversation: MessageSquare,
  bundle: Package,
  manual: PencilLine,
} as const

export function GroundTruthReview({
  projectId,
  onCountChange,
}: {
  projectId: string
  /** Remaining (not discarded), so the page can label its Build action. */
  onCountChange?: (remaining: number, total: number) => void
}) {
  const [items, setItems] = useState<GateItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [discarded, setDiscarded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/project/${projectId}/fragments?status=active`)
      .then(async r => {
        if (!r.ok) throw new Error('Could not load your ground truths')
        return r.json() as Promise<ApiResponse>
      })
      .then(res => {
        if (!live) return
        const model = buildGateModel(res)
        const all = [...model.weak, ...model.confident]
        setItems(all)
        // Reviewing is being SHOWN something, not clicking it. Everything rendered is stamped.
        if (all.length > 0) {
          fetch(`/api/project/${projectId}/fragments`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: all.map(i => i.id), reviewed: true }),
          }).catch(() => { /* best-effort: a missing timestamp must not block the review */ })
        }
      })
      .catch(e => { if (live) setError(String(e.message ?? e)) })
    return () => { live = false }
  }, [projectId])

  useEffect(() => {
    if (items) onCountChange?.(items.length - discarded.size, items.length)
  }, [items, discarded, onCountChange])

  /**
   * Persisted IMMEDIATELY, one fragment at a time — never staged awaiting a submit.
   *
   * This is the one structural rule that survived the retired preflight (§4): a user who rules on
   * six and closes the tab keeps all six. A failed PATCH leaves the row un-discarded rather than
   * optimistically struck, so the screen never claims something the database did not do.
   */
  const toggle = useCallback(async (item: GateItem) => {
    const nowDiscarded = !discarded.has(item.id)
    setPending(p => new Set(p).add(item.id))
    try {
      const r = await fetch(`/api/project/${projectId}/fragments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status: nowDiscarded ? 'archived' : 'active',
          ...(nowDiscarded ? { archivedReason: 'ground_truth_review' } : {}),
        }),
      })
      if (!r.ok) throw new Error('patch failed')
      setDiscarded(d => {
        const next = new Set(d)
        if (nowDiscarded) next.add(item.id); else next.delete(item.id)
        return next
      })
    } catch {
      setError('That didn’t save — try again.')
    } finally {
      setPending(p => { const n = new Set(p); n.delete(item.id); return n })
    }
  }, [discarded, projectId])

  if (error && !items) return <p className="py-6 text-sm text-destructive">{error}</p>
  if (!items) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-foreground/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Reading what I took from you…
      </p>
    )
  }
  if (items.length === 0) {
    return <p className="py-6 text-sm text-foreground/60">Nothing to review yet.</p>
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {groupByDimension(items).map(g => (
        <div key={g.dimension ?? 'none'}>
          <h3 className="border-b pb-1.5 text-xs font-medium uppercase tracking-wide text-foreground/60">
            {g.label}
          </h3>
          <div className="divide-y divide-border">
            {g.items.map(item => (
              <Row
                key={item.id}
                item={item}
                discarded={discarded.has(item.id)}
                pending={pending.has(item.id)}
                open={expanded === item.id}
                onToggleDiscard={() => toggle(item)}
                onToggleOpen={() => setExpanded(expanded === item.id ? null : item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Row({
  item, discarded, pending, open, onToggleDiscard, onToggleOpen,
}: {
  item: GateItem
  discarded: boolean
  pending: boolean
  open: boolean
  onToggleDiscard: () => void
  onToggleOpen: () => void
}) {
  const SourceIcon = SOURCE_ICON[item.sourceKind]
  return (
    <div className={cn('-mx-2 rounded px-2 transition-colors',
      /* Discarded must be scannable, not inferred from a faded glyph. */
      discarded ? 'bg-muted/70' : 'hover:bg-muted/40')}>
      <div className="flex items-start gap-2 py-2.5">
        <button
          onClick={onToggleDiscard}
          disabled={pending}
          title={discarded ? 'Put it back' : 'Discard'}
          aria-label={discarded ? 'Put it back' : 'Discard'}
          aria-pressed={discarded}
          className={cn(
            'mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-40',
            discarded
              ? 'border-foreground/15 bg-foreground/[0.07] text-foreground/60'
              : 'border-foreground/25 text-foreground/55 hover:border-foreground/50 hover:text-foreground')}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" />
            : discarded ? <Check className="h-[18px] w-[18px]" strokeWidth={2.25} />
            : <X className="h-[18px] w-[18px]" strokeWidth={2.25} />}
        </button>

        <div className="min-w-0 flex-1">
          <button
            onClick={onToggleOpen}
            className={cn('flex w-full items-center justify-between gap-3 text-left text-sm leading-snug transition-opacity',
              discarded ? 'opacity-45' : 'text-foreground',
              open && 'font-medium')}
          >
            <span className="min-w-0">{item.claim}</span>
            {/* One axis: down to open, up to close. */}
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-foreground/45 transition-transform', open && 'rotate-180')} />
          </button>

          {item.reason && <p className="mt-0.5 text-xs text-foreground/60">{item.reason}</p>}

          {open && (
            <div className="mt-2">
              {item.evidence && (
                /* ONE quotation device: the rule. A span that did not verify carries a
                   destructive rule rather than the luna one — rendering it as "your words" would
                   be false attribution, which this thread has on record as worse than an honest
                   summary. */
                <p className={cn('border-l-2 pl-3 text-sm italic',
                  item.verification === 'failed' ? 'border-destructive/40 text-foreground/60' : 'border-luna')}>
                  {item.evidence}
                </p>
              )}
              <p className="mt-1.5 flex items-center gap-1.5 pl-3 text-xs text-foreground/45">
                <SourceIcon className="h-3.5 w-3.5" />
                {item.sourceName}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
