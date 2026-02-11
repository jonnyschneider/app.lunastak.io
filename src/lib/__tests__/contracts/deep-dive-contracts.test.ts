// src/lib/__tests__/contracts/deep-dive-contracts.test.ts
/**
 * Deep Dive Contract Tests
 *
 * Verifies deep dive creation and validation conforms to contracts.
 */

import {
  validateDeepDive,
  validateDeepDiveCreateInput,
  isValidDeepDiveStatus,
  isValidDeepDiveOrigin,
  DEEP_DIVE_STATUSES,
  DEEP_DIVE_ORIGINS,
  DeepDiveContract,
  DeepDiveCreateInput,
} from '@/lib/contracts/deep-dive';

describe('Deep Dive Contracts', () => {
  describe('isValidDeepDiveStatus', () => {
    it('should accept all valid statuses', () => {
      for (const status of DEEP_DIVE_STATUSES) {
        expect(isValidDeepDiveStatus(status)).toBe(true);
      }
    });

    it('should reject invalid statuses', () => {
      expect(isValidDeepDiveStatus('invalid')).toBe(false);
      expect(isValidDeepDiveStatus('ACTIVE')).toBe(false);
      expect(isValidDeepDiveStatus('')).toBe(false);
    });
  });

  describe('isValidDeepDiveOrigin', () => {
    it('should accept all valid origins', () => {
      for (const origin of DEEP_DIVE_ORIGINS) {
        expect(isValidDeepDiveOrigin(origin)).toBe(true);
      }
    });

    it('should reject invalid origins', () => {
      expect(isValidDeepDiveOrigin('invalid')).toBe(false);
      expect(isValidDeepDiveOrigin('MANUAL')).toBe(false);
      expect(isValidDeepDiveOrigin('')).toBe(false);
    });
  });

  describe('DeepDiveContract', () => {
    const validDeepDive: DeepDiveContract = {
      id: 'dd_abc123',
      projectId: 'proj_xyz789',
      topic: 'Pricing strategy for enterprise',
      status: 'active',
      origin: 'manual',
      createdAt: '2026-01-08T10:00:00Z',
      updatedAt: '2026-01-08T10:00:00Z',
    };

    it('should validate a correct deep dive', () => {
      expect(validateDeepDive(validDeepDive)).toBe(true);
    });

    it('should validate deep dive with all optional fields', () => {
      const fullDeepDive: DeepDiveContract = {
        ...validDeepDive,
        notes: 'Need to explore pricing tiers and competitive positioning',
        resolvedAt: '2026-01-10T15:30:00Z',
        status: 'resolved',
      };
      expect(validateDeepDive(fullDeepDive)).toBe(true);
    });

    it('should validate deep dive from message deferral', () => {
      const messageDeepDive: DeepDiveContract = {
        ...validDeepDive,
        origin: 'message',
      };
      expect(validateDeepDive(messageDeepDive)).toBe(true);
    });

    it('should validate pending deep dive from document', () => {
      const documentDeepDive: DeepDiveContract = {
        ...validDeepDive,
        status: 'pending',
        origin: 'document',
      };
      expect(validateDeepDive(documentDeepDive)).toBe(true);
    });

    it('should reject deep dive with missing id', () => {
      const { id, ...invalid } = validDeepDive;
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject deep dive with missing projectId', () => {
      const { projectId, ...invalid } = validDeepDive;
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject deep dive with empty topic', () => {
      const invalid = { ...validDeepDive, topic: '' };
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject deep dive with invalid status', () => {
      const invalid = { ...validDeepDive, status: 'invalid' };
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject deep dive with invalid origin', () => {
      const invalid = { ...validDeepDive, origin: 'invalid' };
      expect(validateDeepDive(invalid)).toBe(false);
    });

    it('should reject null', () => {
      expect(validateDeepDive(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateDeepDive('string')).toBe(false);
      expect(validateDeepDive(123)).toBe(false);
    });
  });

  describe('DeepDiveCreateInput', () => {
    const validInput: DeepDiveCreateInput = {
      projectId: 'proj_xyz789',
      topic: 'Competitor analysis',
    };

    it('should validate minimal create input', () => {
      expect(validateDeepDiveCreateInput(validInput)).toBe(true);
    });

    it('should validate create input with optional fields', () => {
      const fullInput: DeepDiveCreateInput = {
        ...validInput,
        notes: 'Focus on Series B competitors',
        origin: 'message',
      };
      expect(validateDeepDiveCreateInput(fullInput)).toBe(true);
    });

    it('should reject input with missing projectId', () => {
      const { projectId, ...invalid } = validInput;
      expect(validateDeepDiveCreateInput(invalid)).toBe(false);
    });

    it('should reject input with missing topic', () => {
      const { topic, ...invalid } = validInput;
      expect(validateDeepDiveCreateInput(invalid)).toBe(false);
    });

    it('should reject input with empty topic', () => {
      const invalid = { ...validInput, topic: '' };
      expect(validateDeepDiveCreateInput(invalid)).toBe(false);
    });

    it('should reject input with invalid origin', () => {
      const invalid = { ...validInput, origin: 'invalid' };
      expect(validateDeepDiveCreateInput(invalid)).toBe(false);
    });

    it('should accept input without origin (defaults on server)', () => {
      expect(validateDeepDiveCreateInput(validInput)).toBe(true);
    });
  });
});
