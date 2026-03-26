'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { Objective } from '@/lib/types';
import { getObjectiveTitle } from '@/lib/utils';
import { normalizeToOMTM } from '@/lib/objective-omtm-migration';

interface ObjectiveInlineEditorProps {
  objective: Objective;
  onSave: (objective: Objective) => Promise<void>;
  onCancel: () => void;
}

export function ObjectiveInlineEditor({ objective: initialObjective, onSave, onCancel }: ObjectiveInlineEditorProps) {
  // Normalize to simplified OMTM format
  const normalized = normalizeToOMTM(initialObjective);

  // State for all fields
  const [title, setTitle] = useState(normalized.title || '');
  const [objectiveText, setObjectiveText] = useState(normalized.objective || normalized.pithy || '');
  const [omtm, setOmtm] = useState(normalized.omtm || normalized.primaryMetric?.name || '');
  const [aspiration, setAspiration] = useState(normalized.aspiration || '');
  const [supportingMetrics, setSupportingMetrics] = useState<string[]>(normalized.supportingMetrics || []);
  const [newSupportingMetric, setNewSupportingMetric] = useState('');
  const [explanation, setExplanation] = useState(normalized.explanation);
  const [saving, setSaving] = useState(false);

  const handleAddSupportingMetric = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSupportingMetric.trim()) {
      e.preventDefault();
      setSupportingMetrics([...supportingMetrics, newSupportingMetric.trim()]);
      setNewSupportingMetric('');
    }
  };

  const handleRemoveSupportingMetric = (index: number) => {
    setSupportingMetrics(supportingMetrics.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: Objective = {
        ...initialObjective,
        title: title.trim() || undefined,
        explanation: explanation.trim(),
        omtm: omtm.trim() || undefined,
        aspiration: aspiration.trim() || undefined,
        supportingMetrics: supportingMetrics.filter(m => m.trim()),
        objective: objectiveText.trim(),
        pithy: objectiveText.trim(),
      };
      await onSave(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-white border shadow-lg">
      <CardContent className="p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short title (3-5 words)"
            className="bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">Used in objective lists and when linking initiatives.</p>
        </div>

        {/* Objective Statement */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Objective
          </label>
          <Textarea
            value={objectiveText}
            onChange={(e) => setObjectiveText(e.target.value)}
            placeholder="What are we trying to achieve?"
            rows={2}
            className="bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
          />
          <p className="text-xs text-gray-400 mt-1">Describe the state you want to be true. Ambitious enough to persist across quarters.</p>
        </div>

        <hr className="border-gray-200" />

        {/* OMTM */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            One Metric That Matters
          </h4>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Metric Name
            </label>
            <Input
              value={omtm}
              onChange={(e) => setOmtm(e.target.value)}
              placeholder="e.g., Weekly Active Users, Net Promoter Score, Revenue"
              className="bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Aspiration (optional)
            </label>
            <Input
              value={aspiration}
              onChange={(e) => setAspiration(e.target.value)}
              placeholder="e.g., 40% increase, Significant growth, Industry-leading"
              className="bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
            />
          </div>
        </div>

        {/* Supporting Metrics */}
        <div>
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-2">
            Supporting Metrics (optional)
          </h4>
          <p className="text-xs text-gray-400 mb-3">Other metrics you'll watch, but the OMTM is the main focus.</p>
          {supportingMetrics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {supportingMetrics.map((metric, i) => (
                <Badge key={i} variant="secondary" className="flex items-center gap-1 pr-1 rounded-full border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200">
                  {metric}
                  <button
                    onClick={() => handleRemoveSupportingMetric(i)}
                    className="p-0.5 hover:bg-gray-300 rounded"
                    aria-label={`Remove ${metric}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newSupportingMetric}
              onChange={(e) => setNewSupportingMetric(e.target.value)}
              onKeyDown={handleAddSupportingMetric}
              placeholder="Add a supporting metric"
              className="text-sm flex-1 bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (newSupportingMetric.trim()) {
                  setSupportingMetrics([...supportingMetrics, newSupportingMetric.trim()]);
                  setNewSupportingMetric('');
                }
              }}
              disabled={!newSupportingMetric.trim()}
            >
              Add
            </Button>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Why It Matters */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Why It Matters
          </label>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Connect to your strategy. Why is this objective important now?"
            rows={3}
            className="bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !objectiveText.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
