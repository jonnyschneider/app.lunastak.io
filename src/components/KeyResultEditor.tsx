'use client';

import { KeyResult } from '@/lib/types';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface KeyResultEditorProps {
  keyResult: KeyResult;
  onChange: (updated: KeyResult) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function KeyResultEditor({
  keyResult,
  onChange,
  onRemove,
  canRemove
}: KeyResultEditorProps) {
  const update = (field: string, value: string) => {
    if (field.startsWith('belief.')) {
      const beliefField = field.split('.')[1] as 'action' | 'outcome';
      onChange({
        ...keyResult,
        belief: { ...keyResult.belief, [beliefField]: value },
      });
    } else {
      onChange({ ...keyResult, [field]: value });
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      {/* Belief line */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">We believe</span>
        <Input
          value={keyResult.belief.action}
          onChange={(e) => update('belief.action', e.target.value)}
          placeholder="[verb]"
          className="w-48 h-8 text-sm"
        />
        <span className="text-muted-foreground">will</span>
        <Input
          value={keyResult.belief.outcome}
          onChange={(e) => update('belief.outcome', e.target.value)}
          placeholder="[outcome]"
          className="w-48 h-8 text-sm"
        />
      </div>

      {/* Signal line */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">and we'll know it's working when we observe</span>
        <Input
          value={keyResult.signal}
          onChange={(e) => update('signal', e.target.value)}
          placeholder="[measurable metric]"
          className="w-48 h-8 text-sm"
        />
      </div>

      {/* Target line */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">move from</span>
        <Input
          value={keyResult.baseline}
          onChange={(e) => update('baseline', e.target.value)}
          placeholder="[from]"
          className="w-20 h-8 text-sm"
        />
        <span className="text-muted-foreground">to</span>
        <Input
          value={keyResult.target}
          onChange={(e) => update('target', e.target.value)}
          placeholder="[to]"
          className="w-20 h-8 text-sm"
        />
        <span className="text-muted-foreground">by</span>
        <Select
          value={keyResult.timeframe}
          onValueChange={(v) => update('timeframe', v)}
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
