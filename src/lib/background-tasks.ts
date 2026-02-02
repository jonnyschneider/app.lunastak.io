// src/lib/background-tasks.ts
/**
 * Background Task Runner
 *
 * Uses Vercel's waitUntil to run tasks after the response is sent.
 * Tasks like reflective summary generation, synthesis updates, and
 * knowledge summary generation run in background to speed up extraction.
 */

import { waitUntil } from '@vercel/functions'

export type BackgroundTaskStatus = 'IDLE' | 'PROCESSING' | 'COMPLETE' | 'ERROR'

interface BackgroundTask {
  name: string
  fn: () => Promise<void>
}

interface BackgroundTaskOptions {
  projectId: string
  tasks: BackgroundTask[]
}

/**
 * Run tasks in background after response is sent.
 * Uses Vercel's waitUntil to detach from request lifecycle.
 */
export function runBackgroundTasks({ projectId, tasks }: BackgroundTaskOptions) {
  waitUntil(executeBackgroundTasks(projectId, tasks))
}

async function executeBackgroundTasks(projectId: string, tasks: BackgroundTask[]) {
  console.log(`[Background] Starting ${tasks.length} tasks for project ${projectId}`)

  const errors: string[] = []

  for (const task of tasks) {
    try {
      console.log(`[Background] Running: ${task.name}`)
      const start = Date.now()
      await task.fn()
      console.log(`[Background] Completed: ${task.name} (${Date.now() - start}ms)`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Background] Failed: ${task.name}`, error)
      errors.push(`${task.name}: ${msg}`)
    }
  }

  console.log(`[Background] All tasks finished for project ${projectId}${errors.length > 0 ? ` with ${errors.length} errors` : ''}`)
}
