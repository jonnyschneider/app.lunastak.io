'use client';

import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';

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
      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              We've read your document: {filename}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Try Another File
        </button>
        <button
          onClick={onContinue}
          className="px-6 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium"
        >
          Continue
        </button>
      </div>

      <p className="text-xs text-center text-zinc-500 dark:text-zinc-500">
        We'll ask a few clarifying questions to fill in any gaps
      </p>
    </div>
  );
}
