'use client'

import { useState, useEffect } from 'react'
import { Upload, Info, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { InlineChat } from '@/components/InlineChat'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'

interface FirstTimeEmptyStateProps {
  projectId: string
  resumeConversationId?: string
  onUploadComplete?: () => void
}

export function FirstTimeEmptyState({ projectId, resumeConversationId, onUploadComplete }: FirstTimeEmptyStateProps) {
  const router = useRouter()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [demoDialogOpen, setDemoDialogOpen] = useState(false)
  const [isLoadingDemo, setIsLoadingDemo] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  // Auto-expand chat if resuming a conversation
  useEffect(() => {
    if (resumeConversationId) {
      setChatStarted(true)
    }
  }, [resumeConversationId])

  const handleCreateDemo = async () => {
    setDemoDialogOpen(false)
    setIsLoadingDemo(true)
    try {
      const response = await fetch('/api/demo/create', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        // Navigate to demo project
        router.push(`/project/${data.projectId}`)
      }
    } catch (error) {
      console.error('Failed to create demo:', error)
    } finally {
      setIsLoadingDemo(false)
    }
  }

  const handleUploadComplete = (fileName?: string) => {
    setUploadDialogOpen(false)
    if (fileName) {
      setUploadedFileName(fileName)
      setChatStarted(true)
      // Don't call onUploadComplete here - it would refresh data and kick us out
      // of FirstTimeEmptyState. Data will refresh when conversation completes.
    } else {
      // No file name means upload failed or was cancelled - refresh data
      onUploadComplete?.()
    }
  }

  return (
    <div className={`flex flex-col px-6 ${chatStarted ? 'h-[calc(100vh-4rem)]' : 'min-h-[60vh] justify-center'}`}>
      <div className={`max-w-xl w-full mx-auto ${chatStarted ? 'flex flex-col flex-1 min-h-0' : 'space-y-6'}`}>
        {/* Header */}
        <div className={`text-center space-y-2 ${chatStarted ? 'shrink-0 pt-6 pb-4' : ''}`}>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hi, I'm Luna. Let's clarify your strategic thinking.
          </h1>
          {!chatStarted && (
            <p className="text-muted-foreground">
              To start, tell me about your strategic challenge, upload an existing doc and we can
              brainstorm from there, or check out an example to see what the output looks like.
            </p>
          )}
        </div>

        {/* Inline Chat */}
        <div className={chatStarted || resumeConversationId ? 'flex-1 min-h-0' : ''}>
          <InlineChat
            key={resumeConversationId || uploadedFileName || 'default'}
            projectId={projectId}
            resumeConversationId={resumeConversationId}
            initialMessage={uploadedFileName ? `I've uploaded ${uploadedFileName}. Let's discuss it.` : undefined}
            autoStart={!!uploadedFileName}
            onConversationStart={() => setChatStarted(true)}
          />
        </div>

        {/* Action buttons - hide once chat started */}
        {!chatStarted && (
          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload a document
            </Button>
            <Button
              variant="outline"
              onClick={() => setDemoDialogOpen(true)}
              disabled={isLoadingDemo}
              className="flex items-center gap-2"
            >
              {isLoadingDemo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              {isLoadingDemo ? 'Setting up demo...' : 'See demo project'}
            </Button>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        projectId={projectId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
      />

      {/* Demo Project Dialog */}
      <AlertDialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create a demo project?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will create a new demo project in your account so you can see how Luna works when there's existing content.
              </p>
              <p>
                You can interact with it (add more chats, upload documents, etc.) or delete it at any time. Your own project will be maintained separately and is safe.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateDemo}>
              Create demo project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
