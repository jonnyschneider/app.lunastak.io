'use client'

import { FileText, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  return (
    <div className="rounded-lg border bg-card text-card-foreground p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Evidence</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {fragmentCount === 0
          ? 'No fragments yet. As Luna analyses your context, the receipts will appear here.'
          : `${fragmentCount} fragment${fragmentCount === 1 ? '' : 's'} extracted from your conversations and documents.`}
      </p>
      <div className="mt-auto">
        {!readOnly && fragmentCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleOpen}>
            Open Evidence
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
