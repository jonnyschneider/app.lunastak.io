/**
 * Unit tests for computeDimensionalCoverageFromInline.
 *
 * The LLM-calling half of this module (`analyzeDimensionalCoverage` and its
 * prompt/parser helpers) was deleted 2026-08-27 as an orphan — no importers.
 * The `Dimensional Analysis Parsing` describe block that nominally covered its
 * parser went with it: those cases asserted locally-defined literals and never
 * called production code.
 */


describe('computeDimensionalCoverageFromInline', () => {
  // Dynamic import for Vitest alias resolution
  let computeDimensionalCoverageFromInline: any
  beforeAll(async () => {
    const mod = await import('@/lib/dimensional-analysis')
    computeDimensionalCoverageFromInline = mod.computeDimensionalCoverageFromInline
  })

  it('should compute coverage from themes with inline dimensions', () => {
    const themes = [
      {
        theme_name: 'Customer Pain Points',
        content: 'Users struggle with manual data entry',
        dimensions: [
          { name: 'customer_market', confidence: 'HIGH' as const },
          { name: 'problem_opportunity', confidence: 'MEDIUM' as const },
        ],
      },
      {
        theme_name: 'Market Opportunity',
        content: 'Growing market for automation',
        dimensions: [
          { name: 'problem_opportunity', confidence: 'HIGH' as const },
        ],
      },
    ];

    const result = computeDimensionalCoverageFromInline(themes);

    // Check covered dimensions
    expect(result.dimensions.customer_and_market.covered).toBe(true);
    expect(result.dimensions.customer_and_market.confidence).toBe('high');
    expect(result.dimensions.customer_and_market.themes).toContain('Customer Pain Points');

    expect(result.dimensions.problem_and_opportunity.covered).toBe(true);
    expect(result.dimensions.problem_and_opportunity.confidence).toBe('high'); // Upgraded from medium
    expect(result.dimensions.problem_and_opportunity.themes).toHaveLength(2);

    // Check uncovered dimensions
    expect(result.dimensions.value_proposition.covered).toBe(false);
    expect(result.dimensions.competitive_landscape.covered).toBe(false);

    // Check summary
    expect(result.summary.dimensionsCovered).toBe(2);
    expect(result.summary.coveragePercentage).toBe(20);
    expect(result.summary.gaps).toContain('value_proposition');
    expect(result.summary.primaryDimensions).toContain('customer_and_market');
  });

  it('should handle empty themes array', () => {
    const result = computeDimensionalCoverageFromInline([]);

    expect(result.summary.dimensionsCovered).toBe(0);
    expect(result.summary.coveragePercentage).toBe(0);
    expect(result.summary.gaps).toHaveLength(10);
    expect(result.summary.primaryDimensions).toHaveLength(0);
  });

  it('should handle themes without dimensions', () => {
    const themes = [
      {
        theme_name: 'Orphan Theme',
        content: 'No dimensions tagged',
        dimensions: [],
      },
    ];

    const result = computeDimensionalCoverageFromInline(themes);

    expect(result.summary.dimensionsCovered).toBe(0);
    expect(result.summary.coveragePercentage).toBe(0);
  });

  it('should upgrade confidence when multiple themes cover same dimension', () => {
    const themes = [
      {
        theme_name: 'Theme A',
        content: 'First theme',
        dimensions: [{ name: 'customer_market', confidence: 'LOW' as const }],
      },
      {
        theme_name: 'Theme B',
        content: 'Second theme',
        dimensions: [{ name: 'customer_market', confidence: 'HIGH' as const }],
      },
    ];

    const result = computeDimensionalCoverageFromInline(themes);

    // Confidence should be upgraded to HIGH (highest among themes)
    expect(result.dimensions.customer_and_market.confidence).toBe('high');
    expect(result.dimensions.customer_and_market.themes).toEqual(['Theme A', 'Theme B']);
  });

  it('should handle unknown dimension keys gracefully', () => {
    const themes = [
      {
        theme_name: 'Theme with bad dimension',
        content: 'Has unknown dimension',
        dimensions: [
          { name: 'unknown_dimension', confidence: 'HIGH' as const },
          { name: 'customer_market', confidence: 'MEDIUM' as const },
        ],
      },
    ];

    const result = computeDimensionalCoverageFromInline(themes);

    // Should still process the valid dimension
    expect(result.dimensions.customer_and_market.covered).toBe(true);
    expect(result.summary.dimensionsCovered).toBe(1);
  });

  it('should include metadata in result', () => {
    const result = computeDimensionalCoverageFromInline([]);

    expect(result.analysisTimestamp).toBeTruthy();
    expect(result.modelUsed).toBe('inline-extraction');
  });

  it('should map all inline dimension keys correctly', () => {
    // Test all 10 dimension mappings
    const themes = [
      {
        theme_name: 'All Dimensions',
        content: 'Covers everything',
        dimensions: [
          { name: 'customer_market', confidence: 'HIGH' as const },
          { name: 'problem_opportunity', confidence: 'HIGH' as const },
          { name: 'value_proposition', confidence: 'HIGH' as const },
          { name: 'differentiation_advantage', confidence: 'HIGH' as const },
          { name: 'competitive_landscape', confidence: 'HIGH' as const },
          { name: 'business_model_economics', confidence: 'HIGH' as const },
          { name: 'go_to_market', confidence: 'HIGH' as const },
          { name: 'product_experience', confidence: 'HIGH' as const },
          { name: 'capabilities_assets', confidence: 'HIGH' as const },
          { name: 'risks_constraints', confidence: 'HIGH' as const },
        ],
      },
    ];

    const result = computeDimensionalCoverageFromInline(themes);

    expect(result.summary.dimensionsCovered).toBe(10);
    expect(result.summary.coveragePercentage).toBe(100);
    expect(result.summary.gaps).toHaveLength(0);
    expect(result.summary.primaryDimensions).toHaveLength(10);
  });
});
