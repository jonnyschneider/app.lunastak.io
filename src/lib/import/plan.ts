import type { ImportTrigger, ImportPlan } from './types'

/**
 * Determine what import steps to run for a given trigger.
 * Pure function — no DB calls, no side effects.
 */
export function planImport(trigger: ImportTrigger): ImportPlan {
  switch (trigger.type) {
    case 'context_bundle':
      return trigger.mode === 'direct'
        ? {
            trigger: 'context_bundle',
            mode: 'direct',
            requiresLLM: false,
            transformFunction: 'contextBundleDirect',
          }
        : {
            trigger: 'context_bundle',
            mode: 'transform',
            requiresLLM: true,
            transformFunction: 'contextBundle',
          }
  }
}
