'use client'

import { Loader2 } from 'lucide-react'
import { useGenerationStatusContext } from '@/components/providers/BackgroundTaskProvider'
import { useDocumentProcessingContext } from '@/components/providers/DocumentProcessingProvider'

interface StatusBannerProps {
  projectId: string
}

export function StatusBanner({ projectId }: StatusBannerProps) {
  const { activeTasks, getProgressLabel } = useGenerationStatusContext()
  const { isProcessing, processingCount } = useDocumentProcessingContext()

  // Find active tasks for this project
  const projectTasks = activeTasks.filter(t => t.projectId === projectId && t.status === 'running')
  const isProcessingDocs = isProcessing(projectId)

  // Build message
  let message: string | null = null

  if (projectTasks.length > 0) {
    const task = projectTasks[0] // Show the first/most recent
    const label = getProgressLabel(projectId)
    message = label || task.messaging.running
  } else if (isProcessingDocs) {
    const count = processingCount(projectId)
    message = count > 1 ? `Processing ${count} documents...` : 'Processing document...'
  }

  if (!message) return null

  return (
    <div className="bg-primary px-6 py-2 flex items-center justify-center gap-2">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />
      <span className="text-sm text-white/90">{message}</span>
    </div>
  )
}
