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
}
