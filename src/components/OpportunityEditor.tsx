'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { getStatsigClient, logAndFlush } from '@/components/StatsigProvider';
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
  compact?: boolean;
  onImproveWithAI?: () => void;
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
  compact = false,
  onImproveWithAI,
}: OpportunityEditorProps) {
  const parsed = parseOpportunityContent(initialContent);
  const [title, setTitle] = useState(parsed.title);
  const [description, setDescription] = useState(parsed.details);
  const [linkedObjectiveIds, setLinkedObjectiveIds] = useState<string[]>(initialObjectiveIds);
  const [successMetrics, setSuccessMetrics] = useState<SuccessMetric[]>(initialSuccessMetrics);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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


  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    const newContent = title ? `${title}\n${newDescription}` : newDescription;
    contentRef.current = newContent;
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


  return (
    <div className="space-y-4 bg-white border rounded-lg shadow-lg p-6">
      {/* Title */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            Initiative Title
          </label>
          {onImproveWithAI && (
            <button
              onClick={onImproveWithAI}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Improve with AI
            </button>
          )}
        </div>
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
          <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            Supports Objectives
          </label>
          <div className="mt-2 space-y-1">
            {objectives.map(obj => (
              <label
                key={obj.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isObjectiveLinked(obj.id)}
                  onChange={() => toggleObjective(obj.id)}
                  className="h-4 w-4 rounded border-gray-300 bg-white text-ds-teal focus:ring-luna"
                  disabled={saving}
                />
                <span className="text-sm text-gray-900">{getObjectiveTitle(obj)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
          Description
        </label>
        <textarea
          ref={textareaRef}
          value={description}
          onChange={handleDescriptionChange}
          placeholder="What are we doing and why?"
          className="mt-1 w-full min-h-[60px] p-3 bg-white border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-luna-dark text-sm"
          disabled={saving}
        />
      </div>

      {/* Coaching removed — replaced by Pro "Improve with AI" fake door */}

      {/* Success Metrics */}
      {!compact && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
              Success Metrics
            </label>
            {successMetrics.length === 0 && (
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
            {successMetrics.length >= 1 && successMetrics.length < 3 && onImproveWithAI && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logAndFlush('fake_door_click', 'Additional Metrics (Pro)')
                  onImproveWithAI()
                }}
                className="h-7 text-xs text-muted-foreground"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Metric
                <Sparkles className="w-3 h-3 ml-1" />
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
              />
            ))}
            {successMetrics.length === 0 && (
              <button
                onClick={handleAddMetric}
                className="w-full py-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
              >
                + Add success metric
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!title.trim() || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

    </div>
  );
}
