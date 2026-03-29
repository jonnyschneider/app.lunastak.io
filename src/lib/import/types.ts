import type { EmergentThemeContract } from '@/lib/contracts/extraction'

// What came in from external source
export type ImportTrigger =
  | {
      type: 'context_bundle'
      projectId: string
      mode: 'transform' | 'direct'
      bundle: ContextBundle
    }

// Generic bundle from any skill/source
export interface ContextBundle {
  version: string
  framework?: string
  // New format: generic chunks (no dimensions)
  chunks?: BundleChunk[]
  // Legacy format: dimensionally-tagged themes (direct insert)
  themes?: BundleTheme[]
  openQuestions?: BundleQuestion[]
  tensions?: BundleTension[]
  coverage?: Record<string, unknown>
  rawSummary?: string
}

export interface BundleChunk {
  topic: string
  content: string
  sources?: string[]
}

// Legacy format (for direct insert mode)
export interface BundleTheme {
  area: string
  theme: string
  evidence?: string[]
  confidence?: string
}

export interface BundleQuestion {
  question: string
  area?: string
  why?: string
}

export interface BundleTension {
  tension: string
  areas: string[]
}

// What the planner decides
export interface ImportPlan {
  trigger: ImportTrigger['type']
  mode: 'transform' | 'direct'
  requiresLLM: boolean
  transformFunction: string
}

// What the executor returns
export interface ImportResult {
  fragmentsCreated: number
  questionsAdded: number
  importBatchId: string
}
