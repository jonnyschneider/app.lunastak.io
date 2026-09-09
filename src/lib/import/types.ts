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
  /**
   * Which tool produced this bundle. Optional and backwards compatible — every bundle emitted
   * before 2026-09-09 lacks it. UNTRUSTED: self-reported by the producing LLM into a blob the
   * user can edit, so it must go through `normaliseGeneratedBy` before it is stored or grouped.
   */
  generatedBy?: string
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
  evidence?: string[]
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
  /** Validated producer, or null when the bundle said nothing. Never the raw claim. */
  generatedBy: string | null
}
