'use client';

import { ExtractedContextVariant, isEmergentContext } from '@/lib/types';

interface ExtractionConfirmProps {
  extractedContext: ExtractedContextVariant;
  onGenerate: () => void;
  onContinue: () => void;
  isGenerating?: boolean;
}

export default function ExtractionConfirm({
  extractedContext,
  onGenerate,
  onContinue,
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
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 shadow-sm space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Here&apos;s what I understood:</h2>
        </div>

        {/* Dynamic Content based on extraction approach */}
        {isEmergent ? (
          // Emergent themes display
          <div className="space-y-4">
            {extractedContext.themes.map((theme, idx) => (
              <div key={idx} className="bg-card border border-border rounded-lg p-4 shadow-sm">
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
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Industry
                </label>
                <p className="text-foreground">{extractedContext.core.industry}</p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Target Market
                </label>
                <p className="text-foreground">{extractedContext.core.target_market}</p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Unique Value
                </label>
                <p className="text-foreground">{extractedContext.core.unique_value}</p>
              </div>
            </div>

            {/* Enrichment Fields Section */}
            {Object.keys(extractedContext.enrichment).length > 0 && (
              <div className="border-t border-primary/20 pt-6">
                <h3 className="text-lg font-medium mb-3">Additional Context</h3>
                <div className="space-y-3">
                  {Object.entries(extractedContext.enrichment).map(([key, value]) => (
                    <div key={key} className="bg-card border border-border rounded-lg p-4 shadow-sm">
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
        {extractedContext.reflective_summary && (
        <div className="border-t border-primary/20 pt-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Reflection</h3>

          {/* Show message if no reflection data */}
          {(extractedContext.reflective_summary.strengths?.length ?? 0) === 0 &&
           (extractedContext.reflective_summary.emerging?.length ?? 0) === 0 &&
           (extractedContext.reflective_summary.opportunities_for_enrichment?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground italic">No reflection data available.</p>
          )}

          {(extractedContext.reflective_summary.strengths?.length ?? 0) > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">What&apos;s Clear</h4>
              <ul className="space-y-2 ml-1">
                {extractedContext.reflective_summary.strengths!.map((strength, idx) => (
                  <li key={idx} className="text-sm text-foreground flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(extractedContext.reflective_summary.emerging?.length ?? 0) > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">What&apos;s Emerging</h4>
              <ul className="space-y-2 ml-1">
                {extractedContext.reflective_summary.emerging!.map((area, idx) => (
                  <li key={idx} className="text-sm text-foreground flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(extractedContext.reflective_summary.opportunities_for_enrichment?.length ?? 0) > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Opportunities for Enrichment</h4>
              <ul className="space-y-2 ml-1">
                {extractedContext.reflective_summary.opportunities_for_enrichment!.map((opportunity, idx) => (
                  <li key={idx} className="text-sm text-foreground flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{opportunity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        )}

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
      </div>

      {/* OR Divider */}
      {extractedContext.reflective_summary?.thought_prompt && (
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm font-medium text-muted-foreground">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Secondary Option - Refine Card */}
      {extractedContext.reflective_summary?.thought_prompt && (
        <div className="bg-card border border-foreground/20 rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Provide more info to refine the strategy</h3>
          <div className="border-l-4 border-primary/40 pl-4 mb-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Next Question</p>
            <p className="text-foreground italic">
              {extractedContext.reflective_summary.thought_prompt}
            </p>
          </div>
          <button
            onClick={onContinue}
            disabled={isGenerating}
            className="w-full px-4 py-2 border border-foreground/20 text-primary rounded-lg hover:bg-muted text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
