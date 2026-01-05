'use client';

import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface DocumentSummaryProps {
  filename: string;
  summary: string;
  onContinue: () => void;
  onRetry: () => void;
}

export function DocumentSummary({
  filename,
  summary,
  onContinue,
  onRetry,
}: DocumentSummaryProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-muted rounded-lg p-6">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground mb-2">
              We've read your document: {filename}
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
        >
          Try Another File
        </button>
        <button
          onClick={onContinue}
          className="px-6 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          Continue
        </button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        We'll ask a few clarifying questions to fill in any gaps
      </p>
    </div>
  );
}
