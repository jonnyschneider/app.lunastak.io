'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CornerDownRight } from 'lucide-react';
import { evaluateOpportunity, CoachingResult } from '@/lib/opportunity-coaching';
import { OpportunityCoaching } from './OpportunityCoaching';
import { FakeDoorDialog } from './FakeDoorDialog';
import { getObjectiveTitle } from '@/lib/utils';

interface ObjectiveContribution {
  objectiveId: string;
  contribution: string;
}

interface ObjectiveForLinking {
  id: string;
  title?: string;
  pithy: string;
}

interface OpportunityEditorProps {
  initialContent?: string;
  initialContributions?: ObjectiveContribution[];
  objectives: ObjectiveForLinking[];
  onSave: (content: string, status: 'draft' | 'complete', contributions: ObjectiveContribution[]) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export function OpportunityEditor({
  initialContent = '',
  initialContributions = [],
  objectives,
  onSave,
  onCancel,
  saving = false,
}: OpportunityEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [contributions, setContributions] = useState<ObjectiveContribution[]>(initialContributions);
  const [coaching, setCoaching] = useState<CoachingResult | null>(null);
  const [showCoaching, setShowCoaching] = useState(false);
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);

  // Keep ref in sync with state
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Evaluate coaching using ref to avoid stale closure
  const evaluateContent = useCallback(() => {
    const currentContent = contentRef.current;
    if (currentContent.trim().length > 0) {
      const result = evaluateOpportunity(currentContent);
      setCoaching(result);
      setShowCoaching(true);
    } else {
      setShowCoaching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    contentRef.current = newContent;
    setShowCoaching(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(evaluateContent, 2000);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    evaluateContent();
  };

  // Objective linking handlers
  const isObjectiveLinked = (objectiveId: string) => {
    return contributions.some(c => c.objectiveId === objectiveId);
  };

  const toggleObjective = (objectiveId: string) => {
    if (isObjectiveLinked(objectiveId)) {
      setContributions(prev => prev.filter(c => c.objectiveId !== objectiveId));
    } else {
      setContributions(prev => [...prev, { objectiveId, contribution: '' }]);
    }
  };

  const updateContribution = (objectiveId: string, contribution: string) => {
    setContributions(prev =>
      prev.map(c => c.objectiveId === objectiveId ? { ...c, contribution } : c)
    );
  };

  const handleSave = async () => {
    if (!content.trim() || saving) return;

    // Determine status: strong coaching + at least one linked objective with contribution = complete
    const result = coaching || evaluateOpportunity(content);
    const hasLinkedObjectives = contributions.length > 0;
    const hasContributions = contributions.some(c => c.contribution.trim().length > 0);

    const status = (result.overallStrength === 'strong' || result.overallStrength === 'okay')
      && hasLinkedObjectives && hasContributions
      ? 'complete'
      : 'draft';

    await onSave(content, status, contributions);
  };

  const handleRewriteClick = () => {
    setFakeDoorOpen(true);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4 bg-white border border-[#0A2933] rounded-lg p-4">
      {/* Content textarea */}
      <div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Describe your opportunity...&#10;First line becomes the heading, add details below."
          className="w-full min-h-[80px] p-3 border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          disabled={saving}
        />
      </div>

      {/* Suggested improvements */}
      {showCoaching && coaching && (
        <OpportunityCoaching
          result={coaching}
          onRewriteClick={handleRewriteClick}
        />
      )}

      {/* Objective linking with inline contributions */}
      {objectives.length > 0 && (
        <div className="space-y-1">
          {objectives.map(obj => {
            const isLinked = isObjectiveLinked(obj.id);
            const contribution = contributions.find(c => c.objectiveId === obj.id);
            return (
              <div key={obj.id}>
                <label className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={() => toggleObjective(obj.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    disabled={saving}
                  />
                  <span className="text-sm text-foreground">{getObjectiveTitle(obj)}</span>
                </label>
                {isLinked && (
                  <div className="flex items-start gap-2 ml-9 mt-1 mb-2">
                    <CornerDownRight className="h-3 w-3 text-muted-foreground mt-2.5 shrink-0" />
                    <input
                      type="text"
                      value={contribution?.contribution || ''}
                      onChange={(e) => updateContribution(obj.id, e.target.value)}
                      placeholder="e.g. add an expected result related to this outcome"
                      className="flex-1 p-2 border border-input rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={saving}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t">
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

This feature would help clarify outcomes and rationale while keeping your core idea intact."
        onInterest={() => {
          console.log('[FakeDoor] User interested in: AI Rewrite for Opportunities');
        }}
      />
    </div>
  );
}
