'use client';

import { WandSparkles } from 'lucide-react';
import { CoachingResult } from '@/lib/opportunity-coaching';

interface OpportunityCoachingProps {
  result: CoachingResult;
  onRewriteClick: () => void;
}

export function OpportunityCoaching({ result, onRewriteClick }: OpportunityCoachingProps) {
  const { criteria } = result;

  const allPassed = criteria.every(c => c.passed);

  return (
    <div className={`mt-3 p-3 rounded-lg border ${
      allPassed ? 'bg-green-50 border-green-200' : 'bg-muted/50 border-border'
    }`}>
      <div className="mb-2">
        <span className={`text-xs font-medium uppercase tracking-wide ${
          allPassed ? 'text-green-700' : 'text-muted-foreground'
        }`}>
          {allPassed ? 'Nice one! This is a well-crafted opportunity' : 'Suggested improvements'}
        </span>
      </div>

      <ul className="space-y-1.5">
        {criteria.map((criterion) => (
          <li key={criterion.id} className="flex items-start gap-2 text-sm">
            <span className={criterion.passed ? 'text-green-600' : 'text-amber-500'}>
              {criterion.passed ? '✓' : '⚠'}
            </span>
            <span className={criterion.passed ? 'text-muted-foreground' : 'text-foreground'}>
              {criterion.passed ? criterion.label : criterion.suggestion}
            </span>
          </li>
        ))}
      </ul>

      {!allPassed && (
        <div className="mt-3">
          <button
            onClick={onRewriteClick}
            className="text-sm text-primary hover:underline flex items-center gap-1.5"
          >
            <WandSparkles className="h-3.5 w-3.5" />
            Rewrite with suggestions
          </button>
        </div>
      )}
    </div>
  );
}
