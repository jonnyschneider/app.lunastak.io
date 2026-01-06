// src/lib/contracts/persistence.ts
/**
 * Persistence Contracts
 *
 * Defines what gets written to the database during extraction.
 * Based on Fragment and FragmentDimensionTag models in Prisma schema.
 */

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
] as const;

export type DimensionKey = typeof VALID_DIMENSIONS[number];

// Fragment record created from extraction
export interface FragmentContract {
  id: string;
  projectId: string;
  conversationId: string;
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
  if (typeof obj.conversationId !== 'string' || !obj.conversationId) return false;
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
