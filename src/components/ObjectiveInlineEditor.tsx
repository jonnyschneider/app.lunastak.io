'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Objective, PrimaryMetric } from '@/lib/types';
import { getObjectiveTitle } from '@/lib/utils';
import { normalizeToOMTM } from '@/lib/objective-omtm-migration';

type EditingSection = 'title' | 'objective' | 'primaryMetric' | 'explanation' | null;

interface ObjectiveInlineEditorProps {
  objective: Objective;
  onSave: (objective: Objective) => Promise<void>;
  onCancel: () => void;
}

function createEmptyPrimaryMetric(): PrimaryMetric {
  return {
    name: '',
    baseline: '',
    target: '',
    timeframe: '6M',
    direction: 'increase',
  };
}

export function ObjectiveInlineEditor({ objective: initialObjective, onSave, onCancel }: ObjectiveInlineEditorProps) {
  // Normalize to OMTM format
  const normalized = normalizeToOMTM(initialObjective);

  // State for all fields
  const [title, setTitle] = useState(normalized.title || '');
  const [objectiveText, setObjectiveText] = useState(normalized.objective || normalized.pithy || '');
  const [primaryMetric, setPrimaryMetric] = useState<PrimaryMetric>(
    normalized.primaryMetric || createEmptyPrimaryMetric()
  );
  const [supportingMetrics, setSupportingMetrics] = useState<string[]>(
    normalized.supportingMetrics || []
  );
  const [explanation, setExplanation] = useState(normalized.explanation);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: Objective = {
        ...initialObjective,
        title: title.trim() || undefined,
        explanation: explanation.trim(),
        primaryMetric: primaryMetric.name.trim() ? primaryMetric : undefined,
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
    <Card className="border-2 border-primary">
      <CardContent className="p-6 space-y-6">
        {/* Header: Title */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Title (for lists)
          </h4>
          {editingSection === 'title' ? (
            <div className="space-y-2">
              <div className="bg-amber-50/50 border-l-2 border-l-amber-200/80 pl-3 py-2 rounded-r-md">
                <p className="text-sm text-stone-500 italic">
                  Used in objective lists and when linking initiatives.
                </p>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title (3-5 words)"
                className="text-sm"
                autoFocus
              />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingSection('title')}
              className="cursor-pointer p-2 -m-2 rounded hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-semibold">
                {title || getObjectiveTitle({ title, objective: objectiveText, pithy: objectiveText })}
              </span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover/section:opacity-100 ml-2">
                (click to edit)
              </span>
            </div>
          )}
        </div>

        {/* Objective Statement */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Objective
          </h4>
          {editingSection === 'objective' ? (
            <div className="space-y-2">
              <div className="bg-amber-50/50 border-l-2 border-l-amber-200/80 pl-3 py-2 rounded-r-md">
                <p className="text-sm text-stone-500 italic">
                  Start with a verb. What measurable outcome are you trying to achieve?
                </p>
              </div>
              <Textarea
                value={objectiveText}
                onChange={(e) => setObjectiveText(e.target.value)}
                placeholder="What are we trying to achieve?"
                rows={2}
                className="text-base"
                autoFocus
              />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingSection('objective')}
              className="cursor-pointer p-2 -m-2 rounded hover:bg-muted/50 transition-colors"
            >
              <p className="text-base font-medium text-foreground leading-relaxed">
                {objectiveText || 'Click to add objective description...'}
              </p>
              <span className="text-xs text-muted-foreground opacity-0 group-hover/section:opacity-100 ml-2">
                (click to edit)
              </span>
            </div>
          )}
        </div>

        <hr className="border-muted" />

        {/* Primary Metric (OMTM) */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            One Metric That Matters
          </h4>
          <div className="bg-amber-50/50 border-l-2 border-l-amber-200/80 pl-3 py-2 rounded-r-md mb-3">
            <p className="text-sm text-stone-500 italic">
              What single metric best measures progress toward this objective?
            </p>
          </div>
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            {/* Metric Name */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">We'll measure</span>
              <Input
                value={primaryMetric.name}
                onChange={(e) => setPrimaryMetric(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Weekly Active Users"
                className="w-48 h-8 text-sm"
              />
            </div>

            {/* Target line */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">moving from</span>
              <Input
                value={primaryMetric.baseline}
                onChange={(e) => setPrimaryMetric(prev => ({ ...prev, baseline: e.target.value }))}
                placeholder="12%"
                className="w-20 h-8 text-sm"
              />
              <Select
                value={primaryMetric.direction}
                onValueChange={(v) => setPrimaryMetric(prev => ({ ...prev, direction: v as 'increase' | 'decrease' }))}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">↑ to</SelectItem>
                  <SelectItem value="decrease">↓ to</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={primaryMetric.target}
                onChange={(e) => setPrimaryMetric(prev => ({ ...prev, target: e.target.value }))}
                placeholder="40%"
                className="w-20 h-8 text-sm"
              />
              <span className="text-muted-foreground">by</span>
              <Select
                value={primaryMetric.timeframe}
                onValueChange={(v) => setPrimaryMetric(prev => ({ ...prev, timeframe: v as PrimaryMetric['timeframe'] }))}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3M">3 months</SelectItem>
                  <SelectItem value="6M">6 months</SelectItem>
                  <SelectItem value="9M">9 months</SelectItem>
                  <SelectItem value="12M">12 months</SelectItem>
                  <SelectItem value="18M">18 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <hr className="border-muted" />

        {/* Why It Matters */}
        <div className="group/section">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Why It Matters
          </h4>
          {editingSection === 'explanation' ? (
            <div className="space-y-2">
              <div className="bg-amber-50/50 border-l-2 border-l-amber-200/80 pl-3 py-2 rounded-r-md">
                <p className="text-sm text-stone-500 italic">
                  Connect to your strategy. Why is this objective important now?
                </p>
              </div>
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain why this objective is important"
                rows={3}
                className="text-sm"
                autoFocus
              />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingSection('explanation')}
              className="cursor-pointer p-2 -m-2 rounded hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm text-muted-foreground leading-relaxed">
                {explanation || 'Click to explain why this objective matters...'}
              </p>
              <span className="text-xs text-muted-foreground opacity-0 group-hover/section:opacity-100 ml-2">
                (click to edit)
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
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
