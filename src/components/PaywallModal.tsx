'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PaywallModalContract } from '@/lib/contracts/paywall';

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modal: PaywallModalContract | null;
}

export function PaywallModal({ open, onOpenChange, modal }: PaywallModalProps) {
  if (!modal) return null;

  const handleLearnMore = () => {
    window.open(modal.ctaUrl, '_blank');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{modal.title}</AlertDialogTitle>
          <AlertDialogDescription>{modal.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Maybe Later</AlertDialogCancel>
          <AlertDialogAction onClick={handleLearnMore}>
            {modal.ctaLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
