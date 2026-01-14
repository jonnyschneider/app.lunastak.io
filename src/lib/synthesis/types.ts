/**
 * Synthesis types
 */

import { Tier1Dimension } from '@/lib/constants/dimensions'
import { StructuredProvocation } from '@/lib/types'

export interface SynthesisResult {
  summary: string
  keyThemes: string[]
  keyQuotes: string[]
  gaps: StructuredProvocation[]
  contradictions: string[]
  subdimensions: Record<string, {
    summary: string
    fragmentIds: string[]
  }> | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface FragmentForSynthesis {
  id: string
  content: string
  contentType: string
  confidence: string | null
  capturedAt: Date
}
