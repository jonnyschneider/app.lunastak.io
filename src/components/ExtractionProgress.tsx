'use client';

import { useEffect, useState } from 'react';

export type ExtractionStep =
  | 'starting'
  | 'extracting_themes'
  | 'analyzing_dimensions'
  | 'generating_summary'
  | 'saving_insights'
  | 'complete'
  | 'error';

interface StepConfig {
  title: string;
  description: string;
}

const STEP_MESSAGES: Record<ExtractionStep, StepConfig> = {
  starting: {
    title: 'Getting ready...',
    description: 'Preparing to analyze your conversation',
  },
  extracting_themes: {
    title: 'Extracting key themes...',
    description: 'Identifying the main ideas from our discussion',
  },
  analyzing_dimensions: {
    title: 'Analyzing strategic dimensions...',
    description: 'Mapping your insights to strategic areas',
  },
  generating_summary: {
    title: 'Generating reflective summary...',
    description: 'Synthesizing strengths and opportunities',
  },
  saving_insights: {
    title: 'Saving your insights...',
    description: 'Preserving what we learned for your strategy',
  },
  complete: {
    title: 'All done!',
    description: 'Your summary is ready',
  },
  error: {
    title: 'Something went wrong',
    description: 'We hit a snag, but you can continue chatting',
  },
};

interface ExtractionProgressProps {
  currentStep: ExtractionStep;
  error?: string;
}

export function ExtractionProgress({ currentStep, error }: ExtractionProgressProps) {
  const [dots, setDots] = useState('');
  const stepConfig = STEP_MESSAGES[currentStep];

  // Animate dots for in-progress states
  useEffect(() => {
    if (currentStep === 'complete' || currentStep === 'error') {
      setDots('');
      return;
    }

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [currentStep]);

  const isError = currentStep === 'error';
  const isComplete = currentStep === 'complete';

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-md text-center">
        <div className={`rounded-lg p-8 ${
          isError
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'bg-muted'
        }`}>
          {/* Progress indicator */}
          {!isComplete && !isError && (
            <div className="mb-6">
              <div className="flex justify-center space-x-1">
                {['extracting_themes', 'analyzing_dimensions', 'generating_summary', 'saving_insights'].map((step, idx) => {
                  const stepOrder = ['starting', 'extracting_themes', 'analyzing_dimensions', 'generating_summary', 'saving_insights', 'complete'];
                  const currentIdx = stepOrder.indexOf(currentStep);
                  const stepIdx = stepOrder.indexOf(step);
                  const isActive = stepIdx === currentIdx;
                  const isDone = stepIdx < currentIdx;

                  return (
                    <div
                      key={step}
                      className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                        isDone
                          ? 'bg-primary'
                          : isActive
                            ? 'bg-primary/70 animate-pulse'
                            : 'bg-muted-foreground/30'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Animated icon */}
          <div className="mb-4">
            {isComplete ? (
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : isError ? (
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
          </div>

          {/* Title */}
          <p className={`font-medium ${
            isError
              ? 'text-red-700 dark:text-red-300'
              : 'text-foreground'
          }`}>
            {stepConfig.title}{!isComplete && !isError && dots}
          </p>

          {/* Description */}
          <p className={`text-sm mt-2 ${
            isError
              ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground'
          }`}>
            {error || stepConfig.description}
          </p>
        </div>
      </div>
    </div>
  );
}
