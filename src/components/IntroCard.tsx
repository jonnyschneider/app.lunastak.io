'use client'

import { Button } from '@/components/ui/button'

interface IntroCardProps {
  onStartClick: () => void
  isLoading?: boolean
}

export function IntroCard({ onStartClick, isLoading = false }: IntroCardProps) {
  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Assistant intro message bubble */}
        <div className="flex justify-start">
          <div className="max-w-[80%] bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg p-4">
            <p className="whitespace-pre-wrap">
              I help founders and business leaders clarify their strategic thinking.
              {'\n\n'}
              Through a short conversation, I'll help you articulate your vision, mission, and strategic objectives.
              {'\n\n'}
              Ready when you are.
            </p>
          </div>
        </div>

        {/* Thinking state or button */}
        {isLoading ? (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 dark:text-zinc-400">Thinking...</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-start">
            <button
              onClick={onStartClick}
              className="px-6 py-3 border border-zinc-800 dark:border-zinc-300 text-zinc-800 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              let's begin
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
