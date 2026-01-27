'use client';

import { CoachingResult } from '@/lib/opportunity-coaching';

interface OpportunityCoachingProps {
  result: CoachingResult;
  onRewriteClick: () => void;
}

export function OpportunityCoaching({ result, onRewriteClick }: OpportunityCoachingProps) {
  const { criteria, overallStrength } = result;

  const allPassed = criteria.every(c => c.passed);

  return (
    <div className={`mt-3 p-3 rounded-lg border ${
      allPassed ? 'bg-green-50 border-green-200' : 'bg-muted/50 border-border'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium uppercase tracking-wide ${
          allPassed ? 'text-green-700' : 'text-muted-foreground'
        }`}>
          {allPassed ? 'Nice one! This is a well-crafted opportunity' : 'Suggested improvements'}
        </span>
        {!allPassed && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            overallStrength === 'strong' ? 'bg-green-100 text-green-700' :
            overallStrength === 'okay' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {overallStrength === 'strong' ? 'Strong' :
             overallStrength === 'okay' ? 'Okay' : 'Weak'}
          </span>
        )}
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
        <div className="mt-3 flex justify-end">
          <button
            onClick={onRewriteClick}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Rewrite with suggestions
          </button>
        </div>
      )}
    </div>
  );
}
