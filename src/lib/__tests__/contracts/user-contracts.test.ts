import {
  validateUser,
  UserContract,
} from '@/lib/contracts/user';

describe('UserContract', () => {
  const validUser: UserContract = {
    id: 'user_abc123',
    email: 'test@example.com',
    isPaid: false,
  };

  it('should validate a correct user', () => {
    expect(validateUser(validUser)).toBe(true);
  });

  it('should validate a paid user', () => {
    const paidUser = { ...validUser, isPaid: true };
    expect(validateUser(paidUser)).toBe(true);
  });

  it('should validate user with optional name', () => {
    const userWithName = { ...validUser, name: 'Test User' };
    expect(validateUser(userWithName)).toBe(true);
  });

  it('should reject user with missing id', () => {
    const { id, ...invalid } = validUser;
    expect(validateUser(invalid)).toBe(false);
  });

  it('should reject user with missing email', () => {
    const { email, ...invalid } = validUser;
    expect(validateUser(invalid)).toBe(false);
  });

  it('should reject user with non-boolean isPaid', () => {
    const invalid = { ...validUser, isPaid: 'false' };
    expect(validateUser(invalid)).toBe(false);
  });

  it('should reject user with invalid email format', () => {
    const invalid = { ...validUser, email: 'not-an-email' };
    expect(validateUser(invalid)).toBe(false);
  });

  it('should validate user with apiCallCount', () => {
    const userWithCalls = { ...validUser, apiCallCount: 15 };
    expect(validateUser(userWithCalls)).toBe(true);
  });

  it('should validate user with zero apiCallCount', () => {
    const userWithZero = { ...validUser, apiCallCount: 0 };
    expect(validateUser(userWithZero)).toBe(true);
  });

  it('should reject user with negative apiCallCount', () => {
    const invalid = { ...validUser, apiCallCount: -1 };
    expect(validateUser(invalid)).toBe(false);
  });

  it('should reject user with non-integer apiCallCount', () => {
    const invalid = { ...validUser, apiCallCount: 5.5 };
    expect(validateUser(invalid)).toBe(false);
  });
});
