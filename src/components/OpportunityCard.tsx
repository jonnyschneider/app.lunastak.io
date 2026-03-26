'use client';

import { SuccessMetric } from '@/lib/types';
import { getObjectiveTitle } from '@/lib/utils';
import { FlipCard } from './FlipCard';

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
  return (
    <FlipCard
      front={
        <div className={`bg-ds-teal rounded-lg p-4 shadow-sm min-h-[120px] ${status === 'draft' ? 'border border-dashed border-white/30' : ''}`}>
          {/* Title */}
          <p className="text-sm font-semibold text-ds-neon mb-2">{title}</p>

          {/* Success metrics */}
          {!compact && successMetrics.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[10px] font-semibold text-ds-neon uppercase tracking-wider mb-1.5">
                Success Indicator
              </h4>
              {successMetrics.map((metric) => (
                <div key={metric.id} className="mb-2 last:mb-0">
                  {(metric.belief.action || metric.belief.outcome) && (
                    <p className="text-xs text-white/85 leading-relaxed">
                      <span className="font-bold text-ds-neon">We believe</span>{' '}
                      {metric.belief.action}{' '}
                      <span className="font-bold text-ds-neon">will</span>{' '}
                      {metric.belief.outcome}
                    </p>
                  )}
                  {metric.signal && (
                    <div className="mt-1">
                      <p className="text-xs font-semibold text-white">{metric.signal}</p>
                      <p className="text-xs text-white/70 mt-0.5">
                        ↳ {metric.baseline || '?'} → {metric.target}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Related objectives — numbered circles */}
          {!compact && objectiveIds.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ds-neon">
                Related to
              </span>
              {objectiveIds.map(objId => {
                const objIndex = objectives.findIndex(o => o.id === objId);
                if (objIndex === -1) return null;
                const obj = objectives[objIndex];
                return (
                  <div
                    key={objId}
                    className="flex items-center justify-center w-[18px] h-[18px] rounded-full border-[1.5px] border-white/25 text-[10px] font-semibold text-white/70"
                    title={getObjectiveTitle(obj)}
                  >
                    {objIndex + 1}
                  </div>
                );
              })}
            </div>
          )}

          {/* Draft badge */}
          {!compact && status === 'draft' && (
            <div className="mt-2">
              <span className="text-xs px-2 py-0.5 bg-white/20 text-white rounded">
                Draft
              </span>
            </div>
          )}
        </div>
      }
      back={
        <div className="bg-ds-teal rounded-lg p-4 shadow-sm min-h-[120px]">
          <div className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-ds-neon text-ds-teal rounded mb-2">
            Explainer
          </div>
          {description ? (
            <p className="text-sm text-white/85 leading-relaxed">{description}</p>
          ) : (
            <p className="text-sm text-white/40 italic">No description yet</p>
          )}

          {/* Delete button on back */}
          <div className="flex justify-between items-center mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="text-xs text-white/40 hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      }
      onEditClick={() => onEdit(id)}
    />
  );
}
