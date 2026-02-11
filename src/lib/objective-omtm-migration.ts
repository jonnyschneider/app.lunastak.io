import { Objective, PrimaryMetric } from './types';

/**
 * Detects if an objective is already in OMTM format.
 */
export function isOMTMObjective(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return 'primaryMetric' in o && o.primaryMetric !== null && o.primaryMetric !== undefined;
}

/**
 * Infers direction from metric context.
 */
function inferDirection(signal: string, _target: string): 'increase' | 'decrease' {
  const decreasePatterns = /churn|tickets|complaints|errors|bugs|time|latency|cost/i;
  if (decreasePatterns.test(signal)) return 'decrease';
  return 'increase';
}

/**
 * Migrates any Objective format to OMTM format.
 */
export function migrateToOMTM(obj: Objective): Objective {
  // Already OMTM format
  if (isOMTMObjective(obj)) {
    return obj;
  }

  // Determine title
  const title = obj.title || obj.objective || obj.pithy || '';

  // Build primary metric from first KR or legacy metric
  let primaryMetric: PrimaryMetric | undefined;
  let supportingMetrics: string[] | undefined;

  if (obj.keyResults && obj.keyResults.length > 0) {
    const firstKR = obj.keyResults[0];
    primaryMetric = {
      name: firstKR.signal,
      baseline: firstKR.baseline,
      target: firstKR.target,
      timeframe: firstKR.timeframe,
      direction: inferDirection(firstKR.signal, firstKR.target),
    };

    // Additional KRs become supporting metrics
    if (obj.keyResults.length > 1) {
      supportingMetrics = obj.keyResults.slice(1).map(kr => kr.signal);
    }
  } else if (obj.metric) {
    primaryMetric = {
      name: obj.metric.category || obj.metric.metricName || 'Metric',
      baseline: '',
      target: obj.metric.summary || obj.metric.metricValue || '',
      timeframe: obj.metric.timeframe || '6M',
      direction: obj.metric.direction || 'increase',
    };
  }

  return {
    id: obj.id,
    title,
    explanation: obj.explanation,
    primaryMetric,
    supportingMetrics,
    // Preserve legacy fields for backward compat
    objective: obj.objective,
    pithy: obj.pithy,
    keyResults: obj.keyResults,
    metric: obj.metric,
    successCriteria: obj.successCriteria,
  };
}

/**
 * Normalizes an objective to OMTM format for display.
 */
export function normalizeToOMTM(obj: Objective): Objective {
  return migrateToOMTM(obj);
}
