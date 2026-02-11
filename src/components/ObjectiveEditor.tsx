'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Objective, ObjectiveMetric } from '@/lib/types';

interface ObjectiveEditorProps {
  objective: Objective;
  onSave: (objective: Objective) => Promise<void>;
  onCancel: () => void;
}

export function ObjectiveEditor({ objective, onSave, onCancel }: ObjectiveEditorProps) {
  const [pithy, setPithy] = useState(objective.objective || objective.pithy || '');
  const [metricSummary, setMetricSummary] = useState(objective.metric?.summary || '');
  const [metricFull, setMetricFull] = useState(objective.metric?.full || '');
  const [metricCategory, setMetricCategory] = useState(objective.metric?.category || '');
  const [direction, setDirection] = useState<'increase' | 'decrease' | undefined>(objective.metric?.direction);
  const [timeframe, setTimeframe] = useState<'3M' | '6M' | '9M' | '12M' | '18M' | undefined>(objective.metric?.timeframe);
  const [explanation, setExplanation] = useState(objective.explanation);
  const [successCriteria, setSuccessCriteria] = useState(objective.successCriteria || '');
  const [saving, setSaving] = useState(false);

  const pithyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    pithyRef.current?.focus();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedObjective: Objective = {
        ...objective,
        objective: pithy.trim(),
        pithy: pithy.trim(),
        metric: {
          summary: metricSummary.trim(),
          full: metricFull.trim(),
          category: metricCategory.trim(),
          direction,
          metricName: objective.metric?.metricName,
          metricValue: objective.metric?.metricValue,
          timeframe,
        },
        explanation: explanation.trim(),
        successCriteria: successCriteria.trim(),
      };
      await onSave(updatedObjective);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border" onKeyDown={handleKeyDown}>
      <div>
        <Label htmlFor="pithy">Objective</Label>
        <Textarea
          ref={pithyRef}
          id="pithy"
          value={pithy}
          onChange={(e) => setPithy(e.target.value)}
          placeholder="Short 1-2 sentence objective"
          rows={2}
          className="mt-1"
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="metricSummary">Metric (short)</Label>
          <Input
            id="metricSummary"
            value={metricSummary}
            onChange={(e) => setMetricSummary(e.target.value)}
            placeholder="e.g., 25%"
            className="mt-1"
            disabled={saving}
          />
        </div>
        <div>
          <Label htmlFor="timeframe">Timeframe</Label>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select..." />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={metricCategory}
            onChange={(e) => setMetricCategory(e.target.value)}
            placeholder="e.g., Revenue, Customer"
            className="mt-1"
            disabled={saving}
          />
        </div>
        <div>
          <Label htmlFor="direction">Direction</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="increase">↑ Increase</SelectItem>
              <SelectItem value="decrease">↓ Decrease</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="metricFull">Full metric description</Label>
        <Input
          id="metricFull"
          value={metricFull}
          onChange={(e) => setMetricFull(e.target.value)}
          placeholder="e.g., Increase revenue by 25% in Q1 2025"
          className="mt-1"
          disabled={saving}
        />
      </div>

      <div>
        <Label htmlFor="explanation">Why it matters</Label>
        <Textarea
          id="explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Explain why this objective is important"
          rows={2}
          className="mt-1"
          disabled={saving}
        />
      </div>

      <div>
        <Label htmlFor="successCriteria">Success criteria</Label>
        <Textarea
          id="successCriteria"
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
          placeholder="What does success look like?"
          rows={2}
          className="mt-1"
          disabled={saving}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !pithy.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
