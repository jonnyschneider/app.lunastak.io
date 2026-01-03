/**
 * Synthesis types
 */

import { Tier1Dimension } from '@/lib/constants/dimensions'

export interface SynthesisResult {
  summary: string
  keyThemes: string[]
  keyQuotes: string[]
  gaps: string[]
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
