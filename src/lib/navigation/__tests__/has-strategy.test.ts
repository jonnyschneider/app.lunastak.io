import { describe, it, expect } from 'vitest'
import { projectHasStrategy, hasStackVision } from '../has-strategy'

describe('hasStackVision', () => {
  it('needs a non-empty vision, not merely a DecisionStack row', () => {
    expect(hasStackVision('Be the trusted default')).toBe(true)
    expect(hasStackVision('')).toBe(false) // setGenerationStatus placeholder
    expect(hasStackVision(null)).toBe(false)
    expect(hasStackVision(undefined)).toBe(false)
  })
})

describe('projectHasStrategy', () => {
  it('is true on a vision', () => {
    expect(projectHasStrategy({ hasVision: true, generationTraceCount: 0 })).toBe(true)
  })

  it('is true on a generation trace alone — the legacy trace-only project the server used to miss', () => {
    expect(projectHasStrategy({ hasVision: false, generationTraceCount: 1 })).toBe(true)
  })

  it('is false with neither — an ingest alone is not a strategy', () => {
    expect(projectHasStrategy({ hasVision: false, generationTraceCount: 0 })).toBe(false)
  })
})
