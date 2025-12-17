'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

interface FeedbackModalProps {
  traceId: string
  onClose: () => void
}

export function FeedbackModal({ traceId, onClose }: FeedbackModalProps) {
  const { data: session } = useSession()
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedback.trim()) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traceId,
          userId: session?.user?.id || null,
          responseText: feedback,
        }),
      })

      if (!response.ok) throw new Error('Failed to submit feedback')

      alert('Thank you for your feedback!')
      onClose()
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">We'd love your feedback</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          What could make this experience better? Any insights you share help us improve the tool.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Your thoughts..."
            rows={4}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 mb-4"
          />

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !feedback.trim()}
              className="px-4 py-2 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
