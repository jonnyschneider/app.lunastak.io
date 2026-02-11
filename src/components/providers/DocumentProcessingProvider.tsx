'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

type DocumentStatus = 'pending' | 'processing' | 'complete' | 'failed';

interface ActiveDocumentProcessing {
  documentId: string;
  projectId: string;
  fileName: string;
  status: DocumentStatus;
  startedAt: Date;
}

interface DocumentProcessingContextValue {
  /** Currently processing documents */
  activeDocuments: ActiveDocumentProcessing[];
  /** Start tracking a new document */
  startProcessing: (documentId: string, projectId: string, fileName: string) => void;
  /** Check if a specific project has documents processing */
  isProcessing: (projectId: string) => boolean;
  /** Get processing count for a project */
  processingCount: (projectId: string) => number;
}

const DocumentProcessingContext = createContext<DocumentProcessingContextValue | null>(null);

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_DURATION = 10 * 60 * 1000; // 10 minutes max for documents

export function DocumentProcessingProvider({ children }: { children: React.ReactNode }) {
  const [activeDocuments, setActiveDocuments] = useState<ActiveDocumentProcessing[]>([]);
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeDocument = useCallback((documentId: string) => {
    const timeout = pollingRefs.current.get(documentId);
    if (timeout) {
      clearTimeout(timeout);
      pollingRefs.current.delete(documentId);
    }
    setActiveDocuments(prev => prev.filter(d => d.documentId !== documentId));
  }, []);

  const startProcessing = useCallback((documentId: string, projectId: string, fileName: string) => {
    setActiveDocuments(prev => [
      ...prev.filter(d => d.documentId !== documentId), // Remove if already exists
      {
        documentId,
        projectId,
        fileName,
        status: 'processing',
        startedAt: new Date(),
      },
    ]);
  }, []);

  // Polling effect for each active document
  useEffect(() => {
    activeDocuments.forEach(doc => {
      if (doc.status === 'complete' || doc.status === 'failed') {
        return;
      }

      // Skip if already polling this document
      if (pollingRefs.current.has(doc.documentId)) {
        return;
      }

      const poll = async () => {
        // Check for timeout
        const elapsed = Date.now() - doc.startedAt.getTime();
        if (elapsed > MAX_POLL_DURATION) {
          setActiveDocuments(prev =>
            prev.map(d =>
              d.documentId === doc.documentId ? { ...d, status: 'failed' as const } : d
            )
          );
          toast.error(`Document "${doc.fileName}" processing timed out`);
          setTimeout(() => removeDocument(doc.documentId), 2000);
          return;
        }

        try {
          const response = await fetch(`/api/documents/${doc.documentId}/status`);

          if (!response.ok) {
            // Continue polling on transient errors
            pollingRefs.current.set(doc.documentId, setTimeout(poll, POLL_INTERVAL));
            return;
          }

          const data = await response.json();

          if (data.status === 'complete') {
            setActiveDocuments(prev =>
              prev.map(d =>
                d.documentId === doc.documentId ? { ...d, status: 'complete' as const } : d
              )
            );

            toast.success(`"${doc.fileName}" processed`);

            // Dispatch event for UI refresh
            window.dispatchEvent(new CustomEvent('documentProcessed', {
              detail: { projectId: doc.projectId, documentId: doc.documentId }
            }));

            setTimeout(() => removeDocument(doc.documentId), 2000);

          } else if (data.status === 'failed') {
            setActiveDocuments(prev =>
              prev.map(d =>
                d.documentId === doc.documentId ? { ...d, status: 'failed' as const } : d
              )
            );

            toast.error(`Failed to process "${doc.fileName}"`, {
              description: data.errorMessage || 'Something went wrong.',
              duration: 8000,
            });

            setTimeout(() => removeDocument(doc.documentId), 2000);

          } else {
            // Still processing, continue polling
            pollingRefs.current.set(doc.documentId, setTimeout(poll, POLL_INTERVAL));
          }
        } catch (err) {
          console.error('[DocumentProcessingProvider] Poll error:', err);
          pollingRefs.current.set(doc.documentId, setTimeout(poll, POLL_INTERVAL));
        }
      };

      // Start polling
      poll();
    });

    return () => {
      // Cleanup timeouts on unmount
      pollingRefs.current.forEach(timeout => clearTimeout(timeout));
      pollingRefs.current.clear();
    };
  }, [activeDocuments, removeDocument]);

  const isProcessing = useCallback((projectId: string) => {
    return activeDocuments.some(
      d => d.projectId === projectId && (d.status === 'pending' || d.status === 'processing')
    );
  }, [activeDocuments]);

  const processingCount = useCallback((projectId: string) => {
    return activeDocuments.filter(
      d => d.projectId === projectId && (d.status === 'pending' || d.status === 'processing')
    ).length;
  }, [activeDocuments]);

  return (
    <DocumentProcessingContext.Provider
      value={{
        activeDocuments,
        startProcessing,
        isProcessing,
        processingCount,
      }}
    >
      {children}
    </DocumentProcessingContext.Provider>
  );
}

export function useDocumentProcessingContext() {
  const context = useContext(DocumentProcessingContext);
  if (!context) {
    throw new Error('useDocumentProcessingContext must be used within DocumentProcessingProvider');
  }
  return context;
}
