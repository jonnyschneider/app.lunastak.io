'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AppLayout } from '@/components/layout/app-layout'
import StrategyDisplay from '@/components/StrategyDisplay'
import { GuestSaveBanner } from '@/components/GuestSaveBanner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StrategyStatements, ExtractedContextVariant } from '@/lib/types'
import { LunasThinking } from '@/components/LunasThinking'

export default function StrategyViewPage() {
  const params = useParams()
  const router = useRouter()
  const traceId = params.traceId as string

  const [strategy, setStrategy] = useState<StrategyStatements | null>(null)
  const [extractedContext, setExtractedContext] = useState<ExtractedContextVariant | null>(null)
  const [thoughts, setThoughts] = useState<string>('')
  const [conversationId, setConversationId] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      setThoughts(data.claudeThoughts || '')
      setConversationId(data.conversationId)
      setProjectId(data.projectId || '')
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
          {/* Line-style tabs */}
          <TabsList className="h-10 w-full justify-center bg-transparent p-0 gap-8 border-b">
            <TabsTrigger
              value="strategy"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Your Strategy
            </TabsTrigger>
            <TabsTrigger
              value="thinking"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Luna&apos;s Thinking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strategy" className="mt-8">

            {/* Decision Stack Card */}
            <div className="max-w-6xl mx-auto rounded-lg overflow-hidden border border-border shadow-sm">
              {/* Branded Header */}
              <div className="bg-[#0A2933] p-8">
                <div className="flex items-center justify-between">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/Decision Stack Logo.svg"
                    alt="Decision Stack"
                    className="h-16"
                  />
                  <a
                    href="https://www.thedecisionstack.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E0FF4F] text-sm hover:text-white transition-colors"
                  >
                    Learn more about The Decision Stack →
                  </a>
                </div>
              </div>

              {/* Strategy Content */}
              <div className="bg-[#EEF8FC] p-6">
                {timestamp && (
                  <p className="text-center text-xs text-gray-400 mb-6">
                    Generated {new Date(timestamp).toLocaleDateString()}
                  </p>
                )}
                {strategy && conversationId && projectId && (
                  <StrategyDisplay
                    strategy={strategy}
                    conversationId={conversationId}
                    traceId={traceId}
                    projectId={projectId}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="thinking" className="mt-8">
            <LunasThinking
              extractedContext={extractedContext}
              thoughts={thoughts}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
