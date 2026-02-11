// src/lib/contracts/deep-dive.ts
/**
 * Deep Dive Contracts
 *
 * Defines types and validation for Deep Dive entities.
 * Deep Dives are user-initiated priority topics that organize
 * conversations and documents for focused exploration.
 */

// Status values
export const DEEP_DIVE_STATUSES = ['pending', 'active', 'resolved'] as const;
export type DeepDiveStatus = typeof DEEP_DIVE_STATUSES[number];

// Origin values - how the deep dive was created
export const DEEP_DIVE_ORIGINS = ['manual', 'message', 'document'] as const;
export type DeepDiveOrigin = typeof DEEP_DIVE_ORIGINS[number];

// Core deep dive contract
export interface DeepDiveContract {
  id: string;
  projectId: string;
  topic: string;
  notes?: string;
  status: DeepDiveStatus;
  origin: DeepDiveOrigin;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Input for creating a deep dive
export interface DeepDiveCreateInput {
  projectId: string;
  topic: string;
  notes?: string;
  origin?: DeepDiveOrigin;
}

// Deep dive with counts for list views
export interface DeepDiveWithCounts extends DeepDiveContract {
  conversationCount: number;
  documentCount: number;
  lastActivityAt?: string;
}

// Validation functions
export function isValidDeepDiveStatus(status: string): status is DeepDiveStatus {
  return DEEP_DIVE_STATUSES.includes(status as DeepDiveStatus);
}

export function isValidDeepDiveOrigin(origin: string): origin is DeepDiveOrigin {
  return DEEP_DIVE_ORIGINS.includes(origin as DeepDiveOrigin);
}

export function validateDeepDive(data: unknown): data is DeepDiveContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  if (typeof obj.topic !== 'string' || !obj.topic) return false;
  if (typeof obj.status !== 'string' || !isValidDeepDiveStatus(obj.status)) return false;
  if (typeof obj.origin !== 'string' || !isValidDeepDiveOrigin(obj.origin)) return false;
  if (typeof obj.createdAt !== 'string' || !obj.createdAt) return false;
  if (typeof obj.updatedAt !== 'string' || !obj.updatedAt) return false;

  // Optional fields
  if (obj.notes !== undefined && obj.notes !== null && typeof obj.notes !== 'string') return false;
  if (obj.resolvedAt !== undefined && obj.resolvedAt !== null && typeof obj.resolvedAt !== 'string') return false;

  return true;
}

export function validateDeepDiveCreateInput(data: unknown): data is DeepDiveCreateInput {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  if (typeof obj.topic !== 'string' || !obj.topic) return false;

  // Optional fields
  if (obj.notes !== undefined && obj.notes !== null && typeof obj.notes !== 'string') return false;
  if (obj.origin !== undefined && obj.origin !== null) {
    if (typeof obj.origin !== 'string' || !isValidDeepDiveOrigin(obj.origin)) return false;
  }

  return true;
}
