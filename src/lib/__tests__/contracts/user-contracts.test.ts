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
});
