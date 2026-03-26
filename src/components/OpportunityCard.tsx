'use client';

import { TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { SuccessMetric } from '@/lib/types';
import { getObjectiveTitle } from '@/lib/utils';
import { FlipCard } from './FlipCard';
import { Button } from '@/components/ui/button';

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
        <div className={`bg-ds-teal rounded-xl p-6 shadow-sm min-h-[120px] ${status === 'draft' ? 'border border-dashed border-white/30' : ''}`}>
          {/* Title */}
          <p className="text-[15px] font-semibold text-ds-neon mb-3">{title}</p>

          {/* Belief statement + Success Indicator heading */}
          {!compact && successMetrics.length > 0 && (
            <div className="mb-3">
              {successMetrics.map((metric) => (
                <div key={metric.id} className="mb-2 last:mb-0">
                  {(metric.belief.action || metric.belief.outcome) && (
                    <p className="text-[13px] text-white/90 leading-relaxed">
                      <span className="italic text-ds-neon font-[family-name:var(--font-ibm-plex-mono)]">We believe</span>{' '}
                      {metric.belief.action}{' '}
                      <span className="italic text-ds-neon font-[family-name:var(--font-ibm-plex-mono)]">will</span>{' '}
                      {metric.belief.outcome}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Goal metrics */}
          {!compact && successMetrics.length > 0 && successMetrics.some(m => m.signal) && (
            <div className="mb-3">
              {successMetrics.map((metric) => metric.signal && (
                <div key={metric.id} className="mb-2 last:mb-0">
                  <p className="text-[13px] font-bold text-white flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-4 h-4 text-ds-neon shrink-0" strokeWidth={3} />
                    {metric.signal}
                  </p>
                  {(metric.baseline || metric.target) && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded px-2.5 py-1.5">
                        <p className="text-[13px] italic text-white font-[family-name:var(--font-ibm-plex-mono)] text-center">{metric.baseline || '?'}</p>
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                        <span className="text-ds-neon font-bold text-[15px]">→</span>
                        <span className="text-[10px] font-bold text-ds-neon uppercase -mt-0.5">to</span>
                      </div>
                      <div className="flex-1 rounded px-2.5 py-1.5">
                        <p className="text-[13px] italic text-white font-[family-name:var(--font-ibm-plex-mono)] text-center">{metric.target}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Related objectives — numbered circles */}
          {!compact && objectiveIds.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-ds-neon/80">
                Related to
              </span>
              {objectiveIds.map(objId => {
                const objIndex = objectives.findIndex(o => o.id === objId);
                if (objIndex === -1) return null;
                const obj = objectives[objIndex];
                return (
                  <div
                    key={objId}
                    className="flex items-center justify-center w-[18px] h-[18px] rounded-full border-[1.5px] border-white/80 text-[10px] font-semibold text-white"
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
              <span className="text-[13px] px-2 py-0.5 bg-white/20 text-white rounded">
                Draft
              </span>
            </div>
          )}
        </div>
      }
      back={
        <div className="bg-ds-teal rounded-xl p-6 shadow-sm min-h-[120px]">
          <div className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-ds-neon text-ds-teal rounded mb-3">
            Explainer
          </div>
          {description ? (
            <p className="text-[13px] text-white leading-relaxed">{description}</p>
          ) : (
            <p className="text-[13px] text-white/40 italic">No description yet</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="text-white/40 hover:text-red-400 hover:bg-white/10 gap-1.5">
              <Trash2 className="h-3 w-3" />
              <span className="text-[13px]">Delete</span>
            </Button>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onEdit(id); }} className="bg-white text-ds-teal hover:bg-white/90 gap-1.5">
              <Pencil className="h-3 w-3" />
              <span className="text-[13px]">Edit</span>
            </Button>
          </div>
        </div>
      }
      onEditClick={() => onEdit(id)}
      hideEditButton
    />
  );
}
