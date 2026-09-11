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
import { describeStackChanges } from '@/lib/guidance/stack-behind'

export type GenerationAction = 'refresh' | 'opportunities'

interface GenerationConfig {
  title: string
  description: string
  confirmLabel: string
  confirmLabelNoChanges: string
  /** Follows the bold change summary ("4 ground truths added, 1 discarded"). */
  afterChanges: string
  /** Follows the bold "Nothing has changed". */
  afterNoChanges: string
  preparingLabel: string
}

const GENERATION_CONFIGS: Record<GenerationAction, GenerationConfig> = {
  refresh: {
    title: 'Refresh Decision Stack',
    description: 'Your current strategy is saved as a snapshot before updating — nothing is lost.',
    confirmLabel: 'Refresh Decision Stack',
    confirmLabelNoChanges: 'Refresh anyway',
    afterChanges: 'since the last update. Luna will rebuild your strategy from your ground truths as they stand now.',
    afterNoChanges:
      'in your ground truths since the last update. Luna will re-analyse the same knowledge and may produce a different result.',
    preparingLabel: 'Updating syntheses with your latest insights',
  },
  opportunities: {
    title: 'Generate Opportunities',
    description: 'Luna will create strategic initiatives linked to your objectives.',
    confirmLabel: 'Generate Opportunities',
    confirmLabelNoChanges: 'Generate anyway',
    afterChanges: 'since the last update. Luna will use your ground truths as they stand now to draft fresh opportunities.',
    afterNoChanges: 'in your ground truths since the last update. Luna will draft opportunities from your current knowledge.',
    preparingLabel: 'Analysing your strategy and knowledge base',
  },
}

interface GenerationConfirmDialogProps {
  action: GenerationAction
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  /**
   * What changed in the ground truths since the stack was built — BOTH directions (`strategySync`).
   * A discard is a change: counting additions only told a user who had just curated their knowledge
   * that nothing had changed, and offered the re-roll copy.
   */
  changes?: { added: number; removed: number }
  isFirstTime?: boolean // true = no existing content for this action (skip confirmation)
}

export function GenerationConfirmDialog({
  action,
  open,
  onOpenChange,
  onConfirm,
  changes = { added: 0, removed: 0 },
  isFirstTime = false,
}: GenerationConfirmDialogProps) {
  const [error, setError] = useState<string | undefined>()
  const [preparing, setPreparing] = useState(false)
  const runningRef = useRef(false)
  const config = GENERATION_CONFIGS[action]
  const changeSummary = describeStackChanges(changes)
  const hasChanges = changeSummary !== ''

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

  // Auto-confirm for first-time generation (nothing to lose, skip the dialog)
  useEffect(() => {
    if (open && isFirstTime && !runningRef.current && !preparing && !error) {
      handleConfirm()
    }
  }, [open, isFirstTime]) // eslint-disable-line react-hooks/exhaustive-deps

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
                {hasChanges ? (
                  <><span className="font-medium text-foreground">{changeSummary}</span> {config.afterChanges}</>
                ) : (
                  <><span className="font-medium text-foreground">Nothing has changed</span> {config.afterNoChanges}</>
                )}
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm}>
                  {hasChanges ? config.confirmLabel : config.confirmLabelNoChanges}
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
