// src/lib/contracts/user.ts
/**
 * User Contracts
 *
 * Defines user-related data structures for auth and subscription.
 */

export interface UserContract {
  id: string;
  email: string;
  isPaid: boolean;
  name?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateUser(data: unknown): data is UserContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.email !== 'string' || !isValidEmail(obj.email)) return false;
  if (typeof obj.isPaid !== 'boolean') return false;

  // Optional fields
  if (obj.name !== undefined && obj.name !== null && typeof obj.name !== 'string') return false;

  return true;
}
