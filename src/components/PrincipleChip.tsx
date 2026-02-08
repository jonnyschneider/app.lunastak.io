'use client';

import { X } from 'lucide-react';
import type { Principle } from '@/lib/types';

interface PrincipleChipProps {
  principle: Principle;
  onRemove?: () => void;
  onFlip?: () => void;
}

export function PrincipleChip({ principle, onRemove, onFlip }: PrincipleChipProps) {
  return (
    <div className="group flex items-center gap-2 px-4 py-3 bg-white border rounded-lg shadow-sm hover:shadow transition-shadow">
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-semibold text-[#0A2933]">{principle.priority}</span>
          <span className="text-gray-500"> even over </span>
          <span className="text-gray-600">{principle.deprioritized}</span>
        </p>
        {principle.context && (
          <p className="text-xs text-gray-400 mt-1 truncate">{principle.context}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onFlip && (
          <button
            onClick={onFlip}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Flip priority"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
