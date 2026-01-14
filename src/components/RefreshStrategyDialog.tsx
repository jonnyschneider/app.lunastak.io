'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { RefreshStrategyStep } from '@/lib/contracts/refresh-strategy'

interface StepConfig {
  title: string
  description: string
}

const STEP_MESSAGES: Record<RefreshStrategyStep, StepConfig> = {
  loading_context: {
    title: 'Loading context',
    description: 'Gathering your strategic insights and recent changes',
  },
  generating_strategy: {
    title: 'Updating strategy',
    description: 'Incorporating new insights into your decision stack',
  },
  summarizing_changes: {
    title: 'Summarizing changes',
    description: 'Documenting what changed and why',
  },
  complete: {
    title: 'Strategy refreshed!',
    description: 'Your decision stack has been updated',
  },
  error: {
    title: 'Something went wrong',
    description: 'Failed to refresh strategy',
  },
}

interface RefreshStrategyDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (traceId: string) => void
}

export function RefreshStrategyDialog({
  projectId,
  open,
  onOpenChange,
  onComplete,
}: RefreshStrategyDialogProps) {
  const [currentStep, setCurrentStep] = useState<RefreshStrategyStep>('loading_context')
  const [error, setError] = useState<string | undefined>()
  const [changeSummary, setChangeSummary] = useState<string | null>(null)
  const [completedTraceId, setCompletedTraceId] = useState<string | null>(null)
  const refreshRunningRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!open) {
      setCurrentStep('loading_context')
      setError(undefined)
      setChangeSummary(null)
      setCompletedTraceId(null)
      refreshRunningRef.current = false
      return
    }

    if (refreshRunningRef.current) return
    refreshRunningRef.current = true

    const runRefresh = async () => {
      try {
        const response = await fetch(`/api/project/${projectId}/refresh-strategy`, {
          method: 'POST',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Refresh failed: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const update = JSON.parse(line)
              setCurrentStep(update.step)

              if (update.step === 'error') {
                setError(update.error || 'Refresh failed')
              } else if (update.step === 'complete') {
                setChangeSummary(update.changeSummary)
                setCompletedTraceId(update.traceId)
              }
            } catch (parseError) {
              console.error('Failed to parse progress:', line, parseError)
            }
          }
        }
      } catch (err) {
        console.error('Refresh error:', err)
        setCurrentStep('error')
        setError(err instanceof Error ? err.message : 'Refresh failed')
      }
    }

    runRefresh()
  }, [open, projectId])

  const stepConfig = STEP_MESSAGES[currentStep]
  const isError = currentStep === 'error'
  const isComplete = currentStep === 'complete'

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen && !isComplete && !isError) return
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
              isError ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'
            }`}
          >
            {/* Progress bars */}
            {!isComplete && !isError && (
              <div className="mb-6">
                <div className="flex justify-center space-x-2">
                  {(['loading_context', 'generating_strategy', 'summarizing_changes'] as const).map(
                    (step) => {
                      const stepOrder = [
                        'loading_context',
                        'generating_strategy',
                        'summarizing_changes',
                        'complete',
                      ]
                      const currentIdx = stepOrder.indexOf(currentStep)
                      const stepIdx = stepOrder.indexOf(step)
                      const isActive = stepIdx === currentIdx
                      const isDone = stepIdx < currentIdx

                      return (
                        <div
                          key={step}
                          className={`h-1.5 w-12 rounded-full transition-all duration-500 ${
                            isDone
                              ? 'bg-primary'
                              : isActive
                              ? 'bg-primary/60 animate-[pulse_3s_ease-in-out_infinite]'
                              : 'bg-primary/20'
                          }`}
                        />
                      )
                    }
                  )}
                </div>
              </div>
            )}

            {/* Status icon */}
            {(isComplete || isError) && (
              <div className="mb-4 flex justify-center">
                {isComplete ? (
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                ) : (
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
                )}
              </div>
            )}

            {/* Title */}
            <p
              className={`font-medium text-center ${
                isError ? 'text-red-700 dark:text-red-300' : 'text-foreground'
              }`}
            >
              {stepConfig.title}
            </p>

            {/* Description or change summary */}
            <p
              className={`text-sm mt-2 text-center ${
                isError ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
              }`}
            >
              {error || (isComplete && changeSummary) || stepConfig.description}
            </p>
          </div>

          {/* Action button */}
          {(isComplete || isError) && (
            <div className="mt-4 flex justify-center">
              <Button
                onClick={() => {
                  if (isComplete && completedTraceId) {
                    onComplete(completedTraceId)
                  } else {
                    onOpenChange(false)
                  }
                }}
              >
                {isComplete ? 'View Strategy' : 'Close'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
