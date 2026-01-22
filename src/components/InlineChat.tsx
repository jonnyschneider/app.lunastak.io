'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConversationPhase } from '@/lib/types'
import { ChatSheet } from '@/components/chat-sheet'

interface InlineMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

interface InlineChatProps {
  projectId: string
  initialMessage?: string
  onConversationStart?: (conversationId: string) => void
}

export function InlineChat({ projectId, initialMessage, onConversationStart }: InlineChatProps) {
  const [input, setInput] = useState(initialMessage || '')
  const [messages, setMessages] = useState<InlineMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL')

  // Transition to sheet for extraction
  const [showSheet, setShowSheet] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check if we should transition to sheet (ready for extraction)
  const shouldTransitionToSheet = currentPhase === 'EXTRACTION' ||
    messages.filter(m => m.role === 'user').length >= 3

  useEffect(() => {
    if (shouldTransitionToSheet && conversationId && !showSheet) {
      setShowSheet(true)
    }
  }, [shouldTransitionToSheet, conversationId, showSheet])

  const startConversation = async (firstMessage: string) => {
    setIsLoading(true)
    setIsExpanded(true)

    try {
      const response = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      const data = await response.json()
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
      setCurrentPhase(data.phase || 'QUESTIONING')

      // Send the user's first message
      await sendMessage(data.conversationId, firstMessage)
    } catch (error) {
      console.error('Failed to start conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (convId: string, content: string) => {
    // Add user message optimistically
    const userMessage: InlineMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/conversation/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          userResponse: content,
          currentPhase,
        }),
      })

      const data = await response.json()

      if (data.message) {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.message,
        }])
      }

      if (data.phase) {
        setCurrentPhase(data.phase)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // If transitioned to sheet, render sheet instead
  if (showSheet && conversationId) {
    return (
      <ChatSheet
        projectId={projectId}
        open={true}
        onOpenChange={() => {}}
        resumeConversationId={conversationId}
        hasExistingStrategy={false}
      />
    )
  }

  return (
    <div className={`transition-all duration-300 ${isExpanded ? 'min-h-[400px]' : ''}`}>
      {/* Messages area - only show when expanded */}
      {isExpanded && messages.length > 0 && (
        <div className="mb-4 space-y-4 max-h-[300px] overflow-y-auto">
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
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="relative">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell me about your strategic challenge..."
          className="min-h-[80px] pr-12 resize-none"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="icon"
          className="absolute bottom-2 right-2"
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
