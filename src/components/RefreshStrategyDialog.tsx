'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useGenerationStatusContext } from '@/components/providers/BackgroundTaskProvider'
import { toast } from 'sonner'

interface RefreshStrategyDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onStarted: () => void
  fragmentsSinceStrategy?: number
}

export function RefreshStrategyDialog({
  projectId,
  open,
  onOpenChange,
  onStarted,
  fragmentsSinceStrategy = 0,
}: RefreshStrategyDialogProps) {
  const [error, setError] = useState<string | undefined>()
  const [preparing, setPreparing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const refreshRunningRef = useRef(false)
  const { startTask } = useGenerationStatusContext()

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setError(undefined)
      setPreparing(false)
      setConfirmed(false)
      refreshRunningRef.current = false
    }
  }, [open])

  // Auto-confirm if there are new fragments (no need to ask)
  useEffect(() => {
    if (open && fragmentsSinceStrategy > 0) {
      setConfirmed(true)
    }
  }, [open, fragmentsSinceStrategy])

  // Start refresh when confirmed
  useEffect(() => {
    if (!open || !confirmed) return
    if (refreshRunningRef.current) return
    refreshRunningRef.current = true

    const runRefresh = async () => {
      setPreparing(true)

      try {
        const response = await fetch(`/api/project/${projectId}/refresh-strategy`, {
          method: 'POST',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Refresh failed: ${response.status}`)
        }

        const data = await response.json()

        if (data.status === 'started' && data.generationId) {
          startTask('generation', data.generationId, projectId, {
            running: 'Refreshing strategy...',
            complete: 'Strategy updated',
            failed: 'Strategy refresh failed',
            completeDescription: 'Click to view your updated strategy.',
            completeAction: (data) => data.traceId
              ? { label: 'View', href: `/strategy/${data.traceId}` }
              : undefined,
          })

          toast.info('Refreshing strategy in the background', {
            description: 'You\'ll be notified when it\'s ready.',
            duration: 4000,
          })

          onOpenChange(false)
          onStarted()
        } else {
          throw new Error('Unexpected response from refresh endpoint')
        }
      } catch (err) {
        console.error('Refresh error:', err)
        setPreparing(false)
        setError(err instanceof Error ? err.message : 'Refresh failed')
      }
    }

    runRefresh()
  }, [open, confirmed, projectId, startTask, onOpenChange, onStarted])

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen && preparing && !error) return
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {!confirmed ? 'Update Direction' : 'Refreshing Strategy'}
          </DialogTitle>
          {!confirmed && (
            <DialogDescription>
              Your current strategy will be snapshotted before updating — nothing is lost.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {/* Confirmation step — shown when no new fragments */}
          {!confirmed && !preparing && !error && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No new insights have been added since the last update. Luna will re-analyse your existing knowledge and may produce a refined strategy.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setConfirmed(true)}>
                  Update anyway
                </Button>
              </div>
            </div>
          )}

          {/* Preparing state */}
          {confirmed && preparing && !error && (
            <div className="rounded-lg p-6 bg-muted">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="font-medium text-center text-foreground">
                  Preparing refresh...
                </p>
                <p className="text-sm text-center text-muted-foreground">
                  Updating syntheses with your latest insights
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-lg p-6 bg-red-50 dark:bg-red-900/20">
              <div className="mb-4 flex justify-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
                  <svg
                    className="w-6 h-6 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-center text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Refresh failed
              </p>
              <p className="text-center text-sm text-red-600 dark:text-red-300 mb-4">
                {error}
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(undefined)
                    setConfirmed(false)
                    refreshRunningRef.current = false
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
