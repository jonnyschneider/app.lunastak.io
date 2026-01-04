'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import StrategyDisplay from '@/components/StrategyDisplay'
import { StrategyStatements } from '@/lib/types'

export default function StrategyViewPage() {
  const params = useParams()
  const router = useRouter()
  const traceId = params.traceId as string

  const [strategy, setStrategy] = useState<StrategyStatements | null>(null)
  const [thoughts, setThoughts] = useState<string>('')
  const [conversationId, setConversationId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStrategy()
  }, [traceId])

  const fetchStrategy = async () => {
    setIsLoading(true)
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
      setThoughts(data.claudeThoughts || '')
      setConversationId(data.conversationId)
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
      <main className="h-screen bg-background flex flex-col">
        <div className="container mx-auto py-8 flex-1 flex flex-col">
          {strategy && conversationId && (
            <StrategyDisplay
              strategy={strategy}
              thoughts={thoughts}
              conversationId={conversationId}
              traceId={traceId}
            />
          )}
        </div>
      </main>
    </AppLayout>
  )
}
