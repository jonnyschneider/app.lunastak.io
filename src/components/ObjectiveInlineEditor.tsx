'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, BadgeInfo } from 'lucide-react';
import type { Objective } from '@/lib/types';
import { getObjectiveTitle } from '@/lib/utils';
import { normalizeToOMTM } from '@/lib/objective-omtm-migration';

type EditingSection = 'title' | 'objective' | 'omtm' | 'explanation' | null;

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
  const [editingSection, setEditingSection] = useState<EditingSection>(null);

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
        // New simplified OMTM fields
        omtm: omtm.trim() || undefined,
        aspiration: aspiration.trim() || undefined,
        supportingMetrics: supportingMetrics.filter(m => m.trim()),
        // Keep legacy fields for backwards compat
        objective: objectiveText.trim(),
        pithy: objectiveText.trim(),
      };
      await onSave(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-ds-teal border-l-4 border-l-luna shadow-md">
      <CardContent className="p-6 space-y-6">
        {/* Header: Title */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">
            Title (for lists)
          </h4>
          {editingSection === 'title' ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 mb-2">
                <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
                <p className="text-sm text-white/90 italic">
                  Used in objective lists and when linking initiatives.
                </p>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title (3-5 words)"
                className="text-sm bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
                autoFocus
              />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)} className="text-white hover:bg-white/10 hover:text-white">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingSection('title')}
              className="cursor-pointer p-2 -m-2 rounded hover:bg-white/10 transition-colors"
            >
              <span className="text-sm font-semibold text-white">
                {title || getObjectiveTitle({ title, objective: objectiveText, pithy: objectiveText })}
              </span>
              <span className="text-xs text-white/50 opacity-0 group-hover/section:opacity-100 ml-2">
                (click to edit)
              </span>
            </div>
          )}
        </div>

        {/* Objective Statement */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">
            Objective
          </h4>
          {editingSection === 'objective' ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 mb-2">
                <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
                <p className="text-sm text-white/90 italic">
                  Start with a verb. What measurable outcome are you trying to achieve?
                </p>
              </div>
              <Textarea
                value={objectiveText}
                onChange={(e) => setObjectiveText(e.target.value)}
                placeholder="What are we trying to achieve?"
                rows={2}
                className="text-base bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
                autoFocus
              />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)} className="text-white hover:bg-white/10 hover:text-white">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingSection('objective')}
              className="cursor-pointer p-2 -m-2 rounded hover:bg-white/10 transition-colors"
            >
              <p className="text-base font-medium text-white leading-relaxed">
                {objectiveText || 'Click to add objective description...'}
              </p>
              <span className="text-xs text-white/50 opacity-0 group-hover/section:opacity-100 ml-2">
                (click to edit)
              </span>
            </div>
          )}
        </div>

        <hr className="border-white/20" />

        {/* OMTM - simplified */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">
            One Metric That Matters
          </h4>
          <div className="flex items-start gap-2 mb-3">
            <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
            <p className="text-sm text-white/90 italic">
              What single metric best represents success for this objective?
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-white mb-1 block">
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
              <label className="text-xs font-medium text-white mb-1 block">
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
        </div>

        {/* Supporting Metrics */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">
            Supporting Metrics (optional)
          </h4>
          <div className="flex items-start gap-2 mb-3">
            <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
            <p className="text-sm text-white/90 italic">
              Other metrics you'll watch, but the OMTM is the main focus.
            </p>
          </div>
          {supportingMetrics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {supportingMetrics.map((metric, i) => (
                <Badge key={i} variant="secondary" className="flex items-center gap-1 pr-1 rounded-full border border-white bg-[#D5E8EC] text-ds-teal hover:bg-[#C5DDE3]">
                  {metric}
                  <button
                    onClick={() => handleRemoveSupportingMetric(i)}
                    className="p-0.5 hover:bg-ds-teal/10 rounded"
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
              className="bg-ds-neon text-ds-teal hover:bg-ds-neon/90 disabled:bg-white/20 disabled:text-white/50"
            >
              Add
            </Button>
          </div>
        </div>

        <hr className="border-white/20" />

        {/* Why It Matters */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">
            Why It Matters
          </h4>
          {editingSection === 'explanation' ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 mb-2">
                <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
                <p className="text-sm text-white/90 italic">
                  Connect to your strategy. Why is this objective important now?
                </p>
              </div>
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain why this objective is important"
                rows={3}
                className="text-sm bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
                autoFocus
              />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)} className="text-white hover:bg-white/10 hover:text-white">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingSection('explanation')}
              className="cursor-pointer p-2 -m-2 rounded hover:bg-white/10 transition-colors"
            >
              <p className="text-sm text-white leading-relaxed">
                {explanation || 'Click to explain why this objective matters...'}
              </p>
              <span className="text-xs text-white/50 opacity-0 group-hover/section:opacity-100 ml-2">
                (click to edit)
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-white/20">
          <Button variant="ghost" onClick={onCancel} disabled={saving} className="text-white hover:bg-white/10 hover:text-white">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !objectiveText.trim()} className="bg-ds-neon text-ds-teal hover:bg-ds-neon/90">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
