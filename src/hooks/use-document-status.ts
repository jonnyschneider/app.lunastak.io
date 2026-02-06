// src/hooks/use-document-status.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type DocumentStatus = 'pending' | 'processing' | 'complete' | 'failed'

interface DocumentStatusResponse {
  status: DocumentStatus
  fileName: string
  errorMessage?: string
  processedAt?: string
}

interface UseDocumentStatusOptions {
  /** Polling interval in ms. Default: 2000 (2 seconds) */
  pollInterval?: number
  /** Called when processing completes successfully */
  onComplete?: (documentId: string) => void
  /** Called when processing fails */
  onError?: (error: string) => void
}

interface UseDocumentStatusReturn {
  /** Current document status */
  status: DocumentStatus | null
  /** Error message (available when failed) */
  error: string | null
  /** Whether polling is active */
  isPolling: boolean
  /** Start polling for a document ID */
  startPolling: (documentId: string) => void
  /** Stop polling */
  stopPolling: () => void
}

const DEFAULT_POLL_INTERVAL = 2000

/**
 * Hook to poll for document processing status.
 *
 * Usage:
 * ```tsx
 * const { status, isPolling, startPolling } = useDocumentStatus({
 *   onComplete: () => toast.success('Document processed'),
 *   onError: (error) => toast.error(error),
 * })
 *
 * // After upload returns
 * startPolling(documentId)
 * ```
 */
export function useDocumentStatus(
  options: UseDocumentStatusOptions = {}
): UseDocumentStatusReturn {
  const { pollInterval = DEFAULT_POLL_INTERVAL, onComplete, onError } = options

  const [documentId, setDocumentId] = useState<string | null>(null)
  const [status, setStatus] = useState<DocumentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  onCompleteRef.current = onComplete
  onErrorRef.current = onError

  const stopPolling = useCallback(() => {
    setDocumentId(null)
    setIsPolling(false)
  }, [])

  const startPolling = useCallback((id: string) => {
    setDocumentId(id)
    setStatus('processing')
    setError(null)
    setIsPolling(true)
  }, [])

  useEffect(() => {
    if (!documentId || !isPolling) {
      return
    }

    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/status`)

        if (!response.ok) {
          console.error('[useDocumentStatus] Poll failed:', response.status)
          if (isMounted && isPolling) {
            timeoutId = setTimeout(poll, pollInterval)
          }
          return
        }

        const data: DocumentStatusResponse = await response.json()

        if (!isMounted) return

        setStatus(data.status)

        if (data.status === 'complete') {
          setIsPolling(false)
          onCompleteRef.current?.(documentId)
        } else if (data.status === 'failed') {
          setError(data.errorMessage || 'Processing failed')
          setIsPolling(false)
          onErrorRef.current?.(data.errorMessage || 'Processing failed')
        } else {
          timeoutId = setTimeout(poll, pollInterval)
        }
      } catch (err) {
        console.error('[useDocumentStatus] Poll error:', err)
        if (isMounted && isPolling) {
          timeoutId = setTimeout(poll, pollInterval)
        }
      }
    }

    poll()

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [documentId, isPolling, pollInterval])

  return {
    status,
    error,
    isPolling,
    startPolling,
    stopPolling,
  }
}
