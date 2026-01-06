// src/lib/contracts/generation.ts
/**
 * Generation Contracts
 *
 * Defines what /api/generate expects as input and produces as output.
 */

import { ExtractionOutputContract } from './extraction';

// Re-export extraction for convenience
export type { ExtractionOutputContract };

// Objective structure in generated output
export interface ObjectiveContract {
  id: string;
  pithy: string;
  metric: {
    summary: string;
    full: string;
    category: string;
    direction?: 'increase' | 'decrease';
    metricName?: string;
    metricValue?: string;
    timeframe?: '3M' | '6M' | '9M' | '12M' | '18M';
  };
  explanation: string;
  successCriteria: string;
}

// Strategy statements - the core output
export interface StrategyStatementsContract {
  vision: string;
  strategy: string;
  objectives: ObjectiveContract[];
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    objectiveIds: string[];
  }>;
  principles: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

// What /api/generate expects
export interface GenerationInputContract {
  conversationId: string;
  extractedContext: ExtractionOutputContract;
  dimensionalCoverage?: unknown; // Optional E2 coverage data
}

// What /api/generate returns
export interface GenerationOutputContract {
  traceId: string;
  thoughts: string;
  statements: StrategyStatementsContract;
}

// Validation
export function validateGenerationInput(data: unknown): data is GenerationInputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.conversationId !== 'string' || !obj.conversationId) return false;
  if (!obj.extractedContext || typeof obj.extractedContext !== 'object') return false;

  return true;
}

export function validateGenerationOutput(data: unknown): data is GenerationOutputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.traceId !== 'string' || !obj.traceId) return false;
  if (typeof obj.thoughts !== 'string') return false;

  const statements = obj.statements as Record<string, unknown>;
  if (!statements || typeof statements !== 'object') return false;
  if (typeof statements.vision !== 'string' || !statements.vision) return false;
  if (typeof statements.strategy !== 'string' || !statements.strategy) return false;
  if (!Array.isArray(statements.objectives)) return false;

  return true;
}
