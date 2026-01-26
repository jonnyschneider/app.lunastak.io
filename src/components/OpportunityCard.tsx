'use client';

import { parseOpportunityContent } from '@/lib/opportunity-coaching';

interface ObjectiveContribution {
  objectiveId: string;
  contribution: string;
}

interface ObjectiveForLinking {
  id: string;
  pithy: string;
}

interface OpportunityCardProps {
  id: string;
  content: string;
  status: 'draft' | 'complete';
  coachingDismissed?: boolean;
  objectiveContributions?: ObjectiveContribution[];
  objectives: ObjectiveForLinking[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function OpportunityCard({
  id,
  content,
  status,
  coachingDismissed,
  objectiveContributions = [],
  objectives,
  onEdit,
  onDelete,
}: OpportunityCardProps) {
  const parsed = parseOpportunityContent(content);
  const showWarning = status === 'draft' && !coachingDismissed;

  // Get linked objectives with their contributions
  const linkedObjectives = objectiveContributions
    .map(oc => {
      const obj = objectives.find(o => o.id === oc.objectiveId);
      return obj ? { ...obj, contribution: oc.contribution } : null;
    })
    .filter(Boolean) as (ObjectiveForLinking & { contribution: string })[];

  return (
    <div className={`
      bg-white border rounded-lg p-4 relative group transition-shadow hover:shadow-md
      ${status === 'draft' ? 'border-dashed border-muted-foreground/50' : 'border-[#0A2933]'}
    `}>
      {/* Status badges */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {status === 'draft' && (
          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
            Draft
          </span>
        )}
        {showWarning && (
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
            Needs links
          </span>
        )}

        {/* Edit button */}
        <button
          onClick={() => onEdit(id)}
          className="text-[#0A2933]/50 hover:text-[#0A2933]/80 transition-colors opacity-0 group-hover:opacity-100"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={() => onDelete(id)}
          className="text-[#0A2933]/50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="pr-20">
        <p className="text-sm font-medium text-[#0A2933]">
          {parsed.title}
        </p>
        {parsed.details && (
          <p className="mt-1 text-sm text-muted-foreground">
            {parsed.details}
          </p>
        )}
      </div>

      {/* Linked objectives with contributions */}
      {linkedObjectives.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="space-y-1.5">
            {linkedObjectives.map(obj => (
              <div key={obj.id} className="flex items-start gap-2 text-xs">
                <span className="text-[#0A2933]/50">→</span>
                <div className="flex-1 min-w-0">
                  <span className="text-muted-foreground truncate block">
                    {obj.pithy}
                  </span>
                  {obj.contribution && (
                    <span className="text-[#0A2933] font-medium">
                      {obj.contribution}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No links indicator */}
      {linkedObjectives.length === 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground italic">
            No objectives linked
          </p>
        </div>
      )}
    </div>
  );
}
