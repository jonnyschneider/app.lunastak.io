export interface BusinessContext {
  industry: string;
  targetMarket: string;
  uniqueValue: string;
}

export interface ObjectiveMetric {
  summary: string;        // "25%" or "Growth" - shown on front
  full: string;          // "Increase revenue by 25% in Q1 2025"
  category: string;      // "Revenue", "Customer", "Product", etc.
}

export interface Objective {
  id: string;            // For filtering relationships
  pithy: string;         // Short 1-2 sentence objective
  metric: ObjectiveMetric;
  explanation: string;   // Full detail for back of card
  successCriteria: string; // What success looks like
}

export interface Initiative {
  id: string;
  title: string;
  description: string;
  objectiveIds: string[]; // References to objectives this supports
}

export interface Principle {
  id: string;
  title: string;
  description: string;
}

export interface StrategyStatements {
  vision: string;
  mission: string;
  objectives: Objective[];
  initiatives: Initiative[];
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
