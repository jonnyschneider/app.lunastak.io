// src/lib/prompts/index.ts
/**
 * Prompt Registry
 *
 * Central registry for all versioned prompts. Use getCurrentPrompt() to get
 * the active version for a prompt type.
 */

import { PromptVersion, PromptType } from './types'
import { EMERGENT_EXTRACTION_V1 } from './extraction/v1-emergent'
import { GENERATION_WITH_SUMMARY_V1 } from './generation/v1-with-summary'
import { GENERATION_THEMES_ONLY_V2 } from './generation/v2-themes-only'
import { REFLECTIVE_SUMMARY_V1 } from './reflective-summary/v1'

export const PROMPT_REGISTRY: Record<PromptType, Record<string, PromptVersion>> = {
  extraction: {
    'v1-emergent': EMERGENT_EXTRACTION_V1,
  },
  generation: {
    'v1-with-summary': GENERATION_WITH_SUMMARY_V1,
    'v2-themes-only': GENERATION_THEMES_ONLY_V2,
  },
  'reflective-summary': {
    'v1': REFLECTIVE_SUMMARY_V1,
  },
}

export function getCurrentPrompt(type: PromptType): PromptVersion {
  const versions = PROMPT_REGISTRY[type]
  const current = Object.values(versions).find(v => v.current)
  if (!current) throw new Error(`No current prompt for ${type}`)
  return current
}

export function getPrompt(type: PromptType, versionId: string): PromptVersion | undefined {
  return PROMPT_REGISTRY[type][versionId]
}

export function listPromptVersions(type: PromptType): PromptVersion[] {
  return Object.values(PROMPT_REGISTRY[type])
}

export type { PromptVersion, PromptType } from './types'
