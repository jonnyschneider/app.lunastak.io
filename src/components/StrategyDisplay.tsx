'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StrategyStatements, Objective } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import { OpportunitySection } from './OpportunitySection';
import { InlineTextEditor } from './InlineTextEditor';
import { ObjectiveInlineEditor } from './ObjectiveInlineEditor';
import { PrinciplesSection } from './PrinciplesSection';
import { FlipCard } from './FlipCard';
import { getObjectiveTitle } from '@/lib/utils';
import { normalizeToOMTM } from '@/lib/objective-omtm-migration';

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  conversationId: string;
  traceId: string;
  projectId: string;
  onUpdate?: (strategy: StrategyStatements) => void;
}

type EditingCard = {
  type: 'vision' | 'strategy' | 'objective' | 'opportunity' | 'principle'
  id?: string
  isNew?: boolean
} | null

export default function StrategyDisplay({ strategy, conversationId, traceId, projectId, onUpdate }: StrategyDisplayProps) {
  const [editingCard, setEditingCard] = useState<EditingCard>(null)

  const startEditing = useCallback((type: NonNullable<EditingCard>['type'], id?: string) => {
    setEditingCard({ type, id })
  }, [])

  const stopEditing = useCallback(() => {
    setEditingCard(null)
  }, [])

  const isEditing = editingCard !== null

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditing) {
        stopEditing()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, stopEditing])

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
      stopEditing();
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
      stopEditing();
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
      stopEditing();
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
      stopEditing();
    } catch (error) {
      console.error('Failed to add objective:', error);
    }
  };

  return (
    <div className="relative">
      {/* Overlay when editing */}
      {isEditing && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={stopEditing}
        />
      )}
      <div className="space-y-6">
        {/* Strategy Output */}
        <div className="space-y-4">
          {/* Vision Card */}
          <div className={cn(
            editingCard?.type === 'vision' && 'relative z-50'
          )}>
            <FlipCard
              front={
                <div className="bg-ds-teal rounded-lg p-6 shadow-sm">
                  <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-3">
                    Vision
                  </h3>
                  <p className="text-lg font-medium text-white leading-relaxed">
                    {strategy.vision}
                  </p>
                </div>
              }
              back={
                <div className="bg-ds-teal rounded-lg p-6 shadow-sm">
                  <div className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-ds-neon text-ds-teal rounded mb-3">
                    Explainer
                  </div>
                  <p className="text-sm text-white/70">No explainer yet</p>
                </div>
              }
              isEditing={editingCard?.type === 'vision'}
              onEditClick={() => startEditing('vision')}
              editForm={
                <div className="bg-white rounded-lg p-6 shadow-lg border">
                  <h3 className="text-xs font-semibold text-ds-teal uppercase tracking-wide mb-3">
                    Edit Vision
                  </h3>
                  <InlineTextEditor
                    value={strategy.vision}
                    onSave={handleSaveVision}
                    onCancel={stopEditing}
                    placeholder="What is your aspirational future state?"
                    minRows={3}
                    coachingTip="Describe the world you're creating, not the product."
                  />
                </div>
              }
            />
          </div>

          {/* Strategy Card */}
          <div className={cn(
            editingCard?.type === 'strategy' && 'relative z-50'
          )}>
            <FlipCard
              front={
                <div className="bg-ds-teal rounded-lg p-6 shadow-sm">
                  <h3 className="text-xs font-semibold text-ds-neon uppercase tracking-wide mb-3">
                    Strategy
                  </h3>
                  <p className="text-lg font-medium text-white leading-relaxed">
                    {strategy.strategy}
                  </p>
                </div>
              }
              back={
                <div className="bg-ds-teal rounded-lg p-6 shadow-sm">
                  <div className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-ds-neon text-ds-teal rounded mb-3">
                    Explainer
                  </div>
                  <p className="text-sm text-white/70">No explainer yet</p>
                </div>
              }
              isEditing={editingCard?.type === 'strategy'}
              onEditClick={() => startEditing('strategy')}
              editForm={
                <div className="bg-white rounded-lg p-6 shadow-lg border">
                  <h3 className="text-xs font-semibold text-ds-teal uppercase tracking-wide mb-3">
                    Edit Strategy
                  </h3>
                  <InlineTextEditor
                    value={strategy.strategy}
                    onSave={handleSaveStrategy}
                    onCancel={stopEditing}
                    placeholder="What are your coherent choices to achieve the vision?"
                    minRows={3}
                    coachingTip="Describe your coherent choices for achieving the vision. Focus on direction, not tactics (12-18 months)."
                  />
                </div>
              }
            />
          </div>

          {/* Objectives Grid */}
          <div>
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-ds-teal uppercase tracking-wide">
                Objectives
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {objectives.map((objective, index) => {
                const isEditingThis = editingCard?.type === 'objective' && editingCard.id === objective.id;
                return (
                  <div
                    key={objective.id}
                    className={cn(
                      isEditingThis && 'col-span-full relative z-50'
                    )}
                  >
                    <FlipCard
                      front={
                        <div className="bg-ds-teal rounded-lg p-6 shadow-sm min-h-[120px]">
                          {/* Numbered circle */}
                          <div className="flex items-center justify-center w-[26px] h-[26px] rounded-full border-[1.5px] border-white/30 text-xs font-semibold text-white mx-auto mb-3">
                            {index + 1}
                          </div>
                          {/* Title */}
                          <p className="text-[15px] font-semibold text-ds-neon mb-3 text-center">
                            {getObjectiveTitle(objective)}
                          </p>
                          {/* OMTM */}
                          {objective.omtm && (
                            <div className="mb-3">
                              <p className="text-sm font-semibold text-white text-center">{objective.omtm}</p>
                              {objective.aspiration && (
                                <p className="text-xs text-white/85 text-center mt-0.5">
                                  ↳ {objective.aspiration}
                                </p>
                              )}
                            </div>
                          )}
                          {/* Objective statement */}
                          {objective.objective && (
                            <p className="text-[13px] text-white/85 leading-relaxed text-center">
                              {objective.objective}
                            </p>
                          )}
                        </div>
                      }
                      back={
                        <div className="bg-ds-teal rounded-lg p-4 shadow-sm min-h-[120px]">
                          <div className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-ds-neon text-ds-teal rounded mb-2">
                            Explainer
                          </div>
                          {objective.objective && (
                            <p className="text-sm text-white mb-2">{objective.objective}</p>
                          )}
                          {objective.explanation && (
                            <p className="text-xs text-white/70 leading-relaxed">{objective.explanation}</p>
                          )}
                        </div>
                      }
                      isEditing={isEditingThis}
                      onEditClick={() => startEditing('objective', objective.id)}
                      editForm={
                        <ObjectiveInlineEditor
                          objective={objective}
                          onSave={handleSaveObjective}
                          onCancel={stopEditing}
                        />
                      }
                    />
                  </div>
                );
              })}

              {/* Add Objective */}
              {editingCard?.type === 'objective' && editingCard.isNew ? (
                <div className="col-span-full relative z-50">
                  <ObjectiveInlineEditor
                    objective={{
                      id: editingCard.id || `obj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
                      explanation: '',
                      objective: '',
                    }}
                    onSave={handleAddObjective}
                    onCancel={stopEditing}
                  />
                </div>
              ) : !(editingCard?.type === 'objective') && (
                <div
                  onClick={() => {
                    const newId = `obj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
                    setEditingCard({ type: 'objective', id: newId, isNew: true });
                  }}
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
          <div className={cn(
            editingCard?.type === 'opportunity' && 'relative z-50'
          )}>
            <OpportunitySection
              projectId={projectId}
              objectives={objectives}
              editingCard={editingCard}
              onStartEditing={(id: string) => startEditing('opportunity', id)}
              onStopEditing={stopEditing}
            />
          </div>

          {/* Principles Section */}
          <div className={cn(
            editingCard?.type === 'principle' && 'relative z-50'
          )}>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xs font-semibold text-ds-teal uppercase tracking-wide">
                Principles
              </h3>
              <span className="text-xs text-muted-foreground">("even over" statements)</span>
            </div>
            <PrinciplesSection
              projectId={projectId}
              initialPrinciples={strategy.principles}
              editingCard={editingCard}
              onStartEditing={(id: string) => startEditing('principle', id)}
              onStopEditing={stopEditing}
              onUpdate={(updated) => {
                if (onUpdate) {
                  onUpdate({ ...strategy, principles: updated });
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
