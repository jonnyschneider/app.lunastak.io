'use client';

import { Objective } from '@/lib/types';
import { FlipCard } from '@/components/ui/flip-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon, PencilIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { getObjectiveTitle } from '@/lib/utils';

interface ObjectiveCardProps {
  objective: Objective;
  isFilterActive: boolean;
  onToggleFilter: () => void;
  onEdit?: () => void;
}

export function ObjectiveCard({ objective, isFilterActive, onToggleFilter, onEdit }: ObjectiveCardProps) {
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
              {/* Metric Badge */}
              <Badge variant="secondary" className="text-lg font-bold">
                {objective.metric.summary}
              </Badge>
              {/* Category Badge */}
              <Badge variant="outline" className="text-xs">
                {objective.metric.category}
              </Badge>
            </div>
          </div>
        </div>

        {/* Pithy Objective */}
        <p className="text-base font-medium text-foreground leading-relaxed flex-1">
          {objective.pithy}
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
        {/* SMART Metric */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Target
          </h4>
          <p className="text-sm font-medium text-foreground">
            {objective.metric.full}
          </p>
        </div>

        {/* Explanation */}
        <div className="mb-4 flex-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Why It Matters
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {objective.explanation}
          </p>
        </div>

        {/* Success Criteria */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Success Looks Like
          </h4>
          <p className="text-sm text-muted-foreground">
            {objective.successCriteria}
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
