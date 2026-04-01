'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { GenerationStatus } from '@/lib/contracts/generation-status'

// --- Types ---

export type BackgroundTaskType = 'extraction' | 'generation' | 'refresh'

type TaskStatus = 'running' | 'complete' | 'failed'

interface BackgroundTask {
  id: string // conversationId for extraction, generationId for generation/refresh
  type: BackgroundTaskType
  projectId: string
  status: TaskStatus
  startedAt: Date
  progressLabel?: string
}

interface BackgroundTaskContextValue {
  /** All active tasks */
  activeTasks: BackgroundTask[]
  /** Start tracking a background task */
  startTask: (type: BackgroundTaskType, id: string, projectId: string) => void
  /** Stop tracking a specific task */
  stopTask: (id: string) => void
  /** Check if any task is running for a project */
  hasActiveTasks: (projectId: string) => boolean
  /** Check if a specific type is running for a project */
  isRunning: (projectId: string, type: BackgroundTaskType) => boolean
  /** Get progress label for the active generation/refresh task */
  getProgressLabel: (projectId: string) => string | undefined

  // Legacy aliases (used by existing code, avoid big refactor)
  /** @deprecated Use startTask('generation', ...) */
  startGeneration: (generationId: string, projectId: string) => void
  /** @deprecated Use isRunning(projectId, 'generation') */
  isGenerating: (projectId: string) => boolean
  /** @deprecated Use hasActiveTasks(projectId) */
  hasActiveGeneration: (projectId: string) => boolean
  /** @deprecated Use stopTask */
  stopTracking: () => void
  /** @deprecated */
  activeGeneration: { generationId: string; projectId: string; status: GenerationStatus; startedAt: Date } | null
}

const BackgroundTaskContext = createContext<BackgroundTaskContextValue | null>(null)

const POLL_INTERVAL = 2000 // 2 seconds
const MAX_POLL_DURATION = 5 * 60 * 1000 // 5 minutes

// --- Toast config per task type ---

const TOAST_CONFIG: Record<BackgroundTaskType, {
  running: { title: string; description: string }
  complete: { title: string; description: string }
  failed: { title: string; description: string }
}> = {
  extraction: {
    running: { title: 'Processing insights...', description: '' },
    complete: { title: 'New insights added', description: 'Your knowledge base has been updated.' },
    failed: { title: 'Extraction failed', description: 'Your conversation has been saved.' },
  },
  generation: {
    running: { title: 'Generating your strategy...', description: 'This will take a few moments.' },
    complete: { title: 'Your strategy is ready', description: 'Click to view your new strategy.' },
    failed: { title: 'Strategy generation failed', description: 'Something went wrong. Please try again.' },
  },
  refresh: {
    running: { title: 'Refreshing strategy...', description: "You'll be notified when it's ready." },
    complete: { title: 'Strategy updated', description: 'Click to view your updated strategy.' },
    failed: { title: 'Strategy refresh failed', description: 'Something went wrong. Please try again.' },
  },
}

export function BackgroundTaskProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<BackgroundTask[]>([])
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Use a ref for router to avoid re-creating poll functions when router changes
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  }, [router])

  // Clean up all polling on unmount
  useEffect(() => {
    const currentPolling = pollingRef.current
    return () => {
      currentPolling.forEach((timeout) => clearTimeout(timeout))
      currentPolling.clear()
    }
  }, [])

  const removeTask = useCallback((taskId: string) => {
    if (pollingRef.current.has(taskId)) {
      clearTimeout(pollingRef.current.get(taskId))
      pollingRef.current.delete(taskId)
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }, [])

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    )
  }, [])

  // Combined poll function — no circular deps because all logic is inline.
  // Uses a ref so startTask can call it without being in its dependency array.
  const pollTaskRef = useRef<(task: BackgroundTask) => void>()

  pollTaskRef.current = (task: BackgroundTask) => {
    const poll = async () => {
      // Check timeout
      const elapsed = Date.now() - task.startedAt.getTime()
      if (elapsed > MAX_POLL_DURATION) {
        updateTaskStatus(task.id, 'failed')
        toast.error(TOAST_CONFIG[task.type].failed.title, {
          description: 'The operation timed out. Please try again.',
          duration: 8000,
        })
        setTimeout(() => removeTask(task.id), 2000)
        return
      }

      try {
        // Poll the appropriate endpoint based on task type
        const url =
          task.type === 'extraction'
            ? `/api/extraction-status/${task.id}`
            : `/api/project/${task.projectId}/generation-status`

        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) {
          // Transient error — keep polling
          pollingRef.current.set(task.id, setTimeout(poll, POLL_INTERVAL))
          return
        }

        const data = await response.json()

        if (task.type === 'extraction') {
          // --- Extraction poll handling ---
          if (data.status === 'extracted') {
            updateTaskStatus(task.id, 'complete')

            const fragmentCount = data.fragmentCount || 0
            toast.success(TOAST_CONFIG.extraction.complete.title, {
              description: `${fragmentCount} insight${fragmentCount !== 1 ? 's' : ''} added to your knowledge base.`,
              duration: 5000,
            })

            // Dispatch event so project page refetches
            window.dispatchEvent(
              new CustomEvent('extractionComplete', {
                detail: { projectId: task.projectId, conversationId: task.id },
              })
            )

            setTimeout(() => removeTask(task.id), 2000)
          } else if (data.status === 'extraction_failed') {
            updateTaskStatus(task.id, 'failed')
            toast.error(TOAST_CONFIG.extraction.failed.title, {
              description: TOAST_CONFIG.extraction.failed.description,
              duration: 8000,
            })
            setTimeout(() => removeTask(task.id), 2000)
          } else {
            // Still extracting — keep polling
            pollingRef.current.set(task.id, setTimeout(poll, POLL_INTERVAL))
          }
        } else {
          // --- Generation/Refresh poll handling ---
          // New project-level endpoint: status is 'idle' when done, 'generating'/'generating_opportunities' when active
          if (data.status === 'idle' || data.status === 'complete') {
            updateTaskStatus(task.id, 'complete')

            toast.success(TOAST_CONFIG[task.type].complete.title, {
              description: TOAST_CONFIG[task.type].complete.description,
              duration: 10000,
            })

            // Dispatch event for sidebar/project page refresh
            window.dispatchEvent(
              new CustomEvent('generationComplete', {
                detail: { projectId: task.projectId },
              })
            )

            setTimeout(() => removeTask(task.id), 2000)
          } else if (data.status === 'failed') {
            updateTaskStatus(task.id, 'failed')
            toast.error(TOAST_CONFIG[task.type].failed.title, {
              description: data.error || TOAST_CONFIG[task.type].failed.description,
              duration: 8000,
            })
            setTimeout(() => removeTask(task.id), 2000)
          } else {
            // Still generating — update progress label and keep polling
            const progressLabel = data.status === 'generating_opportunities'
              ? 'Generating opportunities'
              : data.status === 'generating'
                ? 'Crafting strategy'
                : data.progressLabel
            if (progressLabel) {
              setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, progressLabel } : t))
              )
            }
            pollingRef.current.set(task.id, setTimeout(poll, POLL_INTERVAL))
          }
        }
      } catch {
        // Network error — keep polling
        pollingRef.current.set(task.id, setTimeout(poll, POLL_INTERVAL))
      }
    }

    // Start polling immediately
    poll()
  }

  const startTask = useCallback(
    (type: BackgroundTaskType, id: string, projectId: string) => {
      // Stop existing polling for this id if any
      if (pollingRef.current.has(id)) {
        clearTimeout(pollingRef.current.get(id))
        pollingRef.current.delete(id)
      }

      const task: BackgroundTask = {
        id,
        type,
        projectId,
        status: 'running',
        startedAt: new Date(),
      }

      setTasks((prev) => [...prev.filter((t) => t.id !== id), task])
      pollTaskRef.current?.(task)
    },
    []
  )

  const stopTask = useCallback(
    (id: string) => {
      removeTask(id)
    },
    [removeTask]
  )

  const hasActiveTasks = useCallback(
    (projectId: string) => {
      return tasks.some((t) => t.projectId === projectId)
    },
    [tasks]
  )

  const isRunning = useCallback(
    (projectId: string, type: BackgroundTaskType) => {
      return tasks.some(
        (t) => t.projectId === projectId && t.type === type && t.status === 'running'
      )
    },
    [tasks]
  )

  const getProgressLabel = useCallback(
    (projectId: string) => {
      const task = tasks.find(
        (t) => t.projectId === projectId && (t.type === 'generation' || t.type === 'refresh') && t.status === 'running'
      )
      return task?.progressLabel
    },
    [tasks]
  )

  // --- Legacy aliases for backward compat ---
  const startGeneration = useCallback(
    (generationId: string, projectId: string) => startTask('generation', generationId, projectId),
    [startTask]
  )

  const isGenerating = useCallback(
    (projectId: string) => isRunning(projectId, 'generation') || isRunning(projectId, 'refresh'),
    [isRunning]
  )

  const hasActiveGeneration = useCallback(
    (projectId: string) => {
      return tasks.some(
        (t) => t.projectId === projectId && (t.type === 'generation' || t.type === 'refresh')
      )
    },
    [tasks]
  )

  const stopTracking = useCallback(() => {
    // Stop all tasks (legacy — old code called this on unmount)
    tasks.forEach((t) => removeTask(t.id))
  }, [tasks, removeTask])

  // Legacy activeGeneration object for any code that reads it directly
  const genTask = tasks.find((t) => t.type === 'generation' || t.type === 'refresh')
  const activeGeneration = genTask
    ? {
        generationId: genTask.id,
        projectId: genTask.projectId,
        status: (genTask.status === 'running'
          ? 'generating'
          : genTask.status === 'complete'
            ? 'complete'
            : 'failed') as GenerationStatus,
        startedAt: genTask.startedAt,
      }
    : null

  return (
    <BackgroundTaskContext.Provider
      value={{
        activeTasks: tasks,
        startTask,
        stopTask,
        hasActiveTasks,
        isRunning,
        getProgressLabel,
        // Legacy aliases
        startGeneration,
        isGenerating,
        hasActiveGeneration,
        stopTracking,
        activeGeneration,
      }}
    >
      {children}
    </BackgroundTaskContext.Provider>
  )
}

export function useBackgroundTaskContext() {
  const context = useContext(BackgroundTaskContext)
  if (!context) {
    throw new Error('useBackgroundTaskContext must be used within BackgroundTaskProvider')
  }
  return context
}

// Legacy alias — keeps all existing imports working
export const useGenerationStatusContext = useBackgroundTaskContext
