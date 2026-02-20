'use client'

import { useState, useEffect } from 'react'
import { Upload, KeySquare, Loader2, Blocks } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { InlineChat } from '@/components/InlineChat'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'
import { getStatsigClient } from '@/components/StatsigProvider'

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
        // Navigate to strategy view so users see the output, not just inputs
        if (data.latestTraceId) {
          router.push(`/strategy/${data.latestTraceId}`)
        } else {
          router.push(`/project/${data.projectId}/strategy`)
        }
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
        {/* Header — collapses away once chat starts */}
        <div className={`text-center space-y-2 overflow-hidden transition-all duration-500 ease-in-out ${chatStarted ? 'max-h-0 opacity-0 py-0' : 'max-h-40'}`}>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hi, I'm Luna. Let's clarify your strategic thinking.
          </h1>
          {!chatStarted && (
            <p className="text-muted-foreground">
              Start a conversation, upload an existing doc, or fill in your Decision Stack directly.
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
          <TooltipProvider delayDuration={300}>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  getStatsigClient()?.logEvent('cta_upload_doc', 'first-time', { projectId })
                  setUploadDialogOpen(true)
                }}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload a document
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => {
                      getStatsigClient()?.logEvent('cta_build_strategy', 'first-time', { projectId })
                      router.push(`/project/${projectId}/template`)
                    }}
                    className="flex items-center gap-2"
                  >
                    <Blocks className="h-4 w-4" />
                    Build my Decision Stack
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Fill in your vision, strategy, objectives and principles directly
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => {
                      getStatsigClient()?.logEvent('cta_demo_peek', 'first-time')
                      setDemoDialogOpen(true)
                    }}
                    disabled={isLoadingDemo}
                    className="flex items-center gap-2 bg-[hsl(41_60%_58%/0.1)] border-[hsl(41_60%_58%/0.3)] hover:bg-[hsl(41_60%_58%/0.18)]"
                  >
                    {isLoadingDemo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeySquare className="h-4 w-4 text-[hsl(41_60%_58%)]" />
                    )}
                    {isLoadingDemo ? 'Setting up demo...' : "Peek into Luna's Strategy"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  See Lunastak's real strategy, created by Luna
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
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
            <AlertDialogTitle>Peek into Luna's Strategy?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This creates a demo project built on Lunastak's real Decision Stack — our actual vision, strategy, and objectives. See how Luna works when there's existing content.
              </p>
              <p>
                You can interact with it, continue conversations, or delete it any time. Your own project stays separate and safe.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              getStatsigClient()?.logEvent('cta_demo_confirm', 'first-time')
              handleCreateDemo()
            }}>
              Let me in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
