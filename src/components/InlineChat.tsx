'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/solid'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { ConversationPhase, ExtractedContextVariant } from '@/lib/types'
import { ExtractionStep, GenerationStep, ExtractionProgress } from '@/components/ExtractionProgress'
import ExtractionConfirm from '@/components/ExtractionConfirm'

interface InlineMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

interface InlineChatProps {
  projectId: string
  initialMessage?: string
  autoStart?: boolean
  onConversationStart?: (conversationId: string) => void
}

export function InlineChat({ projectId, initialMessage, autoStart, onConversationStart }: InlineChatProps) {
  const router = useRouter()
  const [input, setInput] = useState(initialMessage || '')
  const [messages, setMessages] = useState<InlineMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL')
  const [error, setError] = useState<string | null>(null)

  // First-time experience: track when ready to generate
  const [readyToGenerate, setReadyToGenerate] = useState(false)
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>('starting')
  const [extractionError, setExtractionError] = useState<string | undefined>()
  const [generationStep, setGenerationStep] = useState<GenerationStep>('preparing')
  const [generationError, setGenerationError] = useState<string | undefined>()

  // Extraction confirmation flow
  const [showExtractionConfirm, setShowExtractionConfirm] = useState(false)
  const [extractedContext, setExtractedContext] = useState<ExtractedContextVariant | null>(null)
  const [dimensionalCoverage, setDimensionalCoverage] = useState<unknown>(null)

  // Use ref to prevent React Strict Mode double-firing of autoStart
  const hasAutoStartedRef = useRef(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-start conversation if autoStart is true and we have an initial message
  useEffect(() => {
    if (autoStart && initialMessage && !hasAutoStartedRef.current && !conversationId) {
      hasAutoStartedRef.current = true
      startConversation(initialMessage)
    }
  }, [autoStart, initialMessage, conversationId])

  const startConversation = async (firstMessage: string) => {
    setIsLoading(true)
    setIsExpanded(true)
    setError(null)

    try {
      const response = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          // Skip Claude call for first question - user already typed their challenge
          suggestedQuestion: "What's on your mind?",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to start conversation: ${response.status}`)
      }

      const data = await response.json()

      if (!data.conversationId) {
        throw new Error('No conversation ID returned')
      }

      setConversationId(data.conversationId)
      onConversationStart?.(data.conversationId)

      // Set initial assistant message
      if (data.message) {
        setMessages([{
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.message,
        }])
      }
      const phase = data.phase || 'QUESTIONING'
      setCurrentPhase(phase)

      // Clear input and send the user's first message
      setInput('')
      await sendMessage(data.conversationId, firstMessage, phase)
    } catch (err) {
      console.error('Failed to start conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to start conversation')
      hasAutoStartedRef.current = false // Allow retry
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (convId: string, content: string, overridePhase?: ConversationPhase) => {
    // Add user message optimistically
    const userMessage: InlineMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    // Use override phase if provided (avoids React state timing issues)
    const phaseToSend = overridePhase || currentPhase

    try {
      const response = await fetch('/api/conversation/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          userResponse: content,
          currentPhase: phaseToSend,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to send message: ${response.status}`)
      }

      const data = await response.json()

      if (data.message) {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.message,
        }])
      }

      // Handle both 'phase' and 'nextPhase' from API
      const newPhase = data.nextPhase || data.phase
      if (newPhase) {
        setCurrentPhase(newPhase)
      }

      // Check if ready to generate (earlyExitOffered or complete)
      if (data.earlyExitOffered || data.complete || newPhase === 'EXTRACTION') {
        setReadyToGenerate(true)
        // Store suggested follow-up question for "Keep Chatting" flow
        if (data.suggestedQuestion) {
          setSuggestedQuestion(data.suggestedQuestion)
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 1: Extract context and show confirmation
  const handleExtract = async () => {
    if (!conversationId) return

    setIsExtracting(true)
    setError(null)
    setExtractionStep('starting')
    setExtractionError(undefined)

    try {
      const extractResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          lightweight: false,
        }),
      })

      if (!extractResponse.ok) {
        throw new Error(`Extraction failed: ${extractResponse.status}`)
      }

      const reader = extractResponse.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let context = null
      let coverage = null

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
              context = update.data.extractedContext
              coverage = update.data.dimensionalCoverage
              setExtractionStep('complete')
            } else if (update.step === 'error') {
              throw new Error(update.error || 'Extraction failed')
            } else if (update.step) {
              const stepMap: Record<string, ExtractionStep> = {
                'starting': 'starting',
                'extracting': 'extracting_themes',
                'extracting_themes': 'extracting_themes',
                'analyzing': 'analyzing_dimensions',
                'analyzing_dimensions': 'analyzing_dimensions',
                'synthesizing': 'generating_summary',
                'generating_summary': 'generating_summary',
                'saving': 'saving_insights',
                'saving_insights': 'saving_insights',
              }
              const mappedStep = stepMap[update.step]
              if (mappedStep) {
                setExtractionStep(mappedStep)
              }
            }
          } catch {
            // Ignore parse errors for partial lines
          }
        }
      }

      if (!context) {
        throw new Error('No context extracted')
      }

      // Show extraction confirmation
      setExtractedContext(context)
      setDimensionalCoverage(coverage)
      setIsExtracting(false)
      setShowExtractionConfirm(true)
    } catch (err) {
      console.error('Failed to extract:', err)
      setExtractionStep('error')
      setExtractionError(err instanceof Error ? err.message : 'Failed to extract')
      setTimeout(() => {
        setIsExtracting(false)
        setExtractionStep('starting')
        setExtractionError(undefined)
      }, 3000)
    }
  }

  // Step 2: Generate strategy from extracted context
  const handleGenerate = async () => {
    if (!conversationId || !extractedContext) return

    setShowExtractionConfirm(false)
    setIsGenerating(true)
    setGenerationStep('preparing')
    setGenerationError(undefined)
    setError(null)

    try {
      const generateResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          extractedContext,
          dimensionalCoverage,
        }),
      })

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `Generation failed: ${generateResponse.status}`)
      }

      const reader = generateResponse.body?.getReader()
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
              const { traceId } = update.data
              // Notify listeners and redirect to strategy page
              window.dispatchEvent(new Event('strategySaved'))
              router.push(`/strategy/${traceId}`)
            } else if (update.step === 'error') {
              throw new Error(update.error || 'Generation failed')
            } else {
              setGenerationStep(update.step)
            }
          } catch (parseError) {
            console.error('Failed to parse progress update:', line, parseError)
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate strategy:', err)
      setGenerationStep('error')
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate strategy')
      // Reset after showing error
      setTimeout(() => {
        setIsGenerating(false)
        setGenerationStep('preparing')
        setGenerationError(undefined)
      }, 3000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const message = input.trim()
    setInput('')

    if (!conversationId) {
      await startConversation(message)
    } else {
      await sendMessage(conversationId, message)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter to send (consistent with ChatInterface)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Handle "Continue" from extraction confirm - go back to chatting
  const handleContinueFromExtraction = () => {
    setShowExtractionConfirm(false)
    setReadyToGenerate(false)
    // Add the thought_prompt as a follow-up question if available
    const thoughtPrompt = extractedContext?.reflective_summary?.thought_prompt
    if (thoughtPrompt) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-thought`,
        role: 'assistant',
        content: thoughtPrompt,
      }])
    }
    inputRef.current?.focus()
  }

  // Check if user has started chatting (for showing End button)
  const hasUserResponded = messages.some(m => m.role === 'user')

  // Show extraction in progress
  if (isExtracting) {
    return (
      <div className="py-8">
        <ExtractionProgress currentStep={extractionStep} error={extractionError} mode="extraction" />
      </div>
    )
  }

  // Show extraction confirmation
  if (showExtractionConfirm && extractedContext) {
    return (
      <div className="py-4">
        <ExtractionConfirm
          extractedContext={extractedContext}
          onGenerate={handleGenerate}
          onContinue={handleContinueFromExtraction}
          isGenerating={isGenerating}
        />
      </div>
    )
  }

  // Show generation in progress UI
  if (isGenerating) {
    return (
      <div className="py-8">
        <ExtractionProgress currentStep={generationStep} error={generationError} mode="generation" />
      </div>
    )
  }

  return (
    <div className={`flex flex-col transition-all duration-300 ${isExpanded ? 'h-full' : ''}`}>
      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg shrink-0">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Messages area - flex-1 to fill space, scrollable */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto mb-4 min-h-0">
          {/* Spacer to push messages to bottom when few messages */}
          <div className="flex flex-col min-h-full justify-end">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-4">
                  <EllipsisHorizontalIcon className="w-6 h-6 text-primary animate-[pulse_3s_ease-in-out_infinite]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          </div>
        </div>
      )}

      {/* Ready to generate UI - anchored at bottom */}
      {readyToGenerate && !isLoading && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg shrink-0">
          <p className="text-sm text-muted-foreground mb-3">
            I have enough context to draft your first strategy. You can generate now or keep chatting to add more detail.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleExtract}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Draft First Strategy
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReadyToGenerate(false)
                // Add suggested follow-up question as assistant message
                if (suggestedQuestion) {
                  setMessages(prev => [...prev, {
                    id: `msg-${Date.now()}-followup`,
                    role: 'assistant',
                    content: suggestedQuestion,
                  }])
                  setSuggestedQuestion(null)
                }
                inputRef.current?.focus()
              }}
            >
              Keep Chatting
            </Button>
          </div>
        </div>
      )}

      {/* Input area - anchored at bottom, hide when ready to generate */}
      {!readyToGenerate && (
        <form onSubmit={handleSubmit} className="shrink-0 border-t border-border pt-4">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me more..."
            disabled={isLoading}
            rows={3}
            className="w-full px-4 py-3 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Kbd>⌘</Kbd><Kbd>Enter</Kbd>
              <span className="mx-1">or</span>
              <Kbd>Ctrl</Kbd><Kbd>Enter</Kbd>
              <span className="ml-1">to send</span>
            </p>
            <div className="flex items-center gap-2">
              {hasUserResponded && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReadyToGenerate(true)}
                  disabled={isLoading}
                >
                  End
                </Button>
              )}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Send
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
