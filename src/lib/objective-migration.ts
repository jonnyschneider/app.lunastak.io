// src/lib/objective-migration.ts
/**
 * Migration helper for converting legacy Objective format to OKR format.
 */

import { Objective, KeyResult, ObjectiveMetric } from './types';

/**
 * Detects if an objective is in legacy format (has metric, no keyResults).
 */
export function isLegacyObjective(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;

  // Has metric but no keyResults (or empty keyResults)
  const hasMetric = 'metric' in o && o.metric !== null && o.metric !== undefined;
  const hasKeyResults = 'keyResults' in o && Array.isArray(o.keyResults) && o.keyResults.length > 0;

  return hasMetric && !hasKeyResults;
}

/**
 * Generates a unique ID for key results.
 */
function generateKrId(): string {
  return `kr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Migrates a legacy objective (with metric) to OKR format (with keyResults).
 */
export function migrateObjectiveToOKR(legacy: {
  id: string;
  pithy?: string;
  objective?: string;
  title?: string;
  metric?: ObjectiveMetric;
  explanation: string;
  successCriteria?: string;
}): Objective {
  const metric = legacy.metric;

  const keyResult: KeyResult = {
    id: generateKrId(),
    belief: {
      action: extractAction(metric?.full || ''),
      outcome: extractOutcome(metric?.full || ''),
    },
    signal: metric?.category || '',
    baseline: '', // Unknown from legacy format
    target: metric?.summary || '',
    timeframe: (metric?.timeframe as KeyResult['timeframe']) || '6M',
  };

  return {
    id: legacy.id,
    title: legacy.title,
    objective: legacy.objective || legacy.pithy || '',
    pithy: legacy.pithy,
    explanation: legacy.explanation,
    keyResults: [keyResult],
    metric: legacy.metric, // Preserve for backwards compatibility
    successCriteria: legacy.successCriteria,
  };
}

/**
 * Extracts the action from the full metric description.
 * Best effort: takes first part before "by" or "to".
 */
function extractAction(full: string): string {
  const match = full.match(/^(.+?)\s+(?:by|to)\s+/i);
  return match ? match[1].trim() : full || 'taking action';
}

/**
 * Extracts the outcome from the full metric description.
 * Best effort: takes part after "will" or returns generic.
 */
function extractOutcome(full: string): string {
  const match = full.match(/will\s+(.+)/i);
  return match ? match[1].trim() : 'achieve target';
}

/**
 * Normalizes an objective to always have the new fields.
 * Safe to call on both legacy and new format objects.
 */
export function normalizeObjective(obj: Objective): Objective {
  if (!obj.keyResults?.length && obj.metric) {
    return migrateObjectiveToOKR(obj);
  }

  // Ensure objective field is set
  return {
    ...obj,
    objective: obj.objective || obj.pithy || '',
  };
}
