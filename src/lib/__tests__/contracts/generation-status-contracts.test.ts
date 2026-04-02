// src/lib/__tests__/contracts/generation-status-contracts.test.ts
/**
 * Generation Status Contract Tests
 */

import {
  validateGenerationStarted,
  GenerationStartedContract,
  GenerationStatus,
} from '@/lib/contracts/generation-status'

describe('Generation Status Contracts', () => {
  describe('validateGenerationStarted', () => {
    it('should validate a correct started response', () => {
      const data: GenerationStartedContract = {
        status: 'started',
        generationId: 'gen-123',
      }
      expect(validateGenerationStarted(data)).toBe(true)
    })

    it('should reject missing generationId', () => {
      expect(validateGenerationStarted({ status: 'started' })).toBe(false)
    })

    it('should reject wrong status', () => {
      expect(validateGenerationStarted({ status: 'pending', generationId: 'gen-123' })).toBe(false)
    })

    it('should reject null', () => {
      expect(validateGenerationStarted(null)).toBe(false)
    })

    it('should reject non-object', () => {
      expect(validateGenerationStarted('started')).toBe(false)
    })
  })

  describe('GenerationStatus type', () => {
    it('should accept valid statuses', () => {
      const statuses: GenerationStatus[] = ['pending', 'generating', 'complete', 'failed']
      expect(statuses).toHaveLength(4)
    })
  })
})
