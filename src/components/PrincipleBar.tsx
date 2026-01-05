'use client';

import { Principle } from '@/lib/types';

interface PrincipleBarProps {
  principle: Principle;
}

export function PrincipleBar({ principle }: PrincipleBarProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow duration-200">
      <h3 className="text-sm font-semibold text-foreground mb-2">
        {principle.title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {principle.description}
      </p>
    </div>
  );
}
