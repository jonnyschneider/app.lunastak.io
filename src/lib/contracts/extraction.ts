// src/lib/contracts/extraction.ts
/**
 * Extraction Output Contract
 *
 * Defines the shape of data produced by /api/extract.
 * Both emergent (E1a/E3) and prescriptive (baseline-v1) variants.
 */

// Shared reflective summary (same for both approaches)
export interface ReflectiveSummaryContract {
  strengths: string[];
  emerging: string[];
  opportunities_for_enrichment: string[];
  thought_prompt?: string;
}

// Emergent theme with inline dimensions
export interface EmergentThemeContract {
  theme_name: string;
  content: string;
  dimensions?: Array<{
    name: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

// Emergent extraction output (E1a, E3)
export interface EmergentExtractionContract {
  themes: EmergentThemeContract[];
  reflective_summary: ReflectiveSummaryContract;
  extraction_approach: 'emergent';
}

// Prescriptive extraction output (baseline-v1)
export interface PrescriptiveExtractionContract {
  core: {
    industry: string;
    target_market: string;
    unique_value: string;
  };
  enrichment: {
    competitive_context?: string;
    customer_segments?: string[];
    operational_capabilities?: string;
    technical_advantages?: string;
    [key: string]: unknown;
  };
  reflective_summary: ReflectiveSummaryContract;
  extraction_approach: 'prescriptive';
}

// Union type - what /api/extract produces
export type ExtractionOutputContract = EmergentExtractionContract | PrescriptiveExtractionContract;

// Type guards
export function isEmergentExtraction(output: ExtractionOutputContract): output is EmergentExtractionContract {
  return output.extraction_approach === 'emergent';
}

export function isPrescriptiveExtraction(output: ExtractionOutputContract): output is PrescriptiveExtractionContract {
  return output.extraction_approach === 'prescriptive';
}

// Validation functions
export function validateEmergentExtraction(data: unknown): data is EmergentExtractionContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (obj.extraction_approach !== 'emergent') return false;
  if (!Array.isArray(obj.themes)) return false;
  if (obj.themes.length === 0) return false;

  // Check first theme has required fields
  const theme = obj.themes[0] as Record<string, unknown>;
  if (typeof theme.theme_name !== 'string' || !theme.theme_name) return false;
  if (typeof theme.content !== 'string' || !theme.content) return false;

  // Check reflective_summary structure
  const summary = obj.reflective_summary as Record<string, unknown>;
  if (!summary || typeof summary !== 'object') return false;
  if (!Array.isArray(summary.strengths)) return false;
  if (!Array.isArray(summary.emerging)) return false;
  if (!Array.isArray(summary.opportunities_for_enrichment)) return false;

  return true;
}

export function validatePrescriptiveExtraction(data: unknown): data is PrescriptiveExtractionContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (obj.extraction_approach !== 'prescriptive') return false;

  // Check core fields
  const core = obj.core as Record<string, unknown>;
  if (!core || typeof core !== 'object') return false;
  if (typeof core.industry !== 'string' || !core.industry) return false;
  if (typeof core.target_market !== 'string' || !core.target_market) return false;
  if (typeof core.unique_value !== 'string' || !core.unique_value) return false;

  // Check reflective_summary structure
  const summary = obj.reflective_summary as Record<string, unknown>;
  if (!summary || typeof summary !== 'object') return false;
  if (!Array.isArray(summary.strengths)) return false;

  return true;
}
