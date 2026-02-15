'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageCircle, X, Plus } from 'lucide-react'
import { Message, ExtractedContextVariant, StrategyStatements, ConversationPhase } from '@/lib/types'
import { ExtractionStep, ExtractionProgress } from '@/components/ExtractionProgress'
import { useGenerationStatusContext } from '@/components/providers/BackgroundTaskProvider'
import { Skeleton } from '@/components/ui/skeleton'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'
import ChatInterface from '@/components/ChatInterface'
import ExtractionConfirm from '@/components/ExtractionConfirm'
import ExtractionSummary from '@/components/ExtractionSummary'
import StrategyDisplay from '@/components/StrategyDisplay'
import FeedbackButtons from '@/components/FeedbackButtons'

interface DeepDiveOption {
  id: string
  topic: string
}

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
  /** If true, allow new conversations even without strategy (e.g., document uploaded) */
  hasKnowledgebaseContent?: boolean
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
  hasKnowledgebaseContent = false,
  viewOnly = false,
}: ChatSheetProps) {
  // Background generation context
  const { startGeneration, startTask } = useGenerationStatusContext()

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

  // Strategy state (for viewing existing strategy)
  const [strategy, setStrategy] = useState<StrategyStatements | null>(null)
  const [thoughts, setThoughts] = useState<string>('')
  const [traceId, setTraceId] = useState<string>('')

  // Early exit state
  const [earlyExitOffered, setEarlyExitOffered] = useState(false)
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null)

  // Explicit end state (user clicked End button)
  const [isExplicitEnd, setIsExplicitEnd] = useState(false)

  // Topic assignment state
  const [currentDeepDive, setCurrentDeepDive] = useState<DeepDiveOption | null>(null)
  const [availableDeepDives, setAvailableDeepDives] = useState<DeepDiveOption[]>([])
  const [isUpdatingTopic, setIsUpdatingTopic] = useState(false)

  // Blocking state for incomplete initial conversation
  const [incompleteInitialConvoId, setIncompleteInitialConvoId] = useState<string | null>(null)
  const [hasCheckedForInitial, setHasCheckedForInitial] = useState(false)

  // Fetch available deep dives when sheet opens
  useEffect(() => {
    if (open && projectId) {
      fetchDeepDives()
    }
  }, [open, projectId])

  const fetchDeepDives = async () => {
    try {
      const response = await fetch(`/api/project/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableDeepDives(data.deepDives?.map((dd: any) => ({
          id: dd.id,
          topic: dd.topic,
        })) || [])

        // Check for incomplete initial conversation (blocks starting new chat)
        const incompleteInitial = data.conversations?.find(
          (c: { isInitialConversation?: boolean; status: string }) =>
            c.isInitialConversation && c.status === 'in_progress'
        )
        setIncompleteInitialConvoId(incompleteInitial?.id || null)
      }
    } catch (error) {
      console.error('Failed to fetch deep dives:', error)
    } finally {
      setHasCheckedForInitial(true)
    }
  }

  // Auto-start or resume conversation when sheet opens
  // Wait for hasCheckedForInitial before deciding to start a new conversation
  useEffect(() => {
    if (open && !conversationId) {
      if (resumeConversationId) {
        // Resume doesn't need to wait for check
        resumeConversation(resumeConversationId)
      } else if (deepDiveId || gapExploration) {
        // Special modes don't need to wait for check
        startConversationWithQuestion(initialQuestion)
      } else if (hasCheckedForInitial && (hasExistingStrategy || hasKnowledgebaseContent)) {
        // Start conversation if project has strategy OR has content from document upload
        startConversationWithQuestion(initialQuestion)
      }
      // If no strategy and no content, don't start - show blocking UI directing to InlineChat
    }
  }, [open, hasCheckedForInitial, incompleteInitialConvoId])

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
      setCurrentDeepDive(null)
      setIncompleteInitialConvoId(null)
      setHasCheckedForInitial(false)
    }
  }, [open])

  // Update topic assignment
  const handleTopicChange = async (newDeepDiveId: string | null) => {
    if (!conversationId) return

    setIsUpdatingTopic(true)
    try {
      const response = await fetch(`/api/conversation/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deepDiveId: newDeepDiveId }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentDeepDive(data.deepDive || null)
      }
    } catch (error) {
      console.error('Failed to update topic:', error)
      toast.error('Failed to update topic')
    } finally {
      setIsUpdatingTopic(false)
    }
  }

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
      // Set current deep dive if conversation was started from one
      if (data.deepDive) {
        setCurrentDeepDive(data.deepDive)
      }

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
      setCurrentDeepDive(data.deepDive || null)
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

    // Follow-up conversations: fire-and-forget, close sheet immediately
    if (hasExistingStrategy) {
      try {
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, lightweight: true }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Extraction failed' }))
          throw new Error(errorData.error || `Extraction failed: ${response.status}`)
        }

        const data = await response.json()

        if (data.status === 'started') {
          startTask('extraction', data.conversationId, projectId)
          onOpenChange(false)
        }
      } catch (error) {
        console.error('Failed to start extraction:', error)
        toast.error('Failed to process insights', {
          description: error instanceof Error ? error.message : 'Something went wrong',
        })
        // Don't close sheet on error — user can try again
      }
      return
    }

    // Initial conversation: keep existing streaming path
    setFlowStep('extracting')
    setIsLoading(true)
    setExtractionStep('starting')
    setExtractionError(undefined)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, lightweight: false }),
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

      const processLine = (line: string) => {
        if (!line.trim()) return

        try {
          const update = JSON.parse(line)

          if (update.step === 'complete') {
            const { extractedContext: ctx, dimensionalCoverage: coverage } = update.data
            setExtractedContext(ctx)
            setDimensionalCoverage(coverage)

            if (isExplicitEnd) {
              // Explicit end without existing strategy — still close
              toast.success('Added to your knowledge base')
              onOpenChange(false)
            } else {
              // Initial conversation — generate strategy
              handleGenerate(ctx, coverage)
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          processLine(line)
        }
      }

      if (buffer.trim()) {
        processLine(buffer)
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

  // Generate strategy from extracted context - fire-and-forget with background processing
  // Accepts optional context/coverage params for immediate calls (bypasses React state timing)
  const handleGenerate = async (ctx?: ExtractedContextVariant, coverage?: any) => {
    const contextToUse = ctx || extractedContext
    const coverageToUse = coverage !== undefined ? coverage : dimensionalCoverage

    if (!conversationId || !contextToUse) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          extractedContext: contextToUse,
          dimensionalCoverage: coverageToUse,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`Generation failed: ${response.status} - ${errorData.error || response.statusText}`)
      }

      const data = await response.json()

      if (data.status === 'started' && data.generationId) {
        // Start tracking generation in context (handles polling and toast)
        startGeneration(data.generationId, projectId)

        // Notify listeners
        window.dispatchEvent(new Event('strategySaved'))

        // Close the sheet - generation continues in background
        toast.success('Generating your strategy', {
          description: 'This will take a few moments. We\'ll notify you when it\'s ready.',
        })
        onOpenChange(false)
      } else {
        throw new Error('Invalid response from generation API')
      }
    } catch (error) {
      console.error('Failed to start strategy generation:', error)
      toast.error('Failed to generate strategy', {
        description: error instanceof Error ? error.message : 'Something went wrong',
      })
      setFlowStep('extraction')
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
      // Prevent closing during extraction (generation now runs in background)
      if (!newOpen && flowStep === 'extracting') {
        return
      }
      onOpenChange(newOpen)
    }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Header */}
        <div className="bg-muted/50 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold flex-1">
              {flowStep === 'chat' && (
                isReadOnly
                  ? 'Past Conversation'
                  : gapExploration
                    ? DIMENSION_CONTEXT[gapExploration.dimension as Tier1Dimension]?.name || 'Chat'
                    : 'Chat'
              )}
              {flowStep === 'extracting' && 'Analyzing...'}
              {flowStep === 'extraction' && 'Review Insights'}
              {flowStep === 'summary' && 'Insights Captured'}
              {flowStep === 'strategy' && 'Your Strategy'}
            </h2>
          </div>

          {/* Topic chip/badge - only show in chat mode */}
          {flowStep === 'chat' && conversationId && (
            <div className="mt-3">
              {currentDeepDive ? (
                <div className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm px-2.5 py-1 rounded-full">
                  <span>{currentDeepDive.topic}</span>
                  <Select
                    value={currentDeepDive.id}
                    onValueChange={(value) => handleTopicChange(value === 'none' ? null : value)}
                    disabled={isUpdatingTopic}
                  >
                    <SelectTrigger className="h-auto p-0 border-0 bg-transparent w-auto focus:ring-0 [&>svg]:hidden">
                      <button className="p-0.5 hover:bg-primary/20 rounded-full ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Remove from topic</SelectItem>
                      {availableDeepDives
                        .filter(dd => dd.id !== currentDeepDive.id)
                        .map(dd => (
                          <SelectItem key={dd.id} value={dd.id}>{dd.topic}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : availableDeepDives.length > 0 ? (
                <Select
                  value=""
                  onValueChange={(value) => handleTopicChange(value)}
                  disabled={isUpdatingTopic}
                >
                  <SelectTrigger className="h-auto w-auto border-dashed text-muted-foreground text-sm px-2.5 py-1 rounded-full">
                    <Plus className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Add to topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDeepDives.map(dd => (
                      <SelectItem key={dd.id} value={dd.id}>{dd.topic}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          )}
        </div>
        <div className="px-6 py-4 flex flex-col h-[calc(100vh-10rem)]">
          {/* Show skeleton while loading or checking for initial conversation */}
          {flowStep === 'chat' && messages.length === 0 && (isLoading || (!hasCheckedForInitial && !resumeConversationId && !deepDiveId && !gapExploration)) && (
            <ChatSkeleton />
          )}

          {/* Block new conversation if no strategy and no knowledgebase content (first-time flow) */}
          {flowStep === 'chat' && messages.length === 0 && !isLoading && hasCheckedForInitial && !hasExistingStrategy && !hasKnowledgebaseContent && !deepDiveId && !gapExploration && !resumeConversationId && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 max-w-md">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                  Complete your first conversation
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                  {incompleteInitialConvoId
                    ? "You have an initial conversation in progress. Complete it to generate your first strategy, or start over from the project page."
                    : "Start your first conversation from the main area to generate your first strategy."}
                </p>
                <button
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {flowStep === 'chat' && messages.length > 0 && (
            <ChatInterface
              conversationId={conversationId}
              messages={messages}
              onUserResponse={handleUserResponse}
              onGenerateStrategy={hasExistingStrategy ? undefined : extractContext}
              onEndConversation={isReadOnly ? undefined : handleEndConversation}
              isLoading={isLoading}
              isComplete={isReadOnly}
              currentPhase={currentPhase}
              traceId={traceId}
              earlyExitOffered={earlyExitOffered}
              suggestedQuestion={suggestedQuestion}
              isFirstStrategy={!hasExistingStrategy && !deepDiveId && !gapExploration}
            />
          )}

          {flowStep === 'extracting' && (
            <ExtractionProgress
              currentStep={extractionStep}
              error={extractionError}
              mode="extraction"
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
                conversationId={conversationId}
                traceId={traceId}
                projectId={projectId}
              />
              <FeedbackButtons traceId={traceId} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
