'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import type { Objective, KeyResult } from '@/lib/types';
import { getObjectiveTitle } from '@/lib/utils';
import { isLegacyObjective, migrateObjectiveToOKR } from '@/lib/objective-migration';
import { KeyResultEditor } from './KeyResultEditor';

type EditingSection = 'title' | 'objective' | 'keyResults' | 'explanation' | null;

interface ObjectiveInlineEditorProps {
  objective: Objective;
  onSave: (objective: Objective) => Promise<void>;
  onCancel: () => void;
}

function generateKrId(): string {
  return `kr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyKeyResult(): KeyResult {
  return {
    id: generateKrId(),
    belief: { action: '', outcome: '' },
    signal: '',
    baseline: '',
    target: '',
    timeframe: '6M',
  };
}

export function ObjectiveInlineEditor({ objective: initialObjective, onSave, onCancel }: ObjectiveInlineEditorProps) {
  // Migrate legacy objective if needed
  const [objective] = useState<Objective>(() => {
    if (isLegacyObjective(initialObjective)) {
      return migrateObjectiveToOKR(initialObjective);
    }
    // Ensure keyResults exists
    return {
      ...initialObjective,
      objective: initialObjective.objective || initialObjective.pithy || '',
      keyResults: initialObjective.keyResults?.length ? initialObjective.keyResults : [createEmptyKeyResult()],
    };
  });

  // State for all fields
  const [title, setTitle] = useState(objective.title || '');
  const [objectiveText, setObjectiveText] = useState(objective.objective || '');
  const [keyResults, setKeyResults] = useState<KeyResult[]>(objective.keyResults || [createEmptyKeyResult()]);
  const [explanation, setExplanation] = useState(objective.explanation);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: Objective = {
        ...objective,
        title: title.trim() || undefined,
        objective: objectiveText.trim(),
        pithy: objectiveText.trim(), // Keep for backwards compatibility
        keyResults: keyResults.filter(kr => kr.signal.trim() || kr.target.trim()),
        explanation: explanation.trim(),
        successCriteria: objective.successCriteria,
      };
      await onSave(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyResultChange = (index: number, updated: KeyResult) => {
    const newKRs = [...keyResults];
    newKRs[index] = updated;
    setKeyResults(newKRs);
  };

  const handleAddKeyResult = () => {
    if (keyResults.length < 3) {
      setKeyResults([...keyResults, createEmptyKeyResult()]);
    }
  };

  const handleRemoveKeyResult = (index: number) => {
    if (keyResults.length > 1) {
      setKeyResults(keyResults.filter((_, i) => i !== index));
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

        {/* Key Results */}
        <div className="group/section">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Key Results
            </h4>
            {keyResults.length < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddKeyResult}
                className="h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add KR
              </Button>
            )}
          </div>
          <div className="bg-amber-50/50 border-l-2 border-l-amber-200/80 pl-3 py-2 rounded-r-md mb-3">
            <p className="text-sm text-stone-500 italic">
              Define 1-3 measurable Key Results. Each is a hypothesis: we believe X will result in Y.
            </p>
          </div>
          <div className="space-y-3">
            {keyResults.map((kr, index) => (
              <KeyResultEditor
                key={kr.id}
                keyResult={kr}
                onChange={(updated) => handleKeyResultChange(index, updated)}
                onRemove={() => handleRemoveKeyResult(index)}
                canRemove={keyResults.length > 1}
              />
            ))}
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
