'use client';

import { useState, useCallback } from 'react';
import type { PaywallFeature, PaywallModalContract } from '@/lib/contracts/paywall';

interface UsePaywallReturn {
  isOpen: boolean;
  modal: PaywallModalContract | null;
  triggerPaywall: (feature: PaywallFeature, context?: Record<string, unknown>) => Promise<boolean>;
  closePaywall: () => void;
}

export function usePaywall(): UsePaywallReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [modal, setModal] = useState<PaywallModalContract | null>(null);

  const triggerPaywall = useCallback(async (
    feature: PaywallFeature,
    context?: Record<string, unknown>
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/paywall/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, context }),
      });

      if (!response.ok) {
        console.error('Paywall API error:', response.status);
        return false; // Allow action on API error
      }

      const data = await response.json();

      if (data.blocked) {
        setModal(data.modal);
        setIsOpen(true);
        return true; // Blocked
      }

      return false; // Not blocked
    } catch (error) {
      console.error('Paywall check failed:', error);
      return false; // Allow action on error
    }
  }, []);

  const closePaywall = useCallback(() => {
    setIsOpen(false);
    setModal(null);
  }, []);

  return { isOpen, modal, triggerPaywall, closePaywall };
}
