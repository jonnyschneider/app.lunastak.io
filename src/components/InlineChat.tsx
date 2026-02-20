'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, RotateCcw, Info } from 'lucide-react'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/solid'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ConversationPhase } from '@/lib/types'
import { ExtractionStep, ExtractionProgress } from '@/components/ExtractionProgress'
import { useGenerationStatusContext } from '@/components/providers/BackgroundTaskProvider'
import { getStatsigClient } from '@/components/StatsigProvider'

interface InlineMessage {
  id: string
  role: 'assistant' | 'user' | 'system'
  content: string
}

interface InlineChatProps {
  projectId: string
  resumeConversationId?: string
  initialMessage?: string
  autoStart?: boolean
  onConversationStart?: (conversationId: string) => void
}

export function InlineChat({ projectId, resumeConversationId, initialMessage, autoStart, onConversationStart }: InlineChatProps) {
  const { startGeneration } = useGenerationStatusContext()
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
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>('starting')
  const [extractionError, setExtractionError] = useState<string | undefined>()


  // Start over confirmation
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false)

  // Finish confirmation
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)

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

  // Resume an existing conversation
  const resumeConversation = async (convId: string) => {
    setIsLoading(true)
    setIsExpanded(true)
    setError(null)

    try {
      const response = await fetch(`/api/conversation/${convId}`)
      if (!response.ok) {
        throw new Error('Failed to load conversation')
      }

      const data = await response.json()

      setConversationId(convId)
      setMessages(data.messages.map((m: { id: string; role: string; content: string }) => ({
        id: m.id,
        role: m.role as 'assistant' | 'user',
        content: m.content,
      })))
      setCurrentPhase(data.currentPhase || 'QUESTIONING')

      // Check if conversation was at early exit point
      // Look for assistant messages that indicate readiness to generate
      const lastAssistantMessage = data.messages
        .filter((m: { role: string }) => m.role === 'assistant')
        .pop()

      if (data.currentPhase === 'EXTRACTION' ||
          lastAssistantMessage?.content?.includes('have enough') ||
          lastAssistantMessage?.content?.includes('ready to')) {
        setReadyToGenerate(true)
      }

      onConversationStart?.(convId)
    } catch (err) {
      console.error('Failed to resume conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setIsLoading(false)
    }
  }

  // Resume conversation if resumeConversationId provided
  useEffect(() => {
    if (resumeConversationId && !conversationId) {
      resumeConversation(resumeConversationId)
    }
  }, [resumeConversationId])

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
      } else {
        // Coaching messages at key moments
        const userMessageCount = messages.filter(m => m.role === 'user').length + 1 // +1 for the one we just added

        if (userMessageCount === 2) {
          setMessages(prev => [...prev, {
            id: `msg-${Date.now()}-coaching`,
            role: 'system',
            content: "A few more thoughts and I'll have enough to draft your first Decision Stack.",
          }])
        } else if (userMessageCount === 7) {
          setMessages(prev => [...prev, {
            id: `msg-${Date.now()}-coaching`,
            role: 'system',
            content: "You've shared great context — keep going for a stronger draft, or hit Generate Strategy now. You can always come back and refine later.",
          }])
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  // Fire-and-forget extraction + generation via pipeline orchestrator
  const handleExtract = async () => {
    if (!conversationId) return

    setIsExtracting(true)
    setError(null)
    setExtractionStep('starting')
    setExtractionError(undefined)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, isInitial: true }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Extraction failed' }))
        throw new Error(errorData.error || `Extraction failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.status === 'started' && data.generationId) {
        setIsExtracting(false)
        // Track via generation polling (covers extracting → generating → complete)
        startGeneration(data.generationId, projectId)

        // Notify listeners that strategy generation started
        // The project page's event listener will refetch data and re-render,
        // replacing FirstTimeEmptyState with the dashboard
        window.dispatchEvent(new Event('strategySaved'))
      } else {
        throw new Error('Invalid response from extraction API')
      }
    } catch (err) {
      console.error('Failed to start extraction:', err)
      setExtractionStep('error')
      setExtractionError(err instanceof Error ? err.message : 'Failed to extract')
      setTimeout(() => {
        setIsExtracting(false)
        setExtractionStep('starting')
        setExtractionError(undefined)
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

  // Abandon conversation and start fresh
  const handleStartOver = async () => {
    if (!conversationId) return

    setShowStartOverConfirm(false)

    try {
      await fetch(`/api/conversation/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'abandoned' }),
      })
    } catch (err) {
      console.error('Failed to abandon conversation:', err)
      // Continue with reset anyway - worst case is an orphaned conversation
    }

    // Reset all state
    setConversationId(null)
    setMessages([])
    setIsExpanded(false)
    setCurrentPhase('INITIAL')
    setReadyToGenerate(false)
    setSuggestedQuestion(null)
    setError(null)
    setInput('')
    hasAutoStartedRef.current = false
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
              message.role === 'system' ? (
                <div key={message.id} className="flex justify-center py-1">
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-4 py-2.5 max-w-[85%]">
                    <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 dark:text-amber-200">
                      {message.content}
                    </p>
                  </div>
                </div>
              ) : (
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
              )
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
            placeholder="Start anywhere — a customer observation, a pain point, a hunch, anything."
            disabled={isLoading}
            rows={3}
            className="w-full px-4 py-3 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="hidden md:flex text-xs text-muted-foreground items-center gap-1">
              <Kbd>⌘</Kbd><Kbd>Enter</Kbd>
              <span className="mx-1">or</span>
              <Kbd>Ctrl</Kbd><Kbd>Enter</Kbd>
              <span className="ml-1">to send</span>
            </p>
            <div className="flex items-center gap-2">
              {conversationId && (
                <button
                  type="button"
                  onClick={() => setShowStartOverConfirm(true)}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Start over
                </button>
              )}
              {hasUserResponded && (
                messages.filter(m => m.role === 'user').length >= 7 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowFinishConfirm(true)}
                    disabled={isLoading}
                  >
                    Finish
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowFinishConfirm(true)}
                    disabled={isLoading}
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Finish
                  </button>
                )
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

      {/* Start over confirmation dialog */}
      <AlertDialog open={showStartOverConfirm} onOpenChange={setShowStartOverConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start over?</AlertDialogTitle>
            <AlertDialogDescription>
              This will abandon your current conversation and start fresh. Your messages will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartOver}>
              Start over
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish confirmation dialog */}
      <AlertDialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {messages.filter(m => m.role === 'user').length <= 2
                ? 'Finish so soon?'
                : 'Ready to generate your strategy?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {messages.filter(m => m.role === 'user').length <= 2
                ? "You've only shared a couple of thoughts. A few more turns usually leads to much better output. Want to keep going?"
                : "I'll extract the key insights from our conversation and generate your first strategy. Future conversations will continue in the side panel."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep chatting</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              getStatsigClient()?.logEvent('cta_generate_strategy', 'inline-chat', { projectId })
              setShowFinishConfirm(false)
              handleExtract()
            }}>
              {messages.filter(m => m.role === 'user').length <= 2 ? 'Finish anyway' : 'Generate strategy'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
