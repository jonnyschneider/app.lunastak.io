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

interface FakeDoorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  description: string;
  onInterest: () => void;
}

export function FakeDoorDialog({
  open,
  onOpenChange,
  featureName,
  description,
  onInterest,
}: FakeDoorDialogProps) {
  const handleInterest = () => {
    onInterest();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{featureName} - Coming Soon</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">
            {description}
            {'\n\n'}
            We're validating interest before building this feature.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Maybe Later</AlertDialogCancel>
          <AlertDialogAction onClick={handleInterest}>
            I'm Interested
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
