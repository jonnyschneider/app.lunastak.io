'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BadgeInfo } from 'lucide-react';
import { PrinciplesSection } from '@/components/PrinciplesSection';
import type { StrategyStatements, Objective, Principle } from '@/lib/types';

function generateId(): string {
  return `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface ObjectiveInput {
  id: string;
  title: string;
  objective: string;
  omtm: string;
  aspiration: string;
}

export default function TemplateEntryPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // Vision: headline + elaboration
  const [visionHeadline, setVisionHeadline] = useState('');
  const [visionElaboration, setVisionElaboration] = useState('');

  // Strategy: headline + elaboration
  const [strategyHeadline, setStrategyHeadline] = useState('');
  const [strategyElaboration, setStrategyElaboration] = useState('');

  // Objectives: title + objective + omtm + aspiration
  const [objectives, setObjectives] = useState<ObjectiveInput[]>([
    { id: generateId(), title: '', objective: '', omtm: '', aspiration: '' },
  ]);

  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'vision' | 'strategy' | 'objectives' | 'principles' | 'review'>('vision');

  const handleAddObjective = () => {
    setObjectives([
      ...objectives,
      { id: generateId(), title: '', objective: '', omtm: '', aspiration: '' },
    ]);
  };

  const handleUpdateObjective = (index: number, field: keyof ObjectiveInput, value: string) => {
    const updated = [...objectives];
    updated[index] = { ...updated[index], [field]: value };
    setObjectives(updated);
  };

  const handleRemoveObjective = (index: number) => {
    if (objectives.length > 1) {
      setObjectives(objectives.filter((_, i) => i !== index));
    }
  };

  const handleComplete = async () => {
    console.log('[Template] handleComplete called');
    setSaving(true);
    setError(null);
    try {
      // Combine headline + elaboration for vision/strategy
      const visionText = visionElaboration
        ? `${visionHeadline}\n\n${visionElaboration}`
        : visionHeadline;
      const strategyText = strategyElaboration
        ? `${strategyHeadline}\n\n${strategyElaboration}`
        : strategyHeadline;

      const statements: StrategyStatements = {
        vision: visionText,
        strategy: strategyText,
        objectives: objectives.filter((o) => o.objective.trim()).map((o): Objective => ({
          id: o.id,
          title: o.title || undefined,
          objective: o.objective,
          pithy: o.objective, // For backwards compat
          omtm: o.omtm || undefined,
          aspiration: o.aspiration || undefined,
          explanation: '',
        })),
        opportunities: [],
        principles,
      };

      console.log('[Template] Sending to API:', statements);

      const response = await fetch(`/api/project/${projectId}/template-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements }),
      });

      console.log('[Template] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Template] API error:', errorData);
        throw new Error(errorData.error || 'Failed to save');
      }

      const { traceId } = await response.json();
      console.log('[Template] Success, redirecting to:', traceId);
      router.push(`/strategy/${traceId}`);
    } catch (err) {
      console.error('[Template] Error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'vision':
        return visionHeadline.trim().length >= 10;
      case 'strategy':
        return strategyHeadline.trim().length >= 10;
      case 'objectives':
        return objectives.some((o) => o.objective.trim());
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
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            {steps.map((s, i) => (
              <span
                key={s}
                className={i <= currentStepIndex ? 'text-ds-teal font-medium' : ''}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-ds-teal transition-all"
              style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Vision step */}
        {step === 'vision' && (
          <div className="bg-ds-teal rounded-lg p-6 space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-1">Vision</h3>
              <h1 className="text-xl font-bold text-white">What world are you creating?</h1>
            </div>

            {/* Coaching tip */}
            <div className="flex items-start gap-2">
              <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
              <p className="text-sm text-white/90 italic">
                Great visions are customer-centric (how does this change lives?), aspirational (lofty enough you may never fully achieve it), and unique to your business.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white mb-1.5 block">
                  Headline (4-15 words)
                </label>
                <Input
                  value={visionHeadline}
                  onChange={(e) => setVisionHeadline(e.target.value)}
                  placeholder="A world where..."
                  className="text-lg bg-white border-border"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white mb-1.5 block">
                  Elaboration (optional)
                </label>
                <Textarea
                  value={visionElaboration}
                  onChange={(e) => setVisionElaboration(e.target.value)}
                  placeholder="Why this matters and what it means for your customers..."
                  rows={2}
                  className="bg-white border-border"
                />
              </div>
            </div>

            <p className="text-xs text-white/60">
              Examples: "To create a better everyday life for many people" (IKEA) · "A world without poverty" (Oxfam) · "Bring inspiration to every athlete" (Nike)
            </p>
          </div>
        )}

        {/* Strategy step */}
        {step === 'strategy' && (
          <div className="bg-ds-teal rounded-lg p-6 space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-1">Strategy</h3>
              <h1 className="text-xl font-bold text-white">How will you get there?</h1>
            </div>

            {/* Coaching tip */}
            <div className="flex items-start gap-2">
              <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
              <p className="text-sm text-white/90 italic">
                Strategy is the coherent "how" — what you're choosing to do (and NOT do), how these choices work together, and why this approach will win.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white mb-1.5 block">
                  Headline (15-25 words)
                </label>
                <Textarea
                  value={strategyHeadline}
                  onChange={(e) => setStrategyHeadline(e.target.value)}
                  placeholder="We will focus on... by... while choosing not to..."
                  rows={2}
                  className="text-lg bg-white border-border"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white mb-1.5 block">
                  Elaboration (optional)
                </label>
                <Textarea
                  value={strategyElaboration}
                  onChange={(e) => setStrategyElaboration(e.target.value)}
                  placeholder="How this plays out. The mechanism..."
                  rows={3}
                  className="bg-white border-border"
                />
              </div>
            </div>

            <p className="text-xs text-white/60">
              Great strategy is as much about what you won't do as what you will.
            </p>
          </div>
        )}

        {/* Objectives step */}
        {step === 'objectives' && (
          <div className="space-y-4">
            <div className="bg-ds-teal rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-1">Objectives</h3>
                <h1 className="text-xl font-bold text-white">What are you trying to achieve?</h1>
              </div>

              {/* Coaching tip */}
              <div className="flex items-start gap-2">
                <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
                <p className="text-sm text-white/90 italic">
                  What you're trying to achieve NOW. Start with a verb. Be specific. Each objective has an OMTM (One Metric That Matters) — just the metric name, not a full target.
                </p>
              </div>

              <p className="text-xs text-white/60">
                Examples: "Capture more data" · "Improve speed of search results" · "Establish market leadership"
              </p>
            </div>

            {objectives.map((obj, index) => (
              <div key={obj.id} className="bg-ds-teal rounded-lg p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-semibold text-ds-neon uppercase tracking-wide">
                    Objective {index + 1}
                  </h4>
                  {objectives.length > 1 && (
                    <button
                      onClick={() => handleRemoveObjective(index)}
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-white mb-1.5 block">
                    Title (3-8 words)
                  </label>
                  <Input
                    value={obj.title}
                    onChange={(e) => handleUpdateObjective(index, 'title', e.target.value)}
                    placeholder="e.g., Achieve product-market fit"
                    className="bg-white border-border"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-white mb-1.5 block">
                    Objective statement
                  </label>
                  <Textarea
                    value={obj.objective}
                    onChange={(e) => handleUpdateObjective(index, 'objective', e.target.value)}
                    placeholder="e.g., Establish Lunastak as the default tool leaders reach for when they need strategic clarity"
                    rows={2}
                    className="bg-white border-border"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-white mb-1.5 block">
                      OMTM (metric name)
                    </label>
                    <Input
                      value={obj.omtm}
                      onChange={(e) => handleUpdateObjective(index, 'omtm', e.target.value)}
                      placeholder="e.g., Weekly Active Users"
                      className="bg-white border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white mb-1.5 block">
                      Aspiration (optional)
                    </label>
                    <Input
                      value={obj.aspiration}
                      onChange={(e) => handleUpdateObjective(index, 'aspiration', e.target.value)}
                      placeholder="e.g., 40% increase"
                      className="bg-white border-border"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={handleAddObjective}
              className="w-full border-ds-teal text-ds-teal hover:bg-ds-teal hover:text-white"
            >
              + Add another objective
            </Button>
          </div>
        )}

        {/* Principles step */}
        {step === 'principles' && (
          <div className="bg-ds-teal rounded-lg p-6 space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-1">Principles</h3>
              <h1 className="text-xl font-bold text-white">What trade-offs guide your decisions?</h1>
            </div>

            {/* Coaching tip */}
            <div className="flex items-start gap-2">
              <BadgeInfo className="w-4 h-4 text-white/90 mt-0.5 shrink-0" />
              <p className="text-sm text-white/90 italic">
                Good principles address real tensions. "Quality over speed" only matters if you sometimes sacrifice quality for speed. Frame as "X even over Y."
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <PrinciplesSection
                projectId={projectId}
                initialPrinciples={principles}
                onUpdate={setPrinciples}
              />
            </div>
          </div>
        )}

        {/* Review step */}
        {step === 'review' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-ds-teal">Review your Decision Stack</h1>
              <p className="text-muted-foreground mt-1">
                Here's what you've defined. You can always edit these later.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 bg-ds-teal rounded-lg">
                <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">Vision</h3>
                <p className="text-white font-medium">{visionHeadline}</p>
                {visionElaboration && (
                  <p className="text-white/80 text-sm mt-2">{visionElaboration}</p>
                )}
              </div>
              <div className="p-5 bg-ds-teal rounded-lg">
                <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">Strategy</h3>
                <p className="text-white font-medium">{strategyHeadline}</p>
                {strategyElaboration && (
                  <p className="text-white/80 text-sm mt-2">{strategyElaboration}</p>
                )}
              </div>
              <div className="p-5 bg-ds-teal rounded-lg">
                <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">Objectives</h3>
                <div className="space-y-3">
                  {objectives.filter((o) => o.objective.trim()).map((obj) => (
                    <div key={obj.id} className="text-white">
                      {obj.title && (
                        <p className="font-medium text-ds-neon text-sm">{obj.title}</p>
                      )}
                      <p>{obj.objective}</p>
                      {obj.omtm && (
                        <p className="text-sm text-white/70 mt-1">
                          OMTM: {obj.omtm}
                          {obj.aspiration && <span className="text-ds-neon"> · {obj.aspiration}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {principles.length > 0 && (
                <div className="p-5 bg-ds-teal rounded-lg">
                  <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-2">Principles</h3>
                  <ul className="space-y-1.5">
                    {principles.map((p) => (
                      <li key={p.id} className="text-white">
                        <strong className="text-ds-neon">{p.priority}</strong>
                        <span className="text-white/70"> even over </span>
                        {p.deprioritized}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
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
            <Button
              onClick={handleComplete}
              disabled={saving}
              className="bg-ds-teal text-white hover:bg-ds-teal/90"
            >
              {saving ? 'Saving...' : 'Complete & View Strategy'}
            </Button>
          ) : (
            <Button
              onClick={() => setStep(steps[currentStepIndex + 1])}
              disabled={!canProceed()}
              className="bg-ds-neon text-ds-teal hover:bg-ds-neon/90"
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
