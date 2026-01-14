'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions';

interface ExtractionSummaryData {
  conversation: {
    id: string;
    title: string | null;
    status: string;
    projectId: string | null;
  };
  summary: {
    totalFragments: number;
    dimensionsCovered: number;
    dimensions: {
      dimension: Tier1Dimension;
      displayName: string;
      fragmentCount: number;
    }[];
  };
  fragments: {
    id: string;
    content: string;
    contentType: string;
    confidence: string | null;
    dimensions: string[];
  }[];
}

interface ExtractionSummaryProps {
  conversationId: string;
  onDone: () => void;
}

/**
 * Displays a summary of what was extracted from a conversation.
 * Used for subsequent conversations (after first strategy has been generated).
 */
export default function ExtractionSummary({
  conversationId,
  onDone,
}: ExtractionSummaryProps) {
  const [data, setData] = useState<ExtractionSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/conversation/${conversationId}/summary`);
        if (!response.ok) {
          throw new Error('Failed to fetch summary');
        }
        const summaryData = await response.json();
        setData(summaryData);
      } catch (err) {
        console.error('Failed to fetch extraction summary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load summary');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [conversationId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || 'Failed to load summary'}
          </p>
          <Button onClick={onDone} variant="outline">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const { summary, fragments } = data;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="space-y-6">
        {/* Success header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Added to Your Knowledge Base</h2>
          <p className="text-muted-foreground">
            {summary.totalFragments} insight{summary.totalFragments !== 1 ? 's' : ''} captured across{' '}
            {summary.dimensionsCovered} strategic dimension{summary.dimensionsCovered !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Dimension breakdown */}
        {summary.dimensions.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Coverage added</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.dimensions.map(dim => (
                <span
                  key={dim.dimension}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-xs"
                >
                  <span className="text-muted-foreground">{dim.displayName}</span>
                  <span className="font-medium text-green-600">+{dim.fragmentCount}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sample insights (show first 3) */}
        {fragments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Sample insights captured</h3>
            <div className="space-y-2">
              {fragments.slice(0, 3).map(fragment => (
                <div
                  key={fragment.id}
                  className="bg-card border border-border rounded-lg p-3 text-sm"
                >
                  <p className="text-foreground line-clamp-2">{fragment.content}</p>
                </div>
              ))}
              {fragments.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{fragments.length - 3} more insight{fragments.length - 3 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Done button */}
        <div className="pt-2">
          <Button onClick={onDone} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
