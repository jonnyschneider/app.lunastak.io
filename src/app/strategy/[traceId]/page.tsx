'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AppLayout } from '@/components/layout/app-layout'
import StrategyDisplay from '@/components/StrategyDisplay'
import { GuestSaveBanner } from '@/components/GuestSaveBanner'
import { Button } from '@/components/ui/button'
import { StrategyStatements } from '@/lib/types'

export default function StrategyViewPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const traceId = params.traceId as string

  const [strategy, setStrategy] = useState<StrategyStatements | null>(null)
  const [extractedContext, setExtractedContext] = useState<Record<string, unknown> | null>(null)
  const [conversationId, setConversationId] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')
  const [isDemo, setIsDemo] = useState(false)
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const readOnly = isDemo || searchParams.get('readonly') === 'true'

  const { data: session } = useSession()
  const isGuest = !session

  useEffect(() => {
    fetchStrategy()

    // Re-fetch when session transfer completes (guest → authenticated)
    const handleStrategySaved = () => {
      console.log('[StrategyPage] Refreshing after session transfer')
      fetchStrategy()
    }
    window.addEventListener('strategySaved', handleStrategySaved)
    return () => window.removeEventListener('strategySaved', handleStrategySaved)
  }, [traceId])

  const fetchStrategy = async () => {
    setIsLoading(true)
    setError(null) // Clear previous error on retry
    try {
      const response = await fetch(`/api/trace/${traceId}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Strategy not found')
        } else if (response.status === 403) {
          setError('You do not have permission to view this strategy')
        } else {
          setError('Failed to load strategy')
        }
        return
      }

      const data = await response.json()
      setStrategy(data.output)
      setExtractedContext(data.extractedContext || null)
      setConversationId(data.conversationId)
      setProjectId(data.projectId || '')
      setIsDemo(data.isDemo || false)
      setTimestamp(data.timestamp)
    } catch (error) {
      console.error('Failed to fetch strategy:', error)
      setError('Failed to load strategy')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <main className="h-screen bg-background flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </main>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <main className="h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="text-primary hover:text-primary/80"
            >
              Return to home
            </button>
          </div>
        </main>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Context header */}
      {projectId && (
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/project/${projectId}`)}
          >
            &larr; Back to Decision Stack
          </Button>
          <span className="text-xs text-muted-foreground">
            {timestamp && new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      )}
      <div className="container mx-auto px-6 py-6">
        {/* Guest Save Banner - above tabs */}
        {isGuest && <GuestSaveBanner />}

        <div className="max-w-6xl mx-auto">
          {strategy && conversationId && projectId && (
            <StrategyDisplay
              strategy={strategy}
              conversationId={conversationId}
              traceId={traceId}
              projectId={projectId}
              onUpdate={setStrategy}
              readOnly={readOnly}
            />
          )}
        </div>
      </div>
    </AppLayout>
  )
}
