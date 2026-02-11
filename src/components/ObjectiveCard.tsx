'use client';

import { Objective } from '@/lib/types';
import { FlipCard } from '@/components/ui/flip-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon, PencilIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { getObjectiveTitle } from '@/lib/utils';
import { normalizeToOMTM } from '@/lib/objective-omtm-migration';
import { MetricProgress } from './MetricProgress';

interface ObjectiveCardProps {
  objective: Objective;
  isFilterActive: boolean;
  onToggleFilter: () => void;
  onEdit?: () => void;
}

export function ObjectiveCard({ objective, isFilterActive, onToggleFilter, onEdit }: ObjectiveCardProps) {
  const normalizedObjective = normalizeToOMTM(objective);

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent flip when clicking filter toggle
    onToggleFilter();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent flip when clicking edit
    onEdit?.();
  };

  const frontContent = (
    <Card className={clsx(
      'h-full border-border hover:shadow-lg transition-shadow duration-200 group',
      isFilterActive && 'ring-2 ring-primary'
    )}>
      <CardContent className="p-6 h-full flex flex-col">
        {/* Header Row - Filter Toggle, Title, Edit, Metric */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2">
            <button
              onClick={handleToggleClick}
              className="p-1 hover:bg-muted rounded transition-colors"
              aria-label={isFilterActive ? 'Hide related initiatives' : 'Show related initiatives'}
            >
              {isFilterActive ? (
                <EyeIcon className="w-5 h-5 text-muted-foreground" />
              ) : (
                <EyeSlashIcon className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            {/* Short Title */}
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {getObjectiveTitle(objective)}
            </h3>
          </div>

          <div className="flex items-start gap-2">
            {/* Edit Button */}
            {onEdit && (
              <button
                onClick={handleEditClick}
                className="p-1 hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Edit objective"
              >
                <PencilIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <div className="flex flex-col items-end gap-1">
              {/* OMTM Target Badge */}
              {normalizedObjective.primaryMetric ? (
                <>
                  <Badge variant="secondary" className="text-lg font-bold">
                    {normalizedObjective.primaryMetric.direction === 'increase' ? '↑' : '↓'} {normalizedObjective.primaryMetric.target}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {normalizedObjective.primaryMetric.name}
                  </Badge>
                </>
              ) : (
                <>
                  <Badge variant="secondary" className="text-lg font-bold">
                    {objective.keyResults?.[0]?.target || objective.metric?.summary || '—'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {objective.keyResults?.[0]?.signal || objective.metric?.category || 'Metric'}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Objective Statement */}
        <p className="text-base font-medium text-foreground leading-relaxed flex-1">
          {objective.objective || objective.pithy}
        </p>

        {/* Flip Indicator */}
        <div className="flex justify-end mt-4">
          <ArrowPathIcon className="w-4 h-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );

  const backContent = (
    <Card className="h-full bg-muted border-border">
      <CardContent className="p-6 h-full flex flex-col">
        {/* One Metric That Matters */}
        {normalizedObjective.primaryMetric && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              One Metric That Matters
            </h4>
            <MetricProgress metric={normalizedObjective.primaryMetric} size="sm" />
          </div>
        )}

        {/* Supporting Metrics */}
        {normalizedObjective.supportingMetrics && normalizedObjective.supportingMetrics.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Supporting Metrics
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {normalizedObjective.supportingMetrics.map((metric, i) => (
                <li key={i}>• {metric}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Legacy fallback for objectives without primaryMetric */}
        {!normalizedObjective.primaryMetric && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {objective.keyResults?.length ? 'Key Results' : 'Target'}
            </h4>
            {objective.keyResults?.length ? (
              <ul className="text-sm text-foreground space-y-3">
                {objective.keyResults.map((kr, i) => (
                  <li key={kr.id || i}>
                    <p className="text-muted-foreground leading-relaxed">
                      We believe <span className="text-foreground font-medium">{kr.belief?.action || '...'}</span> will
                      result in <span className="text-foreground font-medium">{kr.belief?.outcome || '...'}</span> and
                      we'll know it's working when we observe{' '}
                      <span className="text-foreground font-medium">{kr.signal || '...'}</span> move{' '}
                      <span className="text-foreground font-medium">{kr.baseline || '?'}</span>{' '}
                      <span className="text-foreground font-medium">{kr.target}</span> by{' '}
                      <span className="text-foreground font-medium">{kr.timeframe}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-medium text-foreground">
                {objective.metric?.full || '—'}
              </p>
            )}
          </div>
        )}

        {/* Explanation */}
        <div className="mb-4 flex-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Why It Matters
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {objective.explanation}
          </p>
        </div>

        {/* Back Indicator */}
        <div className="flex justify-end">
          <ArrowPathIcon className="w-4 h-4 text-muted-foreground transform rotate-180" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <FlipCard
      front={frontContent}
      back={backContent}
      className="h-80"
    />
  );
}
