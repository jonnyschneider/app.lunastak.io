'use client'

import { Loader2 } from 'lucide-react'
import { useGenerationStatusContext } from '@/components/providers/BackgroundTaskProvider'

interface StatusBannerProps {
  projectId: string
}

export function StatusBanner({ projectId }: StatusBannerProps) {
  const { activeTasks, getProgressLabel, runningCount } = useGenerationStatusContext()

  // Documents used to be a second source here, read from a second provider. They are ordinary
  // background tasks now, so one branch covers every kind — except the plural case, which is the
  // one thing a single task's `running` copy cannot say for itself.
  const projectTasks = activeTasks.filter(t => t.projectId === projectId && t.status === 'running')

  let message: string | null = null

  if (projectTasks.length > 0) {
    const docs = runningCount(projectId, 'document')
    if (docs > 1) {
      message = `Reading ${docs} documents...`
    } else {
      message = getProgressLabel(projectId) || projectTasks[0].messaging.running
    }
  }

  if (!message) return null

  return (
    <div className="sticky top-[6.25rem] md:top-14 z-40 bg-[#c74188]/85 backdrop-blur-sm px-6 py-2 flex items-center justify-center gap-2">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />
      <span className="text-sm text-white/90">{message}</span>
    </div>
  )
}
