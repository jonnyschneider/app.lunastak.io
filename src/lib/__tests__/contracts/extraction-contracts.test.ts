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
  EmergentThemeContract,
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

    it('should validate extraction without reflective_summary (immediate output)', () => {
      const { reflective_summary, ...immediateOutput } = validEmergent;
      expect(validateEmergentExtraction(immediateOutput)).toBe(true);
    });

    it('should validate extraction with reflective_summary (full output)', () => {
      expect(validateEmergentExtraction(validEmergent)).toBe(true);
    });

    it('should reject extraction with invalid reflective_summary structure', () => {
      const invalid = {
        ...validEmergent,
        reflective_summary: { invalid: 'structure' },
      };
      expect(validateEmergentExtraction(invalid)).toBe(false);
    });

    it('should reject extraction with reflective_summary missing required arrays', () => {
      const invalid = {
        ...validEmergent,
        reflective_summary: {
          strengths: ['Valid'],
          // missing emerging and opportunities_for_enrichment
        },
      };
      expect(validateEmergentExtraction(invalid)).toBe(false);
    });

    // Ground-truth check (2026-09-04): every theme should carry the verbatim span it rests on,
    // plus a self-reported verbatim|interpretation type. BOTH are OPTIONAL — three producers roll
    // out at different times, and one that emits neither must keep parsing and validating.
    describe('evidence and type are optional additions', () => {
      it('validates a theme carrying evidence spans and a type', () => {
        const withEvidence: EmergentExtractionContract = {
          ...validEmergent,
          themes: [
            {
              theme_name: 'Pricing Opacity',
              content: 'Builders keep pricing opaque, which stalls the buyer.',
              dimensions: [{ name: 'business_model_economics', confidence: 'HIGH' }],
              evidence: ['builders keep it opaque, mostly', 'so they can’t estimate it properly'],
              type: 'verbatim',
            },
          ],
        };

        expect(validateEmergentExtraction(withEvidence)).toBe(true);
        expect(withEvidence.themes[0].evidence).toHaveLength(2);
        expect(withEvidence.themes[0].type).toBe('verbatim');
      });

      it('accepts interpretation as a type', () => {
        const theme: EmergentThemeContract = {
          theme_name: 'Trust Gap',
          content: 'Reasoning across several points in the discussion.',
          evidence: ['a span', 'another span'],
          type: 'interpretation',
        };

        expect(theme.type).toBe('interpretation');
        expect(validateEmergentExtraction({ ...validEmergent, themes: [theme] })).toBe(true);
      });

      it('validates a theme omitting both — a producer mid-rollout is not a breaking change', () => {
        const legacyTheme: EmergentThemeContract = {
          theme_name: 'Customer Pain Points',
          content: 'SMBs struggle with complex invoicing workflows',
        };

        expect(legacyTheme.evidence).toBeUndefined();
        expect(legacyTheme.type).toBeUndefined();
        expect(validateEmergentExtraction({ ...validEmergent, themes: [legacyTheme] })).toBe(true);
      });
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
