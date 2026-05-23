/**
 * Signup orchestrator contracts.
 *
 * Three distinct events:
 * - SubscribeContext: email captured pre-auth (e.g. guest provides email)
 * - SignupContext: first successful sign-in for a brand-new authenticated user
 * - SignInContext: every sign-in (including immediately post-signup)
 */

export const AUTH_PROVIDERS = ['google', 'email', 'credentials'] as const
export type AuthProvider = (typeof AUTH_PROVIDERS)[number]

export const SIGNUP_SOURCES = ['subscribe-endpoint', 'nextauth'] as const
export type SignupSource = (typeof SIGNUP_SOURCES)[number]

export interface SubscribeContext {
  email: string
  name?: string
  guestUserId?: string
}

export interface SignupContext {
  userId: string
  email: string
  name?: string
  provider: AuthProvider
  source: SignupSource
}

export interface SignInContext {
  userId: string
  email: string
  isNewUser: boolean
  provider: AuthProvider
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidAuthProvider(value: unknown): value is AuthProvider {
  return typeof value === 'string' && (AUTH_PROVIDERS as readonly string[]).includes(value)
}

export function isValidSignupSource(value: unknown): value is SignupSource {
  return typeof value === 'string' && (SIGNUP_SOURCES as readonly string[]).includes(value)
}

export function validateSubscribeContext(data: unknown): data is SubscribeContext {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (!isValidEmail(obj.email)) return false
  if (obj.name !== undefined && typeof obj.name !== 'string') return false
  if (obj.guestUserId !== undefined && typeof obj.guestUserId !== 'string') return false
  return true
}

export function validateSignupContext(data: unknown): data is SignupContext {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.userId !== 'string' || !obj.userId) return false
  if (!isValidEmail(obj.email)) return false
  if (obj.name !== undefined && typeof obj.name !== 'string') return false
  if (!isValidAuthProvider(obj.provider)) return false
  if (!isValidSignupSource(obj.source)) return false
  return true
}

export function validateSignInContext(data: unknown): data is SignInContext {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.userId !== 'string' || !obj.userId) return false
  if (!isValidEmail(obj.email)) return false
  if (typeof obj.isNewUser !== 'boolean') return false
  if (!isValidAuthProvider(obj.provider)) return false
  return true
}
