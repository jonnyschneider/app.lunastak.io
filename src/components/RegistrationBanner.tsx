'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

interface RegistrationBannerProps {
  guestUserId: string
  onDismiss: () => void
}

export function RegistrationBanner({ guestUserId, onDismiss }: RegistrationBannerProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Store guest user ID in localStorage before signing in
      // This will be used to transfer the session after authentication
      localStorage.setItem('guestUserId', guestUserId)

      await signIn('email', { email, redirect: false })
      setEmailSent(true)
    } catch (error) {
      console.error('Failed to send magic link:', error)
      alert('Failed to send magic link. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="bg-zinc-100 dark:bg-zinc-800 border-l-4 border-zinc-400 dark:border-zinc-600 p-4 mb-6 rounded-r-lg">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Check your email
            </h3>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              We've sent a magic link to <strong>{email}</strong>. Click the link to sign in and save your strategy.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="ml-4 text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 border-l-4 border-zinc-400 dark:border-zinc-600 p-4 mb-6 rounded-r-lg">
      <div className="flex items-start">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Save your strategy
          </h3>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Enter your email to save this strategy and access it anytime.
          </p>
          <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Sending...' : 'Send Link'}
            </button>
          </form>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
