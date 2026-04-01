// src/lib/contracts/strategy-version.ts
/**
 * Strategy Version Contracts
 *
 * Defines what /api/project/[id]/strategy-version expects and produces.
 */

import { ObjectiveContract, KeyResultContract } from './generation';

// Component types
export type StrategyComponentType = 'vision' | 'strategy' | 'objective';
export type StrategyVersionSource = 'generation' | 'user_edit' | 'coaching';
export type StrategyVersionCreator = 'user' | 'ai' | 'system';

// Content contracts for each component type
export interface VisionContentContract {
  text: string;
}

export interface StrategyContentContract {
  text: string;
}

export interface PrimaryMetricContract {
  name: string;
  baseline: string;
  target: string;
  timeframe: '3M' | '6M' | '9M' | '12M' | '18M';
  direction: 'increase' | 'decrease';
}

export interface ObjectiveContentContract {
  title?: string;  // Short title (3-5 words) for lists/linking
  explanation: string;

  // OMTM - simplified format (preferred)
  omtm?: string;         // Just the metric name: "Weekly Active Users"
  aspiration?: string;   // Optional directional goal: "40% increase" or "Significant growth"
  supportingMetrics?: string[];  // Optional additional metrics (just names)

  // Legacy OMTM format - still supported for migration
  primaryMetric?: PrimaryMetricContract;

  // OKR format - still supported
  objective?: string;
  keyResults?: KeyResultContract[];

  // Legacy format - still supported
  pithy?: string;
  metric?: ObjectiveContract['metric'];
  successCriteria?: string;
}

// API Input contract for POST /api/project/[id]/strategy-version
export interface StrategyVersionInputContract {
  componentType: StrategyComponentType;
  componentId?: string; // Required for objectives
  content: VisionContentContract | StrategyContentContract | ObjectiveContentContract;
  sourceType: StrategyVersionSource;
  sourceId?: string;
}

// API Output contract
export interface StrategyVersionOutputContract {
  id: string;
  projectId: string;
  componentType: StrategyComponentType;
  componentId: string | null;
  content: VisionContentContract | StrategyContentContract | ObjectiveContentContract;
  version: number;
  createdAt: string;
  createdBy: StrategyVersionCreator;
  sourceType: StrategyVersionSource;
  sourceId: string | null;
}

// Snapshot-based version history (replaces per-component StrategyVersion for display)
export type SnapshotTrigger =
  | 'pre_generation'
  | 'post_generation'
  | 'pre_refresh'
  | 'post_refresh'
  | 'pre_opportunities'
  | 'post_opportunities';

export interface SnapshotVersionContract {
  id: string;
  version: number;
  trigger: SnapshotTrigger;
  createdAt: string;
  changeSummary: string | null;
  modelUsed: string | null;
}

// Validation functions
export function validateStrategyVersionInput(data: unknown): data is StrategyVersionInputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Validate componentType
  if (!['vision', 'strategy', 'objective'].includes(obj.componentType as string)) {
    return false;
  }

  // Validate sourceType
  if (!['generation', 'user_edit', 'coaching'].includes(obj.sourceType as string)) {
    return false;
  }

  // Validate content exists
  if (!obj.content || typeof obj.content !== 'object') {
    return false;
  }

  // Validate componentId required for objectives
  if (obj.componentType === 'objective' && !obj.componentId) {
    return false;
  }

  // Validate content shape based on componentType
  const content = obj.content as Record<string, unknown>;
  if (obj.componentType === 'vision' || obj.componentType === 'strategy') {
    if (typeof content.text !== 'string' || !content.text.trim()) {
      return false;
    }
  } else if (obj.componentType === 'objective') {
    // Accept simplified OMTM (omtm field) OR title-based OR OKR format OR legacy format
    const hasSimplifiedOMTM = typeof content.omtm === 'string' && content.omtm.trim();
    const hasTitleFormat = typeof content.title === 'string' && content.title.trim();
    const hasOKRFormat = typeof content.objective === 'string' && content.objective.trim();
    const hasLegacyFormat = typeof content.pithy === 'string' && content.pithy.trim();
    if (!hasSimplifiedOMTM && !hasTitleFormat && !hasOKRFormat && !hasLegacyFormat) {
      return false;
    }
  }

  return true;
}

export function validateStrategyVersionOutput(data: unknown): data is StrategyVersionOutputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  if (!['vision', 'strategy', 'objective'].includes(obj.componentType as string)) return false;
  if (typeof obj.version !== 'number') return false;
  if (!['user', 'ai', 'system'].includes(obj.createdBy as string)) return false;
  if (!['generation', 'user_edit', 'coaching'].includes(obj.sourceType as string)) return false;

  return true;
}
