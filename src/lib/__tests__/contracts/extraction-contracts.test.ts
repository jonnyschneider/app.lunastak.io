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
