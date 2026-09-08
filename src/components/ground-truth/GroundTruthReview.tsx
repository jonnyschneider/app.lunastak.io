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
import { X, ChevronDown, FileText, MessageSquare, Package, PencilLine, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { buildGateModel, groupByDimension, type ApiResponse, type GateItem } from '@/lib/ground-truth/derive'
import { EvidenceQuote } from './EvidenceQuote'

const SOURCE_ICON = {
  document: FileText,
  conversation: MessageSquare,
  bundle: Package,
  manual: PencilLine,
} as const

export function GroundTruthReview({
  projectId,
  onCountChange,
  dimension,
  onResumeConversation,
}: {
  projectId: string
  /** Remaining (not discarded), total, and how many sit archived — so a host can show volume. */
  onCountChange?: (remaining: number, total: number, archived: number) => void
  /**
   * Show only this dimension. Set when the user arrived by clicking one in the coverage grid —
   * they asked a narrower question than "show me everything" and the surface should answer it.
   */
  dimension?: string
  /**
   * Jump to the conversation a fragment came from. Carried over from `FragmentExplorer`: reading
   * the exchange is often how you decide whether a row is worth keeping, which makes this worth
   * more HERE than it was in a browse view.
   */
  onResumeConversation?: (conversationId: string) => void
}) {
  const [items, setItems] = useState<GateItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  /**
   * WHAT WAS DISCARDED HAS TO BE REACHABLE, or discarding is destructive.
   *
   * `discarded` above is in-session state only: this list fetches `?status=active`, so on the next
   * load a discarded row is simply absent and its "Undo" is gone with the render that offered it.
   * That was survivable while the Evidence sheet existed — it was the one surface reading
   * `?status=archived`. Once the sheet is this component, it has to carry recovery itself.
   */
  const [archivedCount, setArchivedCount] = useState(0)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [archivedItems, setArchivedItems] = useState<GateItem[] | null>(null)
  // Bumped after a restore: the row belongs in the live list again, and re-reading is the only
  // honest way to put it back in its dimension group and its sort position.
  const [reloadKey, setReloadKey] = useState(0)

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
        setArchivedCount(res.archivedCount ?? 0)
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
  }, [projectId, reloadKey])

  useEffect(() => {
    if (items) onCountChange?.(items.length, items.length, archivedCount)
  }, [items, archivedCount, onCountChange])

  /**
   * Persisted IMMEDIATELY, one fragment at a time — never staged awaiting a submit.
   *
   * This is the one structural rule that survived the retired preflight (§4): a user who rules on
   * six and closes the tab keeps all six.
   *
   * ⚠ THE ROW LEAVES THE LIST. It used to stay in place, greyed, offering "Undo" — which showed
   * the state honestly and still read as nothing having happened, because the list was the same
   * length and the row was still in it. Twice on preview that was reported as a missing confirm
   * button (Jonny, 2026-09-08).
   *
   * Removal IS the confirmation. The row goes, the discarded count above it goes up, and that
   * count is the control that brings it back — so the interaction that signals the change is the
   * same one that teaches the undo. A confirm button was considered and rejected: it would be a
   * promise that nothing had happened yet, which is either false or costs the rule above.
   *
   * Optimistic, so the row leaves on the click that discards it. A failed write puts it back where
   * it was and says so.
   */
  const discard = useCallback(async (item: GateItem) => {
    setPending(p => new Set(p).add(item.id))
    setItems(cur => cur?.filter(i => i.id !== item.id) ?? cur)
    setArchivedCount(c => c + 1)
    // Front of the recovery list: the thing you just did is the thing you are most likely to undo.
    setArchivedItems(a => (a === null ? a : [item, ...a]))
    try {
      const r = await fetch(`/api/project/${projectId}/fragments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: 'archived', archivedReason: 'ground_truth_review' }),
      })
      if (!r.ok) throw new Error('patch failed')
      setError(null)
    } catch {
      setItems(cur => (cur ? [...cur, item] : cur))
      setArchivedCount(c => Math.max(0, c - 1))
      setArchivedItems(a => (a === null ? a : a.filter(i => i.id !== item.id)))
      setError('That didn’t save — try again.')
    } finally {
      setPending(p => { const n = new Set(p); n.delete(item.id); return n })
    }
  }, [projectId])

  /** Put a discarded fragment back. Same PATCH as an undo, from a list the undo cannot reach. */
  const restore = useCallback(async (item: GateItem) => {
    setPending(p => new Set(p).add(item.id))
    try {
      const r = await fetch(`/api/project/${projectId}/fragments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: 'active' }),
      })
      if (!r.ok) throw new Error('patch failed')
      setArchivedItems(a => (a ?? []).filter(x => x.id !== item.id))
      setArchivedCount(c => Math.max(0, c - 1))
      // Re-read rather than splice: the row belongs back in its dimension group, in sort order.
      setReloadKey(k => k + 1)
      setError(null)
    } catch {
      setError('That didn’t restore — try again.')
    } finally {
      setPending(p => { const n = new Set(p); n.delete(item.id); return n })
    }
  }, [projectId])

  const openArchived = useCallback(async () => {
    setArchivedOpen(o => !o)
    if (archivedItems) return
    try {
      const res = await fetch(`/api/project/${projectId}/fragments?status=archived`)
        .then(r => r.json() as Promise<ApiResponse>)
      const model = buildGateModel(res)
      setArchivedItems([...model.weak, ...model.confident])
    } catch {
      setError('Couldn’t load what you discarded.')
    }
  }, [projectId, archivedItems])

  if (error && !items) return <p className="py-6 text-sm text-destructive">{error}</p>
  if (!items) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-foreground/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your ground truths…
      </p>
    )
  }
  if (items.length === 0) {
    return <p className="py-6 text-sm text-foreground/60">Nothing to review yet.</p>
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/*
        The recovery path, AT THE TOP. It was a footer for one build, on the reasoning that a list
        of things you already rejected is not what you came for. That was wrong for the reason
        Jonny gave on preview: "users won't find archived all the way down there" — a control
        below fifty rows is a control nobody knows exists, and the volume belongs up front where
        it frames the list rather than trailing it.

        Still closed by default, and still absent entirely when there is nothing to recover.
        The second state of the eventual two-state surface (`15-31`), at the size the interim
        can afford.
      */}
      {archivedCount > 0 && (
        <div className="border-b pb-3">
          <button
            onClick={openArchived}
            className="flex items-center gap-1.5 text-xs text-foreground/50 underline underline-offset-4 hover:text-foreground"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', archivedOpen && 'rotate-180')} />
            {archivedCount} discarded
          </button>

          {archivedOpen && (
            archivedItems === null ? (
              <p className="flex items-center gap-2 py-3 text-sm text-foreground/60">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading what you discarded…
              </p>
            ) : archivedItems.length === 0 ? (
              <p className="py-3 text-sm text-foreground/60">Nothing to show.</p>
            ) : (
              <div className="mt-2 divide-y divide-border">
                {archivedItems.map(item => (
                  <Row
                    key={item.id}
                    item={item}
                    discarded
                    pending={pending.has(item.id)}
                    open={expanded === item.id}
                    onToggleDiscard={() => restore(item)}
                    onToggleOpen={() => setExpanded(expanded === item.id ? null : item.id)}
                    onResumeConversation={onResumeConversation}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* A dimension the grid offers but nothing was filed under must say so, not render blank. */}
      {dimension && !groupByDimension(items).some(g => g.dimension === dimension) && (
        <p className="py-4 text-sm text-foreground/60">Nothing filed under this one yet.</p>
      )}

      {groupByDimension(items)
        .filter(g => !dimension || g.dimension === dimension)
        .map(g => (
        <div key={g.dimension ?? 'none'}>
          {/* Filtered to one dimension, the host has already named it — saying it twice is noise. */}
          {!dimension && (
            <h3 className="border-b pb-1.5 text-xs font-medium uppercase tracking-wide text-foreground/60">
              {g.label}
            </h3>
          )}
          <div className="divide-y divide-border">
            {g.items.map(item => (
              <Row
                key={item.id}
                item={item}
                discarded={false}
                pending={pending.has(item.id)}
                open={expanded === item.id}
                onToggleDiscard={() => discard(item)}
                onToggleOpen={() => setExpanded(expanded === item.id ? null : item.id)}
                onResumeConversation={onResumeConversation}
              />
            ))}
          </div>
        </div>
      ))}

    </div>
  )
}

function Row({
  item, discarded, pending, open, onToggleDiscard, onToggleOpen, onResumeConversation,
}: {
  item: GateItem
  discarded: boolean
  pending: boolean
  open: boolean
  onToggleDiscard: () => void
  onToggleOpen: () => void
  onResumeConversation?: (conversationId: string) => void
}) {
  const SourceIcon = SOURCE_ICON[item.sourceKind]
  return (
    <div className={cn('-mx-2 rounded px-2 transition-colors',
      /* Discarded must be scannable, not inferred from a faded glyph. */
      discarded ? 'bg-muted/70' : 'hover:bg-muted/40')}>
      <div className="flex items-start gap-2 py-2.5">
        {/*
          ⚠ ONE GLYPH, ONE MEANING. This button used to swap ✕ for ✓ once a row was discarded,
          which made the icon show the ACTION while a list invites you to read it as the STATE —
          twenty-six ✕ rows look like an opt-in list where nothing is included yet.

          The fix is the rule the controls already followed everywhere else: the glyph names the
          action and never changes; whether it is engaged is carried by fill and by the row. So a
          live row offers ✕ (discard), and a discarded row offers the reverse as WORDS — "Undo" is
          self-describing where a second icon cannot be.
        */}
        {/*
          `pending` still disables for the length of the write, but shows NOTHING — the row has
          already flipped, so a spinner here would re-introduce the lag the optimistic update just
          removed. Disabling is what stops two in-flight writes for one row racing to a wrong final
          state; at a few hundred milliseconds it is not perceptible, which is the point.
        */}
        {discarded ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleDiscard}
            disabled={pending}
            className="mt-px shrink-0 border-foreground/15 bg-foreground/[0.07] px-2 text-foreground/60 shadow-none hover:bg-foreground/[0.07] hover:text-foreground"
          >
            Undo
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onToggleDiscard}
            disabled={pending}
            title="Discard"
            aria-label="Discard"
            className="mt-px shrink-0 border-foreground/25 bg-transparent text-foreground/55 shadow-none hover:border-foreground/50 hover:bg-transparent hover:text-foreground"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Button>
        )}

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
                <EvidenceQuote text={item.evidence} verification={item.verification} className="text-sm" />
              )}
              <p className="mt-1.5 flex items-center gap-1.5 pl-3 text-xs text-foreground/45">
                <SourceIcon className="h-3.5 w-3.5" />
                {onResumeConversation && item.sourceKind === 'conversation' && item.sourceId ? (
                  <button
                    onClick={() => onResumeConversation(item.sourceId!)}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {item.sourceName}
                  </button>
                ) : (
                  item.sourceName
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
