'use client';

import { signIn } from 'next-auth/react';
import { getStatsigClient } from '@/components/StatsigProvider';
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

interface SignInGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

// Preset configurations for common gates
export const SIGN_IN_GATE_PRESETS = {
  addProject: {
    title: 'Create an Account',
    description: 'To add more projects, you\'ll need to create a free account. This lets you save your work and access it from any device.',
  },
  uploadDocument: {
    title: 'Create an Account',
    description: 'To upload documents, you\'ll need to create a free account. This lets Luna analyze your docs and incorporate insights into your strategy.',
  },
  generic: {
    title: 'Create an Account',
    description: 'Create a free account to save your strategy and access premium features like document upload and multiple projects.',
  },
} as const;

export function SignInGateDialog({
  open,
  onOpenChange,
  title = SIGN_IN_GATE_PRESETS.generic.title,
  description = SIGN_IN_GATE_PRESETS.generic.description,
}: SignInGateDialogProps) {
  const handleSignIn = () => {
    getStatsigClient()?.logEvent('cta_create_account', 'sign-in-gate');
    signIn(undefined, { callbackUrl: window.location.href });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Maybe Later</AlertDialogCancel>
          <AlertDialogAction onClick={handleSignIn}>
            Sign In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
