'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * A cookieless visitor to `/` becomes a guest here, in the browser — see `api/guest/init` for why
 * it isn't a server redirect. No AppLayout: its data calls would all 401 until the cookie exists.
 */
export function GuestStart() {
  const router = useRouter()
  const started = useRef(false) // StrictMode runs effects twice in dev; one visitor, one guest
  const [failed, setFailed] = useState(false)

  const start = async () => {
    setFailed(false)
    try {
      const res = await fetch('/api/guest/init', { method: 'POST' })
      if (!res.ok) throw new Error(`guest/init ${res.status}`)
      const { projectId } = await res.json()
      router.replace(`/project/${projectId}`)
    } catch (error) {
      console.error('[GuestStart] Failed:', error)
      setFailed(true)
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      {failed ? (
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground">Something went wrong getting started.</p>
          <Button onClick={start}>Try again</Button>
        </div>
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
