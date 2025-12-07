'use client';

import { StrategyStatements } from '@/lib/types';
import StrategyFlow from './StrategyFlow';

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  thoughts?: string;
}

export default function StrategyDisplay({ strategy, thoughts }: StrategyDisplayProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Thoughts (optional) */}
      {thoughts && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Strategic Thinking:</h3>
          <p className="text-blue-800 whitespace-pre-wrap">{thoughts}</p>
        </div>
      )}

      {/* Strategy Statements */}
      <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Vision</h3>
          <p className="text-lg text-gray-900">{strategy.vision}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Mission</h3>
          <p className="text-lg text-gray-900">{strategy.mission}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Objectives</h3>
          <ul className="list-disc list-inside space-y-1">
            {strategy.objectives.map((objective, index) => (
              <li key={index} className="text-gray-900">{objective}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ReactFlow Visualization */}
      <div className="bg-white border rounded-lg shadow-sm" style={{ height: '600px' }}>
        <StrategyFlow strategy={strategy} />
      </div>
    </div>
  );
}
