'use client'

import { useState } from 'react'

interface RegistrationBannerProps {
  guestUserId: string
  onDismiss: () => void
}

export function RegistrationBanner({ guestUserId, onDismiss }: RegistrationBannerProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      // Store guest user ID in localStorage for session transfer after authentication
      localStorage.setItem('guestUserId', guestUserId)

      // Use double opt-in flow via /api/subscribe
      // This adds the email to the marketing list and sends a confirmation email
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setEmailSent(true)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to send confirmation. Please try again.')
      }
    } catch (err) {
      console.error('Failed to subscribe:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="bg-muted border-l-4 border-primary p-4 mb-6 rounded-r-lg">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground">
              Check your email
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We've sent a confirmation email to <strong>{email}</strong>. Click the link to verify your email and save your strategy.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="ml-4 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-muted border-l-4 border-primary p-4 mb-6 rounded-r-lg">
      <div className="flex items-start">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-foreground">
            Save your strategy
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email to save this strategy and access it anytime.
          </p>
          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
          <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Sending...' : 'Send Link'}
            </button>
          </form>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
