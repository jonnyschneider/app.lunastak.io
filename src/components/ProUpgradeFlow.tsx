'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Check, Calendar, FileText, Plug, Mic } from 'lucide-react';

// Feature definitions for the interstitial
export const PRO_FEATURES = {
  'monthly-review': {
    icon: Calendar,
    title: 'Monthly Review Drafts',
    description: 'Luna drafts your MBR based on your endorsed strategy. Easy prep, distribute ahead, effective meetings.',
  },
  'quarterly-review': {
    icon: Calendar,
    title: 'Quarterly Review Drafts',
    description: 'Comprehensive QBR narrative with strategic context. Stop scrambling before board meetings.',
  },
  'strategic-narrative': {
    icon: FileText,
    title: 'Strategic Narrative',
    description: 'The story of how you\'re tracking against objectives. Share context without the jargon.',
  },
  'connect-data': {
    icon: Plug,
    title: 'Connect Your Data',
    description: 'Pull operational metrics back into Luna. Let reality inform your strategic updates.',
  },
  'audio-memo': {
    icon: Mic,
    title: 'Audio Memos',
    description: 'Record voice memos, Luna transcribes and extracts strategic insights automatically.',
  },
  'model-selection': {
    icon: Sparkles,
    title: 'Premium AI Model',
    description: 'Access to Opus, our most capable model for deeper strategic analysis.',
  },
} as const;

export type ProFeatureKey = keyof typeof PRO_FEATURES;

interface ProFeatureInterstitialProps {
  feature: ProFeatureKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
}

export function ProFeatureInterstitial({
  feature,
  open,
  onOpenChange,
  onUpgrade,
}: ProFeatureInterstitialProps) {
  const featureConfig = PRO_FEATURES[feature];
  const Icon = featureConfig.icon;

  const handleUpgradeClick = () => {
    // Log the strong signal
    console.log('[ProUpgrade] User clicked Upgrade to Pro for:', feature);
    onUpgrade();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">{featureConfig.title}</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {featureConfig.description}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            This is a Pro feature.
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={handleUpgradeClick} className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full text-muted-foreground"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface UpgradeSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

export function UpgradeSuccessDialog({
  open,
  onOpenChange,
  onContinue,
}: UpgradeSuccessDialogProps) {
  const { data: session } = useSession();
  const sessionEmail = session?.user?.email || '';

  const [email, setEmail] = useState(sessionEmail);
  const [isEditing, setIsEditing] = useState(false);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Update email when session loads
  const effectiveEmail = email || sessionEmail;

  const handleJoinWaitlist = async () => {
    if (!effectiveEmail.trim()) return;

    setIsJoining(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: effectiveEmail, feature: 'pro-early-access' }),
      });

      if (res.ok) {
        setJoinedWaitlist(true);
      } else {
        console.error('[ProUpgrade] Waitlist signup failed');
        setJoinedWaitlist(true);
      }
    } catch (error) {
      console.error('[ProUpgrade] Waitlist error:', error);
      setJoinedWaitlist(true);
    } finally {
      setIsJoining(false);
      setIsEditing(false);
    }
  };

  const handleContinue = () => {
    onContinue();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-luna" />
            <DialogTitle className="text-xl">Welcome to Lunastak Pro</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            We're not taking payment yet, but we've upgraded your account for free.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-4 space-y-6">
          {/* What's unlocked */}
          <div>
            <p className="text-sm font-medium mb-3">You now have access to:</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                Multiple projects
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-600" />
                Premium AI model (coming soon)
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-600" />
                Audio memos (coming soon)
              </li>
            </ul>
          </div>

          {/* What's coming */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Coming to Pro:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Monthly & Quarterly Review Drafts</li>
              <li>• Strategic Narrative Generation</li>
              <li>• Data Integrations</li>
            </ul>
          </div>

          {/* Waitlist */}
          <div className="border-t pt-4">
            {!joinedWaitlist ? (
              <>
                <p className="text-sm mb-3">Want early access to new features?</p>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1"
                      disabled={isJoining}
                      autoFocus
                    />
                    <Button
                      onClick={handleJoinWaitlist}
                      disabled={isJoining || !effectiveEmail.trim()}
                      className="bg-accent text-white hover:bg-accent/90"
                    >
                      {isJoining ? 'Joining...' : 'Join'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-muted-foreground">{effectiveEmail}</span>
                      <button
                        onClick={() => {
                          setEmail(effectiveEmail);
                          setIsEditing(true);
                        }}
                        className="ml-2 text-primary hover:underline text-xs"
                      >
                        change
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleJoinWaitlist}
                      disabled={isJoining || !effectiveEmail.trim()}
                      className="bg-accent text-white hover:bg-accent/90"
                    >
                      {isJoining ? 'Joining...' : 'Join Waitlist'}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-green-600 flex items-center gap-2">
                <Check className="h-4 w-4" />
                You're on the early access list!
              </p>
            )}
          </div>

          <Button onClick={handleContinue} className="w-full">
            Continue to Lunastak
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Dialog for Pro users clicking features that aren't ready yet
interface ProComingSoonDialogProps {
  feature: ProFeatureKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProComingSoonDialog({
  feature,
  open,
  onOpenChange,
}: ProComingSoonDialogProps) {
  const featureConfig = PRO_FEATURES[feature];
  const Icon = featureConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">{featureConfig.title}</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {featureConfig.description}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>You're a Pro — you'll be first to know when this feature is ready.</span>
          </div>

          <Button onClick={() => onOpenChange(false)} className="w-full">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage the upgrade flow
export function useProUpgradeFlow(isPro: boolean = false) {
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [currentFeature, setCurrentFeature] = useState<ProFeatureKey>('monthly-review');

  const triggerUpgrade = (feature: ProFeatureKey) => {
    setCurrentFeature(feature);
    if (isPro) {
      // Pro user clicking unreleased feature
      setComingSoonOpen(true);
      console.log('[ProUpgrade] Pro user viewed coming soon feature:', feature);
    } else {
      // Non-pro user - show upgrade interstitial
      setInterstitialOpen(true);
      console.log('[ProUpgrade] User viewed pro feature:', feature);
    }
  };

  const handleUpgrade = async () => {
    setInterstitialOpen(false);

    // Call API to upgrade user
    try {
      const res = await fetch('/api/user/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: currentFeature }),
      });

      if (res.ok) {
        setSuccessOpen(true);
      } else {
        // Log error but still show success (it's free anyway)
        const error = await res.json().catch(() => ({}));
        console.error('[ProUpgrade] API error:', res.status, error);
        // Show success dialog anyway - worst case they're not marked as upgraded in DB
        setSuccessOpen(true);
      }
    } catch (error) {
      console.error('[ProUpgrade] Upgrade failed:', error);
      // Show success dialog anyway for better UX
      setSuccessOpen(true);
    }
  };

  const handleContinue = () => {
    setSuccessOpen(false);
  };

  return {
    interstitialOpen,
    setInterstitialOpen,
    successOpen,
    setSuccessOpen,
    comingSoonOpen,
    setComingSoonOpen,
    currentFeature,
    triggerUpgrade,
    handleUpgrade,
    handleContinue,
  };
}
