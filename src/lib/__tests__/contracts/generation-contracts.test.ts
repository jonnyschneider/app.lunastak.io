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
