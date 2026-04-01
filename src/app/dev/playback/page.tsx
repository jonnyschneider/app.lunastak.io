'use client'

import { useState, useEffect, useRef } from 'react'

const conversation = [
  {
    role: 'assistant',
    content:
      "Hey! Tell me about what you're building. What's the problem you're solving and who's it for?",
  },
  {
    role: 'user',
    content:
      "We're building BuildFlow - project management software for custom home builders. Think small to mid-sized builders doing 5-50 homes a year.\n\nThese builders are running $3M-$15M businesses with maybe 3-10 employees, and they're managing everything through spreadsheets, group texts, and whiteboards. Every custom home has hundreds of decisions - cabinets, flooring, fixtures, paint colors - and keeping track of what's been selected, ordered, and installed is a nightmare.",
  },
  {
    role: 'assistant',
    content:
      "That selection coordination problem is super tangible - I can picture the chaos. You mentioned Buildertrend tries to do everything. What specifically makes it overwhelming for your target builders? Is it the learning curve, the feature bloat, or something about how it's designed?",
  },
  {
    role: 'user',
    content:
      "It's all of those, honestly. Buildertrend was built for production builders doing the same floor plan over and over. Custom home builders are the opposite - every project is unique.\n\nSo you've got this powerful system with 100 features, but 80 of them don't apply. They spend hours trying to configure it, get frustrated, and eventually just use 10% of it while still doing the rest in spreadsheets.\n\nWe're taking the opposite approach. Start with the homeowner experience and work backward.",
  },
  {
    role: 'assistant',
    content:
      "That 'start with the homeowner experience' insight is interesting positioning. How do you think about the relationship between BuildFlow and the builder's existing subcontractors? Does BuildFlow enhance those relationships or potentially feel like you're inserting yourself into them?",
  },
  {
    role: 'user',
    content:
      "We're very intentional about not trying to replace those relationships. The subs don't need another app to log into.\n\nWhen a selection is made that affects a sub's work, they get a simple notification with exactly what they need to know. They can reply by text if there's an issue. We're not asking them to adopt a new workflow - we're just making sure they have the right information at the right time.",
  },
]

// Timing: how long each message takes to "appear" (ms)
const TYPING_DELAY = 1200 // typing indicator visible
const USER_PAUSE = 800 // pause before user starts typing
const ASSISTANT_PAUSE = 600 // pause before assistant starts typing
const INITIAL_DELAY = 1500 // delay before first message

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-lg p-4 bg-muted">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

export default function PlaybackPage() {
  const [visibleMessages, setVisibleMessages] = useState<number>(0)
  const [showTyping, setShowTyping] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 4>(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [visibleMessages, showTyping])

  function showNextMessage(index: number, multiplier: number) {
    if (index >= conversation.length) {
      setIsPlaying(false)
      setShowTyping(false)
      return
    }

    const msg = conversation[index]
    const pause = msg.role === 'user' ? USER_PAUSE : ASSISTANT_PAUSE

    // Show typing indicator
    setShowTyping(true)
    timeoutRef.current = setTimeout(() => {
      // Show the message
      setShowTyping(false)
      setVisibleMessages(index + 1)

      // Schedule next
      const readTime = Math.min(
        Math.max(msg.content.length * 8, 1500),
        4000,
      )
      timeoutRef.current = setTimeout(
        () => showNextMessage(index + 1, multiplier),
        (readTime + pause) / multiplier,
      )
    }, TYPING_DELAY / multiplier)
  }

  function play() {
    setIsPlaying(true)
    const startFrom = visibleMessages >= conversation.length ? 0 : visibleMessages
    if (startFrom === 0) setVisibleMessages(0)

    timeoutRef.current = setTimeout(
      () => showNextMessage(startFrom, speed),
      INITIAL_DELAY / speed,
    )
  }

  function pause() {
    setIsPlaying(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  function reset() {
    pause()
    setVisibleMessages(0)
    setShowTyping(false)
  }

  function stepForward() {
    if (visibleMessages < conversation.length) {
      setShowTyping(false)
      setVisibleMessages((v) => v + 1)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Controls */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <h1 className="text-sm font-medium mr-4">Conversation Playback</h1>
        <button
          onClick={isPlaying ? pause : play}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md"
        >
          {isPlaying ? 'Pause' : visibleMessages >= conversation.length ? 'Replay' : 'Play'}
        </button>
        <button
          onClick={stepForward}
          disabled={isPlaying || visibleMessages >= conversation.length}
          className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-30"
        >
          Step →
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 text-sm border rounded-md"
        >
          Reset
        </button>
        <div className="ml-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Speed:</span>
          {([1, 2, 4] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs ${
                speed === s
                  ? 'bg-primary text-primary-foreground'
                  : 'border'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {visibleMessages} / {conversation.length} messages
        </span>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {conversation.slice(0, visibleMessages).map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          {showTyping && <TypingIndicator />}
        </div>
      </div>
    </div>
  )
}
