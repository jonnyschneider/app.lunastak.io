import {
  AUTH_PROVIDERS,
  SIGNUP_SOURCES,
  isValidAuthProvider,
  isValidSignupSource,
  validateSubscribeContext,
  validateSignupContext,
  validateSignInContext,
} from '@/lib/contracts/signup'

describe('Signup Contracts', () => {
  describe('isValidAuthProvider', () => {
    it('accepts all valid providers', () => {
      for (const p of AUTH_PROVIDERS) expect(isValidAuthProvider(p)).toBe(true)
    })
    it('rejects invalid providers', () => {
      expect(isValidAuthProvider('facebook')).toBe(false)
      expect(isValidAuthProvider('')).toBe(false)
      expect(isValidAuthProvider(undefined)).toBe(false)
    })
  })

  describe('isValidSignupSource', () => {
    it('accepts all valid sources', () => {
      for (const s of SIGNUP_SOURCES) expect(isValidSignupSource(s)).toBe(true)
    })
    it('rejects invalid sources', () => {
      expect(isValidSignupSource('webhook')).toBe(false)
      expect(isValidSignupSource('')).toBe(false)
    })
  })

  describe('validateSubscribeContext', () => {
    it('accepts minimal valid input', () => {
      expect(validateSubscribeContext({ email: 'test@example.com' })).toBe(true)
    })
    it('accepts full valid input', () => {
      expect(
        validateSubscribeContext({
          email: 'test@example.com',
          name: 'Test User',
          guestUserId: 'guest-123',
        })
      ).toBe(true)
    })
    it('rejects missing email', () => {
      expect(validateSubscribeContext({})).toBe(false)
    })
    it('rejects invalid email', () => {
      expect(validateSubscribeContext({ email: 'not-an-email' })).toBe(false)
    })
  })

  describe('validateSignupContext', () => {
    const valid = {
      userId: 'u_123',
      email: 'test@example.com',
      provider: 'google',
      source: 'nextauth',
    }
    it('accepts valid input', () => {
      expect(validateSignupContext(valid)).toBe(true)
    })
    it('rejects missing userId', () => {
      expect(validateSignupContext({ ...valid, userId: '' })).toBe(false)
    })
    it('rejects invalid provider', () => {
      expect(validateSignupContext({ ...valid, provider: 'facebook' })).toBe(false)
    })
    it('rejects invalid source', () => {
      expect(validateSignupContext({ ...valid, source: 'webhook' })).toBe(false)
    })
  })

  describe('validateSignInContext', () => {
    const valid = {
      userId: 'u_123',
      email: 'test@example.com',
      isNewUser: false,
      provider: 'email',
    }
    it('accepts valid input', () => {
      expect(validateSignInContext(valid)).toBe(true)
    })
    it('rejects non-boolean isNewUser', () => {
      expect(validateSignInContext({ ...valid, isNewUser: 'no' })).toBe(false)
    })
  })
})
