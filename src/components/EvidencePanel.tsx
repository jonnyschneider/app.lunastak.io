'use client'

import { logAndFlush } from '@/components/StatsigProvider'

interface EvidencePanelProps {
  projectId: string
  fragmentCount: number
  onOpen: () => void
  /** Hide actions in demo mode */
  readOnly?: boolean
}

export function EvidencePanel({ projectId, fragmentCount, onOpen, readOnly = false }: EvidencePanelProps) {
  const handleOpen = () => {
    logAndFlush('cta_open_evidence', 'evidence-panel', { projectId, fragmentCount: String(fragmentCount) })
    onOpen()
  }

  const clickable = !readOnly && fragmentCount > 0
  return (
    <button
      type="button"
      onClick={clickable ? handleOpen : undefined}
      disabled={!clickable}
      className="w-full text-left rounded-lg border border-border bg-background text-card-foreground overflow-hidden hover:bg-muted/50 transition-colors disabled:cursor-default disabled:hover:bg-background"
    >
      <div className="px-4 py-3 flex flex-col gap-2">
        {/*
          The card names the ACTION now, not the artefact. It used to say "Review Evidence" and open
          a browse view; it opens the pruning surface, and the whole point of the change is that a
          user can prune whenever they like rather than once, before their first strategy.
        */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium text-sm">Check your ground truths</span>
        </div>
        {/* Row 2: meta */}
        {fragmentCount > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{fragmentCount} fragment{fragmentCount !== 1 ? 's' : ''}</span>
            <span>&middot;</span>
            <span>discard anything wrong</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            No fragments yet. As Luna analyses your context, the receipts will appear here.
          </div>
        )}
      </div>
    </button>
  )
}
