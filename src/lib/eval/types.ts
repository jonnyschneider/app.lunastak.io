/**
 * Eval Infrastructure Types
 *
 * Defines the shape of exported traces and evaluation files.
 */

// Component types for evaluation
export type EvalComponent = 'conversation' | 'extraction' | 'generation';

// Evaluation entry for a single component
export interface ComponentEvaluation {
  notes: string;
  tags: string[];
}

// Exported trace structure
export interface ExportedTrace {
  id: string;
  exportedAt: string;
  pipelineVersion?: string;
  promptVersions: {
    extraction?: string;
    generation?: string;
  };
  components: {
    conversation: {
      messages: Array<{
        role: 'assistant' | 'user';
        content: string;
        stepNumber: number;
      }>;
      questionCount: number;
      experimentVariant?: string;
    };
    extraction: {
      themes?: Array<{
        theme_name: string;
        content: string;
        dimensions?: Array<{
          name: string;
          confidence?: string;
        }>;
      }>;
      dimensionalCoverage?: Record<string, unknown>;
      reflectiveSummary?: {
        strengths: string[];
        emerging: string[];
        opportunities_for_enrichment: string[];
      };
    };
    generation: {
      vision: string;
      strategy: string;
      objectives: Array<{
        id: string;
        title?: string;
        explanation: string;
        // Current OMTM format
        omtm?: string;
        aspiration?: string;
        // Legacy format
        pithy?: string;
        metric?: {
          summary: string;
          full: string;
          category: string;
          direction?: string;
          metricName?: string;
          metricValue?: string;
          timeframe?: string;
        };
        successCriteria?: string;
      }>;
      opportunities?: Array<{
        id: string;
        title: string;
        description: string;
        objectiveIds: string[];
        successMetrics?: Array<{
          id: string;
          belief: { action: string; outcome: string };
          signal: string;
          baseline: string;
          target: string;
        }>;
      }>;
    };
  };
  timing: {
    extractionMs?: number;
    generationMs?: number;
  };
}

// Eval file structure
export interface EvalFile {
  name: string;
  date: string;
  purpose: string;
  traces: string[]; // trace IDs
  baseline: string; // which trace is the baseline
  evaluation: Record<string, Record<EvalComponent, ComponentEvaluation>>;
  summary: string;
  outcome: string;
}

// Tags file structure
export interface TagsFile {
  conversation: string[];
  extraction: string[];
  generation: string[];
}
