// src/lib/contracts/paywall.ts
/**
 * Paywall Contracts
 *
 * Defines request/response shapes for the universal paywall API.
 */

export const PAYWALL_FEATURES = [
  'create_project',
  'export_pdf',
  'add_team_member',
  'advanced_analytics',
] as const;

export type PaywallFeature = typeof PAYWALL_FEATURES[number];

export interface PaywallRequestContract {
  feature: PaywallFeature;
  context?: Record<string, unknown>;
}

export interface PaywallModalContract {
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
}

export interface PaywallResponseContract {
  blocked: boolean;
  modal?: PaywallModalContract;
}

export function isValidPaywallFeature(feature: string): feature is PaywallFeature {
  return PAYWALL_FEATURES.includes(feature as PaywallFeature);
}

export function validatePaywallRequest(data: unknown): data is PaywallRequestContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.feature !== 'string' || !isValidPaywallFeature(obj.feature)) return false;

  // context is optional
  if (obj.context !== undefined && (typeof obj.context !== 'object' || obj.context === null)) {
    return false;
  }

  return true;
}

export function validatePaywallModal(data: unknown): data is PaywallModalContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== 'string' || !obj.title) return false;
  if (typeof obj.message !== 'string' || !obj.message) return false;
  if (typeof obj.ctaLabel !== 'string' || !obj.ctaLabel) return false;
  if (typeof obj.ctaUrl !== 'string' || !obj.ctaUrl) return false;

  return true;
}

export function validatePaywallResponse(data: unknown): data is PaywallResponseContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.blocked !== 'boolean') return false;

  // If blocked, modal is required
  if (obj.blocked && !validatePaywallModal(obj.modal)) return false;

  // If not blocked, modal should be absent or valid
  if (!obj.blocked && obj.modal !== undefined && !validatePaywallModal(obj.modal)) return false;

  return true;
}
