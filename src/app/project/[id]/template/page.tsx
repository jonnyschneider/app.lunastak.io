'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PrinciplesSection } from '@/components/PrinciplesSection';
import type { StrategyStatements, Objective, Principle } from '@/lib/types';

function generateId(): string {
  return `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function TemplateEntryPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [vision, setVision] = useState('');
  const [strategy, setStrategy] = useState('');
  const [objectives, setObjectives] = useState<Partial<Objective>[]>([
    { id: generateId(), pithy: '', metric: { summary: '', full: '', category: '' } },
  ]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'vision' | 'strategy' | 'objectives' | 'principles' | 'review'>('vision');

  const handleAddObjective = () => {
    setObjectives([
      ...objectives,
      { id: generateId(), pithy: '', metric: { summary: '', full: '', category: '' } },
    ]);
  };

  const handleUpdateObjective = (index: number, field: string, value: string) => {
    const updated = [...objectives];
    if (field === 'pithy') {
      updated[index] = { ...updated[index], pithy: value };
    } else if (field.startsWith('metric.')) {
      const metricField = field.split('.')[1];
      updated[index] = {
        ...updated[index],
        metric: { ...updated[index].metric!, [metricField]: value },
      };
    }
    setObjectives(updated);
  };

  const handleRemoveObjective = (index: number) => {
    if (objectives.length > 1) {
      setObjectives(objectives.filter((_, i) => i !== index));
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const statements: StrategyStatements = {
        vision,
        strategy,
        objectives: objectives.filter((o) => o.pithy?.trim()).map((o) => ({
          id: o.id!,
          pithy: o.pithy!,
          metric: {
            summary: o.metric?.summary || '',
            full: o.metric?.full || '',
            category: o.metric?.category || 'General',
          },
          explanation: '',
          successCriteria: '',
        })),
        opportunities: [],
        principles,
      };

      const response = await fetch(`/api/project/${projectId}/template-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const { traceId } = await response.json();
      router.push(`/strategy/${traceId}`);
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'vision':
        return vision.trim().length > 20;
      case 'strategy':
        return strategy.trim().length > 20;
      case 'objectives':
        return objectives.some((o) => o.pithy?.trim());
      case 'principles':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const steps = ['vision', 'strategy', 'objectives', 'principles', 'review'] as const;
  const currentStepIndex = steps.indexOf(step);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            {steps.map((s, i) => (
              <span
                key={s}
                className={i <= currentStepIndex ? 'text-[#0A2933] font-medium' : ''}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0A2933] transition-all"
              style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Vision step */}
        {step === 'vision' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0A2933]">What's your vision?</h1>
              <p className="text-gray-500 mt-1">
                Your aspirational future state. Where are you heading in 3+ years?
              </p>
            </div>
            <Textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              placeholder="e.g., To be the trusted partner that empowers growth-stage teams to turn ambiguity into action..."
              rows={4}
              className="text-lg"
            />
            <p className="text-xs text-gray-400">
              Tip: Be specific about who you serve and what transformation you enable.
            </p>
          </div>
        )}

        {/* Strategy step */}
        {step === 'strategy' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0A2933]">What's your strategy?</h1>
              <p className="text-gray-500 mt-1">
                Your coherent set of choices. How will you achieve the vision in 12-18 months?
              </p>
            </div>
            <Textarea
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="e.g., Focus on enterprise customers, build a partner ecosystem, invest in automation..."
              rows={4}
              className="text-lg"
            />
            <p className="text-xs text-gray-400">
              Tip: Great strategy is as much about what you won't do as what you will.
            </p>
          </div>
        )}

        {/* Objectives step */}
        {step === 'objectives' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0A2933]">What are your objectives?</h1>
              <p className="text-gray-500 mt-1">
                Measurable outcomes for the next 12-18 months. What does success look like?
              </p>
            </div>
            <div className="space-y-4">
              {objectives.map((obj, index) => (
                <div key={obj.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <Label>Objective {index + 1}</Label>
                    {objectives.length > 1 && (
                      <button
                        onClick={() => handleRemoveObjective(index)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={obj.pithy || ''}
                    onChange={(e) => handleUpdateObjective(index, 'pithy', e.target.value)}
                    placeholder="e.g., Achieve product-market fit with 100 paying customers"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={obj.metric?.summary || ''}
                      onChange={(e) => handleUpdateObjective(index, 'metric.summary', e.target.value)}
                      placeholder="Metric (e.g., 100 customers)"
                      className="px-3 py-2 border rounded text-sm"
                    />
                    <input
                      type="text"
                      value={obj.metric?.category || ''}
                      onChange={(e) => handleUpdateObjective(index, 'metric.category', e.target.value)}
                      placeholder="Category (e.g., Growth)"
                      className="px-3 py-2 border rounded text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={handleAddObjective} className="w-full">
              + Add another objective
            </Button>
          </div>
        )}

        {/* Principles step */}
        {step === 'principles' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0A2933]">What are your principles?</h1>
              <p className="text-gray-500 mt-1">
                Trade-offs that guide decisions. What do you prioritize "even over" alternatives?
              </p>
            </div>
            <PrinciplesSection
              projectId={projectId}
              initialPrinciples={principles}
              onUpdate={setPrinciples}
            />
            <p className="text-xs text-gray-400">
              Tip: Good principles address real tensions. "Quality over speed" only matters if you sometimes sacrifice quality for speed.
            </p>
          </div>
        )}

        {/* Review step */}
        {step === 'review' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-[#0A2933]">Review your Decision Stack</h1>
              <p className="text-gray-500 mt-1">
                Here's what you've defined. You can always edit these later.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-sm text-gray-500 mb-1">Vision</h3>
                <p>{vision}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-sm text-gray-500 mb-1">Strategy</h3>
                <p>{strategy}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-sm text-gray-500 mb-1">Objectives</h3>
                <ul className="list-disc list-inside space-y-1">
                  {objectives.filter((o) => o.pithy?.trim()).map((obj) => (
                    <li key={obj.id}>{obj.pithy}</li>
                  ))}
                </ul>
              </div>
              {principles.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-sm text-gray-500 mb-1">Principles</h3>
                  <ul className="space-y-1">
                    {principles.map((p) => (
                      <li key={p.id}>
                        <strong>{p.priority}</strong> even over {p.deprioritized}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => setStep(steps[currentStepIndex - 1])}
            disabled={currentStepIndex === 0}
          >
            Back
          </Button>
          {step === 'review' ? (
            <Button onClick={handleComplete} disabled={saving}>
              {saving ? 'Saving...' : 'Complete & View Strategy'}
            </Button>
          ) : (
            <Button
              onClick={() => setStep(steps[currentStepIndex + 1])}
              disabled={!canProceed()}
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
