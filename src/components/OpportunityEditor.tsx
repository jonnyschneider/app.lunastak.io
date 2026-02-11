'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CornerDownRight, Plus } from 'lucide-react';
import { evaluateOpportunity, CoachingResult } from '@/lib/opportunity-coaching';
import { OpportunityCoaching } from './OpportunityCoaching';
import { FakeDoorDialog } from './FakeDoorDialog';
import { getObjectiveTitle } from '@/lib/utils';
import { SuccessMetric } from '@/lib/types';
import { SuccessMetricEditor } from './SuccessMetricEditor';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ObjectiveContribution {
  objectiveId: string;
  contribution: string;
}

interface ObjectiveForLinking {
  id: string;
  title?: string;
  pithy?: string;
  objective?: string;
}

interface OpportunityEditorProps {
  initialContent?: string;
  initialContributions?: ObjectiveContribution[];
  initialSuccessMetrics?: SuccessMetric[];
  objectives: ObjectiveForLinking[];
  onSave: (
    content: string,
    status: 'draft' | 'complete',
    contributions: ObjectiveContribution[],
    successMetrics: SuccessMetric[]
  ) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

function generateMetricId(): string {
  return `sm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyMetric(): SuccessMetric {
  return {
    id: generateMetricId(),
    belief: { action: '', outcome: '' },
    signal: '',
    baseline: '',
    target: '',
  };
}

function parseOpportunityContent(content: string): { title: string; details: string } {
  const lines = content.split('\n');
  const title = lines[0] || '';
  const details = lines.slice(1).join('\n').trim();
  return { title, details };
}

export function OpportunityEditor({
  initialContent = '',
  initialContributions = [],
  initialSuccessMetrics = [],
  objectives,
  onSave,
  onCancel,
  saving = false,
}: OpportunityEditorProps) {
  const parsed = parseOpportunityContent(initialContent);
  const [title, setTitle] = useState(parsed.title);
  const [description, setDescription] = useState(parsed.details);
  const [contributions, setContributions] = useState<ObjectiveContribution[]>(initialContributions);
  const [successMetrics, setSuccessMetrics] = useState<SuccessMetric[]>(initialSuccessMetrics);
  const [coaching, setCoaching] = useState<CoachingResult | null>(null);
  const [showCoaching, setShowCoaching] = useState(false);
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const content = description ? `${title}\n${description}` : title;
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

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    const newContent = title ? `${title}\n${newDescription}` : newDescription;
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

  // Success metric handlers
  const handleMetricChange = (index: number, updated: SuccessMetric) => {
    const newMetrics = [...successMetrics];
    newMetrics[index] = updated;
    setSuccessMetrics(newMetrics);
  };

  const handleAddMetric = () => {
    if (successMetrics.length < 3) {
      setSuccessMetrics([...successMetrics, createEmptyMetric()]);
    }
  };

  const handleRemoveMetric = (index: number) => {
    setSuccessMetrics(successMetrics.filter((_, i) => i !== index));
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
    if (!title.trim() || saving) return;

    // Combine title and description for content field (backwards compat)
    const fullContent = description ? `${title}\n${description}` : title;

    // Determine status
    const hasMetrics = successMetrics.some(m => m.signal.trim() && m.target.trim());
    const hasLinkedObjectives = contributions.length > 0;

    const status = hasMetrics && hasLinkedObjectives ? 'complete' : 'draft';

    await onSave(fullContent, status, contributions, successMetrics);
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
      {/* Title */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Initiative Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Improve first-session value delivery"
          className="mt-1"
          disabled={saving}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Description
        </label>
        <textarea
          ref={textareaRef}
          value={description}
          onChange={handleDescriptionChange}
          onBlur={handleBlur}
          placeholder="What are we doing and why?"
          className="mt-1 w-full min-h-[60px] p-3 border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          disabled={saving}
        />
      </div>

      {/* Success Metrics */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Success Metrics
          </label>
          {successMetrics.length < 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddMetric}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Metric
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {successMetrics.map((metric, index) => (
            <SuccessMetricEditor
              key={metric.id}
              metric={metric}
              onChange={(updated) => handleMetricChange(index, updated)}
              onRemove={() => handleRemoveMetric(index)}
              canRemove={successMetrics.length > 0}
            />
          ))}
          {successMetrics.length === 0 && (
            <button
              onClick={handleAddMetric}
              className="w-full py-3 border border-dashed border-muted-foreground/50 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
            >
              + Add success metric
            </button>
          )}
        </div>
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
          disabled={!title.trim() || saving}
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
