import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import {
  EmergentExtractedContext,
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
 * This is much faster than calling analyzeDimensionalCoverage
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
 * Analyzes emergent themes and maps them to strategic dimensions
 *
 * @param extractedContext - The emergent extraction result
 * @param conversationHistory - Full conversation text for context
 * @returns Dimensional coverage analysis
 */
export async function analyzeDimensionalCoverage(
  extractedContext: EmergentExtractedContext,
  conversationHistory: string
): Promise<DimensionalCoverage> {
  // Build prompt with dimension definitions
  const prompt = buildDimensionalAnalysisPrompt(
    extractedContext,
    conversationHistory
  );

  // Call Claude to map themes to dimensions
  const response = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2, // Lower temp for consistent tagging
  }, 'dimensional_analysis');

  const content = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '';

  // Parse response into DimensionalCoverage structure
  const coverage = parseDimensionalCoverageResponse(content, extractedContext);

  return coverage;
}

function buildDimensionalAnalysisPrompt(
  extractedContext: EmergentExtractedContext,
  conversationHistory: string
): string {
  // Dimension definitions from TAXONOMY_REFERENCE.md
  const dimensionDefinitions = `
1. Customer & Market - Who we serve, their problems, buying behaviour, market dynamics
2. Problem & Opportunity - The problem space, opportunity size, why now, market need
3. Value Proposition - What we offer, how it solves problems, why it matters to customers
4. Differentiation & Advantage - What makes us unique, defensibility, right to win, moats
5. Competitive Landscape - Who else plays, their strengths/weaknesses, positioning, substitutes
6. Business Model & Economics - How we create/capture value, unit economics, growth model, pricing
7. Go-to-Market - Sales strategy, customer success, growth channels, acquisition
8. Product Experience - The experience we're creating, usability, customer journey
9. Capabilities & Assets - What we can do, what we have, team, technology, IP
10. Risks & Constraints - What could go wrong, dependencies, limitations, the 4 big risks`;

  const themesText = extractedContext.themes
    .map(t => `Theme: "${t.theme_name}"\n${t.content}`)
    .join('\n\n');

  return `You are analyzing emergent themes from a business strategy conversation to assess dimensional coverage.

STRATEGIC DIMENSIONS:
${dimensionDefinitions}

EMERGENT THEMES EXTRACTED:
${themesText}

CONVERSATION CONTEXT:
${conversationHistory}

For each of the 10 strategic dimensions, assess:
1. Is this dimension covered by any emergent theme(s)?
2. If yes, which theme(s) map to this dimension?
3. What is your confidence in this coverage? (high/medium/low)

Guidelines:
- A theme can map to multiple dimensions
- A dimension can be covered by multiple themes
- High confidence = theme directly addresses dimension with specific details
- Medium confidence = theme touches on dimension but lacks depth
- Low confidence = theme only tangentially relates to dimension

Output format:

<dimensional_coverage>
  <dimension name="customer_and_market">
    <covered>true/false</covered>
    <confidence>high/medium/low</confidence>
    <themes>
      <theme>Theme name that maps here</theme>
    </themes>
  </dimension>
  <!-- Repeat for all 10 dimensions -->
</dimensional_coverage>`;
}

function parseDimensionalCoverageResponse(
  xml: string,
  extractedContext: EmergentExtractedContext
): DimensionalCoverage {
  // Extract <dimensional_coverage> block
  const coverageRegex = /<dimensional_coverage>([\s\S]*?)<\/dimensional_coverage>/;
  const match = xml.match(coverageRegex);
  const coverageXML = match ? match[1] : '';

  // Parse each dimension
  const dimensions: any = {};

  for (const dimension of STRATEGIC_DIMENSIONS) {
    const dimRegex = new RegExp(
      `<dimension name="${dimension}"[^>]*>([\\s\\S]*?)</dimension>`,
      'i'
    );
    const dimMatch = coverageXML.match(dimRegex);

    if (dimMatch) {
      const dimContent = dimMatch[1];

      const covered = /<covered>true<\/covered>/i.test(dimContent);

      const confMatch = dimContent.match(/<confidence>(high|medium|low)<\/confidence>/i);
      const confidence: CoverageConfidence = confMatch
        ? (confMatch[1].toLowerCase() as CoverageConfidence)
        : 'low';

      const themeMatches = dimContent.matchAll(/<theme>([^<]+)<\/theme>/gi);
      const themes = Array.from(themeMatches).map(m => m[1].trim());

      dimensions[dimension] = {
        covered,
        confidence,
        themes,
      };
    } else {
      // Default if dimension not found in response
      dimensions[dimension] = {
        covered: false,
        confidence: 'low' as CoverageConfidence,
        themes: [],
      };
    }
  }

  // Calculate summary metrics
  const coveredDimensions = STRATEGIC_DIMENSIONS.filter(
    d => dimensions[d].covered
  );

  const primaryDimensions = STRATEGIC_DIMENSIONS.filter(
    d => dimensions[d].covered && dimensions[d].confidence === 'high'
  );

  const gaps = STRATEGIC_DIMENSIONS.filter(
    d => !dimensions[d].covered
  );

  return {
    dimensions,
    summary: {
      dimensionsCovered: coveredDimensions.length,
      coveragePercentage: Math.round((coveredDimensions.length / 10) * 100),
      gaps,
      primaryDimensions,
    },
    analysisTimestamp: new Date().toISOString(),
    modelUsed: CLAUDE_MODEL,
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
