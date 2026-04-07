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
        {/* Row 1: title */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium text-sm">Review Evidence</span>
        </div>
        {/* Row 2: meta */}
        {fragmentCount > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{fragmentCount} fragment{fragmentCount !== 1 ? 's' : ''}</span>
            <span>&middot;</span>
            <span>extracted from your conversations and documents</span>
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
