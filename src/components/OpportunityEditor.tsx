'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { evaluateOpportunity, CoachingResult } from '@/lib/opportunity-coaching';
import { OpportunityCoaching } from './OpportunityCoaching';
import { FakeDoorDialog } from './FakeDoorDialog';

interface OpportunityEditorProps {
  initialContent?: string;
  onSave: (content: string, status: 'draft' | 'complete') => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export function OpportunityEditor({
  initialContent = '',
  onSave,
  onCancel,
  saving = false,
}: OpportunityEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [coaching, setCoaching] = useState<CoachingResult | null>(null);
  const [showCoaching, setShowCoaching] = useState(false);
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Evaluate coaching on pause (2s debounce) or blur
  const evaluateContent = useCallback(() => {
    if (content.trim().length > 0) {
      const result = evaluateOpportunity(content);
      setCoaching(result);
      setShowCoaching(true);
    } else {
      setShowCoaching(false);
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setShowCoaching(false);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for 2s pause
    timeoutRef.current = setTimeout(evaluateContent, 2000);
  };

  const handleBlur = () => {
    // Clear debounce timeout and evaluate immediately
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    evaluateContent();
  };

  const handleSave = async () => {
    if (!content.trim() || saving) return;

    // Determine status based on coaching
    const result = coaching || evaluateOpportunity(content);
    const status = result.overallStrength === 'strong' ? 'complete' : 'draft';

    await onSave(content, status);
  };

  const handleRewriteClick = () => {
    setFakeDoorOpen(true);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Describe your opportunity... (e.g., 'Launch MVP in Q2 → Core features, beta testing, 10 pilot customers')"
        className="w-full min-h-[100px] p-3 border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        disabled={saving}
      />

      {showCoaching && coaching && (
        <OpportunityCoaching
          result={coaching}
          onRewriteClick={handleRewriteClick}
        />
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!content.trim() || saving}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <FakeDoorDialog
        open={fakeDoorOpen}
        onOpenChange={setFakeDoorOpen}
        featureName="AI Rewrite"
        description="Get AI-powered suggestions to improve your opportunity based on the coaching feedback.

This feature would rewrite your opportunity to include timeframes, specific deliverables, and clearer action items."
        onInterest={() => {
          console.log('[FakeDoor] User interested in: AI Rewrite for Opportunities');
        }}
      />
    </div>
  );
}
