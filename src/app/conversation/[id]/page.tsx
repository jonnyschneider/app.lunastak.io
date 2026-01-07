'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Calendar, MessageSquare, Target } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  stepNumber: number
  createdAt: string
}

interface ConversationData {
  id: string
  projectId: string
  projectName: string
  status: string
  createdAt: string
  messages: Message[]
  fragmentCount: number
  hasGeneratedOutput: boolean
}

export default function ConversationDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const conversationId = params.id as string
  const [conversationData, setConversationData] = useState<ConversationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    fetchConversationData()
  }, [session, status, router, conversationId])

  const fetchConversationData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/conversation/${conversationId}/detail`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Conversation not found')
        }
        throw new Error('Failed to fetch conversation')
      }
      const data = await response.json()
      setConversationData(data)
    } catch (err) {
      console.error('Error fetching conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
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
        <div className="container mx-auto py-8">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/project/${conversationData?.projectId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Conversation</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {conversationData && new Date(conversationData.createdAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {conversationData?.fragmentCount !== undefined && conversationData.fragmentCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Target className="h-3 w-3" />
                {conversationData.fragmentCount} fragments
              </Badge>
            )}
            <Badge variant={conversationData?.status === 'completed' ? 'default' : 'secondary'}>
              {conversationData?.status}
            </Badge>
          </div>
        </div>

        {/* Messages */}
        <div className="max-w-3xl mx-auto space-y-4">
          {conversationData?.messages.map((message) => (
            <div key={message.id}>
              <div
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="max-w-3xl mx-auto pt-6 border-t">
          <div className="flex items-center justify-between">
            <Link href={`/project/${conversationData?.projectId}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
            </Link>
            {conversationData?.hasGeneratedOutput && (
              <Link href={`/?stub=${conversationId}&stubView=strategy`}>
                <Button>
                  View Generated Strategy
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
