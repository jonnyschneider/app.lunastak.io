import {
  DimensionalCoverage,
  STRATEGIC_DIMENSIONS,
  StrategicDimension,
  CoverageConfidence,
} from '@/lib/types';
import { Tier1Dimension } from '@/lib/constants/dimensions';
import { DimensionTagInput } from '@/lib/fragments';

// Map from inline dimension keys to strategic dimension names
const INLINE_TO_STRATEGIC: Record<string, StrategicDimension> = {
  'customer_market': 'customer_and_market',
  'problem_opportunity': 'problem_and_opportunity',
  'value_proposition': 'value_proposition',
  'differentiation_advantage': 'differentiation_and_advantage',
  'competitive_landscape': 'competitive_landscape',
  'business_model_economics': 'business_model_and_economics',
  'go_to_market': 'go_to_market',
  'product_experience': 'product_experience',
  'capabilities_assets': 'capabilities_and_assets',
  'risks_constraints': 'risks_and_constraints',
};

interface ParsedTheme {
  theme_name: string;
  content: string;
  dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[];
}

/**
 * Compute dimensional coverage from inline dimension tags (no Claude call needed)
 * No separate Claude call — dimensions arrive inline on the extracted themes.
 */
export function computeDimensionalCoverageFromInline(
  themes: ParsedTheme[]
): DimensionalCoverage {
  // Initialize all dimensions as uncovered
  const dimensions = Object.fromEntries(
    STRATEGIC_DIMENSIONS.map(dim => [dim, { covered: false, confidence: 'low' as CoverageConfidence, themes: [] as string[] }])
  ) as { [K in StrategicDimension]: { covered: boolean; confidence: CoverageConfidence; themes: string[] } };

  // Map inline dimensions to strategic dimensions
  for (const theme of themes) {
    for (const inlineDim of theme.dimensions) {
      const strategicDim = INLINE_TO_STRATEGIC[inlineDim.name];
      if (!strategicDim) {
        console.log(`[DimensionalCoverage] Unknown inline dimension: ${inlineDim.name}`);
        continue;
      }

      const dimData = dimensions[strategicDim];
      dimData.covered = true;
      dimData.themes.push(theme.theme_name);

      // Upgrade confidence if higher
      const confOrder = { 'low': 0, 'medium': 1, 'high': 2 };
      const inlineConf = inlineDim.confidence.toLowerCase() as CoverageConfidence;
      if (confOrder[inlineConf] > confOrder[dimData.confidence]) {
        dimData.confidence = inlineConf;
      }
    }
  }

  // Calculate summary
  const coveredDimensions = STRATEGIC_DIMENSIONS.filter(d => dimensions[d].covered);
  const primaryDimensions = STRATEGIC_DIMENSIONS.filter(
    d => dimensions[d].covered && dimensions[d].confidence === 'high'
  );
  const gaps = STRATEGIC_DIMENSIONS.filter(d => !dimensions[d].covered);

  return {
    dimensions,
    summary: {
      dimensionsCovered: coveredDimensions.length,
      coveragePercentage: Math.round((coveredDimensions.length / 10) * 100),
      gaps,
      primaryDimensions,
    },
    analysisTimestamp: new Date().toISOString(),
    modelUsed: 'inline-extraction', // No separate model call
  };
}

/**
 * Map from dimensional-analysis dimension names to Tier 1 dimension constants
 */
const DIMENSION_NAME_MAP: Record<string, Tier1Dimension> = {
  'customer_and_market': 'CUSTOMER_MARKET',
  'problem_and_opportunity': 'PROBLEM_OPPORTUNITY',
  'value_proposition': 'VALUE_PROPOSITION',
  'differentiation_and_advantage': 'DIFFERENTIATION_ADVANTAGE',
  'competitive_landscape': 'COMPETITIVE_LANDSCAPE',
  'business_model_and_economics': 'BUSINESS_MODEL_ECONOMICS',
  'go_to_market': 'GO_TO_MARKET',
  'product_experience': 'PRODUCT_EXPERIENCE',
  'capabilities_and_assets': 'CAPABILITIES_ASSETS',
  'risks_and_constraints': 'RISKS_CONSTRAINTS',
}

/**
 * Convert dimensional coverage response to fragment dimension tags
 * Returns a map of theme_name -> dimension tags
 */
export function convertCoverageToDimensionTags(
  coverage: DimensionalCoverage
): Map<string, DimensionTagInput[]> {
  const themeToTags = new Map<string, DimensionTagInput[]>()

  for (const [dimKey, dimValue] of Object.entries(coverage.dimensions)) {
    if (!dimValue.covered) continue

    const tier1Dimension = DIMENSION_NAME_MAP[dimKey]
    if (!tier1Dimension) {
      console.log(`[DimensionalAnalysis] No mapping for dimension: ${dimKey}`)
      continue
    }

    for (const themeName of dimValue.themes) {
      const existingTags = themeToTags.get(themeName) || []
      existingTags.push({
        dimension: tier1Dimension,
        confidence: dimValue.confidence.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
        reasoning: `Mapped from dimensional coverage analysis`,
      })
      themeToTags.set(themeName, existingTags)
    }
  }

  console.log(`[DimensionalAnalysis] Created dimension tags for ${themeToTags.size} themes:`,
    Array.from(themeToTags.keys()))

  return themeToTags
}
