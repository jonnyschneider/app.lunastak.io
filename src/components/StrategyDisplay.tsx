'use client';

import { useMemo, useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { StrategyStatements, Objective } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import { FakeDoorDialog } from './FakeDoorDialog';
import { OpportunitySection } from './OpportunitySection';
import { InlineTextEditor } from './InlineTextEditor';
import { ObjectiveInlineEditor } from './ObjectiveInlineEditor';
import { PrinciplesSection } from './PrinciplesSection';
import { getObjectiveTitle } from '@/lib/utils';
import { normalizeToOMTM } from '@/lib/objective-omtm-migration';

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
  const [newObjective, setNewObjective] = useState<Objective | null>(null);
  const [fakeDoorConfig, setFakeDoorConfig] = useState<{
    name: string;
    description: string;
    feature: string;
  } | null>(null);

  // Handle legacy objectives (string[]) by converting to new format and normalizing to OMTM
  const objectives: Objective[] = useMemo(() => {
    if (strategy.objectives.length === 0) return [];

    // Check if objectives are already in new format
    if (typeof strategy.objectives[0] === 'object' && 'id' in strategy.objectives[0]) {
      return (strategy.objectives as Objective[]).map(normalizeToOMTM);
    }

    // Convert legacy string[] format
    return convertLegacyObjectives(strategy.objectives as unknown as string[]).map(normalizeToOMTM);
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
            explanation: updatedObjective.explanation,
            // New simplified OMTM
            omtm: updatedObjective.omtm,
            aspiration: updatedObjective.aspiration,
            supportingMetrics: updatedObjective.supportingMetrics,
            // Legacy compat
            primaryMetric: updatedObjective.primaryMetric,
            objective: updatedObjective.objective,
            pithy: updatedObjective.pithy || updatedObjective.objective,
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

  const handleAddObjective = async (objective: Objective) => {
    try {
      const response = await fetch(`/api/project/${projectId}/strategy-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentType: 'objective',
          componentId: objective.id,
          content: {
            id: objective.id,
            title: objective.title,
            explanation: objective.explanation,
            omtm: objective.omtm,
            aspiration: objective.aspiration,
            supportingMetrics: objective.supportingMetrics,
            objective: objective.objective,
            pithy: objective.pithy || objective.objective,
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
          objectives: [...strategy.objectives, objective],
        });
      }
      setNewObjective(null);
    } catch (error) {
      console.error('Failed to add objective:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Strategy Output */}
      <div className="space-y-4">
        {/* Vision Card */}
        <div className="bg-ds-teal rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide">
              Vision
            </h3>
            {editingVision && (
              <span className="text-xs text-white/50">Editing</span>
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
              darkMode
            />
          ) : (
            <p
              onClick={() => setEditingVision(true)}
              className="text-lg font-medium text-white leading-relaxed cursor-pointer rounded-md p-2 -m-2"
            >
              {strategy.vision}
            </p>
          )}
        </div>

        {/* Strategy Card */}
        <div className="bg-ds-teal rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide">
              Strategy
            </h3>
            {editingStrategy && (
              <span className="text-xs text-white/50">Editing</span>
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
              darkMode
            />
          ) : (
            <p
              onClick={() => setEditingStrategy(true)}
              className="text-lg font-medium text-white leading-relaxed cursor-pointer rounded-md p-2 -m-2"
            >
              {strategy.strategy}
            </p>
          )}
        </div>

        {/* Objectives Grid */}
        <div>
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-ds-teal uppercase tracking-wide">
              Objectives
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {objectives.map((objective) => (
              <div
                key={objective.id}
                className={editingObjectiveId === objective.id ? 'col-span-full px-8 lg:px-16' : ''}
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
                    className="bg-ds-teal rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative cursor-pointer"
                  >
                    {/* Timeframe badge - top left */}
                    {(objective.primaryMetric?.timeframe || objective.keyResults?.[0]?.timeframe || objective.metric?.timeframe) && (
                      <span className="absolute top-3 left-3 inline-block px-2 py-0.5 text-xs font-medium bg-ds-neon text-ds-teal rounded">
                        {objective.primaryMetric?.timeframe || objective.keyResults?.[0]?.timeframe || objective.metric?.timeframe}
                      </span>
                    )}

                    {/* Objective title */}
                    <p className="text-xs font-semibold text-ds-neon uppercase tracking-wide mt-6 mb-1">
                      {getObjectiveTitle(objective)}
                    </p>
                    {/* Objective text */}
                    <p className="text-sm text-white mb-3">
                      {objective.objective || objective.pithy}
                    </p>

                    {/* OMTM - simplified format (preferred) */}
                    {objective.omtm ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-white">{objective.omtm}</span>
                        {objective.aspiration && (
                          <>
                            <span className="text-white/50">·</span>
                            <span className="text-ds-neon">{objective.aspiration}</span>
                          </>
                        )}
                      </div>
                    ) : objective.primaryMetric ? (
                      /* Legacy: primaryMetric format */
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-ds-neon">
                          {objective.primaryMetric.direction === 'increase' ? '↑' : '↓'}
                        </span>
                        <span className="font-medium text-white">
                          {objective.primaryMetric.name}
                        </span>
                        <span className="text-white/50">|</span>
                        <span className="text-ds-neon">
                          {objective.primaryMetric.baseline || '?'} → {objective.primaryMetric.target}
                        </span>
                      </div>
                    ) : objective.keyResults?.length ? (
                      /* Legacy: keyResults format */
                      <div className="text-xs">
                        <span className="text-white">{objective.keyResults[0].signal}:</span>{' '}
                        <span className="text-ds-neon">{objective.keyResults[0].baseline} → {objective.keyResults[0].target}</span>
                      </div>
                    ) : objective.metric?.direction && objective.metric?.metricName && (
                      /* Legacy: metric format */
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-ds-neon">
                          {objective.metric.direction === 'increase' ? '↑' : '↓'}
                        </span>
                        <span className="font-medium text-white">
                          {objective.metric.metricName}
                        </span>
                        {objective.metric.metricValue && (
                          <>
                            <span className="text-white/50">|</span>
                            <span className="text-ds-neon">
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

            {/* Add Objective */}
            {newObjective ? (
              <div className="col-span-full px-8 lg:px-16">
                <ObjectiveInlineEditor
                  objective={newObjective}
                  onSave={handleAddObjective}
                  onCancel={() => setNewObjective(null)}
                />
              </div>
            ) : !editingObjectiveId && (
              <div
                onClick={() => setNewObjective({
                  id: `obj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
                  explanation: '',
                  objective: '',
                })}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:border-muted-foreground/40 hover:bg-muted/50 transition-colors min-h-[120px]"
              >
                <div className="text-center">
                  <Plus className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1" />
                  <span className="text-sm text-muted-foreground/50">Add objective</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Opportunities Section */}
        <OpportunitySection projectId={projectId} objectives={objectives} />

        {/* Principles Section */}
        <div className="bg-ds-teal rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide">
              Principles
            </h3>
            <span className="text-xs text-white/50">("even over" statements)</span>
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
