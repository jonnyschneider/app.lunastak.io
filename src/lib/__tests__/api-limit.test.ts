// src/lib/__tests__/api-limit.test.ts
import { isGuestUser } from '@/lib/projects';

describe('API Limit Check', () => {
  describe('isGuestUser', () => {
    it('should return true for guest email', () => {
      expect(isGuestUser('guest_abc123@guest.lunastak.io')).toBe(true);
    });

    it('should return false for regular email', () => {
      expect(isGuestUser('user@example.com')).toBe(false);
    });

    it('should return false for similar but non-guest domain', () => {
      expect(isGuestUser('guest@lunastak.io')).toBe(false);
    });
  });

  describe('API limit logic', () => {
    const API_LIMIT = 20;

    it('should allow calls under limit', () => {
      const user = { email: 'guest_abc@guest.lunastak.io', apiCallCount: 19 };
      const isBlocked = isGuestUser(user.email) && user.apiCallCount >= API_LIMIT;
      expect(isBlocked).toBe(false);
    });

    it('should block calls at limit', () => {
      const user = { email: 'guest_abc@guest.lunastak.io', apiCallCount: 20 };
      const isBlocked = isGuestUser(user.email) && user.apiCallCount >= API_LIMIT;
      expect(isBlocked).toBe(true);
    });

    it('should block calls over limit', () => {
      const user = { email: 'guest_abc@guest.lunastak.io', apiCallCount: 25 };
      const isBlocked = isGuestUser(user.email) && user.apiCallCount >= API_LIMIT;
      expect(isBlocked).toBe(true);
    });

    it('should not limit authenticated users regardless of count', () => {
      const user = { email: 'user@example.com', apiCallCount: 100 };
      const isBlocked = isGuestUser(user.email) && user.apiCallCount >= API_LIMIT;
      expect(isBlocked).toBe(false);
    });

    it('should not limit users with zero calls', () => {
      const user = { email: 'guest_abc@guest.lunastak.io', apiCallCount: 0 };
      const isBlocked = isGuestUser(user.email) && user.apiCallCount >= API_LIMIT;
      expect(isBlocked).toBe(false);
    });
  });
});
