// src/lib/__tests__/contracts/generation-status-contracts.test.ts
/**
 * Generation Status Contract Tests
 *
 * Verifies contracts for background generation flow:
 * - Fire-and-forget response
 * - Polling response
 * - Mark-viewed response
 */

import {
  validateGenerationStarted,
  validateGenerationStatusResponse,
  validateGenerationViewedResponse,
  isGenerationInProgress,
  isGenerationFinished,
  GenerationStartedContract,
  GenerationStatusResponseContract,
  GenerationViewedResponseContract,
  GenerationStatus,
} from '@/lib/contracts/generation-status';

describe('Generation Status Contracts', () => {
  describe('GenerationStartedContract', () => {
    const validResponse: GenerationStartedContract = {
      status: 'started',
      generationId: 'gen_abc123',
    };

    it('should validate correct started response', () => {
      expect(validateGenerationStarted(validResponse)).toBe(true);
    });

    it('should reject response with wrong status', () => {
      const invalid = { status: 'pending', generationId: 'gen_abc123' };
      expect(validateGenerationStarted(invalid)).toBe(false);
    });

    it('should reject response with missing generationId', () => {
      const invalid = { status: 'started' };
      expect(validateGenerationStarted(invalid)).toBe(false);
    });

    it('should reject response with empty generationId', () => {
      const invalid = { status: 'started', generationId: '' };
      expect(validateGenerationStarted(invalid)).toBe(false);
    });

    it('should reject null', () => {
      expect(validateGenerationStarted(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateGenerationStarted('string')).toBe(false);
    });
  });

  describe('GenerationStatusResponseContract', () => {
    describe('pending status', () => {
      const pendingResponse: GenerationStatusResponseContract = {
        status: 'pending',
        startedAt: '2026-01-31T12:00:00Z',
      };

      it('should validate pending status', () => {
        expect(validateGenerationStatusResponse(pendingResponse)).toBe(true);
      });
    });

    describe('generating status', () => {
      const generatingResponse: GenerationStatusResponseContract = {
        status: 'generating',
        startedAt: '2026-01-31T12:00:00Z',
      };

      it('should validate generating status', () => {
        expect(validateGenerationStatusResponse(generatingResponse)).toBe(true);
      });
    });

    describe('complete status', () => {
      const completeResponse: GenerationStatusResponseContract = {
        status: 'complete',
        traceId: 'trace_xyz789',
        startedAt: '2026-01-31T12:00:00Z',
        completedAt: '2026-01-31T12:00:15Z',
      };

      it('should validate complete status with traceId', () => {
        expect(validateGenerationStatusResponse(completeResponse)).toBe(true);
      });

      it('should reject complete status without traceId', () => {
        const invalid = { status: 'complete' };
        expect(validateGenerationStatusResponse(invalid)).toBe(false);
      });

      it('should reject complete status with empty traceId', () => {
        const invalid = { status: 'complete', traceId: '' };
        expect(validateGenerationStatusResponse(invalid)).toBe(false);
      });
    });

    describe('failed status', () => {
      const failedResponse: GenerationStatusResponseContract = {
        status: 'failed',
        error: 'Generation timed out',
        startedAt: '2026-01-31T12:00:00Z',
      };

      it('should validate failed status with error', () => {
        expect(validateGenerationStatusResponse(failedResponse)).toBe(true);
      });

      it('should reject failed status without error', () => {
        const invalid = { status: 'failed' };
        expect(validateGenerationStatusResponse(invalid)).toBe(false);
      });
    });

    it('should reject invalid status', () => {
      const invalid = { status: 'unknown' };
      expect(validateGenerationStatusResponse(invalid)).toBe(false);
    });

    it('should reject null', () => {
      expect(validateGenerationStatusResponse(null)).toBe(false);
    });
  });

  describe('GenerationViewedResponseContract', () => {
    const validResponse: GenerationViewedResponseContract = {
      success: true,
      viewedAt: '2026-01-31T12:01:00Z',
    };

    it('should validate correct viewed response', () => {
      expect(validateGenerationViewedResponse(validResponse)).toBe(true);
    });

    it('should validate failed viewed response', () => {
      const failedResponse = { success: false, viewedAt: '2026-01-31T12:01:00Z' };
      expect(validateGenerationViewedResponse(failedResponse)).toBe(true);
    });

    it('should reject response with missing success', () => {
      const invalid = { viewedAt: '2026-01-31T12:01:00Z' };
      expect(validateGenerationViewedResponse(invalid)).toBe(false);
    });

    it('should reject response with missing viewedAt', () => {
      const invalid = { success: true };
      expect(validateGenerationViewedResponse(invalid)).toBe(false);
    });

    it('should reject response with empty viewedAt', () => {
      const invalid = { success: true, viewedAt: '' };
      expect(validateGenerationViewedResponse(invalid)).toBe(false);
    });
  });

  describe('Type guards', () => {
    describe('isGenerationInProgress', () => {
      it('should return true for pending', () => {
        expect(isGenerationInProgress('pending')).toBe(true);
      });

      it('should return true for generating', () => {
        expect(isGenerationInProgress('generating')).toBe(true);
      });

      it('should return false for complete', () => {
        expect(isGenerationInProgress('complete')).toBe(false);
      });

      it('should return false for failed', () => {
        expect(isGenerationInProgress('failed')).toBe(false);
      });
    });

    describe('isGenerationFinished', () => {
      it('should return false for pending', () => {
        expect(isGenerationFinished('pending')).toBe(false);
      });

      it('should return false for generating', () => {
        expect(isGenerationFinished('generating')).toBe(false);
      });

      it('should return true for complete', () => {
        expect(isGenerationFinished('complete')).toBe(true);
      });

      it('should return true for failed', () => {
        expect(isGenerationFinished('failed')).toBe(true);
      });
    });
  });
});
