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
  compact?: boolean;
  readOnly?: boolean;
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
  compact = false,
  readOnly = false,
}: OpportunityCardProps) {
  return (
    <FlipCard
      front={
        <div className="bg-ds-teal rounded-xl p-6 shadow-sm min-h-[120px]">
          {/* Title */}
          <p className="text-sm font-bold text-ds-neon mb-3">{title}</p>

          {/* Description — shown on front when no structured metrics */}
          {!compact && successMetrics.length === 0 && description && (
            <p className="text-sm text-white/90 leading-relaxed mb-3">{description}</p>
          )}

          {/* Primary metric only on front (first metric) */}
          {!compact && successMetrics.length > 0 && (() => {
            const metric = successMetrics[0]
            return (
              <div className="mb-3">
                {metric.belief && (metric.belief.action || metric.belief.outcome) && (
                  <p className="text-sm text-white/90 leading-relaxed mb-3">
                    <span className="italic font-semibold text-ds-neon font-[family-name:var(--font-ibm-plex-mono)]">We believe</span>{' '}
                    {metric.belief.action}{' '}
                    <span className="italic font-semibold text-ds-neon font-[family-name:var(--font-ibm-plex-mono)]">will</span>{' '}
                    {metric.belief.outcome}
                  </p>
                )}
                {metric.signal && (
                  <>
                    <p className="text-sm text-white/90 mb-1">
                      <span className="italic font-semibold text-ds-neon font-[family-name:var(--font-ibm-plex-mono)]">Success is when...</span>
                    </p>
                    <p className="text-sm font-bold text-white flex items-center gap-1.5 mb-2">
                      <TrendingUp className="w-4 h-4 text-ds-neon shrink-0" strokeWidth={3} />
                      {metric.signal}
                    </p>
                    {(metric.baseline || metric.target) && (
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="flex-1 min-w-0 rounded px-2.5 py-1.5">
                          <p className="text-xs italic text-white font-[family-name:var(--font-ibm-plex-mono)] text-center break-words">{metric.baseline || '?'}</p>
                        </div>
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-ds-neon font-bold text-sm">→</span>
                        </div>
                        <div className="flex-1 min-w-0 rounded px-2.5 py-1.5">
                          <p className="text-xs italic text-white font-[family-name:var(--font-ibm-plex-mono)] text-center break-words">{metric.target}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })()}

          {/* Related objectives — numbered circles */}
          {!compact && objectiveIds.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-ds-neon/80">
                Related to
              </span>
              {objectiveIds.map(objId => {
                const objIndex = objectives.findIndex(o => o.id === objId);
                if (objIndex === -1) return null;
                const obj = objectives[objIndex];
                return (
                  <div
                    key={objId}
                    className="flex items-center justify-center w-[18px] h-[18px] rounded-full border-[1.5px] border-white/80 text-[10px] font-bold text-white"
                    title={getObjectiveTitle(obj)}
                  >
                    {objIndex + 1}
                  </div>
                );
              })}
              </div>
            </div>
          )}

        </div>
      }
      back={
        <div className="bg-ds-teal rounded-xl p-6 shadow-sm min-h-[120px]">
          <div className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-ds-neon text-ds-teal rounded mb-3">
            Explainer
          </div>
          {/* When no structured metrics, show guidance instead of description */}
          {successMetrics.length === 0 && (
            <div>
              <p className="text-sm text-white/90 leading-relaxed mb-4">
                Define a testable hypothesis and success metric to turn this opportunity into an actionable experiment.
              </p>
              <div className="rounded bg-white/5 p-4 space-y-2">
                <p className="text-sm text-white/70">
                  <span className="italic font-semibold text-ds-neon/70 font-[family-name:var(--font-ibm-plex-mono)]">We believe</span>{' '}
                  <span className="text-white/50">[action]</span>{' '}
                  <span className="italic font-semibold text-ds-neon/70 font-[family-name:var(--font-ibm-plex-mono)]">will</span>{' '}
                  <span className="text-white/50">[outcome]</span>
                </p>
                <p className="text-sm text-white/50">
                  <span className="font-bold">📈 Signal name</span>
                </p>
                <p className="text-sm italic text-white/40 font-[family-name:var(--font-ibm-plex-mono)]">
                  baseline → target
                </p>
              </div>
            </div>
          )}

          {/* Description as explainer when metrics exist (description is on front only when no metrics) */}
          {successMetrics.length > 0 && description && (
            <p className="text-sm text-white/90 leading-relaxed">{description}</p>
          )}

          {/* Actions */}
          {!readOnly && (
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="text-white/40 hover:text-red-400 hover:bg-white/10 gap-1.5">
                <Trash2 className="h-3 w-3" />
                <span className="text-sm">Delete</span>
              </Button>
              <Button size="sm" onClick={(e) => { e.stopPropagation(); onEdit(id); }} className="bg-white text-ds-teal hover:bg-white/90 gap-1.5">
                <Pencil className="h-3 w-3" />
                <span className="text-sm">Edit</span>
              </Button>
            </div>
          )}
        </div>
      }
      onEditClick={() => onEdit(id)}
      hideEditButton
    />
  );
}
