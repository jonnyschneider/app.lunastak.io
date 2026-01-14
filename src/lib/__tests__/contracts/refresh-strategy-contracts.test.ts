/**
 * Refresh Strategy Contract Tests
 */

import {
  validateRefreshStrategyOutput,
  RefreshStrategyOutputContract,
  RefreshStrategyDeltaContract,
} from '@/lib/contracts/refresh-strategy';

describe('Refresh Strategy Contracts', () => {
  describe('RefreshStrategyDeltaContract', () => {
    const validDelta: RefreshStrategyDeltaContract = {
      newFragmentCount: 3,
      removedFragmentCount: 1,
      newFragmentSummaries: ['Customer insight about pricing', 'Competitor analysis'],
      removedFragmentSummaries: ['Outdated market assumption'],
    };

    it('should represent delta information', () => {
      expect(validDelta.newFragmentCount).toBe(3);
      expect(validDelta.removedFragmentCount).toBe(1);
    });
  });

  describe('RefreshStrategyOutputContract', () => {
    const validOutput: RefreshStrategyOutputContract = {
      traceId: 'trace_abc123',
      statements: {
        vision: 'To transform business automation',
        strategy: 'AI-first platform approach',
        objectives: [
          {
            id: 'obj-1',
            pithy: 'Achieve PMF',
            metric: { summary: '100 customers', full: '100 paying customers', category: 'Growth' },
            explanation: 'Validate demand',
            successCriteria: '100+ paying monthly',
          },
        ],
        opportunities: [],
        principles: [],
      },
      changeSummary: 'Refined vision to emphasize automation. Added objective for Q2 expansion.',
      previousOutputId: 'prev_output_123',
      version: 2,
    };

    it('should validate correct output', () => {
      expect(validateRefreshStrategyOutput(validOutput)).toBe(true);
    });

    it('should reject output with missing traceId', () => {
      const { traceId, ...invalid } = validOutput;
      expect(validateRefreshStrategyOutput(invalid)).toBe(false);
    });

    it('should reject output with missing statements', () => {
      const { statements, ...invalid } = validOutput;
      expect(validateRefreshStrategyOutput(invalid)).toBe(false);
    });

    it('should accept output with null changeSummary', () => {
      const withNullSummary = { ...validOutput, changeSummary: null };
      expect(validateRefreshStrategyOutput(withNullSummary)).toBe(true);
    });

    it('should require previousOutputId for refresh', () => {
      const { previousOutputId, ...invalid } = validOutput;
      expect(validateRefreshStrategyOutput(invalid)).toBe(false);
    });
  });
});
