'use client';

import { Opportunity, Objective } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OpportunityCardProps {
  opportunity: Opportunity;
  objectives: Objective[];
}

export function OpportunityCard({ opportunity, objectives }: OpportunityCardProps) {
  // Get objective names for badges
  const relatedObjectives = objectives.filter(obj =>
    opportunity.objectiveIds.includes(obj.id)
  );

  return (
    <Card className="border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow duration-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {opportunity.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {opportunity.description}
        </p>

        {/* Related Objectives Badges */}
        {relatedObjectives.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">
              Supports:
            </span>
            {relatedObjectives.map(obj => (
              <Badge
                key={obj.id}
                variant="secondary"
                className="text-xs"
              >
                {obj.metric.category}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
