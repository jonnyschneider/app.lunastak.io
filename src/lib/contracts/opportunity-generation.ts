// src/lib/contracts/opportunity-generation.ts
/**
 * Opportunity Generation Contracts
 *
 * Defines the shape of opportunity output from the pipeline.
 */

import type { Opportunity } from '@/lib/types'

/**
 * Response from POST /api/project/[id]/generate-opportunities
 */
export interface OpportunityGenerationStartedContract {
  status: 'started'
  generationId: string
  coverageWarnings?: CoverageWarning[]
}

export interface CoverageWarning {
  dimension: string
  dimensionLabel: string
  confidence: string
  fragmentCount: number
}

/**
 * Output shape stored in GeneratedOutput.content for outputType: 'opportunities'
 */
export interface OpportunityGenerationOutputContract {
  opportunities: Opportunity[]
  generatedFrom: {
    fragmentCount: number
    synthesisCount: number
    decisionStackVersion?: number  // Deprecated — snapshots track versioning now
  }
}
