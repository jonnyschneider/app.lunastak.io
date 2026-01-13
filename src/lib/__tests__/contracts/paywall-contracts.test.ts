import {
  validatePaywallRequest,
  validatePaywallResponse,
  PaywallRequestContract,
  PaywallResponseContract,
  PAYWALL_FEATURES,
} from '@/lib/contracts/paywall';

describe('PaywallContracts', () => {
  describe('PaywallRequestContract', () => {
    const validRequest: PaywallRequestContract = {
      feature: 'create_project',
    };

    it('should validate correct request', () => {
      expect(validatePaywallRequest(validRequest)).toBe(true);
    });

    it('should validate request with context', () => {
      const withContext = { ...validRequest, context: { projectCount: 1 } };
      expect(validatePaywallRequest(withContext)).toBe(true);
    });

    it('should reject request with missing feature', () => {
      expect(validatePaywallRequest({})).toBe(false);
    });

    it('should reject request with invalid feature', () => {
      expect(validatePaywallRequest({ feature: 'invalid_feature' })).toBe(false);
    });
  });

  describe('PaywallResponseContract', () => {
    const validResponse: PaywallResponseContract = {
      blocked: true,
      modal: {
        title: 'Upgrade to Pro',
        message: 'Create multiple projects with a Pro subscription.',
        ctaLabel: 'Learn More',
        ctaUrl: 'https://lunastak.io/pricing',
      },
    };

    it('should validate correct blocked response', () => {
      expect(validatePaywallResponse(validResponse)).toBe(true);
    });

    it('should validate unblocked response without modal', () => {
      const unblocked = { blocked: false };
      expect(validatePaywallResponse(unblocked)).toBe(true);
    });

    it('should reject blocked response without modal', () => {
      const invalid = { blocked: true };
      expect(validatePaywallResponse(invalid)).toBe(false);
    });

    it('should reject response with incomplete modal', () => {
      const invalid = {
        blocked: true,
        modal: { title: 'Upgrade' },
      };
      expect(validatePaywallResponse(invalid)).toBe(false);
    });
  });
});
