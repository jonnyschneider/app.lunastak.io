'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { FragmentExplorer } from '@/components/FragmentExplorer'
import { ChatSheet } from '@/components/chat-sheet'
import { useHeaderTabNav } from '@/components/HeaderContext'

export default function FragmentsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const dimensionFilter = searchParams.get('dimension') || undefined

  const [chatSheetOpen, setChatSheetOpen] = useState(false)
  const [chatResumeConversationId, setChatResumeConversationId] = useState<string | undefined>()

  // Inject breadcrumb into header
  const { setTabNav } = useHeaderTabNav()
  useEffect(() => {
    setTabNav(
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => {
            localStorage.setItem(`project-${projectId}-tab`, 'knowledgebase')
            router.push(`/project/${projectId}`)
          }}
          className="hover:text-foreground transition-colors"
        >
          Knowledgebase
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Fragments</span>
      </div>
    )
    return () => setTabNav(null)
  }, [projectId, router, setTabNav])

  return (
    <AppLayout>
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
