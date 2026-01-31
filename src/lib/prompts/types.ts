// src/lib/prompts/types.ts
/**
 * Prompt Registry Types
 *
 * Defines the structure for versioned prompts used in extraction,
 * generation, and reflective summary.
 */

export interface PromptVersion {
  id: string
  template: string
  description: string
  current: boolean
  deprecated?: boolean
  deprecatedAt?: string
  createdAt: string

  // Input requirements for compatibility checking
  requiredInputs: string[]
  optionalInputs?: string[]
  minTraceSchemaVersion?: string
}

export type PromptType = 'extraction' | 'generation' | 'reflective-summary'
