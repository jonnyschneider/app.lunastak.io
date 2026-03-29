'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Download, Loader2 } from 'lucide-react'

interface VersionEntry {
  id: string
  version: number
  status: string
  createdAt: string
  changeSummary: string | null
}

interface VersionHistorySheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onExportBrief?: (outputId: string, version: number) => void
}

export function VersionHistorySheet({
  projectId,
  open,
  onOpenChange,
  onExportBrief,
}: VersionHistorySheetProps) {
  const router = useRouter()
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    fetch(`/api/project/${projectId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.strategyOutputs) {
          setVersions(data.strategyOutputs)
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
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No strategy versions yet.
            </p>
          ) : (
            versions.map((version, i) => (
              <div
                key={version.id}
                className="flex items-start gap-3 py-3 border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      v{version.version || versions.length - i}
                    </span>
                    <Badge
                      variant={version.status === 'complete' ? 'secondary' : 'outline'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {version.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(version.createdAt)}
                  </p>
                  {version.changeSummary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {version.changeSummary}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      router.push(`/strategy/${version.id}`)
                      onOpenChange(false)
                    }}
                    title="View"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  {onExportBrief && version.status === 'complete' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => onExportBrief(version.id, version.version || versions.length - i)}
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
