'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { evaluateOpportunity, CoachingResult } from '@/lib/opportunity-coaching';
import { OpportunityCoaching } from './OpportunityCoaching';
import { FakeDoorDialog } from './FakeDoorDialog';
import { getObjectiveTitle } from '@/lib/utils';
import { SuccessMetric } from '@/lib/types';
import { SuccessMetricEditor } from './SuccessMetricEditor';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ObjectiveForLinking {
  id: string;
  title?: string;
  pithy?: string;
  objective?: string;
}

interface OpportunityEditorProps {
  initialContent?: string;
  initialObjectiveIds?: string[];
  initialSuccessMetrics?: SuccessMetric[];
  objectives: ObjectiveForLinking[];
  onSave: (
    content: string,
    status: 'draft' | 'complete',
    objectiveIds: string[],
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
  initialObjectiveIds = [],
  initialSuccessMetrics = [],
  objectives,
  onSave,
  onCancel,
  saving = false,
}: OpportunityEditorProps) {
  const parsed = parseOpportunityContent(initialContent);
  const [title, setTitle] = useState(parsed.title);
  const [description, setDescription] = useState(parsed.details);
  const [linkedObjectiveIds, setLinkedObjectiveIds] = useState<string[]>(initialObjectiveIds);
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
    return linkedObjectiveIds.includes(objectiveId);
  };

  const toggleObjective = (objectiveId: string) => {
    if (isObjectiveLinked(objectiveId)) {
      setLinkedObjectiveIds(prev => prev.filter(id => id !== objectiveId));
      // Also clear any metrics linked to this objective
      setSuccessMetrics(prev => prev.map(m =>
        m.objectiveId === objectiveId ? { ...m, objectiveId: undefined } : m
      ));
    } else {
      setLinkedObjectiveIds(prev => [...prev, objectiveId]);
    }
  };

  // Get linked objectives for metric selector
  const linkedObjectives = objectives.filter(obj => linkedObjectiveIds.includes(obj.id));

  const handleSave = async () => {
    if (!title.trim() || saving) return;

    // Combine title and description for content field (backwards compat)
    const fullContent = description ? `${title}\n${description}` : title;

    // Determine status
    const hasMetrics = successMetrics.some(m => m.signal.trim() && m.target.trim());
    const hasLinkedObjectives = linkedObjectiveIds.length > 0;

    const status = hasMetrics && hasLinkedObjectives ? 'complete' : 'draft';

    await onSave(fullContent, status, linkedObjectiveIds, successMetrics);
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
    <div className="space-y-4 bg-ds-teal border-l-4 border-l-luna rounded-lg shadow-md p-6">
      {/* Title */}
      <div>
        <label className="text-xs font-semibold text-ds-neon uppercase tracking-wide">
          Initiative Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Improve first-session value delivery"
          className="mt-1 bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
          disabled={saving}
        />
      </div>

      {/* Objective linking - simple checkboxes */}
      {objectives.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-ds-neon uppercase tracking-wide">
            Supports Objectives
          </label>
          <div className="mt-2 space-y-1">
            {objectives.map(obj => (
              <label
                key={obj.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-white/10 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isObjectiveLinked(obj.id)}
                  onChange={() => toggleObjective(obj.id)}
                  className="h-4 w-4 rounded border-white/50 bg-white text-ds-teal focus:ring-luna"
                  disabled={saving}
                />
                <span className="text-sm text-white">{getObjectiveTitle(obj)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="text-xs font-semibold text-ds-neon uppercase tracking-wide">
          Description
        </label>
        <textarea
          ref={textareaRef}
          value={description}
          onChange={handleDescriptionChange}
          onBlur={handleBlur}
          placeholder="What are we doing and why?"
          className="mt-1 w-full min-h-[60px] p-3 bg-white border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-luna-dark text-sm"
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

      {/* Success Metrics */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-ds-neon uppercase tracking-wide">
            Success Metrics
          </label>
          {successMetrics.length < 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddMetric}
              className="h-7 text-xs text-white hover:bg-white/10 hover:text-white"
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
              linkedObjectives={linkedObjectives}
              darkMode
            />
          ))}
          {successMetrics.length === 0 && (
            <button
              onClick={handleAddMetric}
              className="w-full py-3 border border-dashed border-white/30 rounded-lg text-sm text-white/70 hover:text-white hover:border-white/50 transition-colors"
            >
              + Add success metric
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-white/20">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="px-4 py-2 text-sm bg-ds-neon text-ds-teal rounded-lg hover:bg-ds-neon/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
