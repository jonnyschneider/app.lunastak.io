// src/lib/contracts/strategy-version.ts
/**
 * Strategy Version Contracts
 *
 * Defines what /api/project/[id]/strategy-version expects and produces.
 */

import { ObjectiveContract } from './generation';

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

export interface ObjectiveContentContract {
  title?: string;  // Short title (3-5 words) for lists/linking
  pithy: string;
  metric: ObjectiveContract['metric'];
  explanation: string;
  successCriteria: string;
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
    if (typeof content.pithy !== 'string' || !content.pithy.trim()) {
      return false;
    }
    if (!content.metric || typeof content.metric !== 'object') {
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
