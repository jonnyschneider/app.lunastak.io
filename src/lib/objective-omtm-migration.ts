import { Objective, PrimaryMetric } from './types';

/**
 * Detects if an objective is already in simplified OMTM format.
 */
export function isSimplifiedOMTM(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.omtm === 'string' && o.omtm.trim().length > 0;
}

/**
 * Detects if an objective has legacy primaryMetric format.
 */
export function hasLegacyPrimaryMetric(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return 'primaryMetric' in o && o.primaryMetric !== null && o.primaryMetric !== undefined;
}

/**
 * Legacy: Detects if an objective is in OMTM format (primaryMetric).
 * @deprecated Use isSimplifiedOMTM instead
 */
export function isOMTMObjective(obj: unknown): boolean {
  return isSimplifiedOMTM(obj) || hasLegacyPrimaryMetric(obj);
}

/**
 * Infers direction from metric context.
 */
function inferDirection(signal: string): 'increase' | 'decrease' {
  const decreasePatterns = /churn|tickets|complaints|errors|bugs|time|latency|cost/i;
  if (decreasePatterns.test(signal)) return 'decrease';
  return 'increase';
}

/**
 * Builds aspiration text from primaryMetric.
 * e.g., "12% → 40% in 6M" or "↑ 40% in 6M"
 */
function buildAspirationFromPrimaryMetric(pm: PrimaryMetric): string {
  const arrow = pm.direction === 'increase' ? '↑' : '↓';
  if (pm.baseline && pm.target) {
    return `${pm.baseline} → ${pm.target}`;
  }
  if (pm.target) {
    return `${arrow} ${pm.target}`;
  }
  return '';
}

/**
 * Migrates any Objective format to simplified OMTM format.
 * Extracts omtm (metric name) and aspiration (directional goal).
 */
export function migrateToOMTM(obj: Objective): Objective {
  // Already simplified OMTM format
  if (isSimplifiedOMTM(obj)) {
    return obj;
  }

  // Determine title
  const title = obj.title || obj.objective || obj.pithy || '';

  // Extract omtm and aspiration from various formats
  let omtm: string | undefined;
  let aspiration: string | undefined;
  let supportingMetrics: string[] | undefined = obj.supportingMetrics;

  // Legacy primaryMetric format
  if (obj.primaryMetric) {
    omtm = obj.primaryMetric.name;
    aspiration = buildAspirationFromPrimaryMetric(obj.primaryMetric);
  }
  // OKR format with keyResults
  else if (obj.keyResults && obj.keyResults.length > 0) {
    const firstKR = obj.keyResults[0];
    omtm = firstKR.signal;
    if (firstKR.baseline && firstKR.target) {
      aspiration = `${firstKR.baseline} → ${firstKR.target}`;
    } else if (firstKR.target) {
      const arrow = inferDirection(firstKR.signal) === 'increase' ? '↑' : '↓';
      aspiration = `${arrow} ${firstKR.target}`;
    }

    // Additional KRs become supporting metrics
    if (obj.keyResults.length > 1) {
      supportingMetrics = obj.keyResults.slice(1).map(kr => kr.signal);
    }
  }
  // Legacy metric format
  else if (obj.metric) {
    omtm = obj.metric.category || obj.metric.metricName || 'Metric';
    aspiration = obj.metric.summary || obj.metric.metricValue || '';
  }

  return {
    id: obj.id,
    title,
    explanation: obj.explanation,
    // New simplified fields
    omtm,
    aspiration,
    supportingMetrics,
    // Preserve legacy fields for backward compat
    primaryMetric: obj.primaryMetric,
    objective: obj.objective,
    pithy: obj.pithy,
    keyResults: obj.keyResults,
    metric: obj.metric,
    successCriteria: obj.successCriteria,
  };
}

/**
 * Normalizes an objective to simplified OMTM format for display.
 */
export function normalizeToOMTM(obj: Objective): Objective {
  return migrateToOMTM(obj);
}
