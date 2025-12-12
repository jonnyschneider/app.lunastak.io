'use client';

import { Principle } from '@/lib/types';

interface PrincipleBarProps {
  principle: Principle;
}

export function PrincipleBar({ principle }: PrincipleBarProps) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:shadow-md transition-shadow duration-200">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        {principle.title}
      </h3>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
        {principle.description}
      </p>
    </div>
  );
}
