'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

/**
 * Global provider that handles transferring guest sessions to authenticated users.
 * This runs on any page, so the transfer happens regardless of where the magic link returns to.
 * Shows a loading state while transfer is in progress to prevent permission error flash.
 */
export function SessionTransferProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const hasTransferred = useRef(false)
  const [isTransferring, setIsTransferring] = useState(false)

  useEffect(() => {
    const transferSession = async () => {
      // Only run once per session
      if (hasTransferred.current) return

      // Wait until session is loaded and user is authenticated
      if (status !== 'authenticated' || !session?.user?.id) return

      hasTransferred.current = true
      setIsTransferring(true)
      console.log('[SessionTransfer] Checking for guest session to transfer...')

      try {
        // Server reads guestUserId from httpOnly cookie
        const response = await fetch('/api/transfer-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })

        if (response.ok) {
          console.log('[SessionTransfer] Session transfer complete')

          // Notify components to refresh their data (softer than full reload)
          window.dispatchEvent(new Event('strategySaved'))

          // Use router.refresh() for soft refresh - re-runs server components
          // without full page reload. Much less jarring than window.location.reload()
          router.refresh()
        } else {
          console.error('[SessionTransfer] Transfer failed:', await response.text())
          hasTransferred.current = false // Allow retry
        }
      } catch (error) {
        console.error('[SessionTransfer] Failed to transfer session:', error)
        hasTransferred.current = false // Allow retry
      } finally {
        setIsTransferring(false)
      }
    }

    transferSession()
  }, [session, status, router])

  // Show loading state while transferring to prevent permission error flash
  if (isTransferring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
