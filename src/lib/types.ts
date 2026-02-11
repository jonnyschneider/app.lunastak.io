export interface BusinessContext {
  industry: string;
  targetMarket: string;
  uniqueValue: string;
}

export interface ObjectiveMetric {
  summary: string;        // "25%" or "Growth" - shown on front
  full: string;          // "Increase revenue by 25% in Q1 2025"
  category: string;      // "Revenue", "Customer", "Product", etc.
  // New format for cleaner display
  direction?: 'increase' | 'decrease';  // ↑ or ↓
  metricName?: string;   // "Revenue", "Customer churn", "Market share"
  metricValue?: string;  // "from 20% to 35%", "Achieve profitability", "$10M ARR"
  timeframe?: '3M' | '6M' | '9M' | '12M' | '18M';  // Planning horizon
}

export interface KeyResult {
  id: string;
  belief: {
    action: string;   // "improving onboarding"
    outcome: string;  // "increase retention"
  };
  signal: string;     // "7-day active user rate"
  baseline: string;   // "40%"
  target: string;     // "55%"
  timeframe: '3M' | '6M' | '9M' | '12M' | '18M';
}

export interface PrimaryMetric {
  name: string;             // "Weekly Active Users"
  baseline: string;         // "12%"
  target: string;           // "40%"
  timeframe: '3M' | '6M' | '9M' | '12M' | '18M';
  direction: 'increase' | 'decrease';
}

export interface SuccessMetric {
  id: string;
  belief: {
    action: string;   // "showing insights in first 3 minutes"
    outcome: string;  // "increase session 2 return rate"
  };
  signal: string;     // "S1→S2 conversion"
  baseline: string;   // "25%"
  target: string;     // "50%"
}

export interface Objective {
  id: string;              // For filtering relationships
  title?: string;          // Short title (3-5 words) for lists/linking
  explanation: string;     // Full detail for back of card

  // OMTM - One Metric That Matters
  primaryMetric?: PrimaryMetric;

  // Optional supporting metrics (just names, no targets)
  supportingMetrics?: string[];

  // Legacy OKR format - still supported
  objective?: string;      // Short 1-2 sentence objective (replaces pithy)
  keyResults?: KeyResult[]; // 1-3 Key Results (replaces metric)
  // Legacy format - still supported
  pithy?: string;          // Original field, maps to objective
  metric?: ObjectiveMetric;
  successCriteria?: string; // Kept for AI context
}

export interface Opportunity {
  id: string;
  title: string;              // Initiative name
  description: string;        // What we're doing
  objectiveIds: string[];     // Links to objectives this supports
  successMetrics?: SuccessMetric[];  // Hypothesis-driven metrics
  status?: 'draft' | 'active' | 'complete';
}

export interface Principle {
  id: string;
  priority: string;        // What we prioritize: "Strategic clients"
  deprioritized: string;   // What we deprioritize: "any paying client"
  context?: string;        // Optional: why this matters
  // Legacy support
  title?: string;          // Maps to priority for backward compat
  description?: string;    // Maps to context for backward compat
}

// Strategy Version types (for edit history)
export type StrategyComponentType = 'vision' | 'strategy' | 'objective';
export type StrategyVersionSource = 'generation' | 'user_edit' | 'coaching';
export type StrategyVersionCreator = 'user' | 'ai' | 'system';

export interface StrategyVersion {
  id: string;
  projectId: string;
  componentType: StrategyComponentType;
  componentId: string | null;
  content: VisionContent | StrategyContent | ObjectiveContent;
  version: number;
  createdAt: Date;
  createdBy: StrategyVersionCreator;
  sourceType: StrategyVersionSource;
  sourceId: string | null;
}

// Content types for each component
export interface VisionContent {
  text: string;           // The pithy headline (4-15 words)
  elaboration?: string;   // Why this matters, what it means (optional)
}

export interface StrategyContent {
  text: string;           // The coherent choices (15-25 words)
  elaboration?: string;   // How this plays out (optional)
}

export interface ObjectiveContent {
  explanation: string;
  // New OKR format
  objective?: string;
  keyResults?: KeyResult[];
  // Legacy format - still supported
  pithy?: string;
  metric?: ObjectiveMetric;
  successCriteria?: string;
}

export interface StrategyStatements {
  vision: string;
  strategy: string;
  objectives: Objective[];
  opportunities: Opportunity[];
  principles: Principle[];
}

export interface GenerationResponse {
  thoughts: string;
  statements: StrategyStatements;
}

export interface EvaluationResponse {
  evaluation: "PASS" | "NEEDS_IMPROVEMENT" | "FAIL";
  feedback: string;
}

// Conversation types
export type ConversationStatus = 'in_progress' | 'completed' | 'abandoned';
export type ConversationPhase = 'INITIAL' | 'LENS_SELECTION' | 'QUESTIONING' | 'EXTRACTION' | 'GENERATION';
export type StrategyLens = 'A' | 'B' | 'C' | 'D' | 'E';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Conversation {
  id: string;
  userId: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  currentPhase: ConversationPhase;
  selectedLens?: StrategyLens;
  questionCount: number;
}

export type MessageRole = 'assistant' | 'user';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  stepNumber: number;
  timestamp: Date;
  confidenceScore?: ConfidenceLevel;
  confidenceReasoning?: string;
}

// Context extraction types
export type ExtractionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ExtractedContext {
  industry: string;
  targetMarket: string;
  uniqueValue: string;
  extractionConfidence: ExtractionConfidence;
  rawConversation: Message[];
}

export interface EnrichmentFields {
  competitive_context?: string;
  customer_segments?: string[];
  operational_capabilities?: string;
  technical_advantages?: string;
  [key: string]: any; // Allow additional emergent fields
}

export interface ReflectiveSummary {
  strengths: string[];
  emerging: string[];
  opportunities_for_enrichment: string[];
  thought_prompt?: string;
}

export interface EmergentTheme {
  theme_name: string;
  content: string;
}

export interface EmergentExtractedContext {
  themes: EmergentTheme[];
  reflective_summary: ReflectiveSummary;
  extraction_approach: 'emergent';
}

export interface PrescriptiveExtractedContext {
  core: {
    industry: string;
    target_market: string;
    unique_value: string;
  };
  enrichment: EnrichmentFields;
  reflective_summary: ReflectiveSummary;
  extraction_approach: 'prescriptive';
}

// Union type for both approaches
export type ExtractedContextVariant = EmergentExtractedContext | PrescriptiveExtractedContext;

// Type guard
export function isEmergentContext(context: ExtractedContextVariant): context is EmergentExtractedContext {
  return context.extraction_approach === 'emergent';
}

export function isPrescriptiveContext(context: ExtractedContextVariant): context is PrescriptiveExtractedContext {
  return context.extraction_approach === 'prescriptive';
}

export interface EnhancedExtractedContext {
  core: {
    industry: string;
    target_market: string;
    unique_value: string;
  };
  enrichment: EnrichmentFields;
  reflective_summary: ReflectiveSummary;
}

// Trace types
export type UserFeedback = 'helpful' | 'not_helpful';

export interface Trace {
  id: string;
  conversationId: string;
  userId: string;
  timestamp: Date;
  extractedContext: ExtractedContext;
  output: StrategyStatements;
  claudeThoughts?: string;
  modelUsed: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  userFeedback?: UserFeedback;
  feedbackTimestamp?: Date;
  refinementRequested: boolean;
}

// Strategic Dimensions (Experiment 2: Dimensional Coverage Tracking)
export const STRATEGIC_DIMENSIONS = [
  'customer_and_market',
  'problem_and_opportunity',
  'value_proposition',
  'differentiation_and_advantage',
  'competitive_landscape',
  'business_model_and_economics',
  'go_to_market',
  'product_experience',
  'capabilities_and_assets',
  'risks_and_constraints',
] as const;

export type StrategicDimension = typeof STRATEGIC_DIMENSIONS[number];

export const STRATEGIC_INTENT = 'strategic_intent';

// Dimensional Coverage Types
export type CoverageConfidence = 'high' | 'medium' | 'low';

export interface DimensionCoverage {
  covered: boolean;
  confidence: CoverageConfidence;
  themes: string[];  // Which emergent theme(s) mapped to this dimension
}

export interface DimensionalCoverage {
  // Coverage by dimension
  dimensions: {
    [K in StrategicDimension]: DimensionCoverage;
  };

  // Summary metrics
  summary: {
    dimensionsCovered: number;  // out of 10
    coveragePercentage: number; // 0-100
    gaps: StrategicDimension[];  // dimensions with no coverage
    primaryDimensions: StrategicDimension[];  // dimensions with high confidence
  };

  // Metadata
  analysisTimestamp: string;
  modelUsed: string;
}

// Structured Provocation (for suggested questions and strategic gaps)
export interface StructuredProvocation {
  title: string;       // Short, attention-grabbing title (max ~60 chars)
  description: string; // Fuller explanation or question text
}
