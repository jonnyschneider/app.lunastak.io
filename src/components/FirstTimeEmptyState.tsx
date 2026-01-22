'use client'

import { useState } from 'react'
import { Upload, Info, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InlineChat } from '@/components/InlineChat'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'

interface FirstTimeEmptyStateProps {
  projectId: string
  onUploadComplete?: () => void
}

export function FirstTimeEmptyState({ projectId, onUploadComplete }: FirstTimeEmptyStateProps) {
  const router = useRouter()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [isLoadingDemo, setIsLoadingDemo] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  const handleSeeExample = async () => {
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hi, I'm Luna. Let's clarify your strategic thinking.
          </h1>
          <p className="text-muted-foreground">
            To start, tell me about your strategic challenge, upload an existing doc and we can
            brainstorm from there, or check out an example to see what the output looks like.
          </p>
        </div>

        {/* Inline Chat */}
        <InlineChat
          key={uploadedFileName || 'default'}
          projectId={projectId}
          initialMessage={uploadedFileName ? `I've uploaded ${uploadedFileName}. Let's discuss it.` : undefined}
          autoStart={!!uploadedFileName}
          onConversationStart={() => setChatStarted(true)}
        />

        {/* Action buttons - hide once chat started */}
        {!chatStarted && (
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload existing doc
            </Button>
            <Button
              variant="outline"
              onClick={handleSeeExample}
              disabled={isLoadingDemo}
              className="flex items-center gap-2"
            >
              {isLoadingDemo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              {isLoadingDemo ? 'Setting up example...' : 'See an example'}
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
    </div>
  )
}
