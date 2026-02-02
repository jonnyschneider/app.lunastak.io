'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GenerationStatus,
  GenerationStatusResponseContract,
} from '@/lib/contracts/generation-status';

interface UseGenerationStatusOptions {
  /** Polling interval in ms. Default: 2000 (2 seconds) */
  pollInterval?: number;
  /** Called when generation completes successfully */
  onComplete?: (traceId: string) => void;
  /** Called when generation fails */
  onError?: (error: string) => void;
}

interface UseGenerationStatusReturn {
  /** Current generation status */
  status: GenerationStatus | null;
  /** Trace ID (available when complete) */
  traceId: string | null;
  /** Error message (available when failed) */
  error: string | null;
  /** Whether polling is active */
  isPolling: boolean;
  /** Start polling for a generation ID */
  startPolling: (generationId: string) => void;
  /** Stop polling */
  stopPolling: () => void;
}

const DEFAULT_POLL_INTERVAL = 2000; // 2 seconds

/**
 * Hook to poll for generation status.
 *
 * Usage:
 * ```tsx
 * const { status, traceId, error, isPolling, startPolling } = useGenerationStatus({
 *   onComplete: (traceId) => router.push(`/strategy/${traceId}`),
 *   onError: (error) => toast.error(error),
 * });
 *
 * // After calling /api/generate
 * startPolling(generationId);
 * ```
 */
export function useGenerationStatus(
  options: UseGenerationStatusOptions = {}
): UseGenerationStatusReturn {
  const { pollInterval = DEFAULT_POLL_INTERVAL, onComplete, onError } = options;

  const [generationId, setGenerationId] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Use refs for callbacks to avoid re-creating the effect
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const stopPolling = useCallback(() => {
    setGenerationId(null);
    setIsPolling(false);
  }, []);

  const startPolling = useCallback((id: string) => {
    // Reset state for new generation
    setGenerationId(id);
    setStatus('generating');
    setTraceId(null);
    setError(null);
    setIsPolling(true);
  }, []);

  // Polling effect
  useEffect(() => {
    if (!generationId || !isPolling) {
      return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      try {
        const response = await fetch(`/api/generation-status/${generationId}`);

        if (!response.ok) {
          console.error('[useGenerationStatus] Poll failed:', response.status);
          // Continue polling on transient errors
          if (isMounted && isPolling) {
            timeoutId = setTimeout(poll, pollInterval);
          }
          return;
        }

        const data: GenerationStatusResponseContract = await response.json();

        if (!isMounted) return;

        setStatus(data.status);

        if (data.status === 'complete') {
          setTraceId(data.traceId || null);
          setIsPolling(false);
          onCompleteRef.current?.(data.traceId!);
        } else if (data.status === 'failed') {
          setError(data.error || 'Generation failed');
          setIsPolling(false);
          onErrorRef.current?.(data.error || 'Generation failed');
        } else {
          // Still in progress, continue polling
          timeoutId = setTimeout(poll, pollInterval);
        }
      } catch (err) {
        console.error('[useGenerationStatus] Poll error:', err);
        // Continue polling on network errors
        if (isMounted && isPolling) {
          timeoutId = setTimeout(poll, pollInterval);
        }
      }
    };

    // Start polling immediately
    poll();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [generationId, isPolling, pollInterval]);

  return {
    status,
    traceId,
    error,
    isPolling,
    startPolling,
    stopPolling,
  };
}
