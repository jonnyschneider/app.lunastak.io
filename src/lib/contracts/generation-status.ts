// src/lib/contracts/generation-status.ts
/**
 * Generation Status Contracts
 *
 * Defines contracts for the background generation flow:
 * - Fire-and-forget /api/generate response
 * - Polling /api/generation-status/[id] response
 * - Mark viewed /api/generation/[id]/viewed response
 */

// Generation status enum
export type GenerationStatus = 'pending' | 'generating' | 'complete' | 'failed';

/**
 * Response from /api/generate when using fire-and-forget mode.
 * Returns immediately after starting generation.
 */
export interface GenerationStartedContract {
  status: 'started';
  generationId: string;
}

/**
 * Response from /api/generation-status/[id] polling endpoint.
 */
export interface GenerationStatusResponseContract {
  status: GenerationStatus;
  traceId?: string;      // Set when complete
  error?: string;        // Set when failed
  startedAt?: string;    // ISO timestamp
  completedAt?: string;  // ISO timestamp, set when complete
}

/**
 * Response from /api/generation/[id]/viewed endpoint.
 */
export interface GenerationViewedResponseContract {
  success: boolean;
  viewedAt: string;  // ISO timestamp
}

// Validation functions

export function validateGenerationStarted(data: unknown): data is GenerationStartedContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (obj.status !== 'started') return false;
  if (typeof obj.generationId !== 'string' || !obj.generationId) return false;

  return true;
}

export function validateGenerationStatusResponse(data: unknown): data is GenerationStatusResponseContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Status must be valid
  const validStatuses: GenerationStatus[] = ['pending', 'generating', 'complete', 'failed'];
  if (!validStatuses.includes(obj.status as GenerationStatus)) return false;

  // traceId required when complete
  if (obj.status === 'complete') {
    if (typeof obj.traceId !== 'string' || !obj.traceId) return false;
  }

  // error should be present when failed
  if (obj.status === 'failed') {
    if (typeof obj.error !== 'string') return false;
  }

  return true;
}

export function validateGenerationViewedResponse(data: unknown): data is GenerationViewedResponseContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.success !== 'boolean') return false;
  if (typeof obj.viewedAt !== 'string' || !obj.viewedAt) return false;

  return true;
}

// Type guard for checking if generation is still in progress
export function isGenerationInProgress(status: GenerationStatus): boolean {
  return status === 'pending' || status === 'generating';
}

// Type guard for checking if generation has finished (success or failure)
export function isGenerationFinished(status: GenerationStatus): boolean {
  return status === 'complete' || status === 'failed';
}
