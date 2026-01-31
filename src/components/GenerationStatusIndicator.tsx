'use client';

import { Sparkles, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenerationStatus } from '@/lib/contracts/generation-status';

interface GenerationStatusIndicatorProps {
  /** Current generation status */
  status: GenerationStatus | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the label text */
  showLabel?: boolean;
  /** Custom label for generating state */
  generatingLabel?: string;
  /** Called when retry button is clicked (only shown for failed state) */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const SIZE_CLASSES = {
  sm: {
    icon: 'h-3 w-3',
    dot: 'h-2 w-2',
    container: 'gap-1',
    text: 'text-xs',
  },
  md: {
    icon: 'h-4 w-4',
    dot: 'h-2.5 w-2.5',
    container: 'gap-1.5',
    text: 'text-sm',
  },
  lg: {
    icon: 'h-5 w-5',
    dot: 'h-3 w-3',
    container: 'gap-2',
    text: 'text-base',
  },
};

/**
 * Visual indicator for generation status.
 *
 * States:
 * - generating: Animated sparkles icon + "generating your strategy..."
 * - complete (unseen): Solid dot indicator
 * - complete (viewed): Just shows content, no indicator
 * - failed: Error icon + retry button
 * - pending: Same as generating
 */
export function GenerationStatusIndicator({
  status,
  size = 'md',
  showLabel = true,
  generatingLabel = 'generating your strategy...',
  onRetry,
  className,
}: GenerationStatusIndicatorProps) {
  const sizeClasses = SIZE_CLASSES[size];

  // Null status = not tracking any generation
  if (!status) {
    return null;
  }

  // Generating or pending state
  if (status === 'generating' || status === 'pending') {
    return (
      <div className={cn('flex items-center', sizeClasses.container, className)}>
        <Sparkles
          className={cn(
            sizeClasses.icon,
            'text-primary animate-pulse'
          )}
        />
        {showLabel && (
          <span className={cn(sizeClasses.text, 'text-muted-foreground')}>
            {generatingLabel}
          </span>
        )}
      </div>
    );
  }

  // Failed state
  if (status === 'failed') {
    return (
      <div className={cn('flex items-center', sizeClasses.container, className)}>
        <AlertCircle
          className={cn(
            sizeClasses.icon,
            'text-destructive'
          )}
        />
        {showLabel && (
          <span className={cn(sizeClasses.text, 'text-destructive')}>
            Failed
          </span>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              'ml-1 flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors',
              sizeClasses.text
            )}
          >
            <RotateCcw className={cn(sizeClasses.icon, 'h-3 w-3')} />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  // Complete state - just show checkmark briefly then nothing
  // The "unseen" indicator is handled by the parent component (sidebar)
  if (status === 'complete') {
    return (
      <div className={cn('flex items-center', sizeClasses.container, className)}>
        <Check
          className={cn(
            sizeClasses.icon,
            'text-primary'
          )}
        />
        {showLabel && (
          <span className={cn(sizeClasses.text, 'text-muted-foreground')}>
            Ready
          </span>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Simple dot indicator for unseen strategies in the sidebar.
 */
export function UnseenIndicator({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        sizeClasses.dot,
        'rounded-full bg-primary',
        className
      )}
    />
  );
}
