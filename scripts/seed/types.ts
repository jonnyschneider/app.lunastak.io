/**
 * Fixture Types
 *
 * Defines the shape of JSON fixture files for test data hydration.
 */

// Fixture metadata
export interface FixtureTemplate {
  name: string;
  description: string;
}

// User in fixture (email is placeholder)
export interface FixtureUser {
  name: string;
  email: string; // "{{EMAIL}}" placeholder
}

// Message in fixture
export interface FixtureMessage {
  role: 'assistant' | 'user';
  content: string;
  stepNumber: number;
  confidenceScore?: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceReasoning?: string;
}

// Trace in fixture
export interface FixtureTrace {
  extractedContext: Record<string, unknown>;
  dimensionalCoverage?: Record<string, unknown>;
  output: Record<string, unknown>;
  claudeThoughts?: string;
  modelUsed: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  starred?: boolean;
}

// Conversation in fixture
export interface FixtureConversation {
  id: string; // "{{CONV_N_ID}}" placeholder
  title?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  currentPhase: string;
  selectedLens?: string;
  questionCount: number;
  experimentVariant?: string;
  messages: FixtureMessage[];
  traces: FixtureTrace[];
}

// Fragment in fixture
export interface FixtureFragment {
  id: string; // "{{FRAG_N_ID}}" placeholder
  content: string;
  contentType: 'theme' | 'insight' | 'quote' | 'stat' | 'principle';
  status: 'active' | 'archived' | 'soft_deleted';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  conversationId?: string; // Reference to "{{CONV_N_ID}}"
  documentId?: string;
  dimensionTags: Array<{
    dimension: string;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

// Deep dive in fixture
export interface FixtureDeepDive {
  id: string; // "{{DD_N_ID}}" placeholder
  topic: string;
  notes?: string;
  status: 'pending' | 'active' | 'resolved';
  origin: 'manual' | 'message' | 'document';
}

// Document in fixture
export interface FixtureDocument {
  id: string; // "{{DOC_N_ID}}" placeholder
  fileName: string;
  fileType: string;
  fileSizeBytes?: number;
  uploadContext?: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  deepDiveId?: string;
}

// Structured provocation for suggested questions and gaps
export interface FixtureProvocation {
  title: string;
  description: string;
}

// Dimensional synthesis in fixture
export interface FixtureSynthesis {
  dimension: string;
  summary?: string;
  keyThemes: string[];
  gaps: FixtureProvocation[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  fragmentCount: number;
}

// Project in fixture
export interface FixtureProject {
  id: string; // "{{PROJECT_ID}}" placeholder
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';
  knowledgeSummary?: string;
  suggestedQuestions: FixtureProvocation[];
  conversations: FixtureConversation[];
  fragments: FixtureFragment[];
  deepDives: FixtureDeepDive[];
  documents: FixtureDocument[];
  syntheses?: FixtureSynthesis[];
}

// Complete fixture file
export interface Fixture {
  template: FixtureTemplate;
  user: FixtureUser;
  projects: FixtureProject[];
}

// Hydration options
export interface HydrateOptions {
  fixture: string;
  email: string;
  variantOverride?: string;
  reset?: boolean;
  dryRun?: boolean;
  production?: boolean;
}

// Export options
export interface ExportOptions {
  email?: string;
  conversationId?: string;
  output: string;
}
