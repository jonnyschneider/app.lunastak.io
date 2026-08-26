/**
 * Cost arithmetic for the model-bump experiment.
 *
 * The whole point of the comparison is a dollar figure per pipeline stage, so
 * this has to be right and it has to be tested — a wrong rate silently changes
 * the recommendation.
 *
 * Rates are $/1M tokens, Anthropic first-party, as at 2026-08-26.
 */

import { costUsd, RATES, projectMonthlyUsd } from '@/lib/experiment/pricing'

describe('costUsd', () => {
  it('prices the control model at its published rate', () => {
    // sonnet-4-5: $3 in / $15 out per 1M
    expect(costUsd('claude-sonnet-4-5-20250929', 1_000_000, 0)).toBeCloseTo(3)
    expect(costUsd('claude-sonnet-4-5-20250929', 0, 1_000_000)).toBeCloseTo(15)
  })

  it('prices Sonnet 5 BELOW the control — the point of the whole exercise', () => {
    const control = costUsd('claude-sonnet-4-5-20250929', 100_000, 20_000)
    const sonnet5 = costUsd('claude-sonnet-5', 100_000, 20_000)
    expect(sonnet5).toBeLessThan(control)
  })

  it('prices Opus 5 above Sonnet 5 by the expected multiple', () => {
    const s = costUsd('claude-sonnet-5', 1_000_000, 1_000_000)   // 2 + 10 = 12
    const o = costUsd('claude-opus-5', 1_000_000, 1_000_000)     // 5 + 25 = 30
    expect(s).toBeCloseTo(12)
    expect(o).toBeCloseTo(30)
    expect(o / s).toBeCloseTo(2.5)
  })

  it('handles a dated model id by matching its prefix', () => {
    expect(costUsd('claude-sonnet-4-5-20250929', 1_000_000, 0)).toBeCloseTo(3)
  })

  it('throws on an unknown model rather than silently costing zero', () => {
    // A silent 0 would make an unpriced arm look free and win the comparison.
    expect(() => costUsd('claude-unknown-9', 1000, 1000)).toThrow(/unknown model/i)
  })

  it('publishes a rate for every arm in the experiment', () => {
    for (const m of ['claude-sonnet-4-5-20250929', 'claude-sonnet-5', 'claude-opus-5']) {
      expect(RATES.find(r => m.startsWith(r.prefix))).toBeDefined()
    }
  })
})

describe('projectMonthlyUsd', () => {
  it('scales an observed sample to a monthly figure', () => {
    // 10 calls in the sample, 1000 calls/month observed in prod => 100x
    expect(projectMonthlyUsd(5, 10, 1000)).toBeCloseTo(500)
  })

  it('returns 0 for an empty sample rather than dividing by zero', () => {
    expect(projectMonthlyUsd(0, 0, 1000)).toBe(0)
  })
})
