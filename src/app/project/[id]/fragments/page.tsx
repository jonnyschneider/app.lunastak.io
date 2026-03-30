'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { FragmentExplorer } from '@/components/FragmentExplorer'
import { ChatSheet } from '@/components/chat-sheet'
import { Button } from '@/components/ui/button'

export default function FragmentsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const dimensionFilter = searchParams.get('dimension') || undefined

  // Chat sheet for resume-conversation from fragment source links
  const [chatSheetOpen, setChatSheetOpen] = useState(false)
  const [chatResumeConversationId, setChatResumeConversationId] = useState<string | undefined>()

  return (
    <AppLayout>
      {/* Context header */}
      <div className="bg-primary/5 border-b border-primary/10 px-6 py-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Navigate back to project page, knowledgebase tab
            localStorage.setItem(`project-${projectId}-tab`, 'knowledgebase')
            router.push(`/project/${projectId}`)
          }}
        >
          &larr; Back to Knowledgebase
        </Button>
      </div>

      <div className="container mx-auto px-6 py-6">
        <FragmentExplorer
          projectId={projectId}
          initialDimensionFilter={dimensionFilter}
          onResumeConversation={(convId) => {
            setChatResumeConversationId(convId)
            setChatSheetOpen(true)
          }}
        />
      </div>

      <ChatSheet
        projectId={projectId}
        open={chatSheetOpen}
        onOpenChange={(open) => {
          setChatSheetOpen(open)
          if (!open) setChatResumeConversationId(undefined)
        }}
        resumeConversationId={chatResumeConversationId}
      />
    </AppLayout>
  )
}
