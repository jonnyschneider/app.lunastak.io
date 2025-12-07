'use client';

import { useState } from 'react';
import { ExtractedContext } from '@/lib/types';

interface ExtractionConfirmProps {
  extractedContext: ExtractedContext;
  onConfirm: (context: ExtractedContext) => void;
  onEdit: () => void;
}

export default function ExtractionConfirm({
  extractedContext,
  onConfirm,
  onEdit,
}: ExtractionConfirmProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContext, setEditedContext] = useState(extractedContext);

  const handleSave = () => {
    onConfirm(editedContext);
    setIsEditing(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Here&apos;s what I understood:</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedContext.industry}
                onChange={(e) => setEditedContext({
                  ...editedContext,
                  industry: e.target.value
                })}
                className="w-full px-3 py-2 border rounded-md"
              />
            ) : (
              <p className="text-gray-900">{extractedContext.industry}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Market
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedContext.targetMarket}
                onChange={(e) => setEditedContext({
                  ...editedContext,
                  targetMarket: e.target.value
                })}
                className="w-full px-3 py-2 border rounded-md"
              />
            ) : (
              <p className="text-gray-900">{extractedContext.targetMarket}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unique Value
            </label>
            {isEditing ? (
              <textarea
                value={editedContext.uniqueValue}
                onChange={(e) => setEditedContext({
                  ...editedContext,
                  uniqueValue: e.target.value
                })}
                rows={3}
                className="w-full px-3 py-2 border rounded-md"
              />
            ) : (
              <p className="text-gray-900">{extractedContext.uniqueValue}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedContext(extractedContext);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onConfirm(extractedContext)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Looks Good →
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
