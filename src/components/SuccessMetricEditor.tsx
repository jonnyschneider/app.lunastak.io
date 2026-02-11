'use client';

import { SuccessMetric } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface SuccessMetricEditorProps {
  metric: SuccessMetric;
  onChange: (updated: SuccessMetric) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function SuccessMetricEditor({
  metric,
  onChange,
  onRemove,
  canRemove,
}: SuccessMetricEditorProps) {
  const update = (field: string, value: string) => {
    if (field.startsWith('belief.')) {
      const beliefField = field.split('.')[1] as 'action' | 'outcome';
      onChange({
        ...metric,
        belief: { ...metric.belief, [beliefField]: value },
      });
    } else {
      onChange({ ...metric, [field]: value });
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      {/* Belief line */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">We believe</span>
        <Input
          value={metric.belief.action}
          onChange={(e) => update('belief.action', e.target.value)}
          placeholder="showing insights in first 3 min"
          className="w-56 h-8 text-sm"
        />
        <span className="text-muted-foreground">will</span>
        <Input
          value={metric.belief.outcome}
          onChange={(e) => update('belief.outcome', e.target.value)}
          placeholder="increase session 2 return rate"
          className="w-56 h-8 text-sm"
        />
      </div>

      {/* Signal line */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">and we'll know when</span>
        <Input
          value={metric.signal}
          onChange={(e) => update('signal', e.target.value)}
          placeholder="S1→S2 conversion"
          className="w-40 h-8 text-sm"
        />
        <span className="text-muted-foreground">moves from</span>
        <Input
          value={metric.baseline}
          onChange={(e) => update('baseline', e.target.value)}
          placeholder="25%"
          className="w-20 h-8 text-sm"
        />
        <span className="text-muted-foreground">→</span>
        <Input
          value={metric.target}
          onChange={(e) => update('target', e.target.value)}
          placeholder="50%"
          className="w-20 h-8 text-sm"
        />

        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="ml-auto h-8 w-8"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
