// src/lib/contracts/persistence.ts
/**
 * Persistence Contracts
 *
 * Defines what gets written to the database during extraction.
 * Based on Fragment, FragmentDimensionTag, and Document models in Prisma schema.
 */

// Document status values
export const DOCUMENT_STATUSES = ['pending', 'processing', 'complete', 'failed'] as const;
export type DocumentStatus = typeof DOCUMENT_STATUSES[number];

// Document record for uploaded files
export interface DocumentContract {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number;
  uploadContext?: string;
  status: DocumentStatus;
  processedAt?: string; // ISO date string
  errorMessage?: string;
}

// What document upload API expects
export interface DocumentUploadInputContract {
  projectId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number;
  uploadContext?: string;
}

// Valid dimension keys (Tier 1 dimensions)
export const VALID_DIMENSIONS = [
  'customer_market',
  'problem_opportunity',
  'value_proposition',
  'differentiation_advantage',
  'competitive_landscape',
  'business_model_economics',
  'go_to_market',
  'product_experience',
  'capabilities_assets',
  'risks_constraints',
  'strategic_intent',
] as const;

export type DimensionKey = typeof VALID_DIMENSIONS[number];

// Fragment record created from extraction
export interface FragmentContract {
  id: string;
  projectId: string;
  conversationId?: string; // Optional - null for document-sourced fragments
  documentId?: string;     // Optional - null for conversation-sourced fragments
  title?: string;          // Short theme/insight name for display
  content: string;
  contentType: 'theme'; // Currently only themes
  status: 'active';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Dimension tag attached to fragment
export interface FragmentDimensionTagContract {
  id: string;
  fragmentId: string;
  dimension: DimensionKey;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

// What createFragmentsFromThemes produces
export interface FragmentCreationResultContract {
  fragments: FragmentContract[];
  dimensionTags: FragmentDimensionTagContract[];
}

// Validation functions
export function isValidDimension(dimension: string): dimension is DimensionKey {
  return VALID_DIMENSIONS.includes(dimension as DimensionKey);
}

export function validateFragment(data: unknown): data is FragmentContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  // conversationId is optional (null for document-sourced fragments)
  if (obj.conversationId !== undefined && obj.conversationId !== null && typeof obj.conversationId !== 'string') return false;
  // documentId is optional (null for conversation-sourced fragments)
  if (obj.documentId !== undefined && obj.documentId !== null && typeof obj.documentId !== 'string') return false;
  // At least one of conversationId or documentId should be present
  if (!obj.conversationId && !obj.documentId) return false;
  if (typeof obj.content !== 'string' || !obj.content) return false;
  if (obj.contentType !== 'theme') return false;
  if (obj.status !== 'active') return false;

  return true;
}

export function validateFragmentDimensionTag(data: unknown): data is FragmentDimensionTagContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.fragmentId !== 'string' || !obj.fragmentId) return false;
  if (typeof obj.dimension !== 'string') return false;
  if (!isValidDimension(obj.dimension)) return false;

  return true;
}

export function validateFragmentCreationResult(data: unknown): data is FragmentCreationResultContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.fragments)) return false;
  if (!Array.isArray(obj.dimensionTags)) return false;

  // At least one fragment should be created from themes
  if (obj.fragments.length === 0) return false;

  // Validate each fragment
  for (const fragment of obj.fragments) {
    if (!validateFragment(fragment)) return false;
  }

  // Validate each dimension tag
  for (const tag of obj.dimensionTags) {
    if (!validateFragmentDimensionTag(tag)) return false;
  }

  return true;
}

// Document validation
export function isValidDocumentStatus(status: string): status is DocumentStatus {
  return DOCUMENT_STATUSES.includes(status as DocumentStatus);
}

export function validateDocument(data: unknown): data is DocumentContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  if (typeof obj.fileName !== 'string' || !obj.fileName) return false;
  if (typeof obj.fileType !== 'string' || !obj.fileType) return false;
  if (typeof obj.status !== 'string' || !isValidDocumentStatus(obj.status)) return false;

  // Optional fields
  if (obj.fileSizeBytes !== undefined && obj.fileSizeBytes !== null && typeof obj.fileSizeBytes !== 'number') return false;
  if (obj.uploadContext !== undefined && obj.uploadContext !== null && typeof obj.uploadContext !== 'string') return false;
  if (obj.processedAt !== undefined && obj.processedAt !== null && typeof obj.processedAt !== 'string') return false;
  if (obj.errorMessage !== undefined && obj.errorMessage !== null && typeof obj.errorMessage !== 'string') return false;

  return true;
}

export function validateDocumentUploadInput(data: unknown): data is DocumentUploadInputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.projectId !== 'string' || !obj.projectId) return false;
  if (typeof obj.fileName !== 'string' || !obj.fileName) return false;
  if (typeof obj.fileType !== 'string' || !obj.fileType) return false;

  // Optional fields
  if (obj.fileSizeBytes !== undefined && obj.fileSizeBytes !== null && typeof obj.fileSizeBytes !== 'number') return false;
  if (obj.uploadContext !== undefined && obj.uploadContext !== null && typeof obj.uploadContext !== 'string') return false;

  return true;
}

// Project status values
export const PROJECT_STATUSES = ['active', 'archived', 'deleted'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

// Project record
export interface ProjectContract {
  id: string;
  userId: string;
  name: string;
  status: ProjectStatus;
  isDemo: boolean;
  description?: string;
}

export function isValidProjectStatus(status: string): status is ProjectStatus {
  return PROJECT_STATUSES.includes(status as ProjectStatus);
}

export function validateProject(data: unknown): data is ProjectContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.userId !== 'string' || !obj.userId) return false;
  if (typeof obj.name !== 'string' || !obj.name) return false;
  if (typeof obj.status !== 'string' || !isValidProjectStatus(obj.status)) return false;
  if (typeof obj.isDemo !== 'boolean') return false;

  // Optional fields
  if (obj.description !== undefined && obj.description !== null && typeof obj.description !== 'string') return false;

  return true;
}
