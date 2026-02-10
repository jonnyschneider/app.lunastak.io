'use client';

import { useMemo, useState } from 'react';
import { StrategyStatements, Objective } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import { FakeDoorDialog } from './FakeDoorDialog';
import { OpportunitySection } from './OpportunitySection';
import { InlineTextEditor } from './InlineTextEditor';
import { ObjectiveInlineEditor } from './ObjectiveInlineEditor';
import { PrinciplesSection } from './PrinciplesSection';
import { getObjectiveTitle } from '@/lib/utils';

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  conversationId: string;
  traceId: string;
  projectId: string;
  onUpdate?: (strategy: StrategyStatements) => void;
}

export default function StrategyDisplay({ strategy, conversationId, traceId, projectId, onUpdate }: StrategyDisplayProps) {
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const [editingVision, setEditingVision] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [fakeDoorConfig, setFakeDoorConfig] = useState<{
    name: string;
    description: string;
    feature: string;
  } | null>(null);

  // Handle legacy objectives (string[]) by converting to new format
  const objectives: Objective[] = useMemo(() => {
    if (strategy.objectives.length === 0) return [];

    // Check if objectives are already in new format
    if (typeof strategy.objectives[0] === 'object' && 'id' in strategy.objectives[0]) {
      return strategy.objectives as Objective[];
    }

    // Convert legacy string[] format
    return convertLegacyObjectives(strategy.objectives as unknown as string[]);
  }, [strategy.objectives]);

  const handleFakeDoor = async (feature: string) => {
    console.log(`[Baseline] User clicked: ${feature}`);

    const featureConfig: Record<string, { name: string; description: string }> = {
      'Edit Vision': {
        name: 'Edit Vision',
        description: 'Edit and refine your vision statement.\n\nThis feature would let you directly modify the vision and regenerate related elements.',
      },
      'Edit Strategy': {
        name: 'Edit Strategy',
        description: 'Edit and refine your strategy statement.\n\nThis feature would let you directly modify the strategy and regenerate related elements.',
      },
      'Edit Objective': {
        name: 'Edit Objectives',
        description: 'Edit and refine your strategic objectives.\n\nThis feature would let you modify, add, or remove objectives with smart regeneration.',
      },
    };

    setFakeDoorConfig({
      ...featureConfig[feature],
      feature,
    });
    setFakeDoorOpen(true);
  };

  const handleFakeDoorInterest = async () => {
    if (!fakeDoorConfig) return;

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        traceId,
        eventType: 'fake_door_click',
        eventData: { feature: fakeDoorConfig.feature },
      }),
    }).catch(err => console.error('Failed to log event:', err));

    console.log(`User interested in: ${fakeDoorConfig.name}`);
  };


  const handleSaveVision = async (newText: string) => {
    try {
      const response = await fetch(`/api/project/${projectId}/strategy-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentType: 'vision',
          content: { text: newText },
          sourceType: 'user_edit',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      // Update local state
      if (onUpdate) {
        onUpdate({
          ...strategy,
          vision: newText,
        });
      }
      setEditingVision(false);
    } catch (error) {
      console.error('Failed to save vision:', error);
    }
  };

  const handleSaveStrategy = async (newText: string) => {
    try {
      const response = await fetch(`/api/project/${projectId}/strategy-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentType: 'strategy',
          content: { text: newText },
          sourceType: 'user_edit',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      if (onUpdate) {
        onUpdate({
          ...strategy,
          strategy: newText,
        });
      }
      setEditingStrategy(false);
    } catch (error) {
      console.error('Failed to save strategy:', error);
    }
  };

  const handleSaveObjective = async (updatedObjective: Objective) => {
    try {
      const response = await fetch(`/api/project/${projectId}/strategy-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentType: 'objective',
          componentId: updatedObjective.id,
          content: {
            title: updatedObjective.title,
            objective: updatedObjective.objective,
            pithy: updatedObjective.pithy || updatedObjective.objective,
            keyResults: updatedObjective.keyResults,
            metric: updatedObjective.metric,
            explanation: updatedObjective.explanation,
            successCriteria: updatedObjective.successCriteria,
          },
          sourceType: 'user_edit',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      if (onUpdate) {
        onUpdate({
          ...strategy,
          objectives: strategy.objectives.map((obj) =>
            obj.id === updatedObjective.id ? updatedObjective : obj
          ),
        });
      }
      setEditingObjectiveId(null);
    } catch (error) {
      console.error('Failed to save objective:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Strategy Output */}
      <div className="space-y-4">
        {/* Vision Card */}
        <div className="bg-white border border-[#0A2933] rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#0A2933]/70 uppercase tracking-wide">
              Vision
            </h3>
            {editingVision && (
              <span className="text-xs text-muted-foreground">Editing</span>
            )}
          </div>
          {editingVision ? (
            <InlineTextEditor
              value={strategy.vision}
              onSave={handleSaveVision}
              onCancel={() => setEditingVision(false)}
              placeholder="What is your aspirational future state?"
              minRows={4}
              coachingTip="Describe the world you're creating, not the product. Make it aspirational and future-focused (3+ years)."
            />
          ) : (
            <p
              onClick={() => setEditingVision(true)}
              className="text-lg font-medium text-[#0A2933] leading-relaxed cursor-pointer hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
            >
              {strategy.vision}
            </p>
          )}
        </div>

        {/* Strategy Card */}
        <div className="bg-white border border-[#0A2933] rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#0A2933]/70 uppercase tracking-wide">
              Strategy
            </h3>
            {editingStrategy && (
              <span className="text-xs text-muted-foreground">Editing</span>
            )}
          </div>
          {editingStrategy ? (
            <InlineTextEditor
              value={strategy.strategy}
              onSave={handleSaveStrategy}
              onCancel={() => setEditingStrategy(false)}
              placeholder="What are your coherent choices to achieve the vision?"
              minRows={4}
              coachingTip="Describe your coherent choices for achieving the vision. Focus on direction, not tactics (12-18 months)."
            />
          ) : (
            <p
              onClick={() => setEditingStrategy(true)}
              className="text-lg font-medium text-[#0A2933] leading-relaxed cursor-pointer hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
            >
              {strategy.strategy}
            </p>
          )}
        </div>

        {/* Objectives Grid */}
        <div>
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Objectives
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {objectives.map((objective) => (
              <div
                key={objective.id}
                className={editingObjectiveId === objective.id ? 'col-span-full' : ''}
              >
                {editingObjectiveId === objective.id ? (
                  <ObjectiveInlineEditor
                    objective={objective}
                    onSave={handleSaveObjective}
                    onCancel={() => setEditingObjectiveId(null)}
                  />
                ) : (
                  <div
                    onClick={() => setEditingObjectiveId(objective.id)}
                    className="bg-white border border-[#0A2933] rounded-lg p-4 hover:shadow-md transition-shadow relative cursor-pointer hover:bg-muted/30"
                  >
                    {/* Timeframe badge - top left */}
                    {(objective.keyResults?.[0]?.timeframe || objective.metric?.timeframe) && (
                      <span className="absolute top-3 left-3 inline-block px-2 py-0.5 text-xs font-medium bg-[#E0FF4F] text-[#0A2933] rounded">
                        {objective.keyResults?.[0]?.timeframe || objective.metric?.timeframe}
                      </span>
                    )}

                    {/* Objective title */}
                    <p className="text-xs font-semibold text-[#0A2933]/60 uppercase tracking-wide mt-6 mb-1">
                      {getObjectiveTitle(objective)}
                    </p>
                    {/* Objective text */}
                    <p className="text-sm font-medium text-[#0A2933] mb-3">
                      {objective.objective || objective.pithy}
                    </p>

                    {/* Key Results or Metric information */}
                    {objective.keyResults?.length ? (
                      <div className="text-xs text-[#7F556D]">
                        {objective.keyResults[0].signal}: {objective.keyResults[0].baseline} → {objective.keyResults[0].target}
                      </div>
                    ) : objective.metric?.direction && objective.metric?.metricName && (
                      <div className="flex items-center gap-2 text-xs text-[#7F556D]">
                        <span>
                          {objective.metric.direction === 'increase' ? '↑' : '↓'}
                        </span>
                        <span className="font-medium">
                          {objective.metric.metricName}
                        </span>
                        {objective.metric.metricValue && (
                          <>
                            <span>|</span>
                            <span>
                              {objective.metric.metricValue}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Opportunities Section */}
        <OpportunitySection projectId={projectId} objectives={objectives} />

        {/* Principles Section */}
        <div className="bg-white border border-[#0A2933] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-semibold text-[#0A2933]/70 uppercase tracking-wide">
              Principles
            </h3>
            <span className="text-xs text-gray-400">("even over" statements)</span>
          </div>
          <PrinciplesSection
            projectId={projectId}
            initialPrinciples={strategy.principles}
            onUpdate={(updated) => {
              if (onUpdate) {
                onUpdate({ ...strategy, principles: updated });
              }
            }}
          />
        </div>
      </div>

      {fakeDoorConfig && (
        <FakeDoorDialog
          open={fakeDoorOpen}
          onOpenChange={setFakeDoorOpen}
          featureName={fakeDoorConfig.name}
          description={fakeDoorConfig.description}
          onInterest={handleFakeDoorInterest}
        />
      )}

    </div>
  );
}
