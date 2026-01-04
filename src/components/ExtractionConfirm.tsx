'use client';

import { ExtractedContextVariant, isEmergentContext } from '@/lib/types';

interface ExtractionConfirmProps {
  extractedContext: ExtractedContextVariant;
  onGenerate: () => void;
  onContinue: () => void;
  onFlagForLater: () => void;
  onDismiss: () => void;
  isGenerating?: boolean;
}

export default function ExtractionConfirm({
  extractedContext,
  onGenerate,
  onContinue,
  onFlagForLater,
  onDismiss,
  isGenerating = false,
}: ExtractionConfirmProps) {
  const isEmergent = isEmergentContext(extractedContext);

  // Type guard to ensure we have the right structure
  if (!isEmergent && !('core' in extractedContext)) {
    console.error('Invalid prescriptive context structure:', extractedContext);
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-red-600 dark:text-red-400">
            Error: Invalid extraction data structure. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Here&apos;s what I understood:</h2>
        </div>

        {/* Dynamic Content based on extraction approach */}
        {isEmergent ? (
          // Emergent themes display
          <div className="space-y-4">
            {extractedContext.themes.map((theme, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4">
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {theme.theme_name}
                </h3>
                <p className="text-sm text-muted-foreground">
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
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Industry
                </label>
                <p className="text-foreground">{extractedContext.core.industry}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Target Market
                </label>
                <p className="text-foreground">{extractedContext.core.target_market}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Unique Value
                </label>
                <p className="text-foreground">{extractedContext.core.unique_value}</p>
              </div>
            </div>

            {/* Enrichment Fields Section */}
            {Object.keys(extractedContext.enrichment).length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-3">Additional Context</h3>
                <div className="space-y-3">
                  {Object.entries(extractedContext.enrichment).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <p className="text-foreground text-sm">
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
        <div className="border-t pt-6 bg-muted -m-6 p-6 rounded-b-lg">
          <h3 className="text-lg font-medium text-foreground mb-4">Reflection</h3>

          {extractedContext.reflective_summary.strengths.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">What&apos;s Clear</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-foreground">{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.emerging.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">What&apos;s Emerging</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.emerging.map((area, idx) => (
                  <li key={idx} className="text-sm text-foreground">{area}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.opportunities_for_enrichment.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Opportunities for Enrichment</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.opportunities_for_enrichment.map((opportunity, idx) => (
                  <li key={idx} className="text-sm text-foreground">{opportunity}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.thought_prompt && (
            <div className="bg-card border-l-4 border-primary p-4 rounded">
              <p className="text-sm font-medium text-foreground">
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
              disabled={isGenerating}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating your strategy...' : 'Generate my strategy'}
            </button>
          </div>

          {/* Secondary Actions */}
          {extractedContext.reflective_summary.opportunities_for_enrichment.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Or, explore opportunities for enrichment:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={onContinue}
                  className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted text-sm"
                >
                  Continue now
                </button>
                <button
                  onClick={onFlagForLater}
                  className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted text-sm"
                >
                  Flag for next session
                </button>
                <button
                  onClick={onDismiss}
                  className="flex-1 px-4 py-2 text-muted-foreground rounded-lg hover:bg-muted text-sm"
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
