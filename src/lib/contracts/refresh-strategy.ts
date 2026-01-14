/**
 * Refresh Strategy Contracts
 *
 * Defines what /api/project/[id]/refresh-strategy produces.
 * This is an incremental update flow, not full regeneration.
 */

import { StrategyStatementsContract } from './generation';

// Re-export for convenience
export type { StrategyStatementsContract };

// Delta information - what changed since last generation
export interface RefreshStrategyDeltaContract {
  newFragmentCount: number;
  removedFragmentCount: number;
  newFragmentSummaries: string[];      // First ~100 chars of each new fragment
  removedFragmentSummaries: string[];  // First ~100 chars of each removed fragment
}

// Streaming progress steps
export type RefreshStrategyStep =
  | 'loading_context'
  | 'generating_strategy'
  | 'summarizing_changes'
  | 'complete'
  | 'error';

// Streaming progress update
export interface RefreshStrategyProgressContract {
  step: RefreshStrategyStep;
  error?: string;
}

// Final output from /api/project/[id]/refresh-strategy
export interface RefreshStrategyOutputContract {
  traceId: string;
  statements: StrategyStatementsContract;
  changeSummary: string | null;  // May be null if summary generation failed
  previousOutputId: string;      // Link to previous version
  version: number;
}

// Validation
export function validateRefreshStrategyOutput(data: unknown): data is RefreshStrategyOutputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.traceId !== 'string' || !obj.traceId) return false;
  if (typeof obj.previousOutputId !== 'string' || !obj.previousOutputId) return false;
  if (typeof obj.version !== 'number') return false;

  // changeSummary can be null (best-effort)
  if (obj.changeSummary !== null && typeof obj.changeSummary !== 'string') return false;

  // Validate statements structure
  const statements = obj.statements as Record<string, unknown>;
  if (!statements || typeof statements !== 'object') return false;
  if (typeof statements.vision !== 'string' || !statements.vision) return false;
  if (typeof statements.strategy !== 'string' || !statements.strategy) return false;
  if (!Array.isArray(statements.objectives)) return false;

  return true;
}
