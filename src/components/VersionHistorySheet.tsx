'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')      // italic
    .replace(/_(.+?)_/g, '$1')        // italic underscore
    .replace(/`(.+?)`/g, '$1')        // inline code
}

interface VersionEntry {
  id: string
  version: number
  status: string  // trigger: post_generation, post_refresh, etc.
  createdAt: string
  changeSummary: string | null
}

interface VersionHistorySheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onExportBrief?: (snapshotId: string, version: number) => void
}

const TRIGGER_LABELS: Record<string, string> = {
  post_generation: 'Generated',
  post_refresh: 'Refreshed',
  post_opportunities: 'Opportunities added',
  pre_generation: 'Before generation',
  pre_refresh: 'Before refresh',
  pre_opportunities: 'Before opportunities',
}

export function VersionHistorySheet({
  projectId,
  open,
  onOpenChange,
  onExportBrief,
}: VersionHistorySheetProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    fetch(`/api/project/${projectId}/strategy-version`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.versions) {
          setVersions(data.versions)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [open, projectId])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Only show post-snapshots (the "after" states) for cleaner history
  const postVersions = versions.filter(v => v.status.startsWith('post_'))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : postVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No strategy versions yet.
            </p>
          ) : (
            postVersions.map((version) => (
              <div
                key={version.id}
                className="flex items-start gap-3 py-3 border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      v{version.version}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {TRIGGER_LABELS[version.status] || version.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(version.createdAt)}
                  </p>
                  {version.changeSummary && (
                    <div className="mt-1">
                      <p className={`text-xs text-muted-foreground ${expandedId === version.id ? '' : 'line-clamp-2'}`}>
                        {stripMarkdown(version.changeSummary)}
                      </p>
                      {version.changeSummary.length > 120 && (
                        <button
                          onClick={() => setExpandedId(expandedId === version.id ? null : version.id)}
                          className="text-[10px] text-primary hover:text-primary/80 mt-0.5 flex items-center gap-0.5"
                        >
                          {expandedId === version.id ? (
                            <><ChevronUp className="h-3 w-3" /> less</>
                          ) : (
                            <><ChevronDown className="h-3 w-3" /> more</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onExportBrief && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => onExportBrief(version.id, version.version)}
                      title="Export Brief"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
