'use client'

import { MessageSquare, Upload } from 'lucide-react'

interface ProjectEmptyStateProps {
  projectId: string
  onStartConversation: () => void
  onUploadDocument: () => void
}

export function ProjectEmptyState({
  projectId,
  onStartConversation,
  onUploadDocument,
}: ProjectEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-md text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Let's build your strategy
          </h1>
          <p className="text-muted-foreground">
            Start a conversation with Luna or upload an existing document to begin.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <button
            onClick={onStartConversation}
            className="flex flex-col items-center text-center p-6 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors"
          >
            <MessageSquare className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-medium text-foreground mb-2">
              Start a Conversation
            </h3>
            <p className="text-sm text-muted-foreground">
              Answer a few questions to help Luna understand your business
            </p>
          </button>

          <button
            onClick={onUploadDocument}
            className="flex flex-col items-center text-center p-6 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors"
          >
            <Upload className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-medium text-foreground mb-2">
              Upload a Document
            </h3>
            <p className="text-sm text-muted-foreground">
              Start with an existing strategy doc or business plan
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
