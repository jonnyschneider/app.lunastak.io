'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

interface RegistrationBannerProps {
  onDismiss: () => void
}

export function RegistrationBanner({ onDismiss }: RegistrationBannerProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
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
      <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r-lg">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-green-800">
              Check your email
            </h3>
            <p className="mt-2 text-sm text-green-700">
              We've sent a magic link to <strong>{email}</strong>. Click the link to sign in and save your strategy.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="ml-4 text-green-600 hover:text-green-800"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
      <div className="flex items-start">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Save your strategy
          </h3>
          <p className="mt-2 text-sm text-blue-700">
            Enter your email to save this strategy and access it anytime.
          </p>
          <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 transition"
            >
              {isSubmitting ? 'Sending...' : 'Send Link'}
            </button>
          </form>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 text-blue-600 hover:text-blue-800"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
