'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Objective } from '@/lib/types';
import { getObjectiveTitle } from '@/lib/utils';

interface ObjectiveInlineEditorProps {
  objective: Objective;
  onSave: (objective: Objective) => Promise<void>;
  onCancel: () => void;
}

export function ObjectiveInlineEditor({ objective, onSave, onCancel }: ObjectiveInlineEditorProps) {
  // State for all fields
  const [title, setTitle] = useState(objective.title || '');
  const [pithy, setPithy] = useState(objective.pithy);
  const [metricSummary, setMetricSummary] = useState(objective.metric.summary);
  const [metricFull, setMetricFull] = useState(objective.metric.full);
  const [category, setCategory] = useState(objective.metric.category);
  const [direction, setDirection] = useState<'increase' | 'decrease' | undefined>(objective.metric.direction);
  const [timeframe, setTimeframe] = useState<'3M' | '6M' | '9M' | '12M' | '18M' | undefined>(objective.metric.timeframe);
  const [explanation, setExplanation] = useState(objective.explanation);
  const [successCriteria, setSuccessCriteria] = useState(objective.successCriteria);
  const [saving, setSaving] = useState(false);

  // Track which section is being edited
  const [editingSection, setEditingSection] = useState<'title' | 'pithy' | 'metric' | 'explanation' | 'success' | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: Objective = {
        ...objective,
        title: title.trim() || undefined,
        pithy: pithy.trim(),
        metric: {
          summary: metricSummary.trim(),
          full: metricFull.trim(),
          category: category.trim(),
          direction,
          metricName: objective.metric.metricName,
          metricValue: objective.metric.metricValue,
          timeframe,
        },
        explanation: explanation.trim(),
        successCriteria: successCriteria.trim(),
      };
      await onSave(updated);
    } finally {
      setSaving(false);
    }
  };

  // Editable section wrapper
  const EditableSection = ({
    section,
    label,
    children,
    displayValue,
  }: {
    section: typeof editingSection;
    label: string;
    children: React.ReactNode;
    displayValue: React.ReactNode;
  }) => (
    <div className="group/section">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </h4>
      {editingSection === section ? (
        <div className="space-y-2">
          {children}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setEditingSection(section)}
          className="cursor-pointer p-2 -m-2 rounded hover:bg-muted/50 transition-colors"
        >
          {displayValue}
          <span className="text-xs text-muted-foreground opacity-0 group-hover/section:opacity-100 ml-2">
            (click to edit)
          </span>
        </div>
      )}
    </div>
  );

  return (
    <Card className="border-2 border-primary">
      <CardContent className="p-6 space-y-6">
        {/* Header: Title + Metric */}
        <div className="flex items-start justify-between gap-4">
          {/* Title Section */}
          <div className="flex-1">
            <EditableSection
              section="title"
              label="Title (for lists)"
              displayValue={
                <span className="text-sm font-semibold">
                  {title || getObjectiveTitle({ title, pithy })}
                </span>
              }
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title (3-5 words)"
                className="text-sm"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Used in objective lists and initiative linking
              </p>
            </EditableSection>
          </div>

          {/* Metric Section */}
          <div className="text-right">
            <EditableSection
              section="metric"
              label="Metric"
              displayValue={
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-lg font-bold">
                    {direction === 'increase' ? '↑' : direction === 'decrease' ? '↓' : ''} {metricSummary || '—'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {category || 'Category'} · {timeframe || '—'}
                  </Badge>
                </div>
              }
            >
              <div className="space-y-3 text-left">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Summary</label>
                    <Input
                      value={metricSummary}
                      onChange={(e) => setMetricSummary(e.target.value)}
                      placeholder="e.g., 25%"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Direction</label>
                    <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increase">↑ Increase</SelectItem>
                        <SelectItem value="decrease">↓ Decrease</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Category</label>
                    <Input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., Revenue"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Timeframe</label>
                    <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="—" />
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
                <div>
                  <label className="text-xs text-muted-foreground">Full description</label>
                  <Input
                    value={metricFull}
                    onChange={(e) => setMetricFull(e.target.value)}
                    placeholder="e.g., Increase revenue by 25% in Q1"
                    className="text-sm"
                  />
                </div>
              </div>
            </EditableSection>
          </div>
        </div>

        {/* Pithy Objective */}
        <EditableSection
          section="pithy"
          label="Objective"
          displayValue={
            <p className="text-base font-medium text-foreground leading-relaxed">
              {pithy || 'Click to add objective description...'}
            </p>
          }
        >
          <Textarea
            value={pithy}
            onChange={(e) => setPithy(e.target.value)}
            placeholder="Short 1-2 sentence objective"
            rows={2}
            className="text-base"
            autoFocus
          />
        </EditableSection>

        <hr className="border-muted" />

        {/* Back of Card Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Explanation */}
          <EditableSection
            section="explanation"
            label="Why It Matters"
            displayValue={
              <p className="text-sm text-muted-foreground leading-relaxed">
                {explanation || 'Click to explain why this objective matters...'}
              </p>
            }
          >
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explain why this objective is important"
              rows={3}
              className="text-sm"
              autoFocus
            />
          </EditableSection>

          {/* Success Criteria */}
          <EditableSection
            section="success"
            label="Success Looks Like"
            displayValue={
              <p className="text-sm text-muted-foreground">
                {successCriteria || 'Click to describe what success looks like...'}
              </p>
            }
          >
            <Textarea
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              placeholder="What does success look like?"
              rows={3}
              className="text-sm"
              autoFocus
            />
          </EditableSection>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !pithy.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
