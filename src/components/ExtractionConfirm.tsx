'use client';

import { ExtractedContextVariant, isEmergentContext } from '@/lib/types';

interface ExtractionConfirmProps {
  extractedContext: ExtractedContextVariant;
  onGenerate: () => void;
  onContinue: () => void;
  onFlagForLater: () => void;
  onDismiss: () => void;
}

export default function ExtractionConfirm({
  extractedContext,
  onGenerate,
  onContinue,
  onFlagForLater,
  onDismiss,
}: ExtractionConfirmProps) {
  const isEmergent = isEmergentContext(extractedContext);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 shadow-sm space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Here&apos;s what I understood:</h2>
        </div>

        {/* Dynamic Content based on extraction approach */}
        {isEmergent ? (
          // Emergent themes display
          <div className="space-y-4">
            {extractedContext.themes.map((theme, idx) => (
              <div key={idx} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  {theme.theme_name}
                </h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {theme.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          // Prescriptive fields display (baseline-v1)
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Industry
                </label>
                <p className="text-zinc-900 dark:text-zinc-100">{extractedContext.core.industry}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Market
                </label>
                <p className="text-zinc-900 dark:text-zinc-100">{extractedContext.core.target_market}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Unique Value
                </label>
                <p className="text-zinc-900 dark:text-zinc-100">{extractedContext.core.unique_value}</p>
              </div>
            </div>

            {/* Enrichment Fields Section */}
            {Object.keys(extractedContext.enrichment).length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-3">Additional Context</h3>
                <div className="space-y-3">
                  {Object.entries(extractedContext.enrichment).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <p className="text-zinc-900 dark:text-zinc-100 text-sm">
                        {Array.isArray(value) ? value.join(', ') : value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Reflective Summary Section - Same for both */}
        <div className="border-t pt-6 bg-zinc-50 dark:bg-zinc-900 -m-6 p-6 rounded-b-lg">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Reflection</h3>

          {extractedContext.reflective_summary.strengths.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">What&apos;s Clear</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-zinc-900 dark:text-zinc-100">{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.emerging.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">What&apos;s Emerging</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.emerging.map((area, idx) => (
                  <li key={idx} className="text-sm text-zinc-900 dark:text-zinc-100">{area}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.opportunities_for_enrichment.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Opportunities for Enrichment</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.opportunities_for_enrichment.map((opportunity, idx) => (
                  <li key={idx} className="text-sm text-zinc-900 dark:text-zinc-100">{opportunity}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.thought_prompt && (
            <div className="bg-white dark:bg-zinc-800 border-l-4 border-zinc-400 dark:border-zinc-500 p-4 rounded">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {extractedContext.reflective_summary.thought_prompt}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Primary Action */}
          <div>
            <button
              onClick={onGenerate}
              className="w-full px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 font-medium"
            >
              Generate my strategy
            </button>
          </div>

          {/* Secondary Actions */}
          {extractedContext.reflective_summary.opportunities_for_enrichment.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Or, explore opportunities for enrichment:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={onContinue}
                  className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
                >
                  Continue now
                </button>
                <button
                  onClick={onFlagForLater}
                  className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
                >
                  Flag for next session
                </button>
                <button
                  onClick={onDismiss}
                  className="flex-1 px-4 py-2 text-zinc-500 dark:text-zinc-500 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
