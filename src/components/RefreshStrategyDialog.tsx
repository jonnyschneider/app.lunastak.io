'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
}

export function RefreshStrategyDialog({
  projectId,
  open,
  onOpenChange,
  onStarted,
}: RefreshStrategyDialogProps) {
  const [error, setError] = useState<string | undefined>()
  const [preparing, setPreparing] = useState(false)
  const refreshRunningRef = useRef(false)
  const { startTask } = useGenerationStatusContext()

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setError(undefined)
      setPreparing(false)
      refreshRunningRef.current = false
    }
  }, [open])

  // Start refresh when dialog opens
  useEffect(() => {
    if (!open) return
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
          // Hand off to BackgroundTaskProvider for polling
          startTask('refresh', data.generationId, projectId)

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
  }, [open, projectId, startTask, onOpenChange, onStarted])

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // Only allow closing if we have an error or are not preparing
        if (!newOpen && preparing && !error) return
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Refreshing Strategy
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <div
            className={`rounded-lg p-6 ${
              error ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'
            }`}
          >
            {/* Preparing state */}
            {preparing && !error && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="font-medium text-center text-foreground">
                  Preparing refresh...
                </p>
                <p className="text-sm text-center text-muted-foreground">
                  Updating syntheses with your latest insights
                </p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <>
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
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="font-medium text-center text-red-700 dark:text-red-300">
                  Something went wrong
                </p>
                <p className="text-sm mt-2 text-center text-red-600 dark:text-red-400">
                  {error}
                </p>
              </>
            )}
          </div>

          {/* Close button on error */}
          {error && (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
