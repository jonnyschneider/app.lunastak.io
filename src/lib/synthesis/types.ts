/**
 * Synthesis types
 */

import { Tier1Dimension } from '@/lib/constants/dimensions'
import { StructuredProvocation } from '@/lib/types'

export interface SynthesisResult {
  summary: string
  gaps: StructuredProvocation[]
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface FragmentForSynthesis {
  id: string
  content: string
  contentType: string
  confidence: string | null
  capturedAt: Date
  /** Verbatim spans backing this fragment, in ordinal order. Usually empty. */
  evidence?: EvidenceForSynthesis[]
}

/**
 * One verbatim span from the `Evidence` table, as synthesis needs it.
 *
 * `verification` is carried only so `failed` can be filtered out — see
 * `renderEvidence` in @/lib/prompts/shared/evidence.
 */
export interface EvidenceForSynthesis {
  text: string
  verification: string
}
