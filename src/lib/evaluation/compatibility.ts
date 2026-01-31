// src/lib/evaluation/compatibility.ts
/**
 * Trace-Prompt Compatibility Checking
 *
 * Schema versions track what data is guaranteed present in traces from that era.
 * Used by backtest.ts to filter which traces can be processed by which prompts.
 */

import { PromptVersion } from '@/lib/prompts/types'

export interface TraceSchemaVersion {
  version: string
  fields: string[]
  description: string
}

export const TRACE_SCHEMA_VERSIONS: Record<string, TraceSchemaVersion> = {
  '2025-01': {
    version: '2025-01',
    description: 'Original prescriptive extraction',
    fields: [
      'extractedContext.core.industry',
      'extractedContext.core.target_market',
      'extractedContext.core.unique_value',
      'extractedContext.enrichment',
    ],
  },
  '2025-06': {
    version: '2025-06',
    description: 'Emergent extraction with themes and reflective summary',
    fields: [
      'extractedContext.themes',
      'extractedContext.reflective_summary',
      'extractedContext.extraction_approach',
    ],
  },
  '2026-01': {
    version: '2026-01',
    description: 'Emergent with dimensional coverage, optional reflective summary',
    fields: [
      'extractedContext.themes',
      'extractedContext.extraction_approach',
      'dimensionalCoverage',
    ],
  },
}

/**
 * Determine schema version based on trace timestamp
 */
export function getTraceSchemaVersion(timestamp: Date): string {
  if (timestamp < new Date('2025-06-01')) return '2025-01'
  if (timestamp < new Date('2026-01-01')) return '2025-06'
  return '2026-01'
}

export interface CompatibilityResult {
  compatible: boolean
  missingFields: string[]
  traceSchemaVersion: string
}

/**
 * Check if a trace is compatible with a prompt version
 */
export function checkCompatibility(
  traceTimestamp: Date,
  prompt: PromptVersion
): CompatibilityResult {
  const traceVersion = getTraceSchemaVersion(traceTimestamp)
  const traceSchema = TRACE_SCHEMA_VERSIONS[traceVersion]

  // Check minimum version requirement
  if (prompt.minTraceSchemaVersion && traceVersion < prompt.minTraceSchemaVersion) {
    return {
      compatible: false,
      missingFields: prompt.requiredInputs,
      traceSchemaVersion: traceVersion,
    }
  }

  // Check required fields against trace schema
  const missingFields = (prompt.requiredInputs || []).filter(required => {
    // Map prompt input names to trace field paths
    const fieldMapping: Record<string, string> = {
      'themes': 'extractedContext.themes',
      'reflective_summary': 'extractedContext.reflective_summary',
      'conversation': 'conversation', // Always available via relation
    }

    const fieldPath = fieldMapping[required] || required
    return !traceSchema.fields.some(f => f.includes(fieldPath) || fieldPath.includes(f))
  })

  return {
    compatible: missingFields.length === 0,
    missingFields,
    traceSchemaVersion: traceVersion,
  }
}

/**
 * Check compatibility based on actual trace data (runtime check)
 */
export function checkTraceDataCompatibility(
  extractedContext: any,
  prompt: PromptVersion
): CompatibilityResult {
  const missingFields: string[] = []

  for (const required of prompt.requiredInputs) {
    switch (required) {
      case 'themes':
        if (!extractedContext?.themes || extractedContext.themes.length === 0) {
          missingFields.push('themes')
        }
        break
      case 'reflective_summary':
        if (!extractedContext?.reflective_summary) {
          missingFields.push('reflective_summary')
        }
        break
      case 'conversation':
        // Conversation is always available via DB relation
        break
      default:
        // Unknown field - check if it exists
        if (!(required in extractedContext)) {
          missingFields.push(required)
        }
    }
  }

  return {
    compatible: missingFields.length === 0,
    missingFields,
    traceSchemaVersion: 'runtime',
  }
}
