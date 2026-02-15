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
  status: 'in_progress' | 'completed' | 'abandoned' | 'extracted' | 'extracting';
  currentPhase: string;
  selectedLens?: string;
  questionCount: number;
  experimentVariant?: string;
  isInitialConversation?: boolean;
  deepDiveId?: string;
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
  origin: 'manual' | 'message' | 'document' | 'suggested_question';
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

// Generated output in fixture
export interface FixtureGeneratedOutput {
  outputType: string;
  version: number;
  content: Record<string, unknown>;
  generatedFrom?: string;
  modelUsed: string;
  changeSummary?: string;
}

// User-authored content in fixture (opportunities, principles)
export interface FixtureUserContent {
  id: string; // "{{UC_N_ID}}" placeholder
  type: 'opportunity' | 'principle';
  content: string;
  status: 'draft' | 'complete';
  metadata?: {
    objectiveIds?: string[];
    coachingDismissed?: boolean;
    parsedTitle?: string;
    parsedTimeframe?: string;
  };
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
  generatedOutputs?: FixtureGeneratedOutput[];
  userContent?: FixtureUserContent[];
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
  email?: string;
  variantOverride?: string;
  reset?: boolean;
  dryRun?: boolean;
  production?: boolean;
  // For hydrating into existing guest projects
  projectId?: string;
  userId?: string;
}

// Export options
export interface ExportOptions {
  email?: string;
  conversationId?: string;
  output: string;
}
