'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { GenerationStatus } from '@/lib/contracts/generation-status';

interface ActiveGeneration {
  generationId: string;
  projectId: string;
  status: GenerationStatus;
  startedAt: Date;
}

interface GenerationStatusContextValue {
  /** Currently active generation (if any) */
  activeGeneration: ActiveGeneration | null;
  /** Start tracking a new generation */
  startGeneration: (generationId: string, projectId: string) => void;
  /** Stop tracking (called on completion or navigation away) */
  stopTracking: () => void;
  /** Check if a specific project has an active generation (generating/pending only) */
  isGenerating: (projectId: string) => boolean;
  /** Check if a specific project has any active generation (any status, until cleared) */
  hasActiveGeneration: (projectId: string) => boolean;
}

const GenerationStatusContext = createContext<GenerationStatusContextValue | null>(null);

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_DURATION = 5 * 60 * 1000; // 5 minutes max polling

export function GenerationStatusProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeGeneration, setActiveGeneration] = useState<ActiveGeneration | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopTracking = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    setActiveGeneration(null);
  }, []);

  const startGeneration = useCallback((generationId: string, projectId: string) => {
    // Stop any existing polling
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
    }

    setActiveGeneration({
      generationId,
      projectId,
      status: 'generating',
      startedAt: new Date(),
    });
  }, []);

  // Polling effect
  useEffect(() => {
    if (!activeGeneration || activeGeneration.status === 'complete' || activeGeneration.status === 'failed') {
      return;
    }

    const poll = async () => {
      // Check for timeout
      const elapsed = Date.now() - activeGeneration.startedAt.getTime();
      if (elapsed > MAX_POLL_DURATION) {
        setActiveGeneration(prev => prev ? { ...prev, status: 'failed' } : null);
        toast.error('Strategy generation timed out', {
          description: 'The generation is taking longer than expected. Please try again.',
          duration: 8000,
        });
        setTimeout(() => setActiveGeneration(null), 2000);
        return;
      }

      try {
        const response = await fetch(`/api/generation-status/${activeGeneration.generationId}`);

        if (!response.ok) {
          // Continue polling on transient errors
          pollingRef.current = setTimeout(poll, POLL_INTERVAL);
          return;
        }

        const data = await response.json();

        if (data.status === 'complete') {
          setActiveGeneration(prev => prev ? { ...prev, status: 'complete' } : null);

          // Show toast with action to view strategy
          toast.success('Your strategy is ready', {
            description: 'Click to view your new strategy',
            action: {
              label: 'View',
              onClick: () => {
                if (data.traceId) {
                  router.push(`/strategy/${data.traceId}`);
                }
              },
            },
            duration: 10000, // 10 seconds
          });

          // Dispatch event for sidebar refresh
          window.dispatchEvent(new CustomEvent('generationComplete', {
            detail: { projectId: activeGeneration.projectId, traceId: data.traceId }
          }));

          // Clear after a moment to allow UI to update
          setTimeout(() => setActiveGeneration(null), 2000);

        } else if (data.status === 'failed') {
          setActiveGeneration(prev => prev ? { ...prev, status: 'failed' } : null);

          toast.error('Strategy generation failed', {
            description: data.error || 'Something went wrong. Please try again.',
            duration: 8000,
          });

          // Clear after a moment
          setTimeout(() => setActiveGeneration(null), 2000);

        } else {
          // Still in progress, update status and continue polling
          setActiveGeneration(prev => prev ? { ...prev, status: data.status } : null);
          pollingRef.current = setTimeout(poll, POLL_INTERVAL);
        }
      } catch (err) {
        console.error('[GenerationStatusProvider] Poll error:', err);
        // Continue polling on network errors
        pollingRef.current = setTimeout(poll, POLL_INTERVAL);
      }
    };

    // Start polling immediately
    poll();

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeGeneration?.generationId, activeGeneration?.status, router]);

  const isGenerating = useCallback((projectId: string) => {
    return activeGeneration?.projectId === projectId &&
      (activeGeneration.status === 'generating' || activeGeneration.status === 'pending');
  }, [activeGeneration]);

  // Returns true if there's any active generation for this project (any status)
  // Use this for UI elements that should stay hidden until generation fully clears
  const hasActiveGeneration = useCallback((projectId: string) => {
    return activeGeneration?.projectId === projectId;
  }, [activeGeneration]);

  return (
    <GenerationStatusContext.Provider
      value={{
        activeGeneration,
        startGeneration,
        stopTracking,
        isGenerating,
        hasActiveGeneration,
      }}
    >
      {children}
    </GenerationStatusContext.Provider>
  );
}

export function useGenerationStatusContext() {
  const context = useContext(GenerationStatusContext);
  if (!context) {
    throw new Error('useGenerationStatusContext must be used within GenerationStatusProvider');
  }
  return context;
}
