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
  apiCallCount?: number;
  totalPromptTokens?: number;
  totalCompletionTokens?: number;
  lastLlmCallAt?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isOptionalNonNegativeInt(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return typeof value === 'number' && value >= 0 && Number.isInteger(value);
}

export function validateUser(data: unknown): data is UserContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.email !== 'string' || !isValidEmail(obj.email)) return false;
  if (typeof obj.isPaid !== 'boolean') return false;

  // Optional fields
  if (obj.name !== undefined && obj.name !== null && typeof obj.name !== 'string') return false;
  if (!isOptionalNonNegativeInt(obj.apiCallCount)) return false;
  if (!isOptionalNonNegativeInt(obj.totalPromptTokens)) return false;
  if (!isOptionalNonNegativeInt(obj.totalCompletionTokens)) return false;
  if (obj.lastLlmCallAt !== undefined && obj.lastLlmCallAt !== null && typeof obj.lastLlmCallAt !== 'string') return false;

  return true;
}
