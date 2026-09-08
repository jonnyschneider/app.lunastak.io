'use client'

/**
 * The re-run pruning surface.
 *
 * WHY THIS CHANGED (2026-09-08). This sheet used to host `FragmentExplorer` — a browse-and-archive
 * view of every fragment. Two surfaces were doing practically the same job, and the pruning UI does
 * it better, so the sheet now hosts that instead.
 *
 * The defect it fixes is bigger than the duplication. The review had exactly ONE home, the
 * Launchpad, which only renders when no strategy exists (`project/[id]/page.tsx`). So the gate
 * fired once, before the first strategy, and never again: every later document, conversation or
 * import went into the knowledgebase unreviewed and fed generation unseen. Measured on preview
 * (`UAT-PR31`, 2026-09-08): 52 active fragments, 34 reviewed, **18 never presented**.
 *
 * Reaching the same surface from here makes pruning something a user can do whenever they like,
 * which is what the Launchpad copy already promised.
 *
 * INTERIM, deliberately. The full replacement — one component with an explicit active/archived
 * split, carrying over the explorer's dimension, source and search filters — is `15-31`, at
 * interaction-design refactor time. This ships the reachability fix without waiting for it.
 * Recovery could NOT wait: this sheet was the only surface reading `?status=archived`, so
 * `GroundTruthReview` grew a "N discarded" footer in the same change.
 *
 * `FragmentExplorer` is NOT dead — the demo knowledgebase still renders it, correctly: demo bundles
 * carry no evidence spans, so the pruning UI would flag every row for a reason that is about the
 * fixture rather than the content.
 */
import { useCallback, useState } from 'react'
import { Sheet, SheetContent, SheetTitle, SheetHeader, SheetDescription, SheetClose } from '@/components/ui/sheet'
import { GroundTruthReview } from '@/components/ground-truth/GroundTruthReview'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface EvidenceSheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set when the user arrived by clicking one dimension in the coverage grid. */
  initialDimensionFilter?: string
  onResumeConversation?: (conversationId: string) => void
}

export function EvidenceSheet({
  projectId,
  open,
  onOpenChange,
  initialDimensionFilter,
  onResumeConversation,
}: EvidenceSheetProps) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const onCountChange = useCallback((r: number, t: number) => { setRemaining(r); setTotal(t) }, [])
  const discarded = remaining !== null && total !== null ? total - remaining : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto bg-background p-0 sm:max-w-3xl">
        <SheetHeader className="sticky top-0 z-20 flex-row items-center justify-between space-y-0 border-b bg-card px-6 py-4">
          <SheetTitle>Your ground truths</SheetTitle>
          <SheetDescription className="sr-only">
            Everything extracted from your conversations, documents and context bundles. Discard
            anything wrong, or restore something discarded earlier.
          </SheetDescription>
          <SheetClose className="rounded-sm p-1 opacity-70 transition-opacity hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </SheetHeader>
        <div className="space-y-4 px-6 py-4">
          {/*
            No Build action here, unlike the Launchpad host. Reaching this sheet means a strategy
            already exists or the user came looking on purpose; pruning is the whole job, and
            regenerating is a separate decision made from the Decision Stack.
          */}
          <p className="text-sm text-muted-foreground">
            Everything your vision, strategy and objectives get built from. Discard anything
            wrong — it stops being used straight away.
          </p>
          <GroundTruthReview
            projectId={projectId}
            dimension={initialDimensionFilter}
            onResumeConversation={onResumeConversation}
            onCountChange={onCountChange}
          />
        </div>

        {/*
          ⚠ THERE IS NOTHING TO SUBMIT — SO SAY SO.
          Every discard is written on the click that makes it; there is no staged state and no
          save. But a surface with no closing move reads as one that did not take, which is
          exactly how it was reported on preview: "doesn't have a submit mechanism, and X doesn't
          persist it" — on a build where the write had in fact persisted every time.
          So the footer does the two jobs a submit button was standing in for: it states that the
          work is saved, and it gives the user a way to be finished. It does NOT pretend to
          commit anything.
        */}
        <div className="sticky bottom-0 z-20 mt-auto flex items-center justify-between gap-4 border-t bg-card px-6 py-3">
          <p className="text-xs text-muted-foreground">
            {discarded > 0
              ? `${discarded} discarded · saved`
              : 'Changes save as you make them'}
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
