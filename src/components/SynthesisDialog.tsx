'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

type SynthesisStep =
  | 'starting'
  | 'updating_dimensions'
  | 'generating_summary'
  | 'complete'
  | 'error'

interface StepConfig {
  title: string
  description: string
}

const STEP_MESSAGES: Record<SynthesisStep, StepConfig> = {
  starting: {
    title: 'Getting ready',
    description: 'Preparing to synthesize your knowledge',
  },
  updating_dimensions: {
    title: 'Updating strategic dimensions',
    description: 'Analyzing new insights across your strategy',
  },
  generating_summary: {
    title: 'Generating summary',
    description: 'Creating your updated knowledge summary',
  },
  complete: {
    title: 'Synthesis complete!',
    description: 'Your knowledge base has been updated',
  },
  error: {
    title: 'Something went wrong',
    description: 'Failed to complete synthesis',
  },
}

interface SynthesisDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function SynthesisDialog({
  projectId,
  open,
  onOpenChange,
  onComplete,
}: SynthesisDialogProps) {
  const [currentStep, setCurrentStep] = useState<SynthesisStep>('starting')
  const [error, setError] = useState<string | undefined>()

  // Start synthesis when dialog opens
  useEffect(() => {
    if (!open) {
      // Reset state when closed
      setCurrentStep('starting')
      setError(undefined)
      return
    }

    const runSynthesis = async () => {
      try {
        const response = await fetch(`/api/project/${projectId}/synthesize`, {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error(`Synthesis failed: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

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
                setError(update.error || 'Synthesis failed')
              } else if (update.step === 'complete') {
                // Trigger refresh after a brief moment
                setTimeout(() => {
                  onComplete()
                }, 1500)
              }
            } catch (parseError) {
              console.error('Failed to parse progress update:', line, parseError)
            }
          }
        }
      } catch (err) {
        console.error('Synthesis error:', err)
        setCurrentStep('error')
        setError(err instanceof Error ? err.message : 'Synthesis failed')
      }
    }

    runSynthesis()
  }, [open, projectId, onComplete])

  const stepConfig = STEP_MESSAGES[currentStep]
  const isError = currentStep === 'error'
  const isComplete = currentStep === 'complete'

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Only allow closing when complete or error
      if (!newOpen && !isComplete && !isError) return
      onOpenChange(newOpen)
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Updating Knowledge Base</DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <div className={`rounded-lg p-6 ${
            isError
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-muted'
          }`}>
            {/* Progress bars */}
            {!isComplete && !isError && (
              <div className="mb-6">
                <div className="flex justify-center space-x-2">
                  {['updating_dimensions', 'generating_summary'].map((step) => {
                    const stepOrder = ['starting', 'updating_dimensions', 'generating_summary', 'complete']
                    const currentIdx = stepOrder.indexOf(currentStep)
                    const stepIdx = stepOrder.indexOf(step)
                    const isActive = stepIdx === currentIdx
                    const isDone = stepIdx < currentIdx

                    return (
                      <div
                        key={step}
                        className={`h-1.5 w-16 rounded-full transition-all duration-500 ${
                          isDone
                            ? 'bg-primary'
                            : isActive
                              ? 'bg-primary/60 animate-[pulse_3s_ease-in-out_infinite]'
                              : 'bg-primary/20'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Status icon for complete/error */}
            {(isComplete || isError) && (
              <div className="mb-4 flex justify-center">
                {isComplete ? (
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <p className={`font-medium text-center ${
              isError
                ? 'text-red-700 dark:text-red-300'
                : 'text-foreground'
            }`}>
              {stepConfig.title}
            </p>

            {/* Description */}
            <p className={`text-sm mt-2 text-center ${
              isError
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            }`}>
              {error || stepConfig.description}
            </p>
          </div>

          {/* Close button for complete/error states */}
          {(isComplete || isError) && (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => onOpenChange(false)}>
                {isComplete ? 'Done' : 'Close'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
