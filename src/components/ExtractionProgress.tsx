'use client';

// Extraction steps
export type ExtractionStep =
  | 'starting'
  | 'extracting_themes'
  | 'analyzing_dimensions'
  | 'generating_summary'
  | 'saving_insights'
  | 'complete'
  | 'error';

// Generation steps (from streaming generate API)
export type GenerationStep =
  | 'preparing'
  | 'generating'
  | 'saving'
  | 'complete'
  | 'error';

// Combined type for the progress component
export type ProgressStep = ExtractionStep | GenerationStep;

interface StepConfig {
  title: string;
  description: string;
}

const STEP_MESSAGES: Record<ProgressStep, StepConfig> = {
  // Extraction steps
  starting: {
    title: 'Getting ready',
    description: 'Preparing to analyze your conversation',
  },
  extracting_themes: {
    title: 'Extracting key themes',
    description: 'Identifying the main ideas from our discussion',
  },
  analyzing_dimensions: {
    title: 'Analyzing strategic dimensions',
    description: 'Mapping your insights to strategic areas',
  },
  generating_summary: {
    title: 'Generating reflective summary',
    description: 'Synthesizing strengths and opportunities',
  },
  saving_insights: {
    title: 'Saving your insights',
    description: 'Preserving what we learned for your strategy',
  },
  // Generation steps
  preparing: {
    title: 'Preparing context',
    description: 'Gathering your insights for strategy generation',
  },
  generating: {
    title: 'Generating your strategy',
    description: 'Crafting your vision, strategy, and objectives',
  },
  saving: {
    title: 'Saving your strategy',
    description: 'Preserving your decision stack',
  },
  // Shared steps
  complete: {
    title: 'All done!',
    description: 'Your strategy is ready',
  },
  error: {
    title: 'Something went wrong',
    description: 'We hit a snag, but you can continue chatting',
  },
};

type ProgressMode = 'extraction' | 'generation';

interface ExtractionProgressProps {
  currentStep: ProgressStep;
  error?: string;
  mode?: ProgressMode;
}

const EXTRACTION_STEPS = ['extracting_themes', 'analyzing_dimensions', 'generating_summary', 'saving_insights'] as const;
const EXTRACTION_ORDER = ['starting', 'extracting_themes', 'analyzing_dimensions', 'generating_summary', 'saving_insights', 'complete'] as const;

const GENERATION_STEPS = ['preparing', 'generating', 'saving'] as const;
const GENERATION_ORDER = ['preparing', 'generating', 'saving', 'complete'] as const;

export function ExtractionProgress({ currentStep, error, mode = 'extraction' }: ExtractionProgressProps) {
  const stepConfig = STEP_MESSAGES[currentStep];

  const isError = currentStep === 'error';
  const isComplete = currentStep === 'complete';
  const isGenerating = mode === 'generation';

  // Determine which steps to show based on mode
  const progressSteps = isGenerating ? GENERATION_STEPS : EXTRACTION_STEPS;
  const stepOrder = isGenerating ? GENERATION_ORDER : EXTRACTION_ORDER;

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-md text-center">
        <div className={`rounded-lg p-8 ${
          isError
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'bg-muted'
        }`}>
          {/* Progress bars */}
          {!isComplete && !isError && (
            <div className="mb-6">
              <div className="flex justify-center space-x-1.5">
                {progressSteps.map((step) => {
                  const currentIdx = stepOrder.indexOf(currentStep as any);
                  const stepIdx = stepOrder.indexOf(step as any);
                  const isActive = stepIdx === currentIdx;
                  const isDone = stepIdx < currentIdx;

                  return (
                    <div
                      key={step}
                      className={`h-1.5 w-10 rounded-full transition-all duration-500 ${
                        isDone
                          ? 'bg-primary'
                          : isActive
                            ? 'bg-primary/60 animate-[pulse_3s_ease-in-out_infinite]'
                            : 'bg-primary/20'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Status icon - only for complete/error states */}
          {(isComplete || isError) && (
            <div className="mb-4">
              {isComplete ? (
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <p className={`font-medium ${
            isError
              ? 'text-red-700 dark:text-red-300'
              : 'text-foreground'
          }`}>
            {stepConfig.title}
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
