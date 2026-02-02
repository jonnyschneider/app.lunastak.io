// src/lib/evaluation/types.ts
/**
 * Evaluation Types for Backtesting
 *
 * Used by scripts/backtest.ts to replay traces through different prompt versions.
 */

export interface EvaluationRun {
  id: string
  traceId: string
  promptType: string
  promptVersion: string
  input: {
    conversationHistory: string
    themes?: any[]
  }
  output: {
    raw: string
    parsed: any
  }
  metrics: {
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
  createdAt: Date
}

export interface BacktestConfig {
  traceIds?: string[]
  limit?: number
  promptVersions: string[]
  outputDir?: string
}

export interface ComparisonResult {
  traceId: string
  versions: Record<string, EvaluationRun>
}

export interface SkippedResult {
  traceId: string
  promptVersion: string
  status: 'skipped'
  reason: string
}

export interface BacktestOutput {
  config: BacktestConfig
  summary: {
    totalTraces: number
    byPromptVersion: Record<string, {
      compatible: number
      skipped: number
    }>
    bySchemaVersion: Record<string, number>
  }
  runs: EvaluationRun[]
  skipped: SkippedResult[]
}
