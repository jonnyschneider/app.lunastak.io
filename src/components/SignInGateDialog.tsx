'use client';

import { signIn } from 'next-auth/react';
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
  featureName: string;
}

export function SignInGateDialog({
  open,
  onOpenChange,
  featureName,
}: SignInGateDialogProps) {
  const handleSignIn = () => {
    signIn(undefined, { callbackUrl: window.location.href });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign in to unlock {featureName}</AlertDialogTitle>
          <AlertDialogDescription>
            Create a free account to save your strategy and access premium features
            like document upload and the Decision Stack canvas.
          </AlertDialogDescription>
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
