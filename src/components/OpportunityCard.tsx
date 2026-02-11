'use client';

import { Sparkles } from 'lucide-react';
import { SuccessMetric } from '@/lib/types';
import { getObjectiveTitle } from '@/lib/utils';

interface ObjectiveForLinking {
  id: string;
  title?: string;
  pithy?: string;
  objective?: string;
}

interface OpportunityCardProps {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'complete';
  successMetrics?: SuccessMetric[];
  objectiveIds?: string[];
  objectives: ObjectiveForLinking[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onImproveWithAI?: () => void;
  compact?: boolean;
}

export function OpportunityCard({
  id,
  title,
  description,
  status,
  successMetrics = [],
  objectiveIds = [],
  objectives,
  onEdit,
  onDelete,
  onImproveWithAI,
  compact = false,
}: OpportunityCardProps) {
  const showWarning = !compact && status === 'draft' && objectiveIds.length === 0;

  // Get linked objectives
  const linkedObjectives = objectiveIds
    .map(objId => objectives.find(o => o.id === objId))
    .filter(Boolean) as ObjectiveForLinking[];

  return (
    <div className={`
      bg-ds-teal rounded-lg p-4 relative group transition-shadow hover:shadow-md shadow-sm
      ${status === 'draft' ? 'border border-dashed border-white/30' : ''}
    `}>
      {/* Status badges & actions */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {!compact && onImproveWithAI && (
          <button
            onClick={onImproveWithAI}
            className="flex items-center gap-1 text-xs text-ds-neon/70 hover:text-ds-neon transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Improve with AI
          </button>
        )}
        {!compact && status === 'draft' && (
          <span className="text-xs px-2 py-0.5 bg-white/20 text-white rounded">
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
          className="text-white/50 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={() => onDelete(id)}
          className="text-white/50 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="pr-20">
        <p className="text-sm font-medium text-ds-neon">
          {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-white">
            {description}
          </p>
        )}
      </div>

      {!compact && (
        <>
          {/* Success Metrics */}
          {successMetrics.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <h4 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">
                Success Metrics
              </h4>
              <div className="space-y-2">
                {successMetrics.map((metric) => (
                  <div key={metric.id} className="text-xs space-y-0.5">
                    {(metric.belief.action || metric.belief.outcome) && (
                      <p className="text-white/70 italic">
                        We believe {metric.belief.action} will {metric.belief.outcome}
                      </p>
                    )}
                    <p className="font-medium text-white">
                      <span className="text-white">{metric.signal}:</span> <span className="text-ds-neon">{metric.baseline || '?'} → {metric.target}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked objectives */}
          {linkedObjectives.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <h4 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">
                Supports
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {linkedObjectives.map(obj => (
                  <span
                    key={obj.id}
                    className="text-xs px-2 py-0.5 bg-white/20 text-white rounded"
                  >
                    {getObjectiveTitle(obj)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* No links indicator */}
          {linkedObjectives.length === 0 && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-xs text-white/50 italic">
                No objectives linked
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
