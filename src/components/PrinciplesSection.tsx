'use client';

import { useState } from 'react';
import { TradeoffCard } from './TradeoffCard';
import { PrincipleChip } from './PrincipleChip';
import { CURATED_TRADEOFFS, CATEGORY_LABELS, type TradeoffOption } from '@/lib/curated-tradeoffs';
import type { Principle } from '@/lib/types';

interface PrinciplesSectionProps {
  projectId: string;
  initialPrinciples?: Principle[];
  onUpdate?: (principles: Principle[]) => void;
}

function generateId(): string {
  return `prin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function PrinciplesSection({
  projectId,
  initialPrinciples = [],
  onUpdate,
}: PrinciplesSectionProps) {
  const [principles, setPrinciples] = useState<Principle[]>(initialPrinciples);
  const [selectedCategory, setSelectedCategory] = useState<TradeoffOption['category']>('growth');
  const [saving, setSaving] = useState(false);

  // Filter out already-selected trade-offs
  const usedTradeoffIds = new Set(
    principles.map((p) => {
      const match = CURATED_TRADEOFFS.find(
        (t) =>
          (t.optionA === p.priority && t.optionB === p.deprioritized) ||
          (t.optionB === p.priority && t.optionA === p.deprioritized)
      );
      return match?.id;
    }).filter(Boolean)
  );

  const availableTradeoffs = CURATED_TRADEOFFS.filter(
    (t) => t.category === selectedCategory && !usedTradeoffIds.has(t.id)
  );

  const handleAddPrinciple = async (priority: string, deprioritized: string) => {
    const newPrinciple: Principle = {
      id: generateId(),
      priority,
      deprioritized,
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
    } catch (error) {
      console.error('Failed to add principle:', error);
    } finally {
      setSaving(false);
    }
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
            <h4 className="text-sm font-medium text-gray-700">Your principles</h4>
            <p className="text-xs text-gray-400">
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

      {/* Add more */}
      {!atMaxPrinciples && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">
            {principles.length === 0 ? 'Define your principles' : 'Add another principle'}
          </h4>

          {/* Category tabs */}
          <div className="flex gap-2">
            {(Object.keys(CATEGORY_LABELS) as TradeoffOption['category'][]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#0A2933] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Trade-off cards */}
          <div className="grid gap-2">
            {availableTradeoffs.map((tradeoff) => (
              <TradeoffCard
                key={tradeoff.id}
                tradeoff={tradeoff}
                onSelect={handleAddPrinciple}
                disabled={saving}
              />
            ))}
            {availableTradeoffs.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                All {CATEGORY_LABELS[selectedCategory].toLowerCase()} trade-offs selected
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
