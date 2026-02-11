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
        objective: 'Achieve product-market fit',
        explanation: 'Critical for sustainability',
        keyResults: [
          {
            id: 'kr-1',
            belief: { action: 'improving onboarding', outcome: 'increase retention' },
            signal: '7-day active users',
            baseline: '40%',
            target: '55%',
            timeframe: '6M',
          },
        ],
      },
      sourceType: 'user_edit',
    };

    const legacyObjectiveInput: StrategyVersionInputContract = {
      componentType: 'objective',
      componentId: 'obj-456',
      content: {
        objective: '',  // Empty in legacy
        pithy: 'Achieve product-market fit',
        metric: {
          summary: '100 customers',
          full: 'Acquire 100 paying customers',
          category: 'Growth',
          direction: 'increase',
          timeframe: '12M',
        },
        explanation: 'Critical for sustainability',
        keyResults: [],  // Empty in legacy
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

    it('should validate correct objective input with keyResults', () => {
      expect(validateStrategyVersionInput(validObjectiveInput)).toBe(true);
    });

    it('should validate legacy objective input with pithy and metric', () => {
      expect(validateStrategyVersionInput(legacyObjectiveInput)).toBe(true);
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

    it('should reject objective with no valid format', () => {
      const invalid = {
        componentType: 'objective' as const,
        componentId: 'obj-123',
        content: {
          objective: '',
          pithy: '',
          explanation: 'test',
          keyResults: [],
        },
        sourceType: 'user_edit' as const,
      };
      expect(validateStrategyVersionInput(invalid)).toBe(false);
    });

    it('should validate keyResults structure', () => {
      const withValidKR: StrategyVersionInputContract = {
        componentType: 'objective',
        componentId: 'obj-789',
        content: {
          objective: 'Grow revenue',
          explanation: 'Important for sustainability',
          keyResults: [
            {
              id: 'kr-1',
              belief: { action: 'expanding to enterprise', outcome: 'increase deal size' },
              signal: 'average contract value',
              baseline: '$5k',
              target: '$25k',
              timeframe: '12M',
            },
            {
              id: 'kr-2',
              belief: { action: 'improving sales process', outcome: 'shorten sales cycle' },
              signal: 'days to close',
              baseline: '90',
              target: '45',
              timeframe: '6M',
            },
          ],
        },
        sourceType: 'user_edit',
      };
      expect(validateStrategyVersionInput(withValidKR)).toBe(true);
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
