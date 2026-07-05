'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Link2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/ui/copy-button';
import { logAndFlush } from '@/components/StatsigProvider';

interface ShareDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Google-pattern share dialog: one switch — "Anyone with the link can view" —
 * plus the link and a copy button. The unguessable URL is the security
 * mechanism; toggling off kills the link instantly.
 */
export function ShareDialog({ projectId, open, onOpenChange }: ShareDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/project/${projectId}/share`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setEnabled(data.enabled);
        setShareUrl(data.shareUrl);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load sharing settings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const handleToggle = useCallback(
    async (next: boolean) => {
      setSaving(true);
      setError(null);
      // Optimistic flip; revert on failure
      setEnabled(next);
      try {
        const res = await fetch(`/api/project/${projectId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: next }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setEnabled(data.enabled);
        setShareUrl(data.shareUrl);
        logAndFlush(next ? 'share_link_enabled' : 'share_link_disabled', projectId, {
          projectId,
        });
      } catch {
        setEnabled(!next);
        setError('Could not update sharing. Try again.');
      } finally {
        setSaving(false);
      }
    },
    [projectId]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this Decision Stack</DialogTitle>
          <DialogDescription>
            Share a read-only view of your Decision Stack. Only people with the
            link can see it, and you can turn it off anytime.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Anyone with the link can view</p>
                  <p className="text-xs text-muted-foreground">
                    {enabled
                      ? 'Sharing is on — the link below is live.'
                      : 'Sharing is off — the link is disabled.'}
                  </p>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={handleToggle} disabled={saving} />
            </div>

            {enabled && shareUrl && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input readOnly value={shareUrl} className="pl-8 text-xs" onFocus={e => e.target.select()} />
                </div>
                <CopyButton
                  value={shareUrl}
                  label="Copy link"
                  onCopied={() => logAndFlush('share_link_copied', projectId, { projectId })}
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
