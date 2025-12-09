'use client';

import { StrategyStatements } from '@/lib/types';

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  thoughts?: string;
}

export default function StrategyDisplay({ strategy, thoughts }: StrategyDisplayProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Thoughts Section - Greyscale */}
      {thoughts && (
        <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Strategic Thinking
          </h3>
          <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap text-sm">
            {thoughts}
          </p>
        </div>
      )}

      {/* Decision Stack */}
      <div className="space-y-4">
        {/* Vision Card */}
        <div className="bg-zinc-800 dark:bg-zinc-700 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Vision
          </h3>
          <p className="text-lg font-medium text-white leading-relaxed">
            {strategy.vision}
          </p>
        </div>

        {/* Mission Card */}
        <div className="bg-zinc-700 dark:bg-zinc-600 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide mb-3">
            Mission
          </h3>
          <p className="text-lg font-medium text-white leading-relaxed">
            {strategy.mission}
          </p>
        </div>

        {/* Objectives Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategy.objectives.map((objective, index) => (
            <div
              key={index}
              className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm"
            >
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                Objective {index + 1}
              </h3>
              <p className="text-base text-zinc-900 dark:text-zinc-100 leading-relaxed">
                {objective}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
