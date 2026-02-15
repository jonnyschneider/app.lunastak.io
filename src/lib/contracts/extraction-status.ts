/**
 * Extraction Status Contracts
 *
 * Defines contracts for the background extraction polling flow.
 * Used by BackgroundTaskProvider to track extraction completion.
 */

export type ExtractionStatus = 'extracting' | 'extracted' | 'extraction_failed'

/**
 * Response from GET /api/extraction-status/[conversationId]
 */
export interface ExtractionStatusResponseContract {
  status: ExtractionStatus
  fragmentCount?: number  // Set when extracted
  error?: string          // Set when failed
}

export function validateExtractionStatusResponse(
  data: unknown
): data is ExtractionStatusResponseContract {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>

  const validStatuses: ExtractionStatus[] = ['extracting', 'extracted', 'extraction_failed']
  if (!validStatuses.includes(obj.status as ExtractionStatus)) return false

  if (obj.status === 'extracted' && typeof obj.fragmentCount !== 'number') return false
  if (obj.status === 'extraction_failed' && typeof obj.error !== 'string') return false

  return true
}

export function isExtractionInProgress(status: ExtractionStatus): boolean {
  return status === 'extracting'
}

export function isExtractionFinished(status: ExtractionStatus): boolean {
  return status === 'extracted' || status === 'extraction_failed'
}
