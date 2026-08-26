/**
 * Model pricing for the model-bump experiment.
 *
 * $/1M tokens, Anthropic first-party rates as at 2026-08-26. Kept in one place
 * because the comparison's whole output is a dollar figure per pipeline stage —
 * a wrong rate here silently changes the recommendation.
 *
 * Design: docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md
 */

export interface Rate {
  /** Model-ID prefix — matches dated ids like claude-sonnet-4-5-20250929. */
  prefix: string
  inputPerMTok: number
  outputPerMTok: number
}

/** Longest prefix wins, so order is significant only for readability. */
export const RATES: Rate[] = [
  { prefix: 'claude-sonnet-4-5', inputPerMTok: 3, outputPerMTok: 15 },  // the control
  { prefix: 'claude-sonnet-4-6', inputPerMTok: 3, outputPerMTok: 15 },
  { prefix: 'claude-sonnet-5', inputPerMTok: 2, outputPerMTok: 10 },
  { prefix: 'claude-opus-5', inputPerMTok: 5, outputPerMTok: 25 },
  { prefix: 'claude-opus-4-8', inputPerMTok: 5, outputPerMTok: 25 },
  { prefix: 'claude-opus-4-7', inputPerMTok: 5, outputPerMTok: 25 },
  { prefix: 'claude-opus-4-6', inputPerMTok: 5, outputPerMTok: 25 },
  { prefix: 'claude-fable-5', inputPerMTok: 10, outputPerMTok: 50 },
  { prefix: 'claude-haiku-4-5', inputPerMTok: 1, outputPerMTok: 5 },
  { prefix: 'claude-sonnet-4', inputPerMTok: 3, outputPerMTok: 15 },   // legacy, pre-4.5
]

function rateFor(model: string): Rate {
  // Longest matching prefix, so 'claude-sonnet-4-5' beats 'claude-sonnet-4'.
  const matches = RATES.filter(r => model.startsWith(r.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)

  if (matches.length === 0) {
    // Deliberately throws: a silent $0 would make an unpriced arm look free and
    // win the comparison on cost.
    throw new Error(`Unknown model for pricing: ${model}. Add it to RATES.`)
  }
  return matches[0]
}

/** Cost in USD for a single call. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = rateFor(model)
  return (inputTokens / 1_000_000) * rate.inputPerMTok
    + (outputTokens / 1_000_000) * rate.outputPerMTok
}

/**
 * Scale an observed sample cost to a monthly figure.
 *
 * @param sampleUsd     cost of the sampled calls
 * @param sampleCalls   how many calls the sample covered
 * @param monthlyCalls  observed production calls per month for that stage
 */
export function projectMonthlyUsd(sampleUsd: number, sampleCalls: number, monthlyCalls: number): number {
  if (sampleCalls === 0) return 0
  return (sampleUsd / sampleCalls) * monthlyCalls
}
