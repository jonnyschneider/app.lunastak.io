'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ArrowUpDown, Trash2 } from 'lucide-react';
import { FlipCard } from './FlipCard';
import type { Principle } from '@/lib/types';

interface PrinciplesSectionProps {
  projectId: string;
  initialPrinciples?: Principle[];
  onUpdate?: (principles: Principle[]) => void;
  // Global edit state
  editingCard?: { type: string; id?: string } | null;
  onStartEditing?: (id: string) => void;
  onStopEditing?: () => void;
}

type InputStep = 'priority' | 'loading' | 'confirm';

function generateId(): string {
  return `prin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function fetchSuggestedOpposite(priority: string): Promise<string> {
  try {
    const response = await fetch('/api/suggest-opposite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });

    if (!response.ok) throw new Error('Failed to fetch');

    const data = await response.json();
    return data.opposite || '';
  } catch (error) {
    console.error('Failed to get suggestion:', error);
    return '';
  }
}

const HINT_EXAMPLES = [
  'Speed vs. thoroughness',
  'New customers vs. retention',
  'Revenue vs. profitability',
  'Innovation vs. stability',
  'Autonomy vs. alignment',
];

// Inline edit form for a principle
function PrincipleEditForm({
  principle,
  onSave,
  onCancel,
  onDelete,
  onFlip,
  saving,
}: {
  principle: Principle;
  onSave: (updated: Principle) => void;
  onCancel: () => void;
  onDelete: () => void;
  onFlip: () => void;
  saving: boolean;
}) {
  const [priority, setPriority] = useState(principle.priority);
  const [deprioritized, setDeprioritized] = useState(principle.deprioritized);
  const [context, setContext] = useState(principle.context || '');

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg border space-y-4">
      <h3 className="text-xs font-semibold text-ds-teal uppercase tracking-wide">
        Edit Principle
      </h3>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Priority</label>
        <Input value={priority} onChange={(e) => setPriority(e.target.value)} />
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-gray-400 font-semibold uppercase">even over</span>
        <button
          onClick={onFlip}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Swap priority and deprioritized"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Deprioritized</label>
        <Input value={deprioritized} onChange={(e) => setDeprioritized(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Context (optional)</label>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={3}
          placeholder="Why this trade-off matters right now..."
        />
      </div>
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onDelete}
          disabled={saving}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button
            onClick={() => onSave({
              ...principle,
              priority: priority.trim(),
              deprioritized: deprioritized.trim(),
              context: context.trim() || undefined,
            })}
            disabled={!priority.trim() || !deprioritized.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PrinciplesSection({
  projectId,
  initialPrinciples = [],
  onUpdate,
  editingCard,
  onStartEditing,
  onStopEditing,
}: PrinciplesSectionProps) {
  const [principles, setPrinciples] = useState<Principle[]>(initialPrinciples);
  const [saving, setSaving] = useState(false);

  // Socratic input state
  const [step, setStep] = useState<InputStep>('priority');
  const [priorityInput, setPriorityInput] = useState('');
  const [deprioritizedInput, setDeprioritizedInput] = useState('');
  const [showHints, setShowHints] = useState(false);

  const editingPrincipleId = editingCard?.type === 'principle' ? (editingCard.id ?? null) : null;

  const handlePrioritySubmit = async () => {
    if (!priorityInput.trim()) return;
    onStartEditing?.('new');
    setStep('loading');
    const suggested = await fetchSuggestedOpposite(priorityInput);
    setDeprioritizedInput(suggested);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!priorityInput.trim() || !deprioritizedInput.trim()) return;

    const newPrinciple: Principle = {
      id: generateId(),
      priority: priorityInput.trim(),
      deprioritized: deprioritizedInput.trim(),
    };

    setSaving(true);
    try {
      const response = await fetch(`/api/project/${projectId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'principle',
          content: JSON.stringify(newPrinciple),
          status: 'complete',
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const updated = [...principles, newPrinciple];
      setPrinciples(updated);
      onUpdate?.(updated);

      // Reset for next principle
      setPriorityInput('');
      setDeprioritizedInput('');
      setStep('priority');
      onStopEditing?.();
    } catch (error) {
      console.error('Failed to add principle:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setStep('priority');
    onStopEditing?.();
  };

  const handleRemove = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/project/${projectId}/content?id=${id}`, {
        method: 'DELETE',
      });

      const updated = principles.filter((p) => p.id !== id);
      setPrinciples(updated);
      onUpdate?.(updated);
      onStopEditing?.();
    } catch (error) {
      console.error('Failed to remove principle:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFlip = async (id: string) => {
    const principle = principles.find((p) => p.id === id);
    if (!principle) return;

    const flipped: Principle = {
      ...principle,
      priority: principle.deprioritized,
      deprioritized: principle.priority,
    };

    setSaving(true);
    try {
      await fetch(`/api/project/${projectId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          content: JSON.stringify(flipped),
        }),
      });

      const updated = principles.map((p) => (p.id === id ? flipped : p));
      setPrinciples(updated);
      onUpdate?.(updated);
    } catch (error) {
      console.error('Failed to flip principle:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrinciple = async (updated: Principle) => {
    setSaving(true);
    try {
      await fetch(`/api/project/${projectId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated.id,
          content: JSON.stringify(updated),
        }),
      });

      const updatedList = principles.map((p) => (p.id === updated.id ? updated : p));
      setPrinciples(updatedList);
      onUpdate?.(updatedList);
      onStopEditing?.();
    } catch (error) {
      console.error('Failed to save principle:', error);
    } finally {
      setSaving(false);
    }
  };

  const atMaxPrinciples = principles.length >= 6;

  return (
    <div className="space-y-6">
      {/* Selected principles - grid layout */}
      {principles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">Your principles</h4>
            <p className="text-xs text-muted-foreground">
              {principles.length}/6
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {principles.map((principle) => {
              const isEditingThis = editingPrincipleId === principle.id;
              return (
                <div key={principle.id} className={isEditingThis ? 'col-span-full' : ''}>
                  <FlipCard
                    front={
                      <div className="bg-ds-teal rounded-lg p-4 shadow-sm min-h-[120px] flex items-center justify-center">
                        <div className="text-center space-y-1.5">
                          <p className="text-[13px] font-semibold text-ds-neon">{principle.priority}</p>
                          <p className="text-[13px] font-semibold uppercase tracking-wider text-white/50">even over</p>
                          <p className="text-[13px] text-white/70">{principle.deprioritized}</p>
                        </div>
                      </div>
                    }
                    back={
                      <div className="bg-ds-teal rounded-lg p-4 shadow-sm min-h-[120px]">
                        <div className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-ds-neon text-ds-teal rounded mb-2">
                          Explainer
                        </div>
                        {principle.context ? (
                          <p className="text-[13px] text-white/70 leading-relaxed">{principle.context}</p>
                        ) : (
                          <p className="text-[13px] text-white/40 italic">No context yet</p>
                        )}
                      </div>
                    }
                    isEditing={isEditingThis}
                    onEditClick={() => onStartEditing?.(principle.id)}
                    editForm={
                      <PrincipleEditForm
                        principle={principle}
                        onSave={handleSavePrinciple}
                        onCancel={() => onStopEditing?.()}
                        onDelete={() => handleRemove(principle.id)}
                        onFlip={() => handleFlip(principle.id)}
                        saving={saving}
                      />
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Socratic input */}
      {!atMaxPrinciples && (
        <div className="space-y-4">
          {step === 'priority' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                What matters most for success and is least negotiable right now?
              </label>
              <div className="flex gap-2">
                <Input
                  value={priorityInput}
                  onChange={(e) => setPriorityInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePrioritySubmit()}
                  placeholder="Type what matters most..."
                  className="flex-1 bg-white"
                  disabled={saving}
                />
                <Button
                  onClick={handlePrioritySubmit}
                  disabled={!priorityInput.trim() || saving}
                >
                  Next
                </Button>
              </div>

              {/* Collapsible hints */}
              <div>
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showHints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showHints ? 'Hide examples' : 'Need inspiration?'}
                </button>
                {showHints && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Common trade-offs: {HINT_EXAMPLES.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'loading' && (
            <div className="p-4 bg-white rounded-lg border">
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-ds-teal">{priorityInput}</p>
                <p className="text-xs text-ds-teal/50">even over</p>
                <p className="text-sm text-ds-teal/50 animate-pulse">Thinking of the opposite...</p>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg border space-y-3">
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-ds-teal">{priorityInput}</p>
                  <p className="text-xs text-ds-teal/50">even over</p>
                  <Input
                    value={deprioritizedInput}
                    onChange={(e) => setDeprioritizedInput(e.target.value)}
                    placeholder="What's the trade-off? What gets deprioritized?"
                    className="text-center text-sm"
                    disabled={saving}
                  />
                </div>
                {!deprioritizedInput && (
                  <p className="text-xs text-ds-teal/50 text-center">
                    What's the mutually exclusive opposite? What might you sacrifice?
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={handleBack} disabled={saving}>
                  Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!deprioritizedInput.trim() || saving}
                >
                  {saving ? 'Saving...' : 'Add Principle'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
