// src/lib/__tests__/contracts/strategy-version-contracts.test.ts
/**
 * Strategy Version Contract Tests
 *
 * Verifies strategy version input/output contracts.
 */

import {
  validateStrategyVersionInput,
  validateStrategyVersionOutput,
  StrategyVersionInputContract,
  StrategyVersionOutputContract,
} from '@/lib/contracts/strategy-version';

describe('Strategy Version Contracts', () => {
  describe('StrategyVersionInputContract', () => {
    const validVisionInput: StrategyVersionInputContract = {
      componentType: 'vision',
      content: { text: 'To be the leading provider of...' },
      sourceType: 'user_edit',
    };

    const validObjectiveInput: StrategyVersionInputContract = {
      componentType: 'objective',
      componentId: 'obj-123',
      content: {
        pithy: 'Achieve product-market fit',
        metric: {
          summary: '100 customers',
          full: 'Acquire 100 paying customers',
          category: 'Growth',
          direction: 'increase',
          timeframe: '12M',
        },
        explanation: 'Critical for sustainability',
        successCriteria: 'Consistent month-over-month growth',
      },
      sourceType: 'user_edit',
    };

    it('should validate correct vision input', () => {
      expect(validateStrategyVersionInput(validVisionInput)).toBe(true);
    });

    it('should validate correct strategy input', () => {
      const strategyInput = { ...validVisionInput, componentType: 'strategy' as const };
      expect(validateStrategyVersionInput(strategyInput)).toBe(true);
    });

    it('should validate correct objective input', () => {
      expect(validateStrategyVersionInput(validObjectiveInput)).toBe(true);
    });

    it('should reject objective without componentId', () => {
      const invalid = { ...validObjectiveInput, componentId: undefined };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should reject invalid componentType', () => {
      const invalid = { ...validVisionInput, componentType: 'invalid' };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should reject invalid sourceType', () => {
      const invalid = { ...validVisionInput, sourceType: 'invalid' };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should reject vision with empty text', () => {
      const invalid = {
        ...validVisionInput,
        content: { text: '  ' },
      };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should reject objective with empty pithy', () => {
      const invalid = {
        ...validObjectiveInput,
        content: { ...validObjectiveInput.content, pithy: '' },
      };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should accept input with optional sourceId', () => {
      const withSourceId = { ...validVisionInput, sourceId: 'trace-123' };
      expect(validateStrategyVersionInput(withSourceId)).toBe(true);
    });
  });

  describe('StrategyVersionOutputContract', () => {
    const validOutput: StrategyVersionOutputContract = {
      id: 'sv-123',
      projectId: 'proj-456',
      componentType: 'vision',
      componentId: null,
      content: { text: 'To be the leading provider of...' },
      version: 1,
      createdAt: '2026-02-09T10:00:00Z',
      createdBy: 'user',
      sourceType: 'user_edit',
      sourceId: null,
    };

    it('should validate correct output', () => {
      expect(validateStrategyVersionOutput(validOutput)).toBe(true);
    });

    it('should reject output with missing id', () => {
      const invalid = { ...validOutput, id: '' };
      expect(validateStrategyVersionOutput(invalid)).toBe(false);
    });

    it('should reject output with invalid createdBy', () => {
      const invalid = { ...validOutput, createdBy: 'robot' };
      expect(validateStrategyVersionOutput(invalid)).toBe(false);
    });

    it('should validate output with componentId for objectives', () => {
      const objectiveOutput = {
        ...validOutput,
        componentType: 'objective' as const,
        componentId: 'obj-123',
      };
      expect(validateStrategyVersionOutput(objectiveOutput)).toBe(true);
    });
  });
});
