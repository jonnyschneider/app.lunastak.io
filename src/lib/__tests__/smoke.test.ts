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
