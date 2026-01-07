'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

/**
 * Global provider that handles transferring guest sessions to authenticated users.
 * This runs on any page, so the transfer happens regardless of where the magic link returns to.
 */
export function SessionTransferProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
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
      }
    }

    transferSession()
  }, [session, status, router])

  return <>{children}</>
}
