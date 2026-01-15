'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Message, ExtractedContextVariant, StrategyStatements, ConversationPhase } from '@/lib/types'
import { ExtractionStep, ExtractionProgress } from '@/components/ExtractionProgress'
import { Skeleton } from '@/components/ui/skeleton'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'
import ChatInterface from '@/components/ChatInterface'
import ExtractionConfirm from '@/components/ExtractionConfirm'
import ExtractionSummary from '@/components/ExtractionSummary'
import StrategyDisplay from '@/components/StrategyDisplay'
import FeedbackButtons from '@/components/FeedbackButtons'

function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Message area */}
      <div className="flex-1 space-y-4 p-4">
        {/* Assistant message skeleton */}
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </div>
      {/* Input area skeleton */}
      <div className="border-t p-4">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  )
}

type FlowStep = 'chat' | 'extracting' | 'extraction' | 'summary' | 'strategy'

export interface GapExploration {
  dimension: string
  summary?: string
}

interface ChatSheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuestion?: string
  deepDiveId?: string
  gapExploration?: GapExploration
  resumeConversationId?: string
  hasExistingStrategy?: boolean
  viewOnly?: boolean
}

export function ChatSheet({
  projectId,
  open,
  onOpenChange,
  initialQuestion,
  deepDiveId,
  gapExploration,
  resumeConversationId,
  hasExistingStrategy = false,
  viewOnly = false,
}: ChatSheetProps) {
  // Flow state
  const [flowStep, setFlowStep] = useState<FlowStep>('chat')

  // Conversation state
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationStatus, setConversationStatus] = useState<string>('in_progress')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL')
  const [experimentVariant, setExperimentVariant] = useState<string>('baseline-v1')

  // Derived state
  const isReadOnly = conversationStatus === 'extracted' || viewOnly

  // Extraction state
  const [extractedContext, setExtractedContext] = useState<ExtractedContextVariant | null>(null)
  const [dimensionalCoverage, setDimensionalCoverage] = useState<any>(null)
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>('starting')
  const [extractionError, setExtractionError] = useState<string | undefined>()

  // Strategy state
  const [strategy, setStrategy] = useState<StrategyStatements | null>(null)
  const [thoughts, setThoughts] = useState<string>('')
  const [traceId, setTraceId] = useState<string>('')

  // Early exit state
  const [earlyExitOffered, setEarlyExitOffered] = useState(false)
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null)

  // Explicit end state (user clicked End button)
  const [isExplicitEnd, setIsExplicitEnd] = useState(false)

  // Auto-start or resume conversation when sheet opens
  useEffect(() => {
    if (open && !conversationId) {
      if (resumeConversationId) {
        resumeConversation(resumeConversationId)
      } else {
        startConversationWithQuestion(initialQuestion)
      }
    }
  }, [open])

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setConversationId(null)
      setConversationStatus('in_progress')
      setMessages([])
      setFlowStep('chat')
      setExtractedContext(null)
      setStrategy(null)
      setCurrentPhase('INITIAL')
      setEarlyExitOffered(false)
      setSuggestedQuestion(null)
      setIsExplicitEnd(false)
    }
  }, [open])

  // Start a new conversation
  const startConversationWithQuestion = async (question?: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          ...(question && { suggestedQuestion: question }),
          ...(deepDiveId && { deepDiveId }),
          ...(gapExploration && { gapExploration }),
        }),
      })

      const data = await response.json()
      setConversationId(data.conversationId)
      setExperimentVariant(data.experimentVariant || 'baseline-v1')

      setMessages([{
        id: `msg_${Date.now()}`,
        conversationId: data.conversationId,
        role: 'assistant',
        content: data.message,
        stepNumber: 1,
        timestamp: new Date(),
      }])

      return data.conversationId
    } catch (error) {
      console.error('Failed to start conversation:', error)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  // Resume an existing conversation
  const resumeConversation = async (convId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/conversation/${convId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch conversation')
      }

      const data = await response.json()
      setConversationId(convId)
      setConversationStatus(data.status || 'in_progress')
      setMessages(data.messages.map((m: any) => ({
        id: m.id,
        conversationId: convId,
        role: m.role,
        content: m.content,
        stepNumber: m.stepNumber,
        timestamp: new Date(m.timestamp),
      })))
      setCurrentPhase(data.currentPhase || 'QUESTIONING')
      setExperimentVariant(data.experimentVariant || 'baseline-v1')
    } catch (error) {
      console.error('Failed to resume conversation:', error)
      toast.error('Failed to load conversation')
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle user message response
  const handleUserResponse = async (response: string) => {
    if (!conversationId) return

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId,
      role: 'user',
      content: response,
      stepNumber: messages.length + 1,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    setIsLoading(true)
    try {
      const continueResponse = await fetch('/api/conversation/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          userResponse: response,
          currentPhase,
        }),
      })

      const data = await continueResponse.json()

      if (data.nextPhase) {
        setCurrentPhase(data.nextPhase)
      }

      if (data.complete) {
        extractContext()
      } else {
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}`,
          conversationId,
          role: 'assistant',
          content: data.message,
          stepNumber: data.stepNumber,
          timestamp: new Date(),
        }])

        if (data.earlyExitOffered) {
          setEarlyExitOffered(true)
          setSuggestedQuestion(data.suggestedQuestion || null)
        } else {
          setEarlyExitOffered(false)
          setSuggestedQuestion(null)
        }
      }
    } catch (error) {
      console.error('Failed to continue conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Extract context from conversation
  const extractContext = async () => {
    if (!conversationId) return

    setFlowStep('extracting')
    setIsLoading(true)
    setExtractionStep('starting')
    setExtractionError(undefined)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          // Lightweight mode for follow-on conversations (skip heavy synthesis)
          lightweight: hasExistingStrategy,
        }),
      })

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.status}`)
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

            if (update.step === 'complete') {
              const { extractedContext: ctx, dimensionalCoverage: coverage } = update.data
              setExtractedContext(ctx)
              setDimensionalCoverage(coverage)

              if (isExplicitEnd) {
                // User clicked End - close sheet with toast
                toast.success('Added to your knowledge base')
                onOpenChange(false)
              } else if (hasExistingStrategy) {
                // Subsequent conversation - show summary only
                setFlowStep('summary')
              } else {
                // First conversation - show extraction confirm with generate option
                setFlowStep('extraction')
              }
            } else if (update.step === 'error') {
              throw new Error(update.error || 'Extraction failed')
            } else {
              setExtractionStep(update.step)
            }
          } catch (parseError) {
            console.error('Failed to parse progress update:', line, parseError)
          }
        }
      }
    } catch (error) {
      console.error('Failed to extract context:', error)
      setExtractionStep('error')
      setExtractionError(error instanceof Error ? error.message : 'Something went wrong')
      setTimeout(() => {
        setFlowStep('chat')
        setCurrentPhase('QUESTIONING')
      }, 2000)
    } finally {
      setIsLoading(false)
    }
  }

  // Generate strategy from extracted context
  const handleGenerate = async () => {
    if (!conversationId || !extractedContext) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          extractedContext,
          dimensionalCoverage,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`Generation failed: ${response.status} - ${errorData.error || response.statusText}`)
      }

      const data = await response.json()
      setStrategy(data.statements)
      setThoughts(data.thoughts)
      setTraceId(data.traceId)
      setFlowStep('strategy')

      // Notify listeners
      window.dispatchEvent(new Event('strategySaved'))
    } catch (error) {
      console.error('Failed to generate strategy:', error)
      alert(`Failed to generate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Continue conversation after reviewing extraction
  const handleContinue = async () => {
    if (conversationId) {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          eventType: 'extraction_choice',
          eventData: { choice: 'continue' },
        }),
      }).catch(err => console.error('Failed to log event:', err))
    }

    setCurrentPhase('QUESTIONING')
    setFlowStep('chat')

    if (extractedContext?.reflective_summary?.thought_prompt) {
      const thoughtMessage: Message = {
        id: `msg_${Date.now()}`,
        conversationId: conversationId!,
        role: 'assistant',
        content: extractedContext.reflective_summary.thought_prompt,
        stepNumber: messages.length + 1,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, thoughtMessage])
    }
  }

  // End conversation explicitly - trigger extraction and close
  const handleEndConversation = () => {
    if (!conversationId) return
    setIsExplicitEnd(true)
    extractContext()
  }

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      // Prevent closing during extraction
      if (!newOpen && flowStep === 'extracting') {
        return
      }
      onOpenChange(newOpen)
    }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {flowStep === 'chat' && (
              isReadOnly
                ? 'Past Conversation'
                : deepDiveId
                  ? 'Deep Dive'
                  : gapExploration
                    ? DIMENSION_CONTEXT[gapExploration.dimension as Tier1Dimension]?.name || 'Discussion'
                    : 'Discussion'
            )}
            {flowStep === 'extracting' && 'Analyzing...'}
            {flowStep === 'extraction' && 'Review Insights'}
            {flowStep === 'summary' && 'Insights Captured'}
            {flowStep === 'strategy' && 'Your Strategy'}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col h-[calc(100vh-8rem)]">
          {flowStep === 'chat' && messages.length === 0 && isLoading && (
            <ChatSkeleton />
          )}

          {flowStep === 'chat' && messages.length > 0 && (
            <ChatInterface
              conversationId={conversationId}
              messages={messages}
              onUserResponse={handleUserResponse}
              onGenerateStrategy={extractContext}
              onEndConversation={isReadOnly ? undefined : handleEndConversation}
              isLoading={isLoading}
              isComplete={isReadOnly}
              currentPhase={currentPhase}
              traceId={traceId}
              earlyExitOffered={earlyExitOffered}
              suggestedQuestion={suggestedQuestion}
            />
          )}

          {flowStep === 'extracting' && (
            <ExtractionProgress
              currentStep={extractionStep}
              error={extractionError}
            />
          )}

          {flowStep === 'extraction' && extractedContext && (
            <ExtractionConfirm
              extractedContext={extractedContext}
              onGenerate={handleGenerate}
              onContinue={handleContinue}
              isGenerating={isLoading}
            />
          )}

          {flowStep === 'summary' && conversationId && (
            <ExtractionSummary
              conversationId={conversationId}
              onDone={() => onOpenChange(false)}
            />
          )}

          {flowStep === 'strategy' && strategy && conversationId && (
            <div className="space-y-4">
              <StrategyDisplay
                strategy={strategy}
                thoughts={thoughts}
                conversationId={conversationId}
                traceId={traceId}
              />
              <FeedbackButtons traceId={traceId} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
