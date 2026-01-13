'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Target,
  Loader2,
  Brain,
  RefreshCw,
} from 'lucide-react'

interface StrategyOutput {
  id: string
  createdAt: string
  vision: string | null
  strategy: string | null
  objectives: Array<{
    id: string
    title: string
    description: string
    timeframe: string | null
    direction: string | null
    targetMetric: string | null
  }>
}

interface ProjectStrategy {
  id: string
  name: string
  latestStrategy: StrategyOutput | null
  hasNewThinking: boolean
  thinkingCount: number
}

export default function StrategyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const [data, setData] = useState<ProjectStrategy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    fetchStrategy()
  }, [session, status, router, projectId])

  const fetchStrategy = async () => {
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
            <Button onClick={fetchStrategy} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const strategy = data?.latestStrategy

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {data?.name || 'Strategy'}
            </h1>
            <p className="text-muted-foreground">
              Your current strategic direction
            </p>
          </div>
          {data?.hasNewThinking && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <RefreshCw className="h-3 w-3 mr-1" />
              New thinking available
            </Badge>
          )}
        </div>

        {strategy ? (
          <div className="space-y-6">
            {/* Vision */}
            {strategy.vision && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Vision</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg leading-relaxed">{strategy.vision}</p>
                </CardContent>
              </Card>
            )}

            {/* Strategy */}
            {strategy.strategy && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed whitespace-pre-wrap">{strategy.strategy}</p>
                </CardContent>
              </Card>
            )}

            {/* Objectives */}
            {strategy.objectives && strategy.objectives.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Objectives</CardTitle>
                  <CardDescription>
                    {strategy.objectives.length} objective{strategy.objectives.length !== 1 ? 's' : ''} defined
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {strategy.objectives.map((obj, index) => (
                    <div key={obj.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {index + 1}.
                        </span>
                        <h4 className="font-medium">{obj.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{obj.description}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {obj.timeframe && <span>Timeframe: {obj.timeframe}</span>}
                        {obj.targetMetric && <span>Target: {obj.targetMetric}</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <div className="text-sm text-muted-foreground">
              Last generated: {new Date(strategy.createdAt).toLocaleDateString()}
              {' · '}
              <Link href={`/strategy/${strategy.id}`} className="text-primary hover:underline">
                View full details
              </Link>
            </div>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No strategy generated yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                Have conversations and add context in your Thinking space, then generate your strategy.
              </p>
              <Button asChild>
                <Link href={`/project/${projectId}`}>
                  <Brain className="h-4 w-4 mr-2" />
                  Go to Thinking
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
