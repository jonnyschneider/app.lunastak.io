'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Global provider that handles transferring guest sessions to authenticated users.
 * This runs on any page, so the transfer happens regardless of where the magic link returns to.
 */
export function SessionTransferProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const hasTransferred = useRef(false)

  useEffect(() => {
    const transferSession = async () => {
      // Only run once per session
      if (hasTransferred.current) return

      // Wait until session is loaded and user is authenticated
      if (status !== 'authenticated' || !session?.user?.id) return

      const guestUserId = localStorage.getItem('guestUserId')
      if (!guestUserId) return

      hasTransferred.current = true
      console.log('[SessionTransfer] Transferring guest session:', guestUserId)

      try {
        const response = await fetch('/api/transfer-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestUserId }),
        })

        if (response.ok) {
          console.log('[SessionTransfer] Session transferred successfully')
          localStorage.removeItem('guestUserId')

          // Notify sidebar to refresh strategies list
          window.dispatchEvent(new Event('strategySaved'))

          // Force a page refresh to ensure all UI is updated with new ownership
          // This is a bit heavy-handed but ensures consistency
          window.location.reload()
        } else {
          console.error('[SessionTransfer] Transfer failed:', await response.text())
          hasTransferred.current = false // Allow retry
        }
      } catch (error) {
        console.error('[SessionTransfer] Failed to transfer session:', error)
        hasTransferred.current = false // Allow retry
      }
    }

    transferSession()
  }, [session, status])

  return <>{children}</>
}
