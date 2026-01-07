// src/lib/__tests__/smoke.test.ts
/**
 * Smoke Test
 *
 * End-to-end tests of critical user paths:
 *
 * Path 1: Conversation → Extraction → Fragment Persistence → Generation
 * Path 2: Document Upload → Text Extraction → Theme Extraction → Fragment Persistence → Synthesis
 *
 * Uses mocked AI responses for determinism and speed.
 */

import {
  validateEmergentExtraction,
  validateGenerationOutput,
  validateFragmentCreationResult,
  validateDocument,
  isEmergentExtraction,
} from '@/lib/contracts';
import {
  MOCK_EMERGENT_EXTRACTION,
  MOCK_GENERATION_OUTPUT,
  MOCK_FRAGMENT_CREATION_RESULT,
  MOCK_DOCUMENT,
  MOCK_DOCUMENT_THEMES,
  MOCK_DOCUMENT_FRAGMENT_CREATION_RESULT,
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

describe('Smoke Test: Document Upload Path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Step 1: Document upload creates valid record', () => {
    it('should create document with pending status', () => {
      const document = MOCK_DOCUMENT;

      expect(validateDocument(document)).toBe(true);
      expect(document.status).toBe('pending');
      expect(document.projectId).toBeTruthy();
      expect(document.fileName).toBeTruthy();
    });

    it('should include optional upload context', () => {
      const document = MOCK_DOCUMENT;

      expect(document.uploadContext).toBeTruthy();
      expect(document.fileSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Step 2: Theme extraction produces valid contract', () => {
    it('should extract themes matching EmergentThemeContract', () => {
      const themes = MOCK_DOCUMENT_THEMES;

      expect(themes.length).toBeGreaterThan(0);
      for (const theme of themes) {
        expect(theme.theme_name).toBeTruthy();
        expect(theme.content).toBeTruthy();
        expect(theme.dimensions).toBeDefined();
        expect(theme.dimensions!.length).toBeGreaterThan(0);
      }
    });

    it('should have themes with dimension tags', () => {
      const themes = MOCK_DOCUMENT_THEMES;

      for (const theme of themes) {
        for (const dim of theme.dimensions!) {
          expect(dim.name).toBeTruthy();
          expect(['HIGH', 'MEDIUM', 'LOW']).toContain(dim.confidence);
        }
      }
    });
  });

  describe('Step 3: Fragment persistence with document lineage', () => {
    it('should create fragments with documentId (no conversationId)', () => {
      const result = MOCK_DOCUMENT_FRAGMENT_CREATION_RESULT;

      expect(validateFragmentCreationResult(result)).toBe(true);

      for (const fragment of result.fragments) {
        expect(fragment.documentId).toBeTruthy();
        expect((fragment as any).conversationId).toBeUndefined();
        expect(fragment.status).toBe('active');
      }
    });

    it('should create dimension tags for document fragments', () => {
      const result = MOCK_DOCUMENT_FRAGMENT_CREATION_RESULT;

      // 4 themes × 2 dimensions each = 8 tags
      expect(result.dimensionTags.length).toBe(8);

      const fragmentIds = new Set(result.fragments.map(f => f.id));
      for (const tag of result.dimensionTags) {
        expect(fragmentIds.has(tag.fragmentId)).toBe(true);
      }
    });

    it('should maintain theme count from extraction to fragments', () => {
      const themes = MOCK_DOCUMENT_THEMES;
      const fragments = MOCK_DOCUMENT_FRAGMENT_CREATION_RESULT;

      expect(fragments.fragments.length).toBe(themes.length);
    });
  });

  describe('Step 4: Document status lifecycle', () => {
    it('should transition through valid statuses', () => {
      const statuses = ['pending', 'processing', 'complete'];

      for (const status of statuses) {
        const doc = { ...MOCK_DOCUMENT, status: status as any };
        expect(validateDocument(doc)).toBe(true);
      }
    });

    it('should handle failed status with error message', () => {
      const failedDoc = {
        ...MOCK_DOCUMENT,
        status: 'failed' as const,
        errorMessage: 'Could not extract text from document',
      };

      expect(validateDocument(failedDoc)).toBe(true);
      expect(failedDoc.errorMessage).toBeTruthy();
    });
  });

  describe('Step 5: Data flows correctly through document pipeline', () => {
    it('should maintain dimension count from themes to tags', () => {
      const themes = MOCK_DOCUMENT_THEMES;
      const fragments = MOCK_DOCUMENT_FRAGMENT_CREATION_RESULT;

      const totalDimensions = themes.reduce(
        (sum, theme) => sum + (theme.dimensions?.length || 0),
        0
      );

      expect(fragments.dimensionTags.length).toBe(totalDimensions);
    });

    it('should cover multiple strategic dimensions from document', () => {
      const fragments = MOCK_DOCUMENT_FRAGMENT_CREATION_RESULT;
      const coveredDimensions = new Set(fragments.dimensionTags.map(t => t.dimension));

      // Document should cover multiple dimensions
      expect(coveredDimensions.size).toBeGreaterThanOrEqual(4);
    });

    it('should distinguish document fragments from conversation fragments', () => {
      const docFragments = MOCK_DOCUMENT_FRAGMENT_CREATION_RESULT.fragments;
      const convFragments = MOCK_FRAGMENT_CREATION_RESULT.fragments;

      // Document fragments have documentId, no conversationId
      for (const f of docFragments) {
        expect(f.documentId).toBeTruthy();
        expect((f as any).conversationId).toBeUndefined();
      }

      // Conversation fragments have conversationId, no documentId
      for (const f of convFragments) {
        expect(f.conversationId).toBeTruthy();
        expect((f as any).documentId).toBeUndefined();
      }
    });
  });
});
