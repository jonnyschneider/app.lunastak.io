'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AppLayout } from '@/components/layout/app-layout'
import StrategyDisplay from '@/components/StrategyDisplay'
import { GuestSaveBanner } from '@/components/GuestSaveBanner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StrategyStatements } from '@/lib/types'
import { KnowledgeSnapshot } from '@/components/KnowledgeSnapshot'

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
      <div className="container mx-auto px-6 py-6">
        {/* Guest Save Banner - above tabs */}
        {isGuest && <GuestSaveBanner />}

        {/* Tabbed Content */}
        <Tabs defaultValue="strategy" className="w-full">
          {/* Header row: Tabs left, Logo right - constrained to match content */}
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center border-b">
              {/* Left: Tabs */}
              <TabsList className="h-10 bg-transparent p-0 gap-6">
                <TabsTrigger
                  value="strategy"
                  className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Your Strategy
                </TabsTrigger>
                <TabsTrigger
                  value="knowledge"
                  className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Knowledge Snapshot
                </TabsTrigger>
              </TabsList>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Right: Decision Stack logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Decision Stack Logo.svg"
                alt="Decision Stack"
                className="h-8"
              />
            </div>
          </div>

          <TabsContent value="strategy" className="mt-6">
            <div className="max-w-6xl mx-auto">
              {/* Strategy Content */}
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
          </TabsContent>

          <TabsContent value="knowledge" className="mt-8">
            <KnowledgeSnapshot
              extractedContext={extractedContext}
              timestamp={timestamp}
              projectId={projectId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
