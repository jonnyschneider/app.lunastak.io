'use client';

import { useState } from 'react';
import { PrincipleChip } from './PrincipleChip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Principle } from '@/lib/types';

interface PrinciplesSectionProps {
  projectId: string;
  initialPrinciples?: Principle[];
  onUpdate?: (principles: Principle[]) => void;
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

export function PrinciplesSection({
  projectId,
  initialPrinciples = [],
  onUpdate,
}: PrinciplesSectionProps) {
  const [principles, setPrinciples] = useState<Principle[]>(initialPrinciples);
  const [saving, setSaving] = useState(false);

  // Socratic input state
  const [step, setStep] = useState<InputStep>('priority');
  const [priorityInput, setPriorityInput] = useState('');
  const [deprioritizedInput, setDeprioritizedInput] = useState('');
  const [showHints, setShowHints] = useState(false);

  const handlePrioritySubmit = async () => {
    if (!priorityInput.trim()) return;

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
    } catch (error) {
      console.error('Failed to add principle:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setStep('priority');
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

  const atMaxPrinciples = principles.length >= 6;

  return (
    <div className="space-y-6">
      {/* Selected principles - grid layout */}
      {principles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Your principles</h4>
            <p className="text-xs text-white/50">
              {principles.length}/6
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {principles.map((principle) => (
              <PrincipleChip
                key={principle.id}
                principle={principle}
                onRemove={() => handleRemove(principle.id)}
                onFlip={() => handleFlip(principle.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Socratic input */}
      {!atMaxPrinciples && (
        <div className="space-y-4">
          {step === 'priority' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-white">
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
                  className="bg-ds-neon text-ds-teal hover:bg-ds-neon/90"
                >
                  Next
                </Button>
              </div>

              {/* Collapsible hints */}
              <div>
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70"
                >
                  {showHints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showHints ? 'Hide examples' : 'Need inspiration?'}
                </button>
                {showHints && (
                  <p className="mt-2 text-xs text-white/50">
                    Common trade-offs: {HINT_EXAMPLES.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'loading' && (
            <div className="p-4 bg-white rounded-lg">
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-ds-teal">{priorityInput}</p>
                <p className="text-xs text-ds-teal/50">even over</p>
                <p className="text-sm text-ds-teal/50 animate-pulse">Thinking of the opposite...</p>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg space-y-3">
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
                <Button variant="ghost" onClick={handleBack} disabled={saving} className="text-white hover:bg-white/10 hover:text-white">
                  Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!deprioritizedInput.trim() || saving}
                  className="bg-ds-neon text-ds-teal hover:bg-ds-neon/90"
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
