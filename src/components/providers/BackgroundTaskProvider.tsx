'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
// --- Types ---

/**
 * ⚠ 'document' JOINED THIS UNION 2026-09-09, and `DocumentProcessingProvider` was deleted.
 *
 * That provider was 178 lines of this one: same context shape, same active-items array, same
 * `pollingRefs` Map, same 2s interval, same fetch-status-then-toast, same timeout cap. One concept
 * had been written twice, which is why document upload spoke a different language from every other
 * background task — the divergence was structural, not editorial.
 *
 * Adding a source is now a row in POLL_CONFIG below, not a branch in the poll loop.
 */
export type BackgroundTaskType = 'extraction' | 'generation' | 'document'

export type PollResponseData = {
  traceId?: string
  fragmentCount?: number
  error?: string
}

export type TaskMessaging = {
  running: string
  complete: string
  failed: string
  completeDescription?: string
  failedDescription?: string
  completeAction?: (data: PollResponseData) => { label: string; href: string } | undefined
  onComplete?: (data: PollResponseData) => void
}

type TaskStatus = 'running' | 'complete' | 'failed'

interface BackgroundTask {
  id: string // conversationId for extraction, generationId for generation
  type: BackgroundTaskType
  projectId: string
  status: TaskStatus
  startedAt: Date
  progressLabel?: string
  messaging: TaskMessaging
}

interface BackgroundTaskContextValue {
  /** All active tasks */
  activeTasks: BackgroundTask[]
  /** Start tracking a background task */
  startTask: (type: BackgroundTaskType, id: string, projectId: string, messaging: TaskMessaging) => void
  /** Stop tracking a specific task */
  stopTask: (id: string) => void
  /** Check if any task is running for a project */
  hasActiveTasks: (projectId: string) => boolean
  /** Check if a specific type is running for a project */
  isRunning: (projectId: string, type: BackgroundTaskType) => boolean
  /** Get progress label for the active generation/refresh task */
  getProgressLabel: (projectId: string) => string | undefined
  /** How many ingests of a type are in flight — replaces DocumentProcessingProvider.processingCount */
  runningCount: (projectId: string, type: BackgroundTaskType) => number
}

const BackgroundTaskContext = createContext<BackgroundTaskContextValue | null>(null)

const POLL_INTERVAL = 2000 // 2 seconds

/**
 * Everything that differs per task type, in one table.
 *
 * The poll loop below is now identical for every type; what changes is which endpoint to hit, how
 * long to wait, how to read "done" out of the response, and what to shout when it is. A new
 * background source is a row here.
 */
type PollVerdict = 'complete' | 'failed' | 'running'

interface PollConfig {
  url: (task: { id: string; projectId: string }) => string
  /** Documents can legitimately take far longer than a generation. */
  maxDuration: number
  classify: (data: Record<string, unknown>) => PollVerdict
  /** Dispatched on completion so the project page refetches. Receives whatever `extract` pulled
   *  out of the final poll, so an event can carry payload the page would otherwise refetch for. */
  completionEvent?: (task: { id: string; projectId: string }, data?: PollResponseData) => CustomEvent
  /** Pulled out of the response and handed to the caller's `onComplete`. */
  extract?: (data: Record<string, unknown>) => PollResponseData
  /** Overrides `messaging.running` in the StatusBanner while polling. */
  progressLabel?: (data: Record<string, unknown>) => string | undefined
}

const POLL_CONFIG: Record<BackgroundTaskType, PollConfig> = {
  extraction: {
    url: (t) => `/api/extraction-status/${t.id}`,
    maxDuration: 5 * 60 * 1000,
    classify: (d) =>
      d.status === 'extracted' ? 'complete' : d.status === 'extraction_failed' ? 'failed' : 'running',
    completionEvent: (t) =>
      new CustomEvent('extractionComplete', {
        detail: { projectId: t.projectId, conversationId: t.id },
      }),
    extract: (d) => ({ fragmentCount: (d.fragmentCount as number) || 0 }),
  },

  document: {
    url: (t) => `/api/documents/${t.id}/status`,
    // Documents are the slow path — a long transcript can take minutes.
    maxDuration: 10 * 60 * 1000,
    classify: (d) =>
      d.status === 'complete' ? 'complete' : d.status === 'failed' ? 'failed' : 'running',
    // Same event as extraction: from the page's point of view a document IS an extraction, and
    // both end with new fragments to refetch.
    completionEvent: (t) =>
      new CustomEvent('extractionComplete', {
        detail: { projectId: t.projectId, documentId: t.id },
      }),
    extract: (d) => ({ fragmentCount: (d.fragmentCount as number) || 0 }),
  },

  generation: {
    url: (t) => `/api/project/${t.projectId}/generation-status`,
    maxDuration: 5 * 60 * 1000,
    classify: (d) =>
      d.status === 'idle' || d.status === 'complete'
        ? 'complete'
        : d.status === 'failed'
          ? 'failed'
          : 'running',
    /**
     * ⚠ `traceId` RIDES ALONG, 2026-09-10.
     * The strategy-ready chip is keyed on the trace it announces (see `useStrategyReady`), so a
     * refresh raises a fresh chip and a dismissal stays scoped to the version it dismissed.
     * Without it the listener has to refetch the project just to learn which strategy just landed.
     */
    completionEvent: (t, d) =>
      new CustomEvent('generationComplete', {
        detail: { projectId: t.projectId, traceId: d?.traceId },
      }),
    extract: (d) => ({ traceId: d.traceId as string | undefined, error: d.error as string | undefined }),
    progressLabel: (d) =>
      d.status === 'generating_opportunities'
        ? 'Generating opportunities'
        : d.status === 'generating'
          ? 'Crafting strategy'
          : (d.progressLabel as string | undefined),
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
    const config = POLL_CONFIG[task.type]

    const poll = async () => {
      if (Date.now() - task.startedAt.getTime() > config.maxDuration) {
        updateTaskStatus(task.id, 'failed')
        toast.error(task.messaging.failed, {
          description: 'The operation timed out. Please try again.',
          duration: 8000,
        })
        setTimeout(() => removeTask(task.id), 2000)
        return
      }

      const again = () => pollingRef.current.set(task.id, setTimeout(poll, POLL_INTERVAL))

      try {
        const response = await fetch(config.url(task), { cache: 'no-store' })
        if (!response.ok) return again() // transient — keep polling

        const data = (await response.json()) as Record<string, unknown>
        const verdict = config.classify(data)

        if (verdict === 'running') {
          const label = config.progressLabel?.(data)
          if (label) {
            setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, progressLabel: label } : t)))
          }
          return again()
        }

        if (verdict === 'failed') {
          updateTaskStatus(task.id, 'failed')
          toast.error(task.messaging.failed, {
            description: (data.error as string) || task.messaging.failedDescription,
            duration: 8000,
          })
          setTimeout(() => removeTask(task.id), 2000)
          return
        }

        // --- complete ---
        updateTaskStatus(task.id, 'complete')
        const responseData: PollResponseData = config.extract?.(data) ?? {}

        // One interpolation, as documented — `{{fragmentCount}}` and nothing else.
        const description = task.messaging.completeDescription?.replace(
          '{{fragmentCount}}',
          String(responseData.fragmentCount ?? 0),
        )

        const action = task.messaging.completeAction?.(responseData)
        toast.success(task.messaging.complete, {
          description,
          action: action
            ? { label: action.label, onClick: () => routerRef.current.push(action.href) }
            : undefined,
          duration: action ? 10000 : 5000,
        })

        const event = config.completionEvent?.(task, responseData)
        if (event) window.dispatchEvent(event)

        task.messaging.onComplete?.(responseData)
        setTimeout(() => removeTask(task.id), 2000)
      } catch {
        again() // network error — keep polling
      }
    }

    // Start polling immediately
    poll()
  }

  const startTask = useCallback(
    (type: BackgroundTaskType, id: string, projectId: string, messaging: TaskMessaging) => {
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
        messaging,
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

  const runningCount = useCallback(
    (projectId: string, type: BackgroundTaskType) =>
      tasks.filter((t) => t.projectId === projectId && t.type === type && t.status === 'running').length,
    [tasks]
  )

  const getProgressLabel = useCallback(
    (projectId: string) => {
      const task = tasks.find(
        (t) => t.projectId === projectId && t.type === 'generation' && t.status === 'running'
      )
      return task?.progressLabel
    },
    [tasks]
  )

  return (
    <BackgroundTaskContext.Provider
      value={{
        activeTasks: tasks,
        startTask,
        stopTask,
        hasActiveTasks,
        isRunning,
        getProgressLabel,
        runningCount,
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
