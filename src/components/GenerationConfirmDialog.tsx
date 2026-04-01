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
import { Loader2 } from 'lucide-react'

export type GenerationAction = 'refresh' | 'opportunities'

interface GenerationConfig {
  title: string
  description: string
  confirmLabel: string
  confirmLabelNoChanges: string
  messageWithChanges: (count: number) => string
  messageNoChanges: string
  preparingLabel: string
}

const GENERATION_CONFIGS: Record<GenerationAction, GenerationConfig> = {
  refresh: {
    title: 'Refresh Decision Stack',
    description: 'Your current strategy is saved as a snapshot before updating — nothing is lost.',
    confirmLabel: 'Refresh Decision Stack',
    confirmLabelNoChanges: 'Refresh anyway',
    messageWithChanges: (n) =>
      `${n} new insight${n !== 1 ? 's' : ''} added since the last update. Luna will incorporate these into a refreshed strategy.`,
    messageNoChanges:
      'No new insights have been added since the last update. Luna will re-analyse your existing knowledge and may produce a refined strategy.',
    preparingLabel: 'Updating syntheses with your latest insights',
  },
  opportunities: {
    title: 'Generate Opportunities',
    description: 'Luna will create strategic initiatives linked to your objectives.',
    confirmLabel: 'Generate Opportunities',
    confirmLabelNoChanges: 'Generate anyway',
    messageWithChanges: (n) =>
      `${n} new insight${n !== 1 ? 's' : ''} added since the last update. Luna will use your latest knowledge to draft fresh opportunities.`,
    messageNoChanges:
      'No new insights have been added since the last update. Luna will draft opportunities based on your current knowledge.',
    preparingLabel: 'Analysing your strategy and knowledge base',
  },
}

interface GenerationConfirmDialogProps {
  action: GenerationAction
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  fragmentsSinceStrategy?: number
}

export function GenerationConfirmDialog({
  action,
  open,
  onOpenChange,
  onConfirm,
  fragmentsSinceStrategy = 0,
}: GenerationConfirmDialogProps) {
  const [error, setError] = useState<string | undefined>()
  const [preparing, setPreparing] = useState(false)
  const runningRef = useRef(false)
  const config = GENERATION_CONFIGS[action]

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setError(undefined)
      setPreparing(false)
      runningRef.current = false
    }
  }, [open])

  const handleConfirm = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setPreparing(true)

    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      console.error(`[${action}] Error:`, err)
      setPreparing(false)
      runningRef.current = false
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

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
          <DialogTitle>{config.title}</DialogTitle>
          {!preparing && !error && (
            <DialogDescription>{config.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {/* Confirmation step */}
          {!preparing && !error && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {fragmentsSinceStrategy > 0 ? (
                  <><span className="font-medium text-foreground">{config.messageWithChanges(fragmentsSinceStrategy).split(' ').slice(0, 3).join(' ')}</span> {config.messageWithChanges(fragmentsSinceStrategy).split(' ').slice(3).join(' ')}</>
                ) : (
                  <><span className="font-medium text-foreground">No new insights have been added</span> {config.messageNoChanges.replace('No new insights have been added ', '')}</>
                )}
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm}>
                  {fragmentsSinceStrategy > 0 ? config.confirmLabel : config.confirmLabelNoChanges}
                </Button>
              </div>
            </div>
          )}

          {/* Preparing state */}
          {preparing && !error && (
            <div className="rounded-lg p-6 bg-muted">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="font-medium text-center text-foreground">
                  Preparing...
                </p>
                <p className="text-sm text-center text-muted-foreground">
                  {config.preparingLabel}
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-lg p-6 bg-red-50 dark:bg-red-900/20 space-y-3">
              <p className="text-center text-sm font-medium text-red-800 dark:text-red-200">
                {config.title} failed
              </p>
              <p className="text-center text-sm text-red-600 dark:text-red-300">
                {error}
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(undefined)
                    runningRef.current = false
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
