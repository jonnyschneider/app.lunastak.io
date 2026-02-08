'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { TradeoffOption } from '@/lib/curated-tradeoffs';

interface TradeoffCardProps {
  tradeoff: TradeoffOption;
  onSelect: (priority: string, deprioritized: string) => void;
  disabled?: boolean;
}

export function TradeoffCard({ tradeoff, onSelect, disabled }: TradeoffCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredSide, setHoveredSide] = useState<'A' | 'B' | null>(null);

  const handleSelect = (side: 'A' | 'B') => {
    if (disabled) return;
    const priority = side === 'A' ? tradeoff.optionA : tradeoff.optionB;
    const deprioritized = side === 'A' ? tradeoff.optionB : tradeoff.optionA;
    onSelect(priority, deprioritized);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        disabled={disabled}
        className={cn(
          'w-full px-4 py-3 rounded-lg border border-dashed border-gray-300',
          'text-left text-sm text-gray-600',
          'hover:border-[#0A2933] hover:bg-gray-50 transition-colors',
          'flex items-center gap-2',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="text-gray-400">+</span>
        <span>{tradeoff.optionA}</span>
        <span className="text-gray-400">vs</span>
        <span>{tradeoff.optionB}</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border-2 border-[#0A2933] overflow-hidden">
      <div className="text-xs text-center py-2 bg-gray-50 text-gray-500 font-medium">
        Which do you prioritize?
      </div>
      <div className="grid grid-cols-[1fr,auto,1fr]">
        <button
          onClick={() => handleSelect('A')}
          onMouseEnter={() => setHoveredSide('A')}
          onMouseLeave={() => setHoveredSide(null)}
          className={cn(
            'p-4 text-center font-medium transition-colors',
            hoveredSide === 'A' ? 'bg-[#E0FF4F] text-[#0A2933]' : 'hover:bg-gray-50'
          )}
        >
          {tradeoff.optionA}
        </button>
        <div className="flex items-center px-3 text-gray-400 text-sm font-medium">
          or
        </div>
        <button
          onClick={() => handleSelect('B')}
          onMouseEnter={() => setHoveredSide('B')}
          onMouseLeave={() => setHoveredSide(null)}
          className={cn(
            'p-4 text-center font-medium transition-colors',
            hoveredSide === 'B' ? 'bg-[#E0FF4F] text-[#0A2933]' : 'hover:bg-gray-50'
          )}
        >
          {tradeoff.optionB}
        </button>
      </div>
      <button
        onClick={() => setExpanded(false)}
        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
    </div>
  );
}
