'use client';

import { useState } from 'react';
import { EnhancedExtractedContext } from '@/lib/types';

interface ExtractionConfirmProps {
  extractedContext: EnhancedExtractedContext;
  onConfirm: () => void;
  onExplore: () => void;
}

export default function ExtractionConfirm({
  extractedContext,
  onConfirm,
  onExplore,
}: ExtractionConfirmProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCore, setEditedCore] = useState(extractedContext.core);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white border rounded-lg p-6 shadow-sm space-y-6">

        {/* Core Fields Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Here&apos;s what I understood:</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedCore.industry}
                  onChange={(e) => setEditedCore({
                    ...editedCore,
                    industry: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-gray-900">{extractedContext.core.industry}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Market
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedCore.target_market}
                  onChange={(e) => setEditedCore({
                    ...editedCore,
                    target_market: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-gray-900">{extractedContext.core.target_market}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unique Value
              </label>
              {isEditing ? (
                <textarea
                  value={editedCore.unique_value}
                  onChange={(e) => setEditedCore({
                    ...editedCore,
                    unique_value: e.target.value
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-gray-900">{extractedContext.core.unique_value}</p>
              )}
            </div>
          </div>
        </div>

        {/* Enrichment Fields Section */}
        {Object.keys(extractedContext.enrichment).length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-3">Additional Context</h3>
            <div className="space-y-3">
              {Object.entries(extractedContext.enrichment).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <p className="text-gray-900 text-sm">
                    {Array.isArray(value) ? value.join(', ') : value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reflective Summary Section */}
        <div className="border-t pt-6 bg-blue-50 -m-6 p-6 rounded-b-lg">
          <h3 className="text-lg font-medium mb-4">Reflection</h3>

          {extractedContext.reflective_summary.strengths.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">What&apos;s Clear</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-gray-900">{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.emerging.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">What&apos;s Emerging</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.emerging.map((area, idx) => (
                  <li key={idx} className="text-sm text-gray-900">{area}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.unexplored.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">What&apos;s Unexplored</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.unexplored.map((gap, idx) => (
                  <li key={idx} className="text-sm text-gray-900">{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.thought_prompt && (
            <div className="bg-white border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm font-medium text-gray-900">
                {extractedContext.reflective_summary.thought_prompt}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Generate my strategy
          </button>
          <button
            onClick={onExplore}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Explore further
          </button>
        </div>
      </div>
    </div>
  );
}
