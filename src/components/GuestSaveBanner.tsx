'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStatsigClient } from '@/components/StatsigProvider'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface GuestSaveBannerProps {
  onDismiss?: () => void
}

export function GuestSaveBanner({ onDismiss }: GuestSaveBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const handleSignIn = () => {
    getStatsigClient()?.logEvent('cta_create_account', 'guest-banner')
    signIn(undefined, { callbackUrl: window.location.href })
  }

  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between flex-1 ml-2">
        <span className="text-amber-800">
          Your strategy isn't saved yet. Create an account to keep your work.
        </span>
        <div className="flex items-center gap-2 ml-4">
          <Button
            size="sm"
            onClick={handleSignIn}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Create Account
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-amber-600" />
          </button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
