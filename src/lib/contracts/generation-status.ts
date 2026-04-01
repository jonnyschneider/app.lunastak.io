// src/lib/contracts/generation-status.ts
/**
 * Generation Status Contracts
 */

// Legacy status type — still used by BackgroundTaskProvider and GenerationStatusIndicator
export type GenerationStatus = 'pending' | 'generating' | 'complete' | 'failed';

// Project-level generation status (DecisionStack-based polling)
export type ProjectGenerationStatus = 'idle' | 'generating' | 'generating_opportunities';

/**
 * Response from /api/project/[id]/generation-status polling endpoint.
 */
export interface ProjectGenerationStatusContract {
  status: ProjectGenerationStatus;
  startedAt: string | null;
}

/**
 * Response from fire-and-forget generation API routes.
 * Returns immediately after starting generation.
 */
export interface GenerationStartedContract {
  status: 'started';
  generationId: string;
}

// Validation
export function validateGenerationStarted(data: unknown): data is GenerationStartedContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (obj.status !== 'started') return false;
  if (typeof obj.generationId !== 'string' || !obj.generationId) return false;

  return true;
}
