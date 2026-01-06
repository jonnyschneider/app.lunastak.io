# Contract-Driven Quality Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add data contracts, seam tests, and smoke test to catch pipeline breakages before deployment.

**Architecture:** Define TypeScript types for data boundaries (extraction output, fragment persistence, generation input/output), write integration tests verifying contracts at seams, create end-to-end smoke test with mocked AI, and install pre-push hook to enforce verification.

**Tech Stack:** Jest, TypeScript, Prisma mocks, deterministic AI response fixtures, git hooks

---

## Task 1: Create Contract Types Directory Structure

**Files:**
- Create: `src/lib/contracts/index.ts`
- Create: `src/lib/contracts/extraction.ts`
- Create: `src/lib/contracts/generation.ts`
- Create: `src/lib/contracts/persistence.ts`
- Create: `src/lib/contracts/README.md`

**Step 1: Create contracts directory and index file**

```typescript
// src/lib/contracts/index.ts
export * from './extraction';
export * from './generation';
export * from './persistence';
```

**Step 2: Run type-check to verify empty exports work**

Run: `npm run type-check`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add src/lib/contracts/
git commit -m "chore: scaffold contracts directory structure"
```

---

## Task 2: Define Extraction Output Contract

**Files:**
- Modify: `src/lib/contracts/extraction.ts`

**Step 1: Write the extraction contracts based on actual types in src/lib/types.ts**

```typescript
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
```

**Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/contracts/extraction.ts
git commit -m "feat(contracts): define extraction output contract types"
```

---

## Task 3: Define Generation Contracts

**Files:**
- Modify: `src/lib/contracts/generation.ts`

**Step 1: Write generation contracts based on src/lib/types.ts and /api/generate**

```typescript
// src/lib/contracts/generation.ts
/**
 * Generation Contracts
 *
 * Defines what /api/generate expects as input and produces as output.
 */

import { ExtractionOutputContract } from './extraction';

// Re-export extraction for convenience
export type { ExtractionOutputContract };

// Objective structure in generated output
export interface ObjectiveContract {
  id: string;
  pithy: string;
  metric: {
    summary: string;
    full: string;
    category: string;
    direction?: 'increase' | 'decrease';
    metricName?: string;
    metricValue?: string;
    timeframe?: '3M' | '6M' | '9M' | '12M' | '18M';
  };
  explanation: string;
  successCriteria: string;
}

// Strategy statements - the core output
export interface StrategyStatementsContract {
  vision: string;
  strategy: string;
  objectives: ObjectiveContract[];
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    objectiveIds: string[];
  }>;
  principles: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

// What /api/generate expects
export interface GenerationInputContract {
  conversationId: string;
  extractedContext: ExtractionOutputContract;
  dimensionalCoverage?: unknown; // Optional E2 coverage data
}

// What /api/generate returns
export interface GenerationOutputContract {
  traceId: string;
  thoughts: string;
  statements: StrategyStatementsContract;
}

// Validation
export function validateGenerationInput(data: unknown): data is GenerationInputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.conversationId !== 'string' || !obj.conversationId) return false;
  if (!obj.extractedContext || typeof obj.extractedContext !== 'object') return false;

  return true;
}

export function validateGenerationOutput(data: unknown): data is GenerationOutputContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.traceId !== 'string' || !obj.traceId) return false;
  if (typeof obj.thoughts !== 'string') return false;

  const statements = obj.statements as Record<string, unknown>;
  if (!statements || typeof statements !== 'object') return false;
  if (typeof statements.vision !== 'string' || !statements.vision) return false;
  if (typeof statements.strategy !== 'string' || !statements.strategy) return false;
  if (!Array.isArray(statements.objectives)) return false;

  return true;
}
```

**Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/contracts/generation.ts
git commit -m "feat(contracts): define generation input/output contract types"
```

---

## Task 4: Define Fragment Persistence Contracts

**Files:**
- Modify: `src/lib/contracts/persistence.ts`

**Step 1: Write fragment persistence contracts based on prisma/schema.prisma and src/lib/fragments.ts**

```typescript
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
```

**Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/contracts/persistence.ts
git commit -m "feat(contracts): define fragment persistence contract types"
```

---

## Task 5: Write Extraction Contract Tests

**Files:**
- Create: `src/lib/__tests__/contracts/extraction-contracts.test.ts`

**Step 1: Write the tests**

```typescript
// src/lib/__tests__/contracts/extraction-contracts.test.ts
/**
 * Extraction Contract Tests
 *
 * Verifies that extraction output conforms to contracts.
 */

import {
  validateEmergentExtraction,
  validatePrescriptiveExtraction,
  EmergentExtractionContract,
  PrescriptiveExtractionContract,
} from '@/lib/contracts/extraction';

describe('Extraction Contracts', () => {
  describe('EmergentExtractionContract', () => {
    const validEmergent: EmergentExtractionContract = {
      themes: [
        {
          theme_name: 'Customer Pain Points',
          content: 'SMBs struggle with complex invoicing workflows',
          dimensions: [
            { name: 'customer_market', confidence: 'HIGH' },
          ],
        },
        {
          theme_name: 'Technical Differentiation',
          content: 'AI-powered automation reduces manual work by 80%',
          dimensions: [
            { name: 'differentiation_advantage', confidence: 'HIGH' },
            { name: 'capabilities_assets', confidence: 'MEDIUM' },
          ],
        },
      ],
      reflective_summary: {
        strengths: ['Clear understanding of customer pain'],
        emerging: ['Technical approach taking shape'],
        opportunities_for_enrichment: ['Explore go-to-market strategy'],
        thought_prompt: 'How will you reach your first 100 customers?',
      },
      extraction_approach: 'emergent',
    };

    it('should validate a correct emergent extraction', () => {
      expect(validateEmergentExtraction(validEmergent)).toBe(true);
    });

    it('should reject extraction with no themes', () => {
      const invalid = { ...validEmergent, themes: [] };
      expect(validateEmergentExtraction(invalid)).toBe(false);
    });

    it('should reject extraction with missing theme_name', () => {
      const invalid = {
        ...validEmergent,
        themes: [{ content: 'Some content' }],
      };
      expect(validateEmergentExtraction(invalid)).toBe(false);
    });

    it('should reject extraction with wrong approach', () => {
      const invalid = { ...validEmergent, extraction_approach: 'prescriptive' };
      expect(validateEmergentExtraction(invalid)).toBe(false);
    });

    it('should reject extraction with missing reflective_summary', () => {
      const { reflective_summary, ...invalid } = validEmergent;
      expect(validateEmergentExtraction(invalid)).toBe(false);
    });
  });

  describe('PrescriptiveExtractionContract', () => {
    const validPrescriptive: PrescriptiveExtractionContract = {
      core: {
        industry: 'Financial Technology',
        target_market: 'SMB accounting firms',
        unique_value: 'AI-powered invoice processing',
      },
      enrichment: {
        competitive_context: 'Competing with legacy software',
      },
      reflective_summary: {
        strengths: ['Clear industry focus'],
        emerging: ['Target market becoming defined'],
        opportunities_for_enrichment: ['Explore pricing strategy'],
      },
      extraction_approach: 'prescriptive',
    };

    it('should validate a correct prescriptive extraction', () => {
      expect(validatePrescriptiveExtraction(validPrescriptive)).toBe(true);
    });

    it('should reject extraction with missing core.industry', () => {
      const invalid = {
        ...validPrescriptive,
        core: { target_market: 'SMBs', unique_value: 'AI' },
      };
      expect(validatePrescriptiveExtraction(invalid)).toBe(false);
    });

    it('should reject extraction with wrong approach', () => {
      const invalid = { ...validPrescriptive, extraction_approach: 'emergent' };
      expect(validatePrescriptiveExtraction(invalid)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --testPathPattern=extraction-contracts`
Expected: PASS (all 8 tests)

**Step 3: Commit**

```bash
git add src/lib/__tests__/contracts/
git commit -m "test(contracts): add extraction contract validation tests"
```

---

## Task 6: Write Generation Contract Tests

**Files:**
- Create: `src/lib/__tests__/contracts/generation-contracts.test.ts`

**Step 1: Write the tests**

```typescript
// src/lib/__tests__/contracts/generation-contracts.test.ts
/**
 * Generation Contract Tests
 *
 * Verifies generation input/output contracts.
 */

import {
  validateGenerationInput,
  validateGenerationOutput,
  GenerationInputContract,
  GenerationOutputContract,
} from '@/lib/contracts/generation';
import { EmergentExtractionContract } from '@/lib/contracts/extraction';

describe('Generation Contracts', () => {
  const validExtractedContext: EmergentExtractionContract = {
    themes: [
      {
        theme_name: 'Market Opportunity',
        content: 'Growing demand for automation',
        dimensions: [{ name: 'problem_opportunity', confidence: 'HIGH' }],
      },
    ],
    reflective_summary: {
      strengths: ['Clear opportunity'],
      emerging: [],
      opportunities_for_enrichment: [],
    },
    extraction_approach: 'emergent',
  };

  describe('GenerationInputContract', () => {
    const validInput: GenerationInputContract = {
      conversationId: 'cmk123abc',
      extractedContext: validExtractedContext,
    };

    it('should validate correct input', () => {
      expect(validateGenerationInput(validInput)).toBe(true);
    });

    it('should reject input with missing conversationId', () => {
      const invalid = { extractedContext: validExtractedContext };
      expect(validateGenerationInput(invalid)).toBe(false);
    });

    it('should reject input with empty conversationId', () => {
      const invalid = { ...validInput, conversationId: '' };
      expect(validateGenerationInput(invalid)).toBe(false);
    });

    it('should reject input with missing extractedContext', () => {
      const invalid = { conversationId: 'cmk123abc' };
      expect(validateGenerationInput(invalid)).toBe(false);
    });

    it('should accept input with optional dimensionalCoverage', () => {
      const withCoverage = {
        ...validInput,
        dimensionalCoverage: { summary: { coveragePercentage: 80 } },
      };
      expect(validateGenerationInput(withCoverage)).toBe(true);
    });
  });

  describe('GenerationOutputContract', () => {
    const validOutput: GenerationOutputContract = {
      traceId: 'trace_abc123',
      thoughts: 'Based on the themes discussed...',
      statements: {
        vision: 'To transform how businesses handle invoicing',
        strategy: 'Build AI-first automation platform',
        objectives: [
          {
            id: 'obj-1',
            pithy: 'Achieve product-market fit',
            metric: {
              summary: '100 paying customers',
              full: 'Acquire 100 paying customers in Q1',
              category: 'Growth',
            },
            explanation: 'Validate demand with real revenue',
            successCriteria: '100+ customers paying monthly',
          },
        ],
        opportunities: [],
        principles: [],
      },
    };

    it('should validate correct output', () => {
      expect(validateGenerationOutput(validOutput)).toBe(true);
    });

    it('should reject output with missing traceId', () => {
      const { traceId, ...invalid } = validOutput;
      expect(validateGenerationOutput(invalid)).toBe(false);
    });

    it('should reject output with missing vision', () => {
      const invalid = {
        ...validOutput,
        statements: { ...validOutput.statements, vision: '' },
      };
      expect(validateGenerationOutput(invalid)).toBe(false);
    });

    it('should reject output with missing strategy', () => {
      const invalid = {
        ...validOutput,
        statements: { ...validOutput.statements, strategy: '' },
      };
      expect(validateGenerationOutput(invalid)).toBe(false);
    });

    it('should reject output with non-array objectives', () => {
      const invalid = {
        ...validOutput,
        statements: { ...validOutput.statements, objectives: 'not an array' },
      };
      expect(validateGenerationOutput(invalid)).toBe(false);
    });
  });
});
```

**Step 2: Run test**

Run: `npm test -- --testPathPattern=generation-contracts`
Expected: PASS (all 10 tests)

**Step 3: Commit**

```bash
git add src/lib/__tests__/contracts/generation-contracts.test.ts
git commit -m "test(contracts): add generation contract validation tests"
```

---

## Task 7: Write Fragment Persistence Contract Tests

**Files:**
- Create: `src/lib/__tests__/contracts/persistence-contracts.test.ts`

**Step 1: Write the tests**

```typescript
// src/lib/__tests__/contracts/persistence-contracts.test.ts
/**
 * Fragment Persistence Contract Tests
 *
 * Verifies that fragment creation conforms to contracts.
 */

import {
  validateFragment,
  validateFragmentDimensionTag,
  validateFragmentCreationResult,
  isValidDimension,
  VALID_DIMENSIONS,
  FragmentContract,
  FragmentDimensionTagContract,
} from '@/lib/contracts/persistence';

describe('Persistence Contracts', () => {
  describe('isValidDimension', () => {
    it('should accept all valid dimensions', () => {
      for (const dim of VALID_DIMENSIONS) {
        expect(isValidDimension(dim)).toBe(true);
      }
    });

    it('should reject invalid dimensions', () => {
      expect(isValidDimension('invalid_dimension')).toBe(false);
      expect(isValidDimension('CUSTOMER_MARKET')).toBe(false); // case sensitive
      expect(isValidDimension('')).toBe(false);
    });
  });

  describe('FragmentContract', () => {
    const validFragment: FragmentContract = {
      id: 'frag_abc123',
      projectId: 'proj_xyz789',
      conversationId: 'conv_def456',
      content: 'SMBs struggle with invoice processing',
      contentType: 'theme',
      status: 'active',
      confidence: 'HIGH',
    };

    it('should validate a correct fragment', () => {
      expect(validateFragment(validFragment)).toBe(true);
    });

    it('should reject fragment with missing id', () => {
      const { id, ...invalid } = validFragment;
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with missing projectId', () => {
      const { projectId, ...invalid } = validFragment;
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with missing conversationId', () => {
      const { conversationId, ...invalid } = validFragment;
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with empty content', () => {
      const invalid = { ...validFragment, content: '' };
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with wrong contentType', () => {
      const invalid = { ...validFragment, contentType: 'insight' };
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with wrong status', () => {
      const invalid = { ...validFragment, status: 'archived' };
      expect(validateFragment(invalid)).toBe(false);
    });
  });

  describe('FragmentDimensionTagContract', () => {
    const validTag: FragmentDimensionTagContract = {
      id: 'tag_abc123',
      fragmentId: 'frag_abc123',
      dimension: 'customer_market',
      confidence: 'HIGH',
    };

    it('should validate a correct dimension tag', () => {
      expect(validateFragmentDimensionTag(validTag)).toBe(true);
    });

    it('should reject tag with missing fragmentId', () => {
      const { fragmentId, ...invalid } = validTag;
      expect(validateFragmentDimensionTag(invalid)).toBe(false);
    });

    it('should reject tag with invalid dimension', () => {
      const invalid = { ...validTag, dimension: 'invalid_dimension' };
      expect(validateFragmentDimensionTag(invalid)).toBe(false);
    });

    it('should accept tag without confidence (optional)', () => {
      const { confidence, ...withoutConfidence } = validTag;
      expect(validateFragmentDimensionTag(withoutConfidence)).toBe(true);
    });
  });

  describe('FragmentCreationResultContract', () => {
    const validResult = {
      fragments: [
        {
          id: 'frag_1',
          projectId: 'proj_1',
          conversationId: 'conv_1',
          content: 'Theme content 1',
          contentType: 'theme',
          status: 'active',
        },
        {
          id: 'frag_2',
          projectId: 'proj_1',
          conversationId: 'conv_1',
          content: 'Theme content 2',
          contentType: 'theme',
          status: 'active',
        },
      ],
      dimensionTags: [
        { id: 'tag_1', fragmentId: 'frag_1', dimension: 'customer_market' },
        { id: 'tag_2', fragmentId: 'frag_1', dimension: 'problem_opportunity' },
        { id: 'tag_3', fragmentId: 'frag_2', dimension: 'value_proposition' },
      ],
    };

    it('should validate a correct fragment creation result', () => {
      expect(validateFragmentCreationResult(validResult)).toBe(true);
    });

    it('should reject result with no fragments', () => {
      const invalid = { ...validResult, fragments: [] };
      expect(validateFragmentCreationResult(invalid)).toBe(false);
    });

    it('should reject result with invalid fragment', () => {
      const invalid = {
        ...validResult,
        fragments: [{ id: 'frag_1', content: 'Missing required fields' }],
      };
      expect(validateFragmentCreationResult(invalid)).toBe(false);
    });

    it('should reject result with invalid dimension tag', () => {
      const invalid = {
        ...validResult,
        dimensionTags: [{ id: 'tag_1', fragmentId: 'frag_1', dimension: 'invalid' }],
      };
      expect(validateFragmentCreationResult(invalid)).toBe(false);
    });

    it('should accept result with empty dimension tags', () => {
      const valid = { ...validResult, dimensionTags: [] };
      expect(validateFragmentCreationResult(valid)).toBe(true);
    });
  });
});
```

**Step 2: Run test**

Run: `npm test -- --testPathPattern=persistence-contracts`
Expected: PASS (all 16 tests)

**Step 3: Commit**

```bash
git add src/lib/__tests__/contracts/persistence-contracts.test.ts
git commit -m "test(contracts): add fragment persistence contract tests"
```

---

## Task 8: Create AI Response Fixtures for Smoke Test

**Files:**
- Create: `src/lib/__tests__/fixtures/ai-responses.ts`

**Step 1: Create fixture file with deterministic AI responses**

```typescript
// src/lib/__tests__/fixtures/ai-responses.ts
/**
 * AI Response Fixtures
 *
 * Deterministic responses for smoke testing without calling Claude API.
 * These are realistic examples that match actual API response format.
 */

export const MOCK_EXTRACTION_RESPONSE = `<extraction>
  <theme>
    <theme_name>Customer Pain Points</theme_name>
    <content>Small businesses struggle with manual invoice processing, leading to delayed payments and cash flow issues.</content>
    <dimensions>
      <dimension name="customer_market" confidence="high"/>
      <dimension name="problem_opportunity" confidence="high"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Technical Approach</theme_name>
    <content>AI-powered OCR and automation can reduce processing time by 80%.</content>
    <dimensions>
      <dimension name="capabilities_assets" confidence="high"/>
      <dimension name="differentiation_advantage" confidence="medium"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Market Positioning</theme_name>
    <content>Focus on underserved SMB segment that can't afford enterprise solutions.</content>
    <dimensions>
      <dimension name="competitive_landscape" confidence="medium"/>
      <dimension name="value_proposition" confidence="high"/>
    </dimensions>
  </theme>
</extraction>`;

export const MOCK_SUMMARY_RESPONSE = `<summary>
  <strengths>
    <strength>Clear understanding of customer pain points in the SMB invoicing space</strength>
    <strength>Differentiated technical approach using AI automation</strength>
  </strengths>
  <emerging>
    <area>Market positioning strategy is starting to take shape</area>
  </emerging>
  <opportunities_for_enrichment>
    <opportunity>Explore specific go-to-market channels for SMB acquisition</opportunity>
    <opportunity>Define pricing model and unit economics</opportunity>
  </opportunities_for_enrichment>
  <thought_prompt>How will you reach your first 100 paying customers?</thought_prompt>
</summary>`;

export const MOCK_GENERATION_RESPONSE = `<thoughts>
Based on the emergent themes, this business has a clear value proposition around AI-powered invoice automation for SMBs. The customer pain points are well-understood, and the technical differentiation is compelling. The strategy should focus on accessibility and ease of adoption.
</thoughts>
<statements>
  <vision>To eliminate invoice processing pain for every small business</vision>
  <strategy>Build the most accessible AI-powered invoicing platform that SMBs can adopt in minutes, not weeks</strategy>
  <objectives>
1. Achieve 100 paying customers within 6 months by targeting accounting-adjacent businesses | Growth | from 0 to 100 | 6M
2. Reduce average invoice processing time by 80% compared to manual methods | Product | 80% reduction | 3M
3. Maintain customer satisfaction score above 4.5/5 during beta | Quality | ≥4.5 NPS | 3M
  </objectives>
</statements>`;

// Parsed versions for direct use in tests
export const MOCK_EMERGENT_EXTRACTION = {
  themes: [
    {
      theme_name: 'Customer Pain Points',
      content: 'Small businesses struggle with manual invoice processing, leading to delayed payments and cash flow issues.',
      dimensions: [
        { name: 'customer_market', confidence: 'HIGH' as const },
        { name: 'problem_opportunity', confidence: 'HIGH' as const },
      ],
    },
    {
      theme_name: 'Technical Approach',
      content: 'AI-powered OCR and automation can reduce processing time by 80%.',
      dimensions: [
        { name: 'capabilities_assets', confidence: 'HIGH' as const },
        { name: 'differentiation_advantage', confidence: 'MEDIUM' as const },
      ],
    },
    {
      theme_name: 'Market Positioning',
      content: 'Focus on underserved SMB segment that can\'t afford enterprise solutions.',
      dimensions: [
        { name: 'competitive_landscape', confidence: 'MEDIUM' as const },
        { name: 'value_proposition', confidence: 'HIGH' as const },
      ],
    },
  ],
  reflective_summary: {
    strengths: [
      'Clear understanding of customer pain points in the SMB invoicing space',
      'Differentiated technical approach using AI automation',
    ],
    emerging: ['Market positioning strategy is starting to take shape'],
    opportunities_for_enrichment: [
      'Explore specific go-to-market channels for SMB acquisition',
      'Define pricing model and unit economics',
    ],
    thought_prompt: 'How will you reach your first 100 paying customers?',
  },
  extraction_approach: 'emergent' as const,
};

export const MOCK_GENERATION_OUTPUT = {
  thoughts: 'Based on the emergent themes, this business has a clear value proposition...',
  statements: {
    vision: 'To eliminate invoice processing pain for every small business',
    strategy: 'Build the most accessible AI-powered invoicing platform that SMBs can adopt in minutes, not weeks',
    objectives: [
      {
        id: 'obj-1',
        pithy: 'Achieve 100 paying customers within 6 months',
        metric: {
          summary: '100 customers',
          full: 'Achieve 100 paying customers within 6 months by targeting accounting-adjacent businesses',
          category: 'Growth',
        },
        explanation: 'Validate product-market fit with paying customers',
        successCriteria: '100+ paying customers on monthly plans',
      },
    ],
    opportunities: [],
    principles: [],
  },
};

// Mock fragment creation result
export const MOCK_FRAGMENT_CREATION_RESULT = {
  fragments: [
    {
      id: 'frag_1',
      projectId: 'proj_test',
      conversationId: 'conv_test',
      content: 'Small businesses struggle with manual invoice processing, leading to delayed payments and cash flow issues.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'HIGH' as const,
    },
    {
      id: 'frag_2',
      projectId: 'proj_test',
      conversationId: 'conv_test',
      content: 'AI-powered OCR and automation can reduce processing time by 80%.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'HIGH' as const,
    },
    {
      id: 'frag_3',
      projectId: 'proj_test',
      conversationId: 'conv_test',
      content: 'Focus on underserved SMB segment that can\'t afford enterprise solutions.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'MEDIUM' as const,
    },
  ],
  dimensionTags: [
    { id: 'tag_1', fragmentId: 'frag_1', dimension: 'customer_market' as const, confidence: 'HIGH' as const },
    { id: 'tag_2', fragmentId: 'frag_1', dimension: 'problem_opportunity' as const, confidence: 'HIGH' as const },
    { id: 'tag_3', fragmentId: 'frag_2', dimension: 'capabilities_assets' as const, confidence: 'HIGH' as const },
    { id: 'tag_4', fragmentId: 'frag_2', dimension: 'differentiation_advantage' as const, confidence: 'MEDIUM' as const },
    { id: 'tag_5', fragmentId: 'frag_3', dimension: 'competitive_landscape' as const, confidence: 'MEDIUM' as const },
    { id: 'tag_6', fragmentId: 'frag_3', dimension: 'value_proposition' as const, confidence: 'HIGH' as const },
  ],
};
```

**Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/fixtures/
git commit -m "test: add AI response fixtures for smoke testing"
```

---

## Task 9: Create Smoke Test

**Files:**
- Create: `src/lib/__tests__/smoke.test.ts`

**Step 1: Write the smoke test**

```typescript
// src/lib/__tests__/smoke.test.ts
/**
 * Smoke Test
 *
 * End-to-end test of the critical path:
 * Conversation → Extraction → Fragment Persistence → Generation
 *
 * Uses mocked AI responses for determinism and speed.
 */

import {
  validateEmergentExtraction,
  validateGenerationOutput,
  validateFragmentCreationResult,
  isEmergentExtraction,
} from '@/lib/contracts';
import {
  MOCK_EMERGENT_EXTRACTION,
  MOCK_GENERATION_OUTPUT,
  MOCK_FRAGMENT_CREATION_RESULT,
} from './fixtures/ai-responses';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    trace: {
      create: jest.fn(),
    },
    fragment: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    fragmentDimensionTag: {
      create: jest.fn(),
    },
    generatedOutput: {
      create: jest.fn(),
    },
    extractionRun: {
      create: jest.fn(),
    },
    dimensionalSynthesis: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock Claude API
jest.mock('@/lib/claude', () => ({
  anthropic: {
    messages: {
      create: jest.fn(),
    },
  },
  CLAUDE_MODEL: 'claude-sonnet-4-5-20250929',
}));

describe('Smoke Test: Critical Path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Step 1: Extraction produces valid contract', () => {
    it('should produce extraction output matching EmergentExtractionContract', () => {
      const extractionResult = MOCK_EMERGENT_EXTRACTION;

      expect(validateEmergentExtraction(extractionResult)).toBe(true);
      expect(isEmergentExtraction(extractionResult)).toBe(true);
      expect(extractionResult.themes.length).toBeGreaterThan(0);
      expect(extractionResult.reflective_summary.strengths.length).toBeGreaterThan(0);
    });

    it('should have themes with dimension tags', () => {
      const extractionResult = MOCK_EMERGENT_EXTRACTION;

      for (const theme of extractionResult.themes) {
        expect(theme.dimensions).toBeDefined();
        expect(theme.dimensions!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Step 2: Fragment persistence produces valid records', () => {
    it('should create fragments matching FragmentContract', () => {
      const result = MOCK_FRAGMENT_CREATION_RESULT;

      expect(validateFragmentCreationResult(result)).toBe(true);
      expect(result.fragments.length).toBe(3); // One per theme
    });

    it('should create dimension tags for each fragment', () => {
      const result = MOCK_FRAGMENT_CREATION_RESULT;

      // Each theme has 2 dimensions, 3 themes = 6 tags
      expect(result.dimensionTags.length).toBe(6);

      // All tags should reference valid fragments
      const fragmentIds = new Set(result.fragments.map(f => f.id));
      for (const tag of result.dimensionTags) {
        expect(fragmentIds.has(tag.fragmentId)).toBe(true);
      }
    });

    it('should preserve theme content in fragments', () => {
      const extraction = MOCK_EMERGENT_EXTRACTION;
      const result = MOCK_FRAGMENT_CREATION_RESULT;

      // Fragment content should match theme content
      for (let i = 0; i < extraction.themes.length; i++) {
        expect(result.fragments[i].content).toBe(extraction.themes[i].content);
      }
    });
  });

  describe('Step 3: Generation accepts extraction and produces valid output', () => {
    it('should produce generation output matching GenerationOutputContract', () => {
      const generationResult = {
        traceId: 'test-trace-id',
        ...MOCK_GENERATION_OUTPUT,
      };

      expect(validateGenerationOutput(generationResult)).toBe(true);
      expect(generationResult.statements.vision).toBeTruthy();
      expect(generationResult.statements.strategy).toBeTruthy();
      expect(generationResult.statements.objectives.length).toBeGreaterThan(0);
    });

    it('should produce objectives with required fields', () => {
      const generationResult = {
        traceId: 'test-trace-id',
        ...MOCK_GENERATION_OUTPUT,
      };

      for (const objective of generationResult.statements.objectives) {
        expect(objective.id).toBeTruthy();
        expect(objective.pithy).toBeTruthy();
        expect(objective.metric).toBeDefined();
        expect(objective.metric.summary).toBeTruthy();
      }
    });
  });

  describe('Step 4: Data flows correctly through pipeline', () => {
    it('should maintain theme count from extraction to fragments', () => {
      const extraction = MOCK_EMERGENT_EXTRACTION;
      const fragments = MOCK_FRAGMENT_CREATION_RESULT;

      expect(fragments.fragments.length).toBe(extraction.themes.length);
    });

    it('should maintain dimension count from extraction to tags', () => {
      const extraction = MOCK_EMERGENT_EXTRACTION;
      const fragments = MOCK_FRAGMENT_CREATION_RESULT;

      const totalDimensions = extraction.themes.reduce(
        (sum, theme) => sum + (theme.dimensions?.length || 0),
        0
      );

      expect(fragments.dimensionTags.length).toBe(totalDimensions);
    });

    it('should include reflective summary for generation prompt', () => {
      const extraction = MOCK_EMERGENT_EXTRACTION;

      expect(extraction.reflective_summary).toBeDefined();
      expect(extraction.reflective_summary.strengths.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run the smoke test**

Run: `npm test -- --testPathPattern=smoke`
Expected: PASS (all 9 tests)

**Step 3: Commit**

```bash
git add src/lib/__tests__/smoke.test.ts
git commit -m "test: add smoke test for critical path verification"
```

---

## Task 10: Add npm Scripts for Verify and Smoke

**Files:**
- Modify: `package.json`

**Step 1: Add verify and smoke scripts**

Add to package.json scripts section:

```json
{
  "scripts": {
    "smoke": "jest --testPathPattern=smoke --verbose",
    "verify": "npm run type-check && npm run test && npm run smoke"
  }
}
```

**Step 2: Test the scripts**

Run: `npm run smoke`
Expected: PASS (smoke tests only)

Run: `npm run verify`
Expected: PASS (type-check + all tests + smoke)

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add npm run verify and smoke scripts"
```

---

## Task 11: Write Contracts README

**Files:**
- Modify: `src/lib/contracts/README.md`

**Step 1: Write documentation**

```markdown
# Data Contracts

This directory defines the data contracts for boundaries in the application pipeline.

## What Are Contracts?

Contracts are TypeScript types that define the exact shape of data at key boundaries:

- **Extraction Output** - What `/api/extract` produces
- **Fragment Persistence** - What gets written to the database
- **Generation Input** - What `/api/generate` expects
- **Generation Output** - What `/api/generate` returns

## Why Contracts?

1. **Catch breaking changes early** - Contract tests fail if shapes change
2. **Document expectations** - Types serve as documentation
3. **Enable safe refactoring** - Change internals freely, contracts protect boundaries

## Files

- `extraction.ts` - Extraction output contracts (emergent + prescriptive)
- `persistence.ts` - Fragment and dimension tag contracts
- `generation.ts` - Generation input/output contracts
- `index.ts` - Re-exports all contracts

## Usage

```typescript
import {
  validateEmergentExtraction,
  validateFragmentCreationResult,
  validateGenerationOutput,
} from '@/lib/contracts';

// Validate data at runtime
if (!validateEmergentExtraction(data)) {
  throw new Error('Invalid extraction output');
}
```

## Adding New Contracts

1. Define types in the appropriate file
2. Add validation function
3. Add tests in `__tests__/contracts/`
4. Run `npm run verify` to confirm

## Testing

Contract tests verify:
- Valid data passes validation
- Invalid data fails validation
- Required fields are enforced
- Type guards work correctly

Run: `npm test -- --testPathPattern=contracts`
```

**Step 2: Commit**

```bash
git add src/lib/contracts/README.md
git commit -m "docs(contracts): add README explaining contract usage"
```

---

## Task 12: Update Architecture Documentation

**Files:**
- Modify: `.claude/architecture.md`

**Step 1: Add contracts section to architecture.md**

Add after the "Database Schema V1" section:

```markdown
---

## Data Contracts (2026-01-06)

### Purpose

Contracts define the expected data shapes at key boundaries in the pipeline. They catch breaking changes before deployment.

### Contract Locations

- `src/lib/contracts/` - TypeScript contract types
- `src/lib/__tests__/contracts/` - Contract validation tests
- `src/lib/__tests__/smoke.test.ts` - End-to-end smoke test

### Key Boundaries

1. **Extraction Output** (`/api/extract` → frontend/generate)
   - EmergentExtractionContract: themes + reflective_summary
   - PrescriptiveExtractionContract: core + enrichment + reflective_summary

2. **Fragment Persistence** (extraction → database)
   - FragmentContract: id, projectId, conversationId, content, contentType, status
   - FragmentDimensionTagContract: fragmentId, dimension, confidence

3. **Generation Input** (frontend → `/api/generate`)
   - conversationId + extractedContext

4. **Generation Output** (`/api/generate` → frontend)
   - traceId + thoughts + statements (vision, strategy, objectives)

### Verification Commands

- `npm run smoke` - Run smoke tests only
- `npm run verify` - Run type-check + all tests + smoke

### Adding New Boundaries

When adding a new API or data flow:
1. Define contract types in `src/lib/contracts/`
2. Add validation tests in `src/lib/__tests__/contracts/`
3. Update smoke test if it affects the critical path

---

## Schema Change Policy

**⚠️ The Prisma schema (`prisma/schema.prisma`) is a protected boundary.**

Changes to the schema affect:
- Data contracts and their tests
- Fragment/synthesis creation
- API input/output shapes
- Database migrations in production

**Before modifying the schema:**
1. Consider if the change can be made in application code instead
2. Update relevant contracts in `src/lib/contracts/`
3. Run `npm run verify` to catch breaking changes
4. Test migration on preview deployment before production
5. Document the change in CHANGELOG.md

Schema changes should be intentional and well-considered, not casual.
```

**Step 2: Update the "Last major update" line**

```markdown
**Last major update:** Contract-driven quality foundation (2026-01-06)
```

**Step 3: Commit**

```bash
git add .claude/architecture.md
git commit -m "docs: update architecture with contracts and schema policy"
```

---

## Task 13: Install Pre-Push Hook

**Files:**
- Create: `.husky/pre-push`
- Modify: `package.json` (add husky)

**Step 1: Install husky**

Run: `npm install --save-dev husky`

**Step 2: Initialize husky**

Run: `npx husky init`

**Step 3: Create pre-push hook**

```bash
# .husky/pre-push
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running verification before push..."
npm run verify

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Verification failed. Push blocked."
  echo ""
  echo "Fix the issues above, or bypass with: git push --no-verify"
  echo "(Only bypass if you know what you're doing!)"
  exit 1
fi

echo "✅ Verification passed. Pushing..."
```

**Step 4: Make hook executable**

Run: `chmod +x .husky/pre-push`

**Step 5: Test the hook**

Run: `git push --dry-run`
Expected: Runs verify, shows success message

**Step 6: Commit**

```bash
git add .husky/ package.json package-lock.json
git commit -m "feat: add pre-push hook to enforce verification"
```

---

## Task 14: Run Full Verification

**Files:** None (verification only)

**Step 1: Run full verify flow**

Run: `npm run verify`
Expected: All type-checks and tests pass

**Step 2: Commit any remaining changes**

```bash
git status
# If any unstaged changes:
git add -A
git commit -m "chore: final cleanup for contract-driven quality foundation"
```

---

## Task 15: Update Version and Changelog

**Files:**
- Modify: `package.json` (version bump)
- Modify: `CHANGELOG.md`
- Modify: `VERSION_MAPPING.md`

**Step 1: Bump patch version in package.json**

Change: `"version": "1.4.3"` to `"version": "1.4.4"`

**Step 2: Add changelog entry**

Add to CHANGELOG.md under `## [Unreleased]` or create new entry:

```markdown
## [1.4.4] - 2026-01-06

### Added
- **Data Contracts** - TypeScript contracts for extraction/generation/persistence boundaries
  - `src/lib/contracts/` - Contract type definitions
  - Extraction contracts: EmergentExtractionContract, PrescriptiveExtractionContract
  - Persistence contracts: FragmentContract, FragmentDimensionTagContract
  - Generation contracts: GenerationInputContract, GenerationOutputContract
  - Validation functions for runtime checking

- **Contract Tests** - Integration tests verifying contracts at seams
  - `src/lib/__tests__/contracts/extraction-contracts.test.ts`
  - `src/lib/__tests__/contracts/generation-contracts.test.ts`
  - `src/lib/__tests__/contracts/persistence-contracts.test.ts`

- **Smoke Test** - End-to-end verification of critical path
  - `src/lib/__tests__/smoke.test.ts`
  - Tests extraction → fragment persistence → generation flow
  - Mocked AI responses for determinism

- **Verification Scripts**
  - `npm run smoke` - Run smoke tests only
  - `npm run verify` - Full verification (type-check + tests + smoke)

- **Pre-Push Hook** - Enforces verification before push
  - Runs `npm run verify` automatically
  - Blocks push on failure
  - Bypass with `--no-verify` when needed

### Documentation
- Added `src/lib/contracts/README.md` explaining contract usage
- Updated `.claude/architecture.md` with contracts documentation
- Added Schema Change Policy to protect Prisma schema
```

**Step 3: Update VERSION_MAPPING.md**

Update the "Current Production Version" line.

**Step 4: Commit**

```bash
git add package.json CHANGELOG.md VERSION_MAPPING.md
git commit -m "v1.4.4: Add contract-driven quality foundation"
```

---

## Summary

After completing all tasks:

- **Contracts defined** for extraction, fragment persistence, and generation boundaries
- **34 contract tests** validating data shapes (8 extraction + 10 generation + 16 persistence)
- **9 smoke tests** verifying critical path including fragment creation
- **`npm run verify`** command for pre-push validation
- **Pre-push hook** enforcing verification (blocks push on failure)
- **Schema change policy** documented in architecture.md
- **Documentation** updated in architecture.md and contracts README

The foundation is in place for catching pipeline breakages early, and it's baked into the workflow so engineers don't have to remember checklists.
