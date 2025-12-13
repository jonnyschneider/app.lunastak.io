'use client';

import { Objective } from '@/lib/types';
import { FlipCard } from '@/components/ui/flip-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface ObjectiveCardProps {
  objective: Objective;
  isFilterActive: boolean;
  onToggleFilter: () => void;
}

export function ObjectiveCard({ objective, isFilterActive, onToggleFilter }: ObjectiveCardProps) {
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent flip when clicking filter toggle
    onToggleFilter();
  };

  const frontContent = (
    <Card className={clsx(
      'h-full border-zinc-200 dark:border-zinc-700 hover:shadow-lg transition-shadow duration-200',
      isFilterActive && 'ring-2 ring-zinc-400'
    )}>
      <CardContent className="p-6 h-full flex flex-col">
        {/* Filter Toggle - Top Left */}
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={handleToggleClick}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            aria-label={isFilterActive ? 'Hide related initiatives' : 'Show related initiatives'}
          >
            {isFilterActive ? (
              <EyeIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            ) : (
              <EyeSlashIcon className="w-5 h-5 text-zinc-400" />
            )}
          </button>

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

        {/* Pithy Objective */}
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed flex-1">
          {objective.pithy}
        </p>

        {/* Flip Indicator */}
        <div className="flex justify-end mt-4">
          <ArrowPathIcon className="w-4 h-4 text-zinc-400" />
        </div>
      </CardContent>
    </Card>
  );

  const backContent = (
    <Card className="h-full bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
      <CardContent className="p-6 h-full flex flex-col">
        {/* SMART Metric */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Target
          </h4>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {objective.metric.full}
          </p>
        </div>

        {/* Explanation */}
        <div className="mb-4 flex-1">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Why It Matters
          </h4>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {objective.explanation}
          </p>
        </div>

        {/* Success Criteria */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Success Looks Like
          </h4>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {objective.successCriteria}
          </p>
        </div>

        {/* Back Indicator */}
        <div className="flex justify-end">
          <ArrowPathIcon className="w-4 h-4 text-zinc-400 transform rotate-180" />
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
