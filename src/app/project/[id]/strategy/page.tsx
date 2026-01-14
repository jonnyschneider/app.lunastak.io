'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Target,
  Loader2,
  Brain,
} from 'lucide-react'

interface StrategyRedirectData {
  latestTraceId: string | null
  projectName: string
  thinkingCount: number
}

export default function StrategyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const [data, setData] = useState<StrategyRedirectData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    // Don't redirect to signin - guests can access projects via cookie
    // The API will return 401 if unauthorized
    fetchLatestStrategy()
  }, [status, projectId])

  const fetchLatestStrategy = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/project/${projectId}/strategy`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found')
        }
        throw new Error('Failed to fetch strategy')
      }
      const result = await response.json()
      setData(result)

      // If we have a strategy, redirect to the full view
      if (result.latestTraceId) {
        router.replace(`/strategy/${result.latestTraceId}`)
      }
    } catch (err) {
      console.error('Error fetching strategy:', err)
      setError(err instanceof Error ? err.message : 'Failed to load strategy')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchLatestStrategy} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Empty state - no strategy generated yet
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Current Strategy: Decision Stack
          </h1>
          <p className="text-muted-foreground">
            Your current strategic direction
          </p>
        </div>

        {/* Empty State */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No strategy generated yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              {data?.thinkingCount && data.thinkingCount > 0
                ? `You have ${data.thinkingCount} fragments of context. Start a conversation to generate your strategy.`
                : 'Have conversations and add context in your Thinking space, then generate your strategy.'}
            </p>
            <Button asChild>
              <Link href={`/project/${projectId}`}>
                <Brain className="h-4 w-4 mr-2" />
                Go to Thinking
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
