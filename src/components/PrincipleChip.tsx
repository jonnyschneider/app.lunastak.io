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
    <div className="group relative flex flex-col items-center justify-center p-4 bg-white border rounded-lg shadow-sm hover:shadow transition-shadow text-center min-h-[120px]">
      {/* Stacked content */}
      <p className="text-sm font-semibold text-ds-teal leading-tight">
        {principle.priority}
      </p>
      <p className="text-xs text-gray-400 my-1">even over</p>
      <p className="text-sm text-gray-600 leading-tight">
        {principle.deprioritized}
      </p>

      {principle.context && (
        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{principle.context}</p>
      )}

      {/* Hover actions */}
      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onFlip && (
          <button
            onClick={onFlip}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Flip priority"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
